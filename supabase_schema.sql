-- ═══════════════════════════════════════════════════
-- PassKit — Supabase SQL Schema
-- Supabase SQL Editor'a kopyalayıp çalıştır
-- ═══════════════════════════════════════════════════

-- 1. Tabloları oluştur
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  event_name TEXT NOT NULL DEFAULT 'Etkinlik',
  ticket_price INTEGER NOT NULL DEFAULT 350,
  admin_user TEXT NOT NULL DEFAULT 'admin',
  admin_hash TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prefix TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  commission_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_contact TEXT DEFAULT '',
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  payment_confirmed BOOLEAN DEFAULT FALSE,
  checked_in BOOLEAN DEFAULT FALSE,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. İlk ayar satırını ekle
INSERT INTO settings (id, event_name, ticket_price, admin_user, admin_hash)
VALUES (1, 'Etkinlik', 350, 'admin', '')
ON CONFLICT (id) DO NOTHING;

-- 3. RLS aktif et
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets  ENABLE ROW LEVEL SECURITY;

-- 4. Anon erişim politikaları (uygulama kendi auth katmanını yönetiyor)
CREATE POLICY "anon_settings" ON settings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_partners" ON partners FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_tickets"  ON tickets  FOR ALL TO anon USING (true) WITH CHECK (true);
