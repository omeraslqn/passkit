-- ═══════════════════════════════════════════════════
-- GÜVENLİK İPTALİ - ESKİ SİSTEME DÖNÜŞ
-- ═══════════════════════════════════════════════════

-- 1. Güvenlikli modda sildiğimiz anonim erişim izinlerini geri getiriyoruz
DROP POLICY IF EXISTS "anon_settings" ON settings;
DROP POLICY IF EXISTS "anon_partners" ON partners;
DROP POLICY IF EXISTS "anon_tickets" ON tickets;

CREATE POLICY "anon_settings" ON settings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_partners" ON partners FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_tickets"  ON tickets  FOR ALL TO anon USING (true) WITH CHECK (true);

-- 2. Güvenlikli modda açtığımız RPC fonksiyonlarını siliyoruz (ortalığı temizlemek için)
DROP FUNCTION IF EXISTS api_get_settings();
DROP FUNCTION IF EXISTS api_login(TEXT, TEXT);
DROP FUNCTION IF EXISTS api_save_settings(UUID, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS api_get_partners(UUID);
DROP FUNCTION IF EXISTS api_add_partner(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS api_delete_partner(UUID, UUID);
DROP FUNCTION IF EXISTS api_get_tickets(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS api_add_ticket(UUID, TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS api_confirm_payment(UUID, UUID);
DROP FUNCTION IF EXISTS api_check_in(UUID, UUID);
DROP FUNCTION IF EXISTS api_delete_ticket(UUID, UUID);
DROP FUNCTION IF EXISTS api_get_stats(UUID, UUID);
DROP FUNCTION IF EXISTS get_role(UUID);
