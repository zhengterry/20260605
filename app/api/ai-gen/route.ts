import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { generateRuleFromFileContent } from "@/lib/aiService";

const UPLOAD_DIR = join(process.cwd(), "uploads");

/** 解析 Excel 为可读文本 */
function parseExcelContent(filePath: string): string {
  const XLSX = require("xlsx");
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const parts: string[] = [];

  for (const sn of wb.SheetNames.slice(0, 5)) {
    const ws = wb.Sheets[sn];
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    parts.push(`--- Sheet: "${sn}" (${data.length}行 × ${data[0]?.length || 0}列) ---`);
    for (let i = 0; i < Math.min(data.length, 35); i++) {
      parts.push(`行${String(i).padStart(3)}: ` + data[i].map((c: any) => String(c ?? "").trim()).join(" | "));
    }
    if (data.length > 35) parts.push(`... 还有 ${data.length - 35} 行`);
  }
  return parts.join("\n");
}

/** 解析 Word (.docx) 为可读文本 */
async function parseWordContent(filePath: string): Promise<string> {
  const mammoth = require("mammoth");
  const buf = readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value || "(Word 文件内容为空)";
}

/** 解析 PDF 为可读文本 */
async function parsePdfContent(filePath: string): Promise<string> {
  const pdfParse = require("pdf-parse");
  const buf = readFileSync(filePath);
  const data = await pdfParse(buf);
  return data.text || "(PDF 文件内容为空)";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, fileName, fileType, fileContent } = body;

    let content = fileContent || "";
    const ext = (fileName || "").split(".").pop()?.toLowerCase() || fileType;

    // 如果有 fileId，从 uploads 目录读取文件并解析
    if (fileId) {
      const filePath = join(UPLOAD_DIR, `${fileId}.${ext}`);
      if (!existsSync(filePath)) {
        return NextResponse.json({ error: "上传的文件已过期，请重新上传" }, { status: 400 });
      }

      if (ext === "xlsx" || ext === "xls") {
        content = parseExcelContent(filePath);
      } else if (ext === "docx" || ext === "doc") {
        content = await parseWordContent(filePath);
      } else if (ext === "pdf") {
        content = await parsePdfContent(filePath);
      } else {
        content = readFileSync(filePath, "utf-8");
      }
    }

    if (!content || content.trim().length < 10) {
      return NextResponse.json({ error: "未能提取到有效的文件内容" }, { status: 400 });
    }

    const result = await generateRuleFromFileContent(content, fileType || ext, fileName || "未知文件");

    return NextResponse.json({
      success: true,
      config: result.config,
      name: result.name,
      confidence: result.confidence,
    });
  } catch (error: any) {
    console.error("AI 规则生成失败:", error.message);
    return NextResponse.json({ error: error.message || "AI 规则生成失败" }, { status: 500 });
  }
}
