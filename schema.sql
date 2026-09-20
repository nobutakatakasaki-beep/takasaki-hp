-- 髙﨑会計事務所 お問合せデータベース（Cloudflare D1）
-- Cloudflare の D1 コンソールに、この中身をそのまま貼り付けて実行してください。

CREATE TABLE IF NOT EXISTS inquiries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT    NOT NULL,          -- 受信日時（UTC, ISO8601）
  kind        TEXT,                      -- お問合せ種別
  name        TEXT,                      -- お名前
  kana        TEXT,                      -- ふりがな
  company     TEXT,                      -- 会社名・屋号
  email       TEXT,
  tel         TEXT,
  body        TEXT,                      -- ご相談内容
  source      TEXT,                      -- 当事務所を知ったきっかけ
  ip          TEXT,                      -- 送信元IP（連投の検知用）
  ua          TEXT,                      -- ブラウザ情報
  elapsed     INTEGER,                   -- ページを開いてから送信までの秒数
  score       INTEGER NOT NULL,          -- 営業スコア 0-100
  verdict     TEXT    NOT NULL,          -- 自動判定 sales / unsure / client
  reasons     TEXT,                      -- 判定理由（JSON配列）
  label       TEXT,                      -- 人が確定したラベル（自動判定より優先）
  handled     INTEGER DEFAULT 0,         -- 対応済みなら1
  memo        TEXT                       -- 事務所側のメモ
);

CREATE INDEX IF NOT EXISTS idx_inq_created ON inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inq_ip      ON inquiries (ip);
CREATE INDEX IF NOT EXISTS idx_inq_verdict ON inquiries (verdict);

-- 学習ルール：管理画面で「営業に確定」すると、そのドメインがここに溜まる
CREATE TABLE IF NOT EXISTS rules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,             -- ng_domain / ok_domain / ng_word
  value       TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  UNIQUE (type, value)
);
