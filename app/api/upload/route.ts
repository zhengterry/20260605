import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

const UPLOAD_DIR = join(process.cwd(), "uploads");

function ensureDir() {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function POST(request: NextRequest) {
  try {
    ensureDir();
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "未收到文件" }, { status: 400 });
    }

    // 验证文件类型
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type) &&
        !file.name.match(/\.(xlsx|xls|docx|pdf)$/i)) {
      return NextResponse.json({
        error: `不支持的文件格式: ${file.name}。请上传 Excel(.xlsx/.xls)、Word(.docx) 或 PDF 文件`,
      }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileId = uuidv4();
    const ext = file.name.split(".").pop()?.toLowerCase() || "xlsx";
    const fileName = `${fileId}.${ext}`;
    const filePath = join(UPLOAD_DIR, fileName);

    writeFileSync(filePath, buffer);

    // 判断文件类型
    let fileType: "excel" | "word" | "pdf";
    if (ext === "xlsx" || ext === "xls") fileType = "excel";
    else if (ext === "docx") fileType = "word";
    else fileType = "pdf";

    return NextResponse.json({
      success: true,
      fileId,
      fileName: file.name,
      fileType,
      size: buffer.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "文件上传失败" }, { status: 500 });
  }
}
