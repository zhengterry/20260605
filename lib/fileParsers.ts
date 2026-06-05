"use client";

/**
 * 前端文件解析器 - 支持 Excel (.xlsx/.xls) 解析
 * 使用 xlsx (SheetJS) 库
 */

export async function parseExcelFile(file: File): Promise<any[][][]> {
  const XLSX = await import("xlsx");

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const result: any[][][] = [];
  const sheetNames = workbook.SheetNames;

  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    // 使用 raw:true 保留原始格式，header:1 返回数组格式
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: true,
      defval: "",
    });
    result.push(jsonData as any[][]);
  }

  return result;
}
