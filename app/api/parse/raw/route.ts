import { NextRequest, NextResponse } from "next/server";

// ---- 纯内存文件解析器 ----

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

function parseWord(buffer: Buffer): any[][][] {
  const mammoth = require("mammoth");
  const result = mammoth.extractRawText({ buffer });
  const lines = result.value.split("\n").filter((l: string) => l.trim());
  return [[lines.map((l: string) => [l])]];
}

async function parsePdf(buffer: Buffer): Promise<any[][][]> {
  const pdfParse = require("pdf-parse");
  const result = await pdfParse(buffer);
  const lines = result.text.split("\n").filter((l: string) => l.trim());
  return [[lines.map((l: string) => [l])]];
}

// ---- API：接收文件，返回解析后的原始数据（不存盘、不调 AI） ----

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "未收到文件" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    let fileType: string;
    if (ext === "xlsx" || ext === "xls") fileType = "excel";
    else if (ext === "docx") fileType = "word";
    else if (ext === "pdf") fileType = "pdf";
    else {
      return NextResponse.json({ error: `不支持的文件格式: ${file.name}` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let rawData: any[][][];
    switch (fileType) {
      case "excel": rawData = parseExcel(buffer); break;
      case "word":  rawData = parseWord(buffer);  break;
      default:      rawData = await parsePdf(buffer);   break;
    }

    return NextResponse.json({
      success: true,
      fileType,
      fileName: file.name,
      rawData,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "文件解析失败" }, { status: 500 });
  }
}
