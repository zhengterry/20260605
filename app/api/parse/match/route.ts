import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { sql } from "@/lib/db";
import { executeRule } from "@/lib/ruleEngine";
import { generateRuleFromFileContent } from "@/lib/aiService";

const UPLOAD_DIR = join(tmpdir(), "uploads");

// ---- 文件内容解析器 ----
function parseExcel(filePath: string): any[][][] {
  const XLSX = require("xlsx");
  const wb = XLSX.readFile(filePath);
  const sheets: any[][][] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    sheets.push(data);
  }
  return sheets;
}

function parseWord(filePath: string): any[][][] {
  const mammoth = require("mammoth");
  const result = mammoth.extractRawText({ path: filePath });
  const lines = result.value.split("\n").filter((l: string) => l.trim());
  return [[lines.map((l: string) => [l])]];
}

function parsePdf(filePath: string): any[][][] {
  const pdfParse = require("pdf-parse");
  const buf = readFileSync(filePath);
  const result = pdfParse(buf);
  const lines = result.text.split("\n").filter((l: string) => l.trim());
  return [[lines.map((l: string) => [l])]];
}

function extendFileForAI(filePath: string, fileType: string): string {
  if (fileType === "excel" || fileType === "xlsx" || fileType === "xls") {
    const XLSX = require("xlsx");
    const wb = XLSX.readFile(filePath);
    const texts: string[] = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      texts.push(`[Sheet: ${name}]\n${JSON.stringify(XLSX.utils.sheet_to_json(ws, { header: 1 }))}`);
    }
    return texts.join("\n\n");
  }
  if (fileType === "word" || fileType === "docx") {
    const mammoth = require("mammoth");
    const result = mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  const pdfParse = require("pdf-parse");
  const buf = readFileSync(filePath);
  const result = pdfParse(buf);
  return result.text;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, fileName, fileType } = body;

    if (!fileId) {
      return NextResponse.json({ error: "缺少 fileId" }, { status: 400 });
    }

    const ext = fileName?.split(".").pop()?.toLowerCase() || "xlsx";
    const filePath = join(UPLOAD_DIR, `${fileId}.${ext}`);
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "文件已过期，请重新上传" }, { status: 400 });
    }

    let rawData: any[][][];

    if (fileType === "excel" || ext === "xlsx" || ext === "xls") {
      rawData = parseExcel(filePath);
    } else if (fileType === "word" || ext === "docx") {
      rawData = parseWord(filePath);
    } else {
      rawData = parsePdf(filePath);
    }

    // 步骤1：尝试本地规则匹配
    const rules = await sql`SELECT * FROM rules WHERE file_type = ${fileType || "excel"} ORDER BY created_at DESC`;
    for (const rule of rules) {
      try {
        const config = typeof rule.config === "string" ? JSON.parse(rule.config) : rule.config;
        const orders = executeRule(rawData, config, fileType || "excel");
        if (orders.length > 0) {
          return NextResponse.json({
            success: true,
            source: "local",
            ruleId: rule.id,
            ruleName: rule.name,
            orders,
          });
        }
      } catch {
        // 当前规则不匹配，继续尝试下一个
      }
    }

    // 步骤2：本地规则全失败 → AI 生成规则
    const aiContent = extendFileForAI(filePath, fileType || "excel");
    const aiResult = await generateRuleFromFileContent(aiContent, fileType || "excel", fileName || "unknown");

    rawData = fileType === "excel" ? parseExcel(filePath) :
              fileType === "word" ? parseWord(filePath) : parsePdf(filePath);

    const orders = executeRule(rawData, aiResult.config, fileType || "excel");

    return NextResponse.json({
      success: true,
      source: "ai",
      ruleName: aiResult.name,
      orders,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "智能匹配失败" }, { status: 500 });
  }
}
