import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { executeRule } from "@/lib/ruleEngine";
import { generateRuleFromFileContent } from "@/lib/aiService";

// ---- 内存文件解析器（Buffer → 结构化数据） ----

function parseExcel(buffer: Buffer): any[][][] {
  const XLSX = require("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheets: any[][][] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    sheets.push(XLSX.utils.sheet_to_json(ws, { header: 1 }));
  }
  return sheets;
}

function excelToText(buffer: Buffer): string {
  const XLSX = require("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const texts: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    texts.push(`[Sheet: ${name}]\n${JSON.stringify(XLSX.utils.sheet_to_json(ws, { header: 1 }))}`);
  }
  return texts.join("\n\n");
}

function parseWord(buffer: Buffer): any[][][] {
  const mammoth = require("mammoth");
  const result = mammoth.extractRawText({ buffer });
  const lines = result.value.split("\n").filter((l: string) => l.trim());
  return [[lines.map((l: string) => [l])]];
}

function wordToText(buffer: Buffer): string {
  const mammoth = require("mammoth");
  const result = mammoth.extractRawText({ buffer });
  return result.value;
}

function parsePdf(buffer: Buffer): any[][][] {
  const pdfParse = require("pdf-parse");
  const result = pdfParse(buffer);
  const lines = result.text.split("\n").filter((l: string) => l.trim());
  return [[lines.map((l: string) => [l])]];
}

function pdfToText(buffer: Buffer): string {
  const pdfParse = require("pdf-parse");
  const result = pdfParse(buffer);
  return result.text;
}

function fileToText(buffer: Buffer, fileType: string): string {
  if (fileType === "excel") return excelToText(buffer);
  if (fileType === "word") return wordToText(buffer);
  return pdfToText(buffer);
}

// ---- API ----

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "未收到文件" }, { status: 400 });
    }

    // 判断文件类型
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    let fileType: "excel" | "word" | "pdf";
    if (ext === "xlsx" || ext === "xls") fileType = "excel";
    else if (ext === "docx") fileType = "word";
    else if (ext === "pdf") fileType = "pdf";
    else {
      return NextResponse.json({ error: `不支持的文件格式: ${file.name}` }, { status: 400 });
    }

    // 全部在内存中处理，不写磁盘
    const buffer = Buffer.from(await file.arrayBuffer());

    // 解析文件为结构化数据
    let rawData: any[][][];
    switch (fileType) {
      case "excel": rawData = parseExcel(buffer); break;
      case "word":  rawData = parseWord(buffer);  break;
      case "pdf":   rawData = parsePdf(buffer);   break;
    }

    // 步骤1：尝试本地规则匹配
    try {
      const s = sql();
      const rules = await s`SELECT * FROM rules WHERE file_type = ${fileType} ORDER BY created_at DESC`;
      for (const rule of rules) {
        try {
          const config = typeof rule.config === "string" ? JSON.parse(rule.config) : rule.config;
          const orders = executeRule(rawData, config, fileType);
          if (orders.length > 0) {
            return NextResponse.json({
              success: true,
              source: "local",
              ruleId: rule.id,
              ruleName: rule.name,
              config,
              orders,
            });
          }
        } catch {
          // 当前规则不匹配，继续尝试下一个
        }
      }
    } catch {
      // 数据库不可用时跳过本地规则
    }

    // 步骤2：本地规则全失败 → AI 生成规则
    const textContent = fileToText(buffer, fileType);
    const aiResult = await generateRuleFromFileContent(textContent, fileType, file.name);

    // 用 AI 生成的规则重新解析
    const orders = executeRule(rawData, aiResult.config, fileType);

    return NextResponse.json({
      success: true,
      source: "ai",
      ruleName: aiResult.name,
      config: aiResult.config,
      orders,
    });
  } catch (error: any) {
    console.error("智能匹配失败:", error);
    return NextResponse.json({ error: error.message || "智能匹配失败" }, { status: 500 });
  }
}
