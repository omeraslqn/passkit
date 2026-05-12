// ═══════════════════════════════════════════════════
// db.js — Supabase REST API data layer
// ═══════════════════════════════════════════════════

const DB = (() => {
  const SUPABASE_URL = 'https://qihhwehkszwifrjnwsdy.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpaGh3ZWhrc3p3aWZyam53c2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTgyOTgsImV4cCI6MjA5NDE5NDI5OH0.Kc4B4V_mef3VVkWazqR_CiQN-Lvq7dD_wAiLx69zo7g';

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  async function req(method, table, params = '', body = null) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${params}`;
    const opts = { method, headers: { ...headers } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `API hatası: ${res.status}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  }

  // ── Settings ──
  async function getSettings() {
    const rows = await req('GET', 'settings', '?id=eq.1');
    return rows[0] || { event_name: 'Etkinlik', ticket_price: 350, admin_user: 'admin', admin_hash: '' };
  }

  async function saveSettings(data) {
    await req('PATCH', 'settings', '?id=eq.1', data);
  }

  // ── Partners ──
  async function getPartners() {
    return req('GET', 'partners', '?order=created_at.asc');
  }

  async function addPartner({ name, prefix, username, passwordHash, commissionRate = 0 }) {
    const rows = await req('GET', 'partners', `?or=(username.eq.${encodeURIComponent(username)},prefix.eq.${encodeURIComponent(prefix.toUpperCase())})`);
    if (rows.length) throw new Error('Bu kullanıcı adı veya prefix zaten kullanılıyor.');
    const [partner] = await req('POST', 'partners', '', {
      name, prefix: prefix.toUpperCase(), username,
      password_hash: passwordHash,
      commission_rate: commissionRate
    });
    return partner;
  }

  async function deletePartner(id) {
    await req('DELETE', 'partners', `?id=eq.${id}`);
  }

  async function getPartnerById(id) {
    const rows = await req('GET', 'partners', `?id=eq.${id}`);
    return rows[0] || null;
  }

  async function getPartnerByUsername(username) {
    const rows = await req('GET', 'partners', `?username=eq.${encodeURIComponent(username)}`);
    return rows[0] || null;
  }

  // ── Tickets ──
  async function getTickets(filters = {}) {
    let params = '?order=created_at.desc';
    if (filters.partnerId) params += `&partner_id=eq.${filters.partnerId}`;
    if (filters.status === 'confirmed')  params += '&payment_confirmed=eq.true';
    if (filters.status === 'pending')    params += '&payment_confirmed=eq.false';
    if (filters.status === 'checkedIn') params += '&checked_in=eq.true';
    if (filters.search) {
      const q = encodeURIComponent(filters.search);
      params += `&or=(buyer_name.ilike.*${q}*,code.ilike.*${q}*,buyer_contact.ilike.*${q}*)`;
    }
    return req('GET', 'tickets', params);
  }

  async function getNextCode(prefix) {
    const tickets = await req('GET', 'tickets', `?code=like.${prefix}-*&order=created_at.desc`);
    const nums = tickets.map(t => parseInt(t.code.split('-')[1]) || 0);
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `${prefix}-${String(next).padStart(3, '0')}`;
  }

  async function addTicket({ buyerName, buyerContact, partnerId, partnerPrefix }) {
    const code = await getNextCode(partnerPrefix);
    const [ticket] = await req('POST', 'tickets', '', {
      code,
      buyer_name: buyerName.trim(),
      buyer_contact: (buyerContact || '').trim(),
      partner_id: partnerId
    });
    return ticket;
  }

  async function confirmPayment(ticketId) {
    await req('PATCH', 'tickets', `?id=eq.${ticketId}`, { payment_confirmed: true });
  }

  async function checkIn(ticketId) {
    const rows = await req('GET', 'tickets', `?id=eq.${ticketId}`);
    const t = rows[0];
    if (!t) throw new Error('Bilet bulunamadı.');
    if (t.checked_in) throw new Error('Bu kişi zaten içeri girmiş!');
    if (!t.payment_confirmed) throw new Error('Ödeme onaylanmamış!');
    await req('PATCH', 'tickets', `?id=eq.${ticketId}`, {
      checked_in: true,
      checked_in_at: new Date().toISOString()
    });
  }

  async function deleteTicket(ticketId) {
    await req('DELETE', 'tickets', `?id=eq.${ticketId}`);
  }

  async function getStats(partnerId = null) {
    let params = '?select=payment_confirmed,checked_in';
    if (partnerId) params += `&partner_id=eq.${partnerId}`;
    const [tickets, settings] = await Promise.all([
      req('GET', 'tickets', params),
      getSettings()
    ]);
    return {
      total: tickets.length,
      confirmed: tickets.filter(t => t.payment_confirmed).length,
      checkedIn: tickets.filter(t => t.checked_in).length,
      pending: tickets.filter(t => !t.payment_confirmed).length,
      revenue: tickets.filter(t => t.payment_confirmed).length * settings.ticket_price
    };
  }

  function init() {} // no-op for Supabase

  return {
    init, getSettings, saveSettings,
    getPartners, addPartner, deletePartner, getPartnerById, getPartnerByUsername,
    getTickets, addTicket, confirmPayment, checkIn, deleteTicket, getStats
  };
})();
