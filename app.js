// ═══════════════════════════════════════════════════
// app.js — Main application logic (Supabase async)
// ═══════════════════════════════════════════════════

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const $ = id => document.getElementById(id);
const fmt = d => new Date(d).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });

function showToast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $(name).classList.add('active');
}

function openModal(id) { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }

function showTab(tabGroup, tabName) {
  document.querySelectorAll(`[data-tabgroup="${tabGroup}"]`).forEach(el => {
    const match = el.dataset.tab === tabName;
    el.classList.toggle('active', match);
  });
}

function loading(tbodyId, cols) {
  $(tbodyId).innerHTML = `<tr><td colspan="${cols}" style="text-align:center;padding:32px;color:var(--text-muted)">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;display:inline-block">
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".3"/><path d="M21 12a9 9 0 01-9 9"/>
    </svg></td></tr>`;
}

// Add spin animation
const style = document.createElement('style');
style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(style);

function payPill(confirmed) {
  return confirmed
    ? '<span class="pill pill-green">Ödendi</span>'
    : '<span class="pill pill-amber">Bekliyor</span>';
}
function checkPill(checked) {
  return checked
    ? '<span class="pill pill-green">Girdi</span>'
    : '<span class="pill pill-gray">Bekleniyor</span>';
}

// ════ ADMIN ════
async function renderAdmin() {
  const session = Auth.getSession();
  $('admin-user-name').textContent = session.name;
  await renderAdminStats();
  await populatePartnerFilter();
  await renderAdminTickets();
  await renderAdminPartners();
}

async function populatePartnerFilter() {
  const sel = $('filter-partner'); if (!sel) return;
  const cur = sel.value;
  const partners = await DB.getPartners();
  sel.innerHTML = '<option value="">Tüm Partnerlar</option>' +
    partners.map(p => `<option value="${p.id}" ${cur===p.id?'selected':''}>${esc(p.name)}</option>`).join('');
}

async function renderAdminStats() {
  const [s, settings] = await Promise.all([DB.getStats(), DB.getSettings()]);
  $('stat-total').textContent     = s.total;
  $('stat-confirmed').textContent = s.confirmed;
  $('stat-checkedin').textContent = s.checkedIn;
  $('stat-revenue').textContent   = s.revenue.toLocaleString('tr-TR') + ' ₺';
  $('admin-event-name').textContent = settings.event_name;
}

async function renderAdminTickets(filters = {}) {
  loading('tickets-tbody', 7);
  const [tickets, partners] = await Promise.all([DB.getTickets(filters), DB.getPartners()]);
  const pMap = Object.fromEntries(partners.map(p => [p.id, p]));
  const tbody = $('tickets-tbody');
  if (!tickets.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z"/></svg>
      <p>Gösterilecek bilet yok</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = tickets.map(t => `
    <tr>
      <td><code style="color:var(--primary);font-family:monospace;font-size:12px;letter-spacing:.5px">${esc(t.code)}</code></td>
      <td style="font-weight:500">${esc(t.buyer_name)}</td>
      <td style="color:var(--text-muted)">${esc(t.buyer_contact || '—')}</td>
      <td>${pMap[t.partner_id] ? `<span class="pill pill-cyan" style="font-size:10px">${esc(pMap[t.partner_id].name)}</span>` : '—'}</td>
      <td>${payPill(t.payment_confirmed)}</td>
      <td>${checkPill(t.checked_in)}</td>
      <td style="display:flex;gap:6px">
        ${!t.payment_confirmed ? `<button class="btn btn-success btn-sm" onclick="confirmPay('${t.id}')">Onayla</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="deleteTicketPrompt('${t.id}','${esc(t.buyer_name)}')">Sil</button>
      </td>
    </tr>`).join('');
}

async function renderAdminPartners() {
  const [partners, settings] = await Promise.all([DB.getPartners(), DB.getSettings()]);
  const container = $('partners-container');
  if (!partners.length) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 7a4 4 0 110 8 4 4 0 010-8z"/></svg>
      <p>Henüz partner eklenmedi</p></div>`;
    return;
  }
  const statsArr = await Promise.all(partners.map(p => DB.getStats(p.id)));
  container.innerHTML = `<div class="partner-grid">${partners.map((p, i) => {
    const s = statsArr[i];
    const revenue = s.confirmed * settings.ticket_price;
    const commission = Math.round(revenue * (p.commission_rate / 100));
    return `<div class="partner-card">
      <div class="p-header">
        <div>
          <div class="p-name">${esc(p.name)}</div>
          <div class="p-meta">${esc(p.prefix)}-XXX · @${esc(p.username)}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="deletePartnerPrompt('${p.id}','${esc(p.name)}')">Sil</button>
      </div>
      <div class="p-stats">
        <div class="p-stat"><div class="p-stat-val" style="color:var(--primary)">${s.total}</div><div class="p-stat-lbl">Bilet</div></div>
        <div class="p-stat"><div class="p-stat-val" style="color:var(--success)">${s.confirmed}</div><div class="p-stat-lbl">Ödendi</div></div>
        <div class="p-stat"><div class="p-stat-val" style="color:var(--cyan)">${s.checkedIn}</div><div class="p-stat-lbl">Geldi</div></div>
      </div>
      <div class="p-revenue">
        Tahsilat: <strong>${revenue.toLocaleString('tr-TR')} ₺</strong>
        ${p.commission_rate ? ` &nbsp;·&nbsp; Komisyon (%${p.commission_rate}): <strong style="color:var(--warning)">${commission.toLocaleString('tr-TR')} ₺</strong>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

// ════ PARTNER ════
async function renderPartner() {
  const session = Auth.getSession();
  const partner = await DB.getPartnerById(session.partnerId);
  $('partner-display-name').textContent = partner.name;
  const [s, settings] = await Promise.all([DB.getStats(partner.id), DB.getSettings()]);
  $('p-stat-total').textContent     = s.total;
  $('p-stat-confirmed').textContent = s.confirmed;
  $('p-stat-checkedin').textContent = s.checkedIn;
  $('p-stat-revenue').textContent   = (s.confirmed * settings.ticket_price).toLocaleString('tr-TR') + ' ₺';
  await renderPartnerTickets();
}

async function renderPartnerTickets(search = '') {
  loading('p-tickets-tbody', 6);
  const session = Auth.getSession();
  const tickets = await DB.getTickets({ partnerId: session.partnerId, search });
  const tbody = $('p-tickets-tbody');
  if (!tickets.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z"/></svg>
      <p>${search ? 'Sonuç bulunamadı.' : 'Henüz bilet eklemediniz.'}</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = tickets.map(t => `
    <tr>
      <td><code style="color:var(--cyan);font-family:monospace;font-size:12px;letter-spacing:.5px">${esc(t.code)}</code></td>
      <td style="font-weight:500">${esc(t.buyer_name)}</td>
      <td style="color:var(--text-muted)">${esc(t.buyer_contact || '—')}</td>
      <td>${payPill(t.payment_confirmed)}</td>
      <td>${checkPill(t.checked_in)}</td>
      <td>${!t.payment_confirmed ? `<button class="btn btn-success btn-sm" onclick="confirmPay('${t.id}')">Ödeme Alındı</button>` : ''}</td>
    </tr>`).join('');
}

// ════ DOOR MODE ════
async function renderDoorStats() {
  const s = await DB.getStats();
  $('door-checked').textContent = s.checkedIn;
  $('door-total').textContent   = s.confirmed;
}

let doorSearchTimeout = null;
async function searchDoor(query) {
  const container = $('door-results');
  if (!query.trim()) {
    container.innerHTML = `<div class="door-hint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>İsim veya bilet kodu yazarak arama yapın</p></div>`;
    await renderDoorStats();
    return;
  }
  container.innerHTML = `<div class="door-hint"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;display:block;margin:0 auto"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".3"/><path d="M21 12a9 9 0 01-9 9"/></svg></div>`;
  const [tickets, partners] = await Promise.all([DB.getTickets({ search: query }), DB.getPartners()]);
  const pMap = Object.fromEntries(partners.map(p => [p.id, p]));
  if (!tickets.length) {
    container.innerHTML = `<div class="door-hint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>Kayıt bulunamadı: <strong>${esc(query)}</strong></p></div>`;
    return;
  }
  container.innerHTML = tickets.map(t => {
    const isIn   = t.checked_in;
    const unpaid = !t.payment_confirmed;
    const cardClass = isIn ? 'already-in' : unpaid ? 'unpaid' : 'ready';
    return `<div class="door-result-card ${cardClass}">
      <div class="dr-left">
        <div class="dr-name">${esc(t.buyer_name)}</div>
        <div class="dr-code">${esc(t.code)}${t.buyer_contact ? ' · ' + esc(t.buyer_contact) : ''}</div>
        <div class="dr-meta">
          ${pMap[t.partner_id] ? `<span class="pill pill-cyan" style="font-size:10px">${esc(pMap[t.partner_id].name)}</span>` : ''}
          ${payPill(t.payment_confirmed)}
          ${isIn ? `<span class="pill pill-amber" style="font-size:10px">⚠ Zaten girdi — ${fmt(t.checked_in_at)}</span>` : ''}
        </div>
      </div>
      <button class="checkin-btn" onclick="doCheckIn('${t.id}')"
        ${isIn || unpaid ? 'disabled' : ''}>
        ${isIn ? '✓ Girdi' : unpaid ? 'Ödeme yok' : '✓ Giriş'}
      </button>
    </div>`;
  }).join('');
}

async function doCheckIn(ticketId) {
  try {
    await DB.checkIn(ticketId);
    showToast('Giriş başarılı ✓', 'success');
    await searchDoor($('door-search').value);
    await renderDoorStats();
  } catch(e) { showToast(e.message, 'error'); }
}

// ════ ACTIONS ════
async function confirmPay(ticketId) {
  try {
    await DB.confirmPayment(ticketId);
    showToast('Ödeme onaylandı ✓', 'success');
    const session = Auth.getSession();
    if (session.role === 'admin') {
      await renderAdminTickets(getCurrentFilters());
      await renderAdminStats();
    } else {
      await renderPartner();
    }
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteTicketPrompt(id, name) {
  if (!confirm(`"${name}" isimli bileti silmek istediğine emin misin?`)) return;
  try {
    await DB.deleteTicket(id);
    showToast('Bilet silindi.', 'info');
    await renderAdminTickets(getCurrentFilters());
    await renderAdminStats();
  } catch(e) { showToast(e.message, 'error'); }
}

async function deletePartnerPrompt(id, name) {
  if (!confirm(`"${name}" partnerini silmek istediğine emin misin?`)) return;
  try {
    await DB.deletePartner(id);
    showToast('Partner silindi.', 'info');
    await renderAdminPartners();
  } catch(e) { showToast(e.message, 'error'); }
}

function getCurrentFilters() {
  return {
    partnerId: $('filter-partner')?.value || undefined,
    status:    $('filter-status')?.value  || undefined,
    search:    $('filter-search')?.value  || undefined
  };
}

// ════ INIT & EVENT LISTENERS ════
document.addEventListener('DOMContentLoaded', async () => {
  DB.init();

  // Password show/hide
  document.addEventListener('click', e => {
    if (!e.target.closest('.pass-toggle')) return;
    const btn = e.target.closest('.pass-toggle');
    const inp = $(btn.dataset.target);
    if (!inp) return;
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    btn.querySelector('svg').style.opacity = show ? '1' : '0.4';
  });

  // ── Login ──
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = $('login-error');
    errEl.classList.remove('show');
    const btn = $('login-btn');
    btn.disabled = true; btn.textContent = 'Giriş yapılıyor...';
    try {
      const result = await Auth.login($('login-user').value.trim(), $('login-pass').value);
      if (result.role === 'admin') { showView('view-admin'); await renderAdmin(); }
      else { showView('view-partner'); await renderPartner(); }
    } catch(err) {
      errEl.textContent = err.message; errEl.classList.add('show');
    } finally { btn.disabled = false; btn.textContent = 'Giriş Yap'; }
  });

  // ── Logout ──
  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', () => { Auth.logout(); showView('view-login'); $('login-form').reset(); });
  });

  // ── Reset password ──
  $('reset-link').addEventListener('click', async e => {
    e.preventDefault();
    if (!confirm('Admin şifresini sıfırlamak istediğine emin misin?\n(Bilet ve partner verilerin korunacak.)')) return;
    try {
      await DB.saveSettings({ admin_hash: '' });
      showToast('Şifre sıfırlandı. Yeni şifrenle giriş yapabilirsin.', 'info');
      $('login-form').reset();
    } catch(e) { showToast(e.message, 'error'); }
  });

  // ── Export CSV ──
  function exportToCSV(tickets, partners) {
    const pMap = Object.fromEntries(partners.map(p => [p.id, p.name]));
    const headers = ['Bilet Kodu', 'Ad Soyad', 'Iletisim', 'Partner', 'Odeme Durumu', 'Giris Durumu', 'Olusturulma Tarihi'];
    const rows = tickets.map(t => [
      t.code,
      t.buyer_name,
      t.buyer_contact || '',
      pMap[t.partner_id] || '',
      t.payment_confirmed ? 'Odendi' : 'Bekliyor',
      t.checked_in ? 'Girdi' : 'Bekleniyor',
      new Date(t.created_at).toLocaleString('tr-TR')
    ]);
    const csvContent = [headers, ...rows].map(e => e.map(s => `"${String(s).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bilet_listesi_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  $('export-csv-admin')?.addEventListener('click', async () => {
    try {
      const [tickets, partners] = await Promise.all([DB.getTickets(getCurrentFilters()), DB.getPartners()]);
      exportToCSV(tickets, partners);
      showToast('Liste indirildi ✓', 'success');
    } catch(e) { showToast('İndirme başarısız: ' + e.message, 'error'); }
  });

  $('export-csv-partner')?.addEventListener('click', async () => {
    try {
      const session = Auth.getSession();
      const search = $('p-search').value;
      const [tickets, partners] = await Promise.all([
        DB.getTickets({ partnerId: session.partnerId, search }),
        DB.getPartners()
      ]);
      exportToCSV(tickets, partners);
      showToast('Liste indirildi ✓', 'success');
    } catch(e) { showToast('İndirme başarısız: ' + e.message, 'error'); }
  });

  // ── Admin tabs ──
  document.querySelectorAll('[data-tabgroup="admin"]').forEach(el => {
    el.addEventListener('click', () => showTab('admin', el.dataset.tab));
  });

  // ── Ticket filters ──
  ['filter-search','filter-partner','filter-status'].forEach(id => {
    const el = $(id); if (!el) return;
    let t; el.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => renderAdminTickets(getCurrentFilters()), 350); });
  });


  // ── Add Partner ──
  $('open-add-partner').addEventListener('click', () => openModal('modal-add-partner'));
  $('close-add-partner').addEventListener('click', () => closeModal('modal-add-partner'));
  $('close-add-partner-2').addEventListener('click', () => closeModal('modal-add-partner'));
  $('add-partner-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = $('add-partner-error');
    errEl.classList.remove('show');
    const btn = e.submitter; btn.disabled = true; btn.textContent = 'Ekleniyor...';
    try {
      const passwordHash = await Auth.hashPassword($('ap-password').value);
      await DB.addPartner({
        name: $('ap-name').value.trim(),
        prefix: $('ap-prefix').value.trim(),
        username: $('ap-username').value.trim(),
        passwordHash,
        commissionRate: parseFloat($('ap-commission').value) || 0
      });
      closeModal('modal-add-partner');
      $('add-partner-form').reset();
      showToast('Partner eklendi ✓', 'success');
      await renderAdminPartners();
      await populatePartnerFilter();
    } catch(err) { errEl.textContent = err.message; errEl.classList.add('show'); }
    finally { btn.disabled = false; btn.textContent = 'Ekle'; }
  });

  // ── Add Ticket (Admin) ──
  $('open-add-ticket-admin').addEventListener('click', async () => {
    const partners = await DB.getPartners();
    $('at-partner').innerHTML = '<option value="">Partner seçin...</option>' +
      partners.map(p => `<option value="${p.id}|${p.prefix}">${esc(p.name)} (${p.prefix})</option>`).join('');
    openModal('modal-add-ticket');
  });
  $('close-add-ticket').addEventListener('click', () => closeModal('modal-add-ticket'));
  $('close-add-ticket-2').addEventListener('click', () => closeModal('modal-add-ticket'));
  $('add-ticket-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = $('add-ticket-error');
    errEl.classList.remove('show');
    const [partnerId, prefix] = ($('at-partner').value || '|').split('|');
    if (!partnerId) { errEl.textContent = 'Lütfen partner seçin.'; errEl.classList.add('show'); return; }
    const btn = e.submitter; btn.disabled = true; btn.textContent = 'Oluşturuluyor...';
    try {
      const ticket = await DB.addTicket({ buyerName: $('at-name').value.trim(), buyerContact: $('at-contact').value.trim(), partnerId, partnerPrefix: prefix });
      closeModal('modal-add-ticket');
      $('add-ticket-form').reset();
      showToast(`Bilet oluşturuldu: ${ticket.code} ✓`, 'success');
      await renderAdminTickets(getCurrentFilters());
      await renderAdminStats();
    } catch(err) { errEl.textContent = err.message; errEl.classList.add('show'); }
    finally { btn.disabled = false; btn.textContent = 'Bilet Oluştur'; }
  });

  // ── Add Ticket (Partner) ──
  $('open-add-ticket-partner').addEventListener('click', () => openModal('modal-add-ticket-partner'));
  $('close-add-ticket-partner').addEventListener('click', () => closeModal('modal-add-ticket-partner'));
  $('close-add-ticket-partner-2').addEventListener('click', () => closeModal('modal-add-ticket-partner'));
  $('add-ticket-partner-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = $('add-tp-error');
    errEl.classList.remove('show');
    const session = Auth.getSession();
    const partner = await DB.getPartnerById(session.partnerId);
    const btn = e.submitter; btn.disabled = true; btn.textContent = 'Oluşturuluyor...';
    try {
      const ticket = await DB.addTicket({ buyerName: $('tp-name').value.trim(), buyerContact: $('tp-contact').value.trim(), partnerId: partner.id, partnerPrefix: partner.prefix });
      closeModal('modal-add-ticket-partner');
      $('add-ticket-partner-form').reset();
      showToast(`Bilet oluşturuldu: ${ticket.code} ✓`, 'success');
      await renderPartner();
    } catch(err) { errEl.textContent = err.message; errEl.classList.add('show'); }
    finally { btn.disabled = false; btn.textContent = 'Bilet Oluştur'; }
  });

  // ── Partner search ──
  let pSearchT;
  $('p-search').addEventListener('input', e => {
    clearTimeout(pSearchT);
    pSearchT = setTimeout(() => renderPartnerTickets(e.target.value), 350);
  });

  // ── Door mode ──
  const openDoor = async () => { showView('view-door'); await renderDoorStats(); $('door-search').focus(); };
  $('goto-door').addEventListener('click', openDoor);
  $('goto-door-partner').addEventListener('click', openDoor);
  $('door-back').addEventListener('click', async () => {
    const session = Auth.getSession();
    if (session.role === 'admin') {
      showView('view-admin'); await renderAdmin();
    } else {
      showView('view-partner'); await renderPartner();
    }
  });
  $('door-search').addEventListener('input', e => {
    clearTimeout(doorSearchTimeout);
    doorSearchTimeout = setTimeout(() => searchDoor(e.target.value), 300);
  });

  // ── Close modals on overlay ──
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
  });

  // ── Settings ──
  $('open-settings').addEventListener('click', async () => {
    const s = await DB.getSettings();
    $('set-event-name').value = s.event_name;
    $('set-price').value = s.ticket_price;
    $('set-new-pass').value = '';
    openModal('modal-settings');
  });
  $('close-settings').addEventListener('click', () => closeModal('modal-settings'));
  $('close-settings-2').addEventListener('click', () => closeModal('modal-settings'));
  $('settings-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; btn.textContent = 'Kaydediliyor...';
    try {
      const update = { event_name: $('set-event-name').value.trim(), ticket_price: parseInt($('set-price').value) };
      const newPass = $('set-new-pass').value;
      if (newPass) update.admin_hash = await Auth.hashPassword(newPass);
      await DB.saveSettings(update);
      closeModal('modal-settings');
      showToast('Ayarlar kaydedildi ✓', 'success');
      await renderAdminStats();
    } catch(e) { showToast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Kaydet'; }
  });

  // ── Route on load ──
  const session = Auth.getSession();
  if (session) {
    if (session.role === 'admin') { showView('view-admin'); await renderAdmin(); }
    else { showView('view-partner'); await renderPartner(); }
  } else {
    showView('view-login');
  }
});
