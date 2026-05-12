// ═══════════════════════════════════════════════════
// auth.js — Authentication (Supabase-compatible)
// SHA-256 + custom session, no Supabase Auth SDK needed
// ═══════════════════════════════════════════════════

const Auth = (() => {
  const SESSION_KEY = 'pk_session';
  const SALT = 'passkit_salt_2026_x7k';

  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function saveSession(session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      ...session,
      expiresAt: Date.now() + 12 * 60 * 60 * 1000
    }));
  }

  function getSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      if (!s || s.expiresAt < Date.now()) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return s;
    } catch { return null; }
  }

  function logout() { sessionStorage.removeItem(SESSION_KEY); }

  async function login(username, password) {
    const hash = await hashPassword(password);
    const settings = await DB.getSettings();

    if (username === settings.admin_user) {
      if (!settings.admin_hash) {
        await DB.saveSettings({ admin_hash: hash });
        saveSession({ role: 'admin', userId: 'admin', name: 'Yönetici' });
        return { role: 'admin' };
      }
      if (hash !== settings.admin_hash) throw new Error('Kullanıcı adı veya şifre hatalı.');
      saveSession({ role: 'admin', userId: 'admin', name: 'Yönetici' });
      return { role: 'admin' };
    }

    const partner = await DB.getPartnerByUsername(username);
    if (!partner) throw new Error('Kullanıcı adı veya şifre hatalı.');
    if (hash !== partner.password_hash) throw new Error('Kullanıcı adı veya şifre hatalı.');
    saveSession({ role: 'partner', userId: partner.id, name: partner.name, partnerId: partner.id });
    return { role: 'partner', partner };
  }

  function isAdmin()     { return getSession()?.role === 'admin'; }
  function isPartner()   { return getSession()?.role === 'partner'; }
  function getPartnerId(){ return getSession()?.partnerId || null; }

  return { hashPassword, login, logout, getSession, isAdmin, isPartner, getPartnerId };
})();
