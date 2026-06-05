import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { sql, ensureInit } from "@/lib/db";

const SEED_FILE = join(process.cwd(), "data", "rules.json");

async function autoSeed() {
  await ensureInit();
  const s = sql();
  const rows = await s`SELECT COUNT(*)::int as c FROM rules`;
  if (rows[0].c > 0) return;
  if (!existsSync(SEED_FILE)) return;

  const rulesData = JSON.parse(readFileSync(SEED_FILE, "utf-8"));
  for (const rule of rulesData.rules || []) {
    await s`INSERT INTO rules (id,name,description,file_type,config,ai_generated,confidence,created_at,updated_at)
            VALUES (${rule.id},${rule.name},${rule.description||""},${rule.fileType},
                    ${JSON.stringify(rule.config)},${rule.aiGenerated??false},
                    ${rule.confidence||null},${rule.createdAt},${rule.updatedAt})
            ON CONFLICT (id) DO NOTHING`;
  }
  console.log(`[autoSeed] 已导入 ${rulesData.rules.length} 条默认规则`);
}

function rowToRule(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    fileType: row.file_type,
    config: typeof row.config === "string" ? JSON.parse(row.config) : row.config,
    aiGenerated: row.ai_generated ?? false,
    confidence: row.confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    await autoSeed();
    const s = sql();
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const search = searchParams.get("search");

    let rows: any[];
    if (search) {
      rows = await s`SELECT * FROM rules WHERE name ILIKE ${"%" + search + "%"} OR description ILIKE ${"%" + search + "%"} ORDER BY updated_at DESC`;
    } else if (limit) {
      rows = await s`SELECT * FROM rules ORDER BY updated_at DESC LIMIT ${parseInt(limit)}`;
    } else {
      rows = await s`SELECT * FROM rules ORDER BY updated_at DESC`;
    }

    return NextResponse.json({ rules: rows.map(rowToRule) });
  } catch (error: any) {
    console.error("GET /api/rules:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureInit();
    const s = sql();
    const body = await request.json();
    const id = uuidv4();
    const now = new Date().toISOString();

    await s`INSERT INTO rules (id,name,description,file_type,config,ai_generated,confidence,created_at,updated_at)
           VALUES (${id},${body.name||""},${body.description||""},${body.fileType||"excel"},
                   ${JSON.stringify(body.config||{})},${body.aiGenerated??false},
                   ${body.confidence||null},${now},${now})`;

    const rows = await s`SELECT * FROM rules WHERE id = ${id}`;
    return NextResponse.json({ rule: rowToRule(rows[0]) });
  } catch (error: any) {
    console.error("POST /api/rules:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureInit();
    const s = sql();
    const body = await request.json();
    const { id, name, description, fileType, config, aiGenerated, confidence } = body;
    if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

    const now = new Date().toISOString();
    await s`UPDATE rules SET name=${name},description=${description||""},file_type=${fileType||"excel"},
            config=${JSON.stringify(config||{})},ai_generated=${aiGenerated??false},
            confidence=${confidence||null},updated_at=${now} WHERE id=${id}`;

    const rows = await s`SELECT * FROM rules WHERE id = ${id}`;
    return NextResponse.json({ rule: rowToRule(rows[0]) });
  } catch (error: any) {
    console.error("PUT /api/rules:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureInit();
    const s = sql();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

    await s`DELETE FROM rules WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/rules:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
