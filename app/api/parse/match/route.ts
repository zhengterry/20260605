import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { sql } from "@/lib/db";
import { executeRule } from "@/lib/ruleEngine";
import { generateRuleFromFileContent } from "@/lib/aiService";

const UPLOAD_DIR = join(process.cwd(), "uploads");

// ---- 文件内容解析器 ----
function parseExcel(filePath: string): any[][][] {
  const XLSX = require("xlsx");
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });
  return wb.SheetNames.map((sn: string) =>
    XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: "" })
  );
}

async function parsePdf(filePath: string): Promise<string[]> {
  const pdfParse = require("pdf-parse");
  const buf = readFileSync(filePath);
  const data = await pdfParse(buf);
  return data.text.split("\n").filter((l: string) => l.trim());
}

async function parseWord(filePath: string): Promise<string[]> {
  const mammoth = require("mammoth");
  const buf = readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer: buf });
  return (result.value || "").split("\n").filter((l: string) => l.trim());
}

// ---- AI 文件内容提取（服务端已解析好的文本） ----
function extendExcelForAI(filePath: string): string {
  const XLSX = require("xlsx");
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const parts: string[] = [];
  for (const sn of wb.SheetNames.slice(0, 3)) {
    const ws = wb.Sheets[sn];
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    parts.push(`--- Sheet: "${sn}" (${data.length}行) ---`);
    for (let i = 0; i < Math.min(data.length, 30); i++) {
      parts.push(data[i].map((c: any) => String(c ?? "").trim()).join(" | "));
    }
  }
  return parts.join("\n");
}

async function extendFileForAI(filePath: string, fileType: string): Promise<string> {
  if (fileType === "excel") return extendExcelForAI(filePath);
  if (fileType === "pdf") return (await parsePdf(filePath)).join("\n");
  if (fileType === "word") return (await parseWord(filePath)).join("\n");
  return "";
}

// ---- 主 API ----
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, fileName, fileType } = body;

    if (!fileId || !fileType) {
      return NextResponse.json({ error: "缺少 fileId 或 fileType" }, { status: 400 });
    }

    const ext = (fileName || "").split(".").pop()?.toLowerCase();
    const filePath = join(UPLOAD_DIR, `${fileId}.${ext || fileType === "excel" ? "xlsx" : fileType}`);

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "文件已过期，请重新上传" }, { status: 400 });
    }

    // 加载匹配文件类型的所有本地规则
    const s = sql();
    await s`CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
      file_type TEXT NOT NULL, config JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;
    const rules = await s`SELECT * FROM rules WHERE file_type = ${fileType} ORDER BY updated_at DESC`;

    // 步骤1：逐个尝试本地规则
    for (const rule of rules) {
      try {
        const config = typeof rule.config === "string" ? JSON.parse(rule.config) : rule.config;
        let rawData: any;

        if (fileType === "excel") {
          rawData = parseExcel(filePath);
        } else if (fileType === "pdf") {
          rawData = await parsePdf(filePath);
        } else if (fileType === "word") {
          rawData = await parseWord(filePath);
        } else {
          continue;
        }

        const orders = executeRule(rawData, config, fileType as any);
        if (orders.length > 0) {
          return NextResponse.json({
            success: true,
            source: "local",
            ruleId: rule.id,
            ruleName: rule.name,
            config,
            orders,
            stats: { totalRows: orders.reduce((s, o) => s + o.items.length, 0), successCount: orders.length, errorCount: 0, parseTime: 0 },
          });
        }
      } catch {
        // 规则不匹配，继续尝试下一条
      }
    }

    // 步骤2：所有本地规则都失败 → 调用 AI 生成规则
    console.log("[match] 本地规则均未匹配，启动 AI 生成...");

    const aiContent = await extendFileForAI(filePath, fileType);
    const aiResult = await generateRuleFromFileContent(aiContent, fileType, fileName || "未知文件");

    // 用 AI 生成的规则再解析一次
    let rawData: any;
    if (fileType === "excel") {
      rawData = parseExcel(filePath);
    } else if (fileType === "pdf") {
      rawData = await parsePdf(filePath);
    } else if (fileType === "word") {
      rawData = await parseWord(filePath);
    }

    const orders = executeRule(rawData, aiResult.config, fileType as any);

    return NextResponse.json({
      success: true,
      source: "ai",
      ruleName: aiResult.name,
      config: aiResult.config,
      orders,
      stats: { totalRows: orders.reduce((s, o) => s + o.items.length, 0), successCount: orders.length, errorCount: 0, parseTime: 0 },
    });
  } catch (error: any) {
    console.error("[match] 解析失败:", error.message);
    return NextResponse.json({ error: error.message || "解析失败" }, { status: 500 });
  }
}
