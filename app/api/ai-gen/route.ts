import { NextRequest, NextResponse } from "next/server";
import { generateRuleFromFileContent } from "@/lib/aiService";

// ---- 内存文件文本提取 ----

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

function wordToText(buffer: Buffer): string {
  const mammoth = require("mammoth");
  const result = mammoth.extractRawText({ buffer });
  return result.value;
}

async function pdfToText(buffer: Buffer): Promise<string> {
  const pdfParse = require("pdf-parse");
  const result = await pdfParse(buffer);
  return result.text;
}

// ---- API：直接接收文件，内存解析后调用 AI 生成规则 ----

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "未收到文件" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    let fileType: "excel" | "word" | "pdf";
    if (ext === "xlsx" || ext === "xls") fileType = "excel";
    else if (ext === "docx") fileType = "word";
    else if (ext === "pdf") fileType = "pdf";
    else {
      return NextResponse.json({ error: `不支持的文件格式: ${file.name}` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 提取文本内容
    let content: string;
    switch (fileType) {
      case "excel": content = excelToText(buffer); break;
      case "word":  content = wordToText(buffer);  break;
      case "pdf":   content = await pdfToText(buffer);   break;
    }

    // 调用 AI 生成规则
    const result = await generateRuleFromFileContent(content, fileType, file.name);

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
