/**
 * app.js — Main Application Logic
 * Handles tracker, budget, history, rendering, CSV export
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = {
  food:      { label: 'Food',      icon: '🍔', color: '#e8462a' },
  transport: { label: 'Transport', icon: '🚌', color: '#3a7be8' },
  study:     { label: 'Study',     icon: '📚', color: '#2d9e6b' },
  social:    { label: 'Social',    icon: '🎉', color: '#c9920e' },
  health:    { label: 'Health',    icon: '💊', color: '#7c5cbf' },
  shopping:  { label: 'Shopping',  icon: '🛍️', color: '#e07030' },
  other:     { label: 'Other',     icon: '📦', color: '#a8987e' },
};

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

let state = {
  expenses:        [],
  budgets:         {},     // { "2026-03": 5000, ... }
  currentDate:     new Date(),
  activeFilter:    'all',
  selectedCategory:'food',
  sortAscending:   false,
  isLoading:       true,
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const toDateStr  = (d) => d.toISOString().split('T')[0];
const monthKey   = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const fmtAmount  = (n) => (+n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const escHtml    = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nowTime    = ()  => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

const getMonthLabel = (key) => {
  const [y, m] = key.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const getMonthExpenses = (key) => {
  const k = key || monthKey(state.currentDate);
  return state.expenses.filter(e => e.date && e.date.startsWith(k));
};

const calcMonthStats = (key) => {
  const k       = key || monthKey(state.currentDate);
  const expenses = getMonthExpenses(k);
  const total   = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const budget  = Number(state.budgets[k] || 0);
  const remaining = budget - total;
  const pct     = budget > 0 ? Math.min(100, (total / budget) * 100) : 0;
  return { k, expenses, total, budget, remaining, pct };
};

const getAllMonthKeys = () => {
  const keys = new Set();
  state.expenses.forEach(e => e.date && keys.add(e.date.slice(0, 7)));
  Object.keys(state.budgets).forEach(k => keys.add(k));
  return Array.from(keys).sort((a, b) => b.localeCompare(a));
};

// ─────────────────────────────────────────────────────────────────────────────
// SOUND — Web Audio API (no external files needed)
// ─────────────────────────────────────────────────────────────────────────────

function playSuccessSound() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [[523, 0, 0.10], [659, 0.09, 0.10], [784, 0.18, 0.18]];
    notes.forEach(([freq, start, dur]) => {
      const osc  = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ac.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.15, ac.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + dur);
      osc.start(ac.currentTime + start);
      osc.stop(ac.currentTime + start + dur + 0.05);
    });
    setTimeout(() => { try { ac.close(); } catch(e) {} }, 700);
  } catch(e) {}
}

function playErrorSound() {
  try {
    const ac   = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.value = 200;
    gain.gain.setValueAtTime(0.1, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.3);
    setTimeout(() => { try { ac.close(); } catch(e) {} }, 400);
  } catch(e) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

async function initApp() {
  // Set today's date in form
  document.getElementById('expDate').value = toDateStr(new Date());

  try {
    await DB.open();

    // Load all data from IndexedDB
    const [expRows, budgetRows] = await Promise.all([
      DB.getAll('expenses'),
      DB.getAll('budgets'),
    ]);

    state.expenses = expRows || [];
    budgetRows.forEach(row => { state.budgets[row.monthKey] = row.amount; });

    // Update DB status indicator
    document.getElementById('dbDot').className  = 'db-dot ok';
    document.getElementById('dbText').textContent = `IndexedDB ✓ (${state.expenses.length} records)`;

  } catch (err) {
    console.error('DB init error:', err);
    document.getElementById('dbDot').className  = 'db-dot error';
    document.getElementById('dbText').textContent = 'DB failed — using memory';
    state.expenses = [];
    state.budgets  = {};
  }

  // Prefill budget input if set for current month
  const k = monthKey(state.currentDate);
  if (state.budgets[k]) {
    document.getElementById('budgetInput').value = state.budgets[k];
  }

  state.isLoading = false;
  renderAll();
  updateAIContext();
  initAIChat();
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW SWITCHING
// ─────────────────────────────────────────────────────────────────────────────

function switchView(view) {
  ['tracker', 'ai', 'history'].forEach(v => {
    document.getElementById(`view-${v}`).classList.toggle('active', v === view);
    document.getElementById(`tab-${v}`).classList.toggle('active', v === view);
  });
  if (view === 'history') renderHistory();
  if (view === 'ai')      updateAIContext();
}

// ─────────────────────────────────────────────────────────────────────────────
// MONTH NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

function changeMonth(direction) {
  state.currentDate = new Date(
    state.currentDate.getFullYear(),
    state.currentDate.getMonth() + direction,
    1
  );
  const k = monthKey(state.currentDate);
  const bi = document.getElementById('budgetInput');
  bi.value = state.budgets[k] || '';
  renderAll();
  updateAIContext();
}

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET
// ─────────────────────────────────────────────────────────────────────────────

function onBudgetType(raw) {
  const val = parseFloat(raw);
  const { total } = calcMonthStats();
  const remEl  = document.getElementById('cardRemaining');
  const remSub = document.getElementById('cardRemainingSub');

  if (!val || val <= 0) {
    remEl.textContent  = '—';
    remEl.className    = 'card-value';
    remSub.textContent = 'set budget first';
    return;
  }

  const rem = val - total;
  if (rem >= 0) {
    remEl.textContent  = `₹${fmtAmount(rem)}`;
    remEl.className    = 'card-value safe';
    remSub.textContent = `${Math.round(val > 0 ? total / val * 100 : 0)}% used`;
  } else {
    remEl.textContent  = `−₹${fmtAmount(Math.abs(rem))}`;
    remEl.className    = 'card-value over';
    remSub.textContent = 'over budget!';
  }

  const pct = val > 0 ? Math.min(100, total / val * 100) : 0;
  const bar = document.getElementById('progressBar');
  bar.style.width = pct + '%';
  bar.className   = 'progress-bar' + (pct >= 100 ? ' danger' : pct >= 80 ? ' warn' : '');
}

async function saveBudget(amountOverride) {
  const val = amountOverride || parseFloat(document.getElementById('budgetInput').value);
  if (!val || val <= 0) {
    showToast('Enter a valid budget amount', 'error');
    return;
  }
  const k = monthKey(state.currentDate);
  state.budgets[k] = val;

  try {
    await DB.put('budgets', { monthKey: k, amount: val });
  } catch(e) {
    console.warn('Budget save to DB failed:', e);
  }

  document.getElementById('budgetInput').value = val;
  showToast(`✓ Budget ₹${fmtAmount(val)} saved`, 'success');
  renderAll();
  updateAIContext();
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD EXPENSE
// ─────────────────────────────────────────────────────────────────────────────

async function addExpenseCore(desc, amount, date, category) {
  const d = String(desc || '').trim();
  const a = Number(amount);
  const t = String(date || '');
  const c = category || 'other';

  if (!d)          return { ok: false, error: 'Description is required' };
  if (!a || a <= 0) return { ok: false, error: 'Amount must be greater than 0' };
  if (!t)          return { ok: false, error: 'Date is required' };

  const expense = {
    desc: d,
    amount: a,
    date: t,
    category: c,
    monthKey: t.slice(0, 7),
    createdAt: Date.now(),
  };

  try {
    const newId    = await DB.add('expenses', expense);
    expense.id     = newId;
    state.expenses.unshift(expense);
    return { ok: true, expense };
  } catch(dbErr) {
    console.warn('DB add failed, using memory:', dbErr);
    expense.id = Date.now() + Math.floor(Math.random() * 1000);
    state.expenses.unshift(expense);
    return { ok: true, expense };
  }
}

async function addExpenseManual() {
  const desc     = document.getElementById('expDesc').value.trim();
  const amount   = parseFloat(document.getElementById('expAmount').value);
  const date     = document.getElementById('expDate').value;
  const category = state.selectedCategory;

  if (!desc)           { showToast('Please enter a description', 'error'); playErrorSound(); return; }
  if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'error'); playErrorSound(); return; }
  if (!date)           { showToast('Please select a date', 'error'); playErrorSound(); return; }

  const result = await addExpenseCore(desc, amount, date, category);
  if (result.ok) {
    document.getElementById('expDesc').value   = '';
    document.getElementById('expAmount').value = '';
    playSuccessSound();
    showToast(`✓ ₹${fmtAmount(amount)} added — ${desc}`, 'success');
    renderAll();
    updateAIContext();
  } else {
    showToast(result.error, 'error');
    playErrorSound();
  }
}

async function deleteExpense(id) {
  try {
    await DB.remove('expenses', id);
  } catch(e) {
    console.warn('DB delete failed:', e);
  }
  state.expenses = state.expenses.filter(e => e.id !== id);
  renderAll();
  updateAIContext();
  showToast('Expense deleted', '');
}

async function clearMonth() {
  const k   = monthKey(state.currentDate);
  const mes = getMonthExpenses(k);
  if (!mes.length) { showToast('No expenses to clear this month', ''); return; }
  if (!confirm(`Delete all ${mes.length} expenses for ${getMonthLabel(k)}?`)) return;

  for (const e of mes) {
    try { await DB.remove('expenses', e.id); } catch(err) {}
  }
  state.expenses = state.expenses.filter(e => !(e.date && e.date.startsWith(k)));
  renderAll();
  updateAIContext();
  showToast(`Cleared all expenses for ${getMonthLabel(k)}`, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────────────────────────────────────────

function exportCSV() {
  const k   = monthKey(state.currentDate);
  const mes = getMonthExpenses(k);

  if (!mes.length) {
    showToast('No expenses to export this month', '');
    return;
  }

  const sorted = [...mes].sort((a, b) => a.date.localeCompare(b.date));
  const { total, budget, remaining } = calcMonthStats(k);
  const label = getMonthLabel(k);

  // ── 1. Show plain text report in a popup modal ──────────────────────────────
  const catTotals = {};
  sorted.forEach(e => { catTotals[e.category] = (catTotals[e.category]||0) + Number(e.amount); });

  // Group by date for readable format
  const groups = {};
  sorted.forEach(e => { (groups[e.date] = groups[e.date]||[]).push(e); });

  let plainText = `📊 PAISA EXPENSE REPORT\n`;
  plainText    += `📅 ${label}\n`;
  plainText    += `${'─'.repeat(38)}\n\n`;

  Object.keys(groups).forEach(date => {
    const d    = new Date(date+'T00:00:00');
    const dLbl = d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
    const dayTotal = groups[date].reduce((s,e)=>s+Number(e.amount),0);
    plainText += `📅 ${dLbl}  (₹${fmtAmount(dayTotal)})\n`;
    groups[date].forEach(e => {
      const cat = CATEGORIES[e.category]||CATEGORIES.other;
      plainText += `  ${cat.icon} ${e.desc.padEnd(22,' ')} ₹${fmtAmount(e.amount)}\n`;
    });
    plainText += '\n';
  });

  plainText += `${'─'.repeat(38)}\n`;
  plainText += `💰 TOTAL SPENT   : ₹${fmtAmount(total)}\n`;
  if (budget > 0) {
    plainText += `🎯 BUDGET        : ₹${fmtAmount(budget)}\n`;
    plainText += `${remaining>=0?'✅':'🚨'} REMAINING      : ${remaining>=0?'':'−'}₹${fmtAmount(Math.abs(remaining))}\n`;
  }
  plainText += `\n📦 BY CATEGORY:\n`;
  Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).forEach(([c,v])=>{
    const cat = CATEGORIES[c]||CATEGORIES.other;
    const pct = total ? Math.round(v/total*100) : 0;
    const bar = '█'.repeat(Math.round(pct/5)) + '░'.repeat(20-Math.round(pct/5));
    plainText += `  ${cat.icon} ${cat.label.padEnd(12,' ')} ${bar} ${pct}%  ₹${fmtAmount(v)}\n`;
  });
  plainText += `\n📱 Generated by Paisa AI Expense Tracker`;

  // Show modal with the plain text
  const existing = document.getElementById('exportModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'exportModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:999;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;width:min(560px,98vw);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.25)">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)">
        <div style="font-weight:700;font-size:1rem">📊 Expense Report — ${label}</div>
        <button onclick="document.getElementById('exportModal').remove()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--text3);line-height:1">✕</button>
      </div>

      <div style="padding:16px 20px;overflow-y:auto;flex:1">
        <pre id="reportText" style="font-family:var(--mono);font-size:.8rem;line-height:1.7;color:var(--text);white-space:pre;overflow-x:auto;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;margin:0">${escHtml(plainText)}</pre>
      </div>

      <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="copyReport()" style="background:var(--ai);color:#fff;border:none;border-radius:8px;padding:9px 18px;font-weight:700;font-size:.85rem;cursor:pointer;font-family:var(--font)">
          📋 Copy Text
        </button>
        <button onclick="downloadCSV_handler()" style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:9px 18px;font-weight:700;font-size:.85rem;cursor:pointer;font-family:var(--font)">
          ⬇ Download CSV
        </button>
        <button onclick="document.getElementById('exportModal').remove()" style="background:var(--surface3);border:1px solid var(--border2);border-radius:8px;padding:9px 18px;font-weight:600;font-size:.85rem;cursor:pointer;color:var(--text2);font-family:var(--font)">
          Close
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.onclick = e => { if (e.target === modal) modal.remove(); };

  // Store data for download button
  window._exportData = { k, mes: sorted, total, budget, remaining, label };

  // ── 2. Also trigger CSV file download ───────────────────────────────────────
  const headers = ['Date', 'Description', 'Category', 'Amount (INR)'];
  const rows    = sorted.map(e => [
    e.date,
    `"${(e.desc||'').replace(/"/g,'""')}"`,
    CATEGORIES[e.category]?.label || e.category || 'Other',
    e.amount,
  ]);
  rows.push([], ['','SUMMARY','',''], ['','Total Spent','',total]);
  if (budget > 0) { rows.push(['','Budget','',budget], ['','Remaining','',budget-remaining]); }

  const csvContent = [
    `Paisa AI Expense Tracker — ${label}`, '',
    headers.join(','),
    ...rows.map(r => r.join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `paisa_expenses_${k}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`✓ Report ready! CSV also downloading…`, 'success');
}

function copyReport() {
  const pre = document.getElementById('reportText');
  if (!pre) return;
  const text = pre.innerText || pre.textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 Report copied to clipboard!', 'success');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showToast('📋 Copied!', 'success');
  });
}

function downloadCSV_handler() {
  const d = window._exportData;
  if (!d) return;
  const headers = ['Date','Description','Category','Amount (INR)'];
  const rows = d.mes.map(e => [e.date, '"'+(e.desc||'').replace(/"/g,'""')+'"', (window.CATEGORIES||{})[e.category]?.label||e.category||'Other', e.amount]);
  rows.push([],['','SUMMARY','',''],['','Total Spent','',d.total]);
  if (d.budget>0) rows.push(['','Budget','',d.budget],['','Remaining','',d.budget-d.remaining]);
  const csv = ['\uFEFF'+'Paisa AI — '+d.label,'',headers.join(','),...rows.map(r=>r.join(','))].join('\r\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download='paisa_expenses_'+d.k+'.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if(window.showToast) showToast('⬇ CSV downloaded!','success');
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER ALL
// ─────────────────────────────────────────────────────────────────────────────

function renderAll() {
  // Update month label
  document.getElementById('monthLabel').textContent =
    state.currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  renderSummaryCards();
  renderExpenses();
  renderDonutChart();
  checkBudgetAlert();
}

function renderSummaryCards() {
  const { expenses, total, budget, remaining, pct } = calcMonthStats();

  // Budget card
  document.getElementById('cardBudget').textContent =
    budget > 0 ? `₹${fmtAmount(budget)}` : '—';
  document.getElementById('cardBudgetSub').textContent =
    budget > 0
      ? (pct >= 100 ? '⚠ limit reached' : `${Math.round(pct)}% used`)
      : 'not set';

  // Spent card
  document.getElementById('cardSpent').textContent = `₹${fmtAmount(total)}`;
  document.getElementById('cardSpentSub').textContent =
    `${expenses.length} transaction${expenses.length !== 1 ? 's' : ''}`;

  // Remaining card
  const remEl  = document.getElementById('cardRemaining');
  const remSub = document.getElementById('cardRemainingSub');
  if (budget <= 0) {
    remEl.textContent  = '—';
    remEl.className    = 'card-value';
    remSub.textContent = 'set budget first';
  } else if (remaining >= 0) {
    remEl.textContent  = `₹${fmtAmount(remaining)}`;
    remEl.className    = 'card-value safe';
    remSub.textContent = 'left this month ✓';
  } else {
    remEl.textContent  = `−₹${fmtAmount(Math.abs(remaining))}`;
    remEl.className    = 'card-value over';
    remSub.textContent = 'over budget!';
  }

  // Count card
  document.getElementById('cardCount').textContent = expenses.length;
  const avg = expenses.length ? total / expenses.length : 0;
  document.getElementById('cardAvg').textContent =
    expenses.length ? `avg ₹${fmtAmount(avg)}/txn` : '—';

  // Daily average card
  const today    = new Date();
  const isCurrent = monthKey(state.currentDate) === monthKey(today);
  const daysElapsed = isCurrent
    ? today.getDate()
    : new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1, 0).getDate();
  document.getElementById('cardDaily').textContent = `₹${fmtAmount(daysElapsed > 0 ? total / daysElapsed : 0)}`;
  document.getElementById('cardDailySub').textContent = `over ${daysElapsed} day${daysElapsed !== 1 ? 's' : ''}`;

  // Progress bar
  const bar = document.getElementById('progressBar');
  bar.style.width = pct + '%';
  bar.className   = 'progress-bar' + (pct >= 100 ? ' danger' : pct >= 80 ? ' warn' : '');

  // Sync budget input (only if not focused)
  const budgetInput = document.getElementById('budgetInput');
  if (document.activeElement !== budgetInput) {
    budgetInput.value = budget > 0 ? budget : '';
  }

  // Transaction badge
  document.getElementById('txnBadge').textContent = expenses.length;
}

function checkBudgetAlert() {
  const { total, budget, remaining, pct } = calcMonthStats();
  const banner = document.getElementById('alertBanner');
  const icon   = document.getElementById('alertIcon');
  const text   = document.getElementById('alertText');

  if (budget > 0 && pct >= 100) {
    banner.className    = 'alert-banner show danger';
    icon.textContent    = '🚨';
    text.textContent    = `You have exceeded your budget by ₹${fmtAmount(Math.abs(remaining))}! Review your expenses.`;
  } else if (budget > 0 && pct >= 80) {
    banner.className    = 'alert-banner show warn';
    icon.textContent    = '⚠️';
    text.textContent    = `${Math.round(pct)}% of budget used — only ₹${fmtAmount(remaining)} remaining this month.`;
  } else {
    banner.className    = 'alert-banner';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE LIST RENDERING
// ─────────────────────────────────────────────────────────────────────────────

function setFilter(filter, btn) {
  state.activeFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderExpenses();
}

function selectCategory(btn) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.selectedCategory = btn.dataset.cat;
}

function toggleSort() {
  state.sortAscending = !state.sortAscending;
  document.getElementById('sortBtn').textContent = state.sortAscending ? 'Date ↑' : 'Date ↓';
  renderExpenses();
}

function renderExpenses() {
  const k   = monthKey(state.currentDate);
  const mes = getMonthExpenses(k);
  const q   = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();

  // Filter
  let filtered = state.activeFilter === 'all'
    ? mes
    : mes.filter(e => e.category === state.activeFilter);

  // Search
  if (q) {
    filtered = filtered.filter(e =>
      e.desc.toLowerCase().includes(q) ||
      (CATEGORIES[e.category]?.label || '').toLowerCase().includes(q)
    );
  }

  // Sort
  filtered = [...filtered].sort((a, b) =>
    state.sortAscending
      ? a.date.localeCompare(b.date) || a.id - b.id
      : b.date.localeCompare(a.date) || b.id - a.id
  );

  const container = document.getElementById('expenseList');
  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🧾</div>
        <p>${q ? `No results for "${escHtml(q)}"` : 'No expenses yet this month'}</p>
      </div>`;
    return;
  }

  // Group by date
  const groups = {};
  filtered.forEach(e => {
    (groups[e.date] = groups[e.date] || []).push(e);
  });

  const sortedDates = Object.keys(groups).sort((a, b) =>
    state.sortAscending ? a.localeCompare(b) : b.localeCompare(a)
  );

  container.innerHTML = sortedDates.map(date => {
    const dayTotal = groups[date].reduce((s, e) => s + Number(e.amount), 0);
    const items    = groups[date].map(e => {
      const cat = CATEGORIES[e.category] || CATEGORIES.other;
      return `
        <div class="expense-item">
          <div class="expense-icon" style="background:${cat.color}18;color:${cat.color}">${cat.icon}</div>
          <div class="expense-info">
            <div class="expense-name">${escHtml(e.desc)}</div>
            <div class="expense-cat">${cat.label}</div>
          </div>
          <div class="expense-right">
            <div class="expense-amount" style="color:${cat.color}">₹${fmtAmount(e.amount)}</div>
            <button class="expense-delete" onclick="deleteExpense(${e.id})">Delete</button>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="date-group-header">
        <span class="date-group-label">${formatDateLabel(date)}</span>
        <span class="date-group-total">₹${fmtAmount(dayTotal)}</span>
      </div>
      ${items}`;
  }).join('');
}

function formatDateLabel(dateStr) {
  const d    = new Date(dateStr + 'T00:00:00');
  const now  = new Date(); now.setHours(0, 0, 0, 0);
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.getTime() === now.getTime())  return 'Today';
  if (d.getTime() === yest.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─────────────────────────────────────────────────────────────────────────────
// DONUT CHART (pure SVG, no libraries)
// ─────────────────────────────────────────────────────────────────────────────

function renderDonutChart() {
  const k   = monthKey(state.currentDate);
  const mes = getMonthExpenses(k);

  const totals = {};
  mes.forEach(e => {
    totals[e.category] = (totals[e.category] || 0) + Number(e.amount);
  });

  const cats  = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
  const total = cats.reduce((s, c) => s + totals[c], 0);

  document.getElementById('donutTotal').textContent = total > 0 ? `₹${fmtAmount(total)}` : '₹0';

  const svg = document.getElementById('donutSvg');
  svg.innerHTML = '';

  if (!cats.length) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '60'); circle.setAttribute('cy', '60');
    circle.setAttribute('r',  '38'); circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', '#f0ebe0'); circle.setAttribute('stroke-width', '14');
    svg.appendChild(circle);
    document.getElementById('categoryBreakdown').innerHTML =
      '<div style="font-size:.76rem;color:var(--text3);text-align:center;padding:8px 0">No data this month</div>';
    return;
  }

  let angle = -Math.PI / 2;
  const cx = 60, cy = 60, r = 38;

  cats.forEach(c => {
    const cat   = CATEGORIES[c] || CATEGORIES.other;
    const frac  = totals[c] / total;
    const sweep = frac * 2 * Math.PI;
    const ea    = angle + sweep;

    if (frac >= 0.999) {
      // Full circle (single category)
      const ci = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ci.setAttribute('cx', cx); ci.setAttribute('cy', cy); ci.setAttribute('r', r);
      ci.setAttribute('fill', 'none'); ci.setAttribute('stroke', cat.color);
      ci.setAttribute('stroke-width', '14');
      svg.appendChild(ci);
    } else {
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(ea);
      const y2 = cy + r * Math.sin(ea);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d',
        `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${sweep > Math.PI ? 1 : 0},1 ${x2.toFixed(2)},${y2.toFixed(2)}`
      );
      path.setAttribute('fill',         'none');
      path.setAttribute('stroke',       cat.color);
      path.setAttribute('stroke-width', '14');
      path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(path);
    }

    angle += sweep;
  });

  // Breakdown list
  document.getElementById('categoryBreakdown').innerHTML = cats.map(c => {
    const cat = CATEGORIES[c] || CATEGORIES.other;
    const pct = total ? Math.round(totals[c] / total * 100) : 0;
    return `
      <div class="cat-breakdown-row">
        <div class="cat-breakdown-icon">${cat.icon}</div>
        <div class="cat-breakdown-name">${cat.label}</div>
        <div class="cat-breakdown-bar-wrap">
          <div class="cat-breakdown-bar" style="width:${pct}%;background:${cat.color}"></div>
        </div>
        <div class="cat-breakdown-amount" style="color:${cat.color}">₹${fmtAmount(totals[c])}</div>
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY VIEW
// ─────────────────────────────────────────────────────────────────────────────

function renderHistory() {
  const months  = getAllMonthKeys();
  const curKey  = monthKey(state.currentDate);

  document.getElementById('historyCount').textContent =
    `${months.length} month${months.length !== 1 ? 's' : ''}`;

  if (!months.length) {
    document.getElementById('historyCards').innerHTML =
      '<div style="color:var(--text3);font-size:.82rem;padding:12px;grid-column:1/-1">No history yet. Start adding expenses!</div>';
    document.getElementById('historyTableBody').innerHTML = '';
    return;
  }

  // Month Cards (top 6)
  document.getElementById('historyCards').innerHTML = months.slice(0, 6).map(k => {
    const { expenses, total, budget, remaining, pct } = calcMonthStats(k);
    const isCurrent = k === curKey;
    const barColor  = pct >= 100 ? '#e8463a' : pct >= 80 ? '#c9920e' : '#3a7be8';

    let badge = '';
    if (!budget)          badge = '<span class="hc-badge none">No budget</span>';
    else if (remaining >= 0) badge = `<span class="hc-badge surplus">+₹${fmtAmount(remaining)}</span>`;
    else                  badge = `<span class="hc-badge over">−₹${fmtAmount(Math.abs(remaining))}</span>`;

    return `
      <div class="history-card${isCurrent ? ' current-month' : ''}" onclick="jumpToMonth('${k}')">
        ${badge}
        <div class="hc-month">${getMonthLabel(k)}</div>
        <div class="hc-row"><span class="hc-label">Spent</span><span class="hc-value" style="color:#3a7be8">₹${fmtAmount(total)}</span></div>
        <div class="hc-row"><span class="hc-label">Budget</span><span class="hc-value">${budget ? '₹' + fmtAmount(budget) : '—'}</span></div>
        <div class="hc-row"><span class="hc-label">Transactions</span><span class="hc-value">${expenses.length}</span></div>
        <div class="hc-progress-wrap"><div class="hc-progress-fill" style="width:${pct}%;background:${barColor}"></div></div>
      </div>`;
  }).join('');

  // Table rows (all months)
  document.getElementById('historyTableBody').innerHTML = months.map(k => {
    const { total, budget, remaining } = calcMonthStats(k);
    let pc = 'none', pt = 'No budget';
    if (budget && remaining >= 0)  { pc = 'surplus'; pt = `+₹${fmtAmount(remaining)}`; }
    else if (budget)               { pc = 'over';    pt = `−₹${fmtAmount(Math.abs(remaining))}`; }

    return `
      <div class="history-table-row" onclick="jumpToMonth('${k}')">
        <span style="font-weight:600">${getMonthLabel(k)}</span>
        <span style="font-family:var(--mono);color:var(--text2)">${budget ? '₹' + fmtAmount(budget) : '—'}</span>
        <span style="font-family:var(--mono);color:#3a7be8">₹${fmtAmount(total)}</span>
        <span><span class="status-pill ${pc}">${pt}</span></span>
      </div>`;
  }).join('');
}

function jumpToMonth(key) {
  const [y, m] = key.split('-');
  state.currentDate = new Date(+y, +m - 1, 1);
  document.getElementById('budgetInput').value = state.budgets[key] || '';
  switchView('tracker');
  renderAll();
}

// ─────────────────────────────────────────────────────────────────────────────
// AI CONTEXT UPDATE
// ─────────────────────────────────────────────────────────────────────────────

function updateAIContext() {
  const { total, budget, remaining, expenses } = calcMonthStats();
  document.getElementById('ctxMonth').textContent     =
    state.currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  document.getElementById('ctxBudget').textContent    = budget > 0 ? `₹${fmtAmount(budget)}` : 'Not set';
  document.getElementById('ctxSpent').textContent     = `₹${fmtAmount(total)}`;
  document.getElementById('ctxRemaining').textContent = budget > 0 ? `₹${fmtAmount(remaining)}` : '—';
  document.getElementById('ctxTxns').textContent      = expenses.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

function showToast(message, type = '') {
  const container = document.getElementById('toastContainer');
  const toast     = document.createElement('div');

  toast.className = `toast${type === 'success' ? ' success' : type === 'error' ? ' error' : type === 'info' ? ' info' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─────────────────────────────────────────────────────────────────────────────
// START APP
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', initApp);
