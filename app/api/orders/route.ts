import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { sql } from "@/lib/db";

function rowToOrder(row: any) {
  return {
    id: row.id,
    externalCode: row.external_code,
    storeName: row.store_name,
    receiverName: row.receiver_name,
    receiverPhone: row.receiver_phone,
    receiverAddress: row.receiver_address,
    items: typeof row.items === "string" ? JSON.parse(row.items) : row.items,
    status: row.status,
    batchId: row.batch_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const s = sql();
    await s`CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, items JSONB NOT NULL DEFAULT '[]',
      external_code TEXT, store_name TEXT,
      receiver_name TEXT, receiver_phone TEXT, receiver_address TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      batch_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const batchId = searchParams.get("batchId");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const offset = (page - 1) * pageSize;

    let rows: any[] = [];
    let total = 0;

    if (status) {
      const countResult = await s`SELECT COUNT(*)::int as total FROM orders WHERE status = ${status}`;
      total = countResult[0]?.total || 0;
      rows = await s`SELECT * FROM orders WHERE status = ${status} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
    } else if (batchId) {
      const countResult = await s`SELECT COUNT(*)::int as total FROM orders WHERE batch_id = ${batchId}`;
      total = countResult[0]?.total || 0;
      rows = await s`SELECT * FROM orders WHERE batch_id = ${batchId} ORDER BY created_at DESC`;
    } else if (search) {
      const q = "%" + search + "%";
      const countResult = await s`SELECT COUNT(*)::int as total FROM orders WHERE external_code ILIKE ${q} OR store_name ILIKE ${q}`;
      total = countResult[0]?.total || 0;
      rows = await s`SELECT * FROM orders WHERE external_code ILIKE ${q} OR store_name ILIKE ${q} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
    } else {
      const countResult = await s`SELECT COUNT(*)::int as total FROM orders`;
      total = countResult[0]?.total || 0;
      rows = await s`SELECT * FROM orders ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
    }
    return NextResponse.json({
      orders: rows.map(rowToOrder),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error: any) {
    console.error("GET /api/orders:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const s = sql();
    await s`CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, items JSONB NOT NULL DEFAULT '[]',
      external_code TEXT, store_name TEXT,
      receiver_name TEXT, receiver_phone TEXT, receiver_address TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      batch_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;
    const body = await request.json();
    const orders = body.orders || [body];
    const batchId = uuidv4();
    const now = new Date().toISOString();
    const results: string[] = [];

    for (const order of orders) {
      const id = uuidv4();
      await s`INSERT INTO orders (id,external_code,store_name,receiver_name,receiver_phone,receiver_address,items,status,batch_id,created_at,updated_at)
             VALUES (${id},${order.externalCode||null},${order.storeName||null},${order.receiverName||null},${order.receiverPhone||null},${order.receiverAddress||null},${JSON.stringify(order.items||[])},${order.status||"pending"},${batchId},${now},${now})`;
      results.push(id);
    }

    return NextResponse.json({ success: true, batchId, orderIds: results, count: results.length });
  } catch (error: any) {
    console.error("POST /api/orders:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const s = sql();
    const body = await request.json();
    const { id, status } = body;
    if (!id || !status) return NextResponse.json({ error: "缺少 id 或 status" }, { status: 400 });

    const now = new Date().toISOString();
    await s`UPDATE orders SET status = ${status}, updated_at = ${now} WHERE id = ${id}`;

    const rows = await s`SELECT * FROM orders WHERE id = ${id}`;
    return NextResponse.json({ order: rowToOrder(rows[0]) });
  } catch (error: any) {
    console.error("PUT /api/orders:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
