import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { generateRuleFromFileContent } from "@/lib/aiService";

const UPLOAD_DIR = join(tmpdir(), "uploads");

/** 解析 Excel 为可读文本 */
function parseExcelContent(filePath: string): string {
  const XLSX = require("xlsx");
  const wb = XLSX.readFile(filePath);
  const texts: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    texts.push(`[Sheet: ${name}]\n${JSON.stringify(data)}`);
  }
  return texts.join("\n\n");
}

/** 解析 Word 为可读文本 */
function parseWordContent(filePath: string): string {
  const mammoth = require("mammoth");
  const result = mammoth.extractRawText({ path: filePath });
  return result.value;
}

/** 解析 PDF 为可读文本 */
function parsePdfContent(filePath: string): string {
  const pdfParse = require("pdf-parse");
  const buf = readFileSync(filePath);
  const result = pdfParse(buf);
  return result.text;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, fileName, fileType, fileContent } = body;

    let content: string;

    // 如果直接传了文件内容，直接用
    if (fileContent) {
      content = fileContent;
    } else if (fileId) {
      // 从 tmp 目录读取文件并解析
      const ext = fileName?.split(".").pop()?.toLowerCase() || "xlsx";
      const filePath = join(UPLOAD_DIR, `${fileId}.${ext}`);
      if (!existsSync(filePath)) {
        return NextResponse.json({ error: "上传的文件已过期，请重新上传" }, { status: 400 });
      }

      if (fileType === "excel" || ext === "xlsx" || ext === "xls") {
        content = parseExcelContent(filePath);
      } else if (fileType === "word" || ext === "docx") {
        content = parseWordContent(filePath);
      } else {
        content = parsePdfContent(filePath);
      }
    } else {
      return NextResponse.json({ error: "缺少 fileId 或 fileContent" }, { status: 400 });
    }

    const result = await generateRuleFromFileContent(content, fileType || "excel", fileName || "unknown");

    return NextResponse.json({
      success: true,
      config: result.config,
      name: result.name,
      confidence: result.confidence,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "AI 规则生成失败" }, { status: 500 });
  }
}
