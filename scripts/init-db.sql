-- ============================================
-- AI万能导入V2 数据库初始化脚本
-- 目标库: Neon PostgreSQL
-- ============================================

-- 删除旧表（如果存在）
DROP TABLE IF EXISTS orders CASCADE;

-- 重建 orders 表（新 Schema）
CREATE TABLE orders (
    id              TEXT PRIMARY KEY,
    external_code   TEXT,
    store_name      TEXT,
    receiver_name   TEXT,
    receiver_phone  TEXT,
    receiver_address TEXT,
    items           JSONB NOT NULL DEFAULT '[]',
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','failed')),
    batch_id        TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_orders_batch   ON orders(batch_id);
CREATE INDEX idx_orders_status  ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_store   ON orders(store_name);
CREATE INDEX idx_orders_extcode ON orders(external_code);

-- rules 表已存在则跳过
CREATE TABLE IF NOT EXISTS rules (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT DEFAULT '',
    file_type       TEXT NOT NULL CHECK (file_type IN ('excel','word','pdf')),
    config          JSONB NOT NULL DEFAULT '{}',
    ai_generated    BOOLEAN DEFAULT false,
    confidence      TEXT CHECK (confidence IN ('high','medium','low')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rules_name      ON rules(name);
CREATE INDEX IF NOT EXISTS idx_rules_file_type ON rules(file_type);
