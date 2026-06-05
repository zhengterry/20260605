import { neon } from "@neondatabase/serverless";

const connectionString = () => process.env.POSTGRES_URL || "";

export function sql() {
  return neon(connectionString());
}

export async function initDatabase() {
  const s = sql();

  // rules 表
  await s`CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
    file_type TEXT NOT NULL CHECK (file_type IN ('excel','word','pdf')),
    config JSONB NOT NULL DEFAULT '{}', ai_generated BOOLEAN DEFAULT false,
    confidence TEXT CHECK (confidence IN ('high','medium','low')),
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;

  // orders 表
  await s`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, external_code TEXT, store_name TEXT,
    receiver_name TEXT, receiver_phone TEXT, receiver_address TEXT,
    items JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','failed')),
    batch_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;

  await s`CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC)`;
  await s`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`;
  await s`CREATE INDEX IF NOT EXISTS idx_orders_batch ON orders(batch_id)`;
}

let _initialized = false;
export async function ensureInit() {
  if (!_initialized) { await initDatabase(); _initialized = true; }
}
