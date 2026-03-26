/**
 * ai.js — AI Chat + Voice + Smart Local Parser
 * 
 * HYBRID MODE:
 * - Simple expenses (e.g. "chai 30, auto 60") → Handled LOCALLY, no API needed
 * - Complex questions (e.g. "analyze my spending") → Uses Anthropic API
 * This means basic features work even with $0 API credits!
 */

let chatHistory     = [];
let anthropicApiKey = localStorage.getItem('paisa_api_key') || '';
let useLocalMode    = false; // auto-detected based on API availability

// ─── INIT ────────────────────────────────────────────────────────────────────

function initAIChat() {
  const hasKey = !!anthropicApiKey;
  addAIMessage(
    `Hi! I'm **Paisa AI** 👋\n\n` +
    `I can understand natural language for expenses.\n` +
    `Basic features work even **without an API key!**\n\n` +
    `Try:\n` +
     
    (hasKey
      ? `✅ API key found — full AI mode active!\n\nClick 🎙️ for voice!`
      : `⚡ Running in **Smart Local Mode** — basic commands work instantly!\n\nFor advanced AI: click ⚙️ Settings to add your API key.`)
  );

  if (!hasKey) renderApiKeyBtn();
}

// Small settings button in chat header area
function renderApiKeyBtn() {
  const hdr = document.querySelector('.chat-header');
  if (!hdr || hdr.querySelector('#apiSettingsBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'apiSettingsBtn';
  btn.title = 'Set API Key for full AI';
  btn.innerHTML = '⚙️ API Key';
  btn.style.cssText = 'background:rgba(108,71,232,.1);border:1px solid rgba(108,71,232,.3);border-radius:6px;color:#6c47e8;padding:4px 10px;font-size:.72rem;font-weight:600;cursor:pointer;font-family:var(--font)';
  btn.onclick = showApiKeyModal;
  hdr.querySelector('.chat-header-left').after(btn);
}

// ─── API KEY MODAL ────────────────────────────────────────────────────────────

function showApiKeyModal() {
  const existing = document.getElementById('apiKeyModal');
  if (existing) { existing.remove(); return; }

  const modal = document.createElement('div');
  modal.id = 'apiKeyModal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:999;
    display:flex;align-items:center;justify-content:center`;
  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:28px;width:min(460px,90vw);box-shadow:0 20px 60px rgba(0,0,0,.2)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-weight:700;font-size:1rem">🔑 Anthropic API Key</div>
        <button onclick="document.getElementById('apiKeyModal').remove()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text3)">✕</button>
      </div>

      <div style="background:#faf7f2;border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px;font-size:.82rem;line-height:1.6;color:var(--text2)">
        <strong>Why you see "credit balance too low":</strong><br>
        Your Anthropic account has $0 credits. Add $5 at:<br>
        <strong>console.anthropic.com → Settings → Billing → Add Credits</strong><br><br>
        <strong>Good news:</strong> Basic expense entry works WITHOUT any credits using Smart Local Mode!
      </div>

      <label style="display:block;font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:5px">API Key (starts with sk-ant-...)</label>
      <input type="password" id="modalKeyInput" placeholder="sk-ant-api03-..."
        value="${anthropicApiKey}"
        style="width:100%;background:var(--bg2);border:1px solid var(--border2);border-radius:6px;color:var(--text);padding:9px 12px;font-family:monospace;font-size:.85rem;outline:none;margin-bottom:12px"
        onkeydown="if(event.key==='Enter')saveApiKeyFromModal()">
      <div id="modalKeyErr" style="font-size:.75rem;color:var(--red);margin-bottom:10px;display:none"></div>

      <div style="display:flex;gap:8px">
        <button onclick="saveApiKeyFromModal()" style="flex:1;background:var(--ai);color:#fff;border:none;border-radius:8px;padding:10px;font-weight:700;font-size:.88rem;cursor:pointer">Save & Activate</button>
        ${anthropicApiKey ? `<button onclick="clearApiKey()" style="background:var(--red-dim);color:var(--red);border:1px solid rgba(232,70,58,.3);border-radius:8px;padding:10px 14px;font-weight:600;font-size:.82rem;cursor:pointer">Remove</button>` : ''}
      </div>

      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);font-size:.72rem;color:var(--text3)">
        Get free key: <strong>console.anthropic.com</strong> → API Keys → Create Key &nbsp;·&nbsp; 🔒 Stored only on your device
      </div>
    </div>`;
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('modalKeyInput')?.focus(), 100);
}

function saveApiKeyFromModal() {
  const input = document.getElementById('modalKeyInput');
  const errEl = document.getElementById('modalKeyErr');
  if (!input) return;
  const key = input.value.trim();
  if (!key) { errEl.style.display='block'; errEl.textContent='Please enter your API key.'; return; }
  if (!key.startsWith('sk-ant-')) { errEl.style.display='block'; errEl.textContent='Invalid — must start with sk-ant-...'; return; }
  anthropicApiKey = key;
  localStorage.setItem('paisa_api_key', key);
  document.getElementById('apiKeyModal')?.remove();
  showToast('✓ API key saved! Full AI mode active.', 'success');
  addAIMessage(`✅ **API key saved!**\n\nFull AI mode is now active. You can ask anything!`);
}

function clearApiKey() {
  anthropicApiKey = '';
  localStorage.removeItem('paisa_api_key');
  document.getElementById('apiKeyModal')?.remove();
  showToast('API key removed — back to Smart Local Mode', '');
  addAIMessage(`Key removed. Running in Smart Local Mode.\nBasic expense commands still work!`);
}

// ─── SMART LOCAL PARSER (no API needed!) ─────────────────────────────────────

const LOCAL_CATS = {
  food:      ['chai','tea','coffee','mess','lunch','dinner','breakfast','snack','canteen','hotel','biscuit','maggi','samosa','vada','idli','dosa','biryani','thali','paratha','roti','sabzi','dal','rice','milk','curd','lassi','juice','sandwich','burger','pizza','noodles','pasta','bread','egg','omelette','poha','upma','pongal','food','eat','ate'],
  transport: ['auto','bus','metro','cab','uber','ola','train','bike','petrol','travel','fare','ticket','rickshaw','transport','travel'],
  study:     ['book','pen','notes','xerox','print','stationery','fees','tuition','course','textbook','notebook','assignment','study','class','college','exam','pencil','ruler','eraser','calculator','lab'],
  social:    ['movie','party','outing','hangout','trip','picnic','friend','zomato','swiggy','restaurant','treat','club','game','cricket','sports','fun','date','bowling'],
  health:    ['medicine','doctor','hospital','pharmacy','medical','gym','tablet','syrup','clinic','consultation','dentist','injection','health','vitamin','protein','supplement'],
  shopping:  ['shirt','jeans','clothes','shoes','bag','amazon','flipkart','meesho','mall','buy','purchase','dress','kurti','saree','pant','top','jacket','cap','watch','earphone','mobile','phone','laptop','charger','cover'],
  other:     ['rent','electricity','recharge','wifi','subscription','internet','gas','water','bill']
};

function detectCategory(text) {
  const t = text.toLowerCase();
  for (const [cat, words] of Object.entries(LOCAL_CATS)) {
    if (words.some(w => t.includes(w))) return cat;
  }
  return 'other';
}

function parseRelativeDate(text) {
  const t   = text.toLowerCase();
  const now = new Date();
  if (t.includes('yesterday'))                return toDateStr(new Date(now - 86400000));
  if (t.includes('day before') || t.includes('2 days ago')) return toDateStr(new Date(now - 2*86400000));
  if (t.includes('monday'))    { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay()+6)%7));     return toDateStr(d); }
  if (t.includes('tuesday'))   { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay()+5)%7));     return toDateStr(d); }
  if (t.includes('wednesday')) { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay()+4)%7));     return toDateStr(d); }
  if (t.includes('thursday'))  { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay()+3)%7));     return toDateStr(d); }
  if (t.includes('friday'))    { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay()+2)%7));     return toDateStr(d); }
  if (t.includes('saturday'))  { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay()+1)%7));     return toDateStr(d); }
  if (t.includes('sunday'))    { const d = new Date(now); d.setDate(d.getDate() - (d.getDay()%7));         return toDateStr(d); }
  return toDateStr(now);
}

function parseWordNumbers(text) {
  const map = {
    'zero':0,'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10,
    'eleven':11,'twelve':12,'thirteen':13,'fourteen':14,'fifteen':15,'sixteen':16,'seventeen':17,'eighteen':18,'nineteen':19,'twenty':20,
    'thirty':30,'forty':40,'fifty':50,'sixty':60,'seventy':70,'eighty':80,'ninety':90,
    'hundred':100,'thousand':1000,'five hundred':500,'two hundred':200,'three hundred':300,
    'four hundred':400,'six hundred':600,'seven hundred':700,'eight hundred':800,'nine hundred':900,
    'one fifty':150,'one twenty':120,'one eighty':180,'two fifty':250,'two twenty':220,'two eighty':280,
    'three fifty':350,'four fifty':450,'five fifty':550,'six fifty':650,'seven fifty':750
  };
  let t = text.toLowerCase();
  for (const [w, n] of Object.entries(map).sort((a,b) => b[0].length - a[0].length)) {
    t = t.replace(new RegExp('\\b' + w + '\\b', 'g'), String(n));
  }
  return t;
}

// Extract expenses from text locally — no API call
function localParseExpenses(rawText) {
  const text    = parseWordNumbers(rawText);
  const date    = parseRelativeDate(text);
  const found   = [];

  // Pattern 1: "item amount" or "amount on/for item"
  // Handles: "chai 30", "auto fare 80", "spent 150 on mess", "200 on lunch"
  const patterns = [
    // "chai 30" or "chai: 30"
    /([a-zA-Z][a-zA-Z\s]{1,25?}?)\s*:?\s*₹?\s*(\d+(?:\.\d{1,2})?)/g,
    // "₹30 chai" or "30 for chai"
    /₹?\s*(\d+(?:\.\d{1,2})?)\s+(?:on|for|for\s+the|towards)\s+([a-zA-Z][a-zA-Z\s]{1,25})/g,
    // "spent 30 on chai"
    /(?:spent|paid|gave|bought)\s+₹?\s*(\d+(?:\.\d{1,2})?)\s+(?:on|for|at)?\s*([a-zA-Z][a-zA-Z\s]{1,25})/g,
  ];

  for (const pat of patterns) {
    let m;
    pat.lastIndex = 0;
    while ((m = pat.exec(text)) !== null) {
      let desc, amt;
      if (pat.source.startsWith('₹') || pat.source.startsWith('/₹')) {
        amt  = parseFloat(m[1]);
        desc = m[2];
      } else if (pat.source.includes('(?:spent')) {
        amt  = parseFloat(m[1]);
        desc = m[2];
      } else {
        desc = m[1];
        amt  = parseFloat(m[2]);
      }
      desc = (desc || '').trim().replace(/\s+/g, ' ');
      if (!desc || !amt || amt <= 0 || amt > 100000) continue;
      // Skip noise words as descriptions
      if (['the','a','an','i','my','on','for','in','at','and','to','of','spent','paid','gave','today','yesterday'].includes(desc.toLowerCase())) continue;
      found.push({ desc, amount: amt, date, cat: detectCategory(desc) });
    }
  }

  // Deduplicate by desc+amount
  const seen = new Set();
  return found.filter(e => {
    const key = `${e.desc}_${e.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Check if text is a question/command
function classifyInput(text) {
  const t = text.toLowerCase().trim();
  const questionWords = ['how much','how many','what','which','when','why','show','tell me','give me','list','analyze','suggest','advice','tip','compare','can i','should i','will i','am i'];
  const isQuestion = questionWords.some(w => t.startsWith(w)) || t.endsWith('?');
  const isBudgetSet = /set.*(budget|limit)/i.test(t) || /budget.*(\d+)/i.test(t) || /(\d+).*(budget|limit)/i.test(t);
  const hasNumbers = /\d/.test(t);
  return { isQuestion, isBudgetSet, hasNumbers };
}

// Answer simple questions locally
function localAnswerQuestion(text) {
  const t = text.toLowerCase();
  const { total, budget, remaining, expenses, pct } = calcMonthStats(monthKey(state.currentDate));
  const monthName = state.currentDate.toLocaleDateString('en-IN', { month:'long', year:'numeric' });

  if (t.includes('how much') && (t.includes('spent') || t.includes('spend'))) {
    const catTotals = {};
    expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category]||0) + Number(e.amount); });
    const breakdown = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([c,v]) => `${CATEGORIES[c]?.icon||'📦'} ${CATEGORIES[c]?.label||c}: ₹${fmtAmount(v)}`).join('\n');
    return `📊 **${monthName} Summary**\n\nTotal spent: **₹${fmtAmount(total)}**\n${budget>0?`Budget: ₹${fmtAmount(budget)} (${Math.round(pct)}% used)\nRemaining: ₹${fmtAmount(remaining)}\n`:''}\n${breakdown||'No expenses yet!'}`;
  }
  if (t.includes('budget') && (t.includes('track') || t.includes('on track') || t.includes('check'))) {
    if (!budget) return `No budget set for ${monthName}. Set one using:\n"set budget to 5000"`;
    if (pct >= 100) return `🚨 You've **exceeded your budget** by ₹${fmtAmount(Math.abs(remaining))}!\nSpent ₹${fmtAmount(total)} of ₹${fmtAmount(budget)}.`;
    if (pct >= 80)  return `⚠️ **${Math.round(pct)}% used** — only ₹${fmtAmount(remaining)} left.\nBe careful with spending!`;
    return `✅ You're on track! Used ${Math.round(pct)}% of ₹${fmtAmount(budget)} budget.\n₹${fmtAmount(remaining)} remaining this month.`;
  }
  if (t.includes('top') || t.includes('most') || t.includes('biggest') || t.includes('highest')) {
    const catTotals = {};
    expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category]||0) + Number(e.amount); });
    const sorted = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
    if (!sorted.length) return 'No expenses recorded yet this month!';
    const [topCat, topAmt] = sorted[0];
    return `🏆 Your biggest spending category is **${CATEGORIES[topCat]?.label||topCat}** at ₹${fmtAmount(topAmt)} this month.`;
  }
  if (t.includes('remaining') || t.includes('left') || t.includes('balance')) {
    if (!budget) return `No budget set. Set one: *"set budget to 5000"*`;
    return remaining >= 0 ? `✅ ₹${fmtAmount(remaining)} remaining this month.` : `❌ Over budget by ₹${fmtAmount(Math.abs(remaining))}!`;
  }
  if (t.includes('transaction') || t.includes('how many')) {
    return `You have **${expenses.length}** transaction${expenses.length!==1?'s':''} this month totalling ₹${fmtAmount(total)}.`;
  }
  return null; // Can't answer locally
}

// Parse budget set command locally
function localParseBudget(text) {
  const match = text.match(/(?:set\s+)?budget\s+(?:to\s+)?₹?\s*(\d+(?:,\d+)?(?:\.\d+)?)/i) ||
                text.match(/₹?\s*(\d+(?:,\d+)?(?:\.\d+)?)\s+(?:as\s+)?budget/i) ||
                text.match(/budget.*?(\d{3,})/i);
  if (match) {
    const amt = parseFloat(match[1].replace(',',''));
    if (amt > 0) return amt;
  }
  return null;
}

// ─── SEND MESSAGE (Hybrid: Local first, then AI if needed) ──────────────────

async function sendChatMessage() {
  const input   = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const text    = input.value.trim();
  if (!text) return;

  sendBtn.disabled = true;
  input.value = '';
  input.style.height = 'auto';
  addUserMessage(text);

  const { isQuestion, isBudgetSet, hasNumbers } = classifyInput(text);

  // ── 1. Try to parse budget set locally ──────────────────────────────────────
  if (isBudgetSet) {
    const amt = localParseBudget(text);
    if (amt) {
      await saveBudget(amt);
      playSuccessSound();
      addAIMessage(`✅ Budget set to **₹${fmtAmount(amt)}** for ${state.currentDate.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}!`);
      sendBtn.disabled = false;
      return;
    }
  }

  // ── 2. Try to answer questions locally ──────────────────────────────────────
  if (isQuestion) {
    const localAnswer = localAnswerQuestion(text);
    if (localAnswer) {
      addAIMessage(localAnswer);
      sendBtn.disabled = false;
      return;
    }
  }

  // ── 3. Try to parse expenses locally (fast, no API) ─────────────────────────
  if (hasNumbers && !isQuestion) {
    const parsed = localParseExpenses(text);
    if (parsed.length > 0) {
      const added = [];
      for (const e of parsed) {
        const result = await addExpenseCore(e.desc, e.amount, e.date, e.cat);
        if (result.ok) added.push(e);
      }
      if (added.length > 0) {
        renderAll(); updateAIContext(); playSuccessSound();
        addAIMessage(
          added.length === 1
            ? `✅ Added **${added[0].desc}** — ₹${fmtAmount(added[0].amount)}`
            : `✅ Added **${added.length} expenses** totalling ₹${fmtAmount(added.reduce((s,e)=>s+e.amount,0))}`,
          added
        );
        sendBtn.disabled = false;
        return;
      }
    }
  }

  // ── 4. Fall back to Anthropic API (for complex queries) ─────────────────────
  if (!anthropicApiKey) {
    addAIMessage(
      `I couldn't parse that locally. For complex queries, add your Anthropic API key.\n\n` +
      `Click **⚙️ API Key** button above the chat to add one.\n\n` +
      `Or try rephrasing — e.g. *"lunch 120"* or *"auto 60"*`
    );
    sendBtn.disabled = false;
    return;
  }

  chatHistory.push({ role: 'user', content: text });
  showTypingIndicator();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: anthropicApiKey,
        model: 'claude-haiku-4-5-20251001',  // Haiku = cheapest, fastest
        max_tokens: 800,
        system: buildSystemPrompt(),
        messages: chatHistory.slice(-10),
      }),
    });

    hideTypingIndicator();

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.error?.message || `HTTP ${response.status}`;

      if (response.status === 401) {
        addAIMessage(`❌ **Invalid API Key**\n\nClick ⚙️ API Key button to update it.`);
        anthropicApiKey = '';
        localStorage.removeItem('paisa_api_key');
        sendBtn.disabled = false; return;
      }
      if (response.status === 429) {
        addAIMessage(`⚠️ Rate limit hit — please wait a moment.`);
        sendBtn.disabled = false; return;
      }
      if (msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('billing')) {
        addAIMessage(
          `💳 **Anthropic account has no credits.**\n\n` +
          `Add $5 at: **console.anthropic.com → Settings → Billing → Add Credits**\n\n` +
          `**Good news:** Basic expense entry still works without credits!\n` +
          `Try: *"chai 30"* or *"auto 60 and lunch 120"*`
        );
        sendBtn.disabled = false; return;
      }
      throw new Error(msg);
    }

    const data    = await response.json();
    const rawText = (data.content?.[0]?.text || '{}').trim();

    let parsed = { message: '', actions: [] };
    try {
      const clean = rawText.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
      parsed = JSON.parse(clean);
    } catch(e) {
      parsed = { message: rawText.slice(0, 400) || 'Done!', actions: [] };
    }

    const { message = 'Done!', actions = [] } = parsed;
    const added = [];

    for (const action of (actions || [])) {
      if (action.type === 'add_expense') {
        if (!action.desc || !Number(action.amount) || Number(action.amount) <= 0) continue;
        const result = await addExpenseCore(action.desc, Number(action.amount), action.date || toDateStr(new Date()), action.cat || 'other');
        if (result.ok) { added.push(action); renderAll(); updateAIContext(); }
      } else if (action.type === 'set_budget' && Number(action.amount) > 0) {
        await saveBudget(Number(action.amount));
      }
    }

    if (added.length > 0) playSuccessSound();
    addAIMessage(message, added);
    chatHistory.push({ role: 'assistant', content: rawText });

  } catch(error) {
    hideTypingIndicator();
    playErrorSound();
    let msg = error.message || 'Unknown error';
    if (msg.toLowerCase().includes('failed to fetch')) {
      msg = `❌ Cannot reach the local server!\n\nMake sure **START.bat** is running, then refresh.`;
    }
    addAIMessage(msg);
  }

  sendBtn.disabled = false;
  setTimeout(() => input.focus(), 80);
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────

function buildSystemPrompt() {
  const { total, budget, remaining, expenses, pct } = calcMonthStats(monthKey(state.currentDate));
  const catTotals = {};
  expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category]||0) + Number(e.amount); });
  const today     = toDateStr(new Date());
  const yesterday = toDateStr(new Date(Date.now() - 86400000));
  const monthName = state.currentDate.toLocaleDateString('en-IN',{month:'long',year:'numeric'});

  return `You are Paisa AI, expense assistant for Indian college student.

DATA: Today:${today} Yesterday:${yesterday} Month:${monthName} Budget:${budget>0?'₹'+fmtAmount(budget):'Not set'} Spent:₹${fmtAmount(total)} Remaining:${budget>0?'₹'+fmtAmount(remaining):'N/A'} Txns:${expenses.length} Categories:${Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([c,v])=>`${CATEGORIES[c]?.label||c}:₹${fmtAmount(v)}`).join(',')||'none'} Recent:${expenses.slice(0,5).map(e=>`${e.date}:${e.desc}:₹${e.amount}`).join('|')||'none'}

RESPOND ONLY with valid JSON: {"message":"reply","actions":[...]}
Actions: {"type":"add_expense","desc":"name","amount":150,"date":"${today}","cat":"food"} or {"type":"set_budget","amount":5000}

Categories: food(chai/mess/lunch/dinner) transport(auto/bus/metro) study(book/xerox/fees) social(movie/party/zomato) health(medicine/doctor) shopping(clothes/amazon) other
Number words: fifty=50 hundred=100 thousand=1000 five hundred=500
Extract ALL expenses in one message. Use ${yesterday} for yesterday. Be warm, brief, use ₹. ALWAYS valid JSON.`;
}

// ─── CHAT UI ─────────────────────────────────────────────────────────────────

function addUserMessage(text) {
  const c   = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'message user';
  div.innerHTML = `<div class="message-avatar">👤</div><div class="message-body"><div class="message-bubble">${escHtml(text)}</div><div class="message-time">${nowTime()}</div></div>`;
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
}

function addAIMessage(text, addedExpenses = []) {
  const c   = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'message ai';
  const fmt = escHtml(text).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/\n/g,'<br>');
  const cards = addedExpenses.map(e => {
    const cat = CATEGORIES[e.cat||e.category] || CATEGORIES.other;
    return `<div class="expense-added-card"><div class="eac-icon" style="background:${cat.color}18;color:${cat.color}">${cat.icon}</div><div class="eac-info"><div class="eac-name">${escHtml(e.desc)}</div><div class="eac-meta">${cat.label} · ${e.date}</div></div><div class="eac-amount" style="color:${cat.color}">₹${fmtAmount(e.amount)}</div><div class="eac-badge">✓ Saved</div></div>`;
  }).join('');
  div.innerHTML = `<div class="message-avatar">✦</div><div class="message-body"><div class="message-bubble">${fmt}${cards?`<div style="margin-top:7px">${cards}</div>`:''}</div><div class="message-time">${nowTime()}</div></div>`;
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
}

function showTypingIndicator() {
  const ind = document.getElementById('typingIndicator');
  const m   = document.getElementById('chatMessages');
  ind.classList.add('show'); m.appendChild(ind); m.scrollTop = m.scrollHeight;
}
function hideTypingIndicator() { document.getElementById('typingIndicator').classList.remove('show'); }
function useQuickPrompt(t)  { document.getElementById('chatInput').value = t; sendChatMessage(); }
function handleChatKey(e)   { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChatMessage();} }
function autoResizeTextarea(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,100)+'px';}

// ─── VOICE ───────────────────────────────────────────────────────────────────

let voiceState={isListening:false,recognition:null,finalText:'',interimText:'',micStream:null,audioContext:null,analyser:null,animFrame:null};
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;

function openVoiceModal(){
  const o=document.getElementById('voiceOverlay');o.classList.add('show');
  voiceState.finalText='';voiceState.interimText='';
  setVoiceTranscript('','');setVoiceStatus('','Ready — tap Start');
  document.getElementById('voiceStartBtn').textContent='▶ Start Listening';
  document.getElementById('voiceStartBtn').classList.remove('stop');
  document.getElementById('voiceSendBtn').disabled=true;
  stopWaveAnimation();
  document.getElementById('voiceLiveBanner').classList.remove('show');
  o.onclick=e=>{if(e.target===o)closeVoiceModal();};
}
function closeVoiceModal(){stopVoiceRecording();stopWaveAnimation();stopMicStream();document.getElementById('voiceOverlay').classList.remove('show');document.getElementById('micBtn').classList.remove('recording');document.getElementById('voiceLiveBanner').classList.remove('show');}
function toggleVoiceRecording(){if(voiceState.isListening)stopVoiceRecording();else startVoiceRecording();}
function startVoiceRecording(){
  if(!SR){setVoiceStatus('error','Not supported — use Chrome or Edge');return;}
  voiceState.finalText='';voiceState.interimText='';setVoiceTranscript('','');
  document.getElementById('voiceSendBtn').disabled=true;
  const rec=new SR();voiceState.recognition=rec;
  rec.continuous=true;rec.interimResults=true;rec.lang=document.getElementById('voiceLang').value;
  rec.onstart=()=>{voiceState.isListening=true;setVoiceStatus('listening','Listening… speak now');document.getElementById('voiceStartBtn').textContent='⏹ Stop';document.getElementById('voiceStartBtn').classList.add('stop');document.getElementById('micBtn').classList.add('recording');startMicVisualization();};
  rec.onresult=e=>{
    let interim='',final=voiceState.finalText;
    for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)final+=(final?' ':'')+t.trim();else interim=t;}
    voiceState.finalText=final;voiceState.interimText=interim;setVoiceTranscript(final,interim);
    if(final)document.getElementById('voiceSendBtn').disabled=false;
    const b=document.getElementById('voiceLiveBanner');b.textContent=`🎙️ "${(final+' '+interim).trim().slice(0,90)}"`;b.classList.add('show');
  };
  rec.onerror=e=>{const m={'no-speech':'No speech — try again','not-allowed':'Allow microphone access','audio-capture':'No mic found'};setVoiceStatus('error',m[e.error]||'Error: '+e.error);voiceState.isListening=false;document.getElementById('voiceStartBtn').textContent='▶ Start Listening';document.getElementById('voiceStartBtn').classList.remove('stop');document.getElementById('micBtn').classList.remove('recording');stopWaveAnimation();stopMicStream();};
  rec.onend=()=>{if(voiceState.isListening){try{rec.start();}catch(e){}}else{document.getElementById('voiceStartBtn').textContent='▶ Start Listening';document.getElementById('voiceStartBtn').classList.remove('stop');document.getElementById('micBtn').classList.remove('recording');stopWaveAnimation();stopMicStream();setVoiceStatus(voiceState.finalText?'done':'',voiceState.finalText?'✓ Done! Click "Send to AI"':'Nothing captured');}};
  try{rec.start();}catch(e){setVoiceStatus('error','Could not start: '+e.message);}
}
function stopVoiceRecording(){voiceState.isListening=false;if(voiceState.recognition){try{voiceState.recognition.stop();}catch(e){}}}
async function startMicVisualization(){
  try{voiceState.micStream=await navigator.mediaDevices.getUserMedia({audio:true});voiceState.audioContext=new(window.AudioContext||window.webkitAudioContext)();voiceState.analyser=voiceState.audioContext.createAnalyser();voiceState.analyser.fftSize=64;voiceState.audioContext.createMediaStreamSource(voiceState.micStream).connect(voiceState.analyser);animateWaveform();}catch(e){animateDummyWaveform();}
}
function animateWaveform(){const bars=document.querySelectorAll('.wave-bar'),data=new Uint8Array(voiceState.analyser.frequencyBinCount);function draw(){voiceState.animFrame=requestAnimationFrame(draw);voiceState.analyser.getByteFrequencyData(data);bars.forEach((b,i)=>{const v=(data[i*2]||0)/255;b.style.height=Math.max(4,v*46)+'px';b.style.opacity=(0.35+v*0.65).toString();b.style.background=v>.5?'linear-gradient(to top,var(--ai),var(--accent))':'var(--ai)';b.classList.remove('animate');});}draw();}
function animateDummyWaveform(){document.querySelectorAll('.wave-bar').forEach(b=>b.classList.add('animate'));}
function stopWaveAnimation(){if(voiceState.animFrame){cancelAnimationFrame(voiceState.animFrame);voiceState.animFrame=null;}document.querySelectorAll('.wave-bar').forEach(b=>{b.classList.remove('animate');b.style.height='5px';b.style.opacity='.4';b.style.background='var(--ai)';});}
function stopMicStream(){if(voiceState.micStream){voiceState.micStream.getTracks().forEach(t=>t.stop());voiceState.micStream=null;}if(voiceState.audioContext){try{voiceState.audioContext.close();}catch(e){}voiceState.audioContext=null;}voiceState.analyser=null;}
function setVoiceTranscript(fin,inter){const el=document.getElementById('voiceTranscriptText'),wrap=document.getElementById('voiceTranscript');if(!fin&&!inter){wrap.className='voice-transcript empty';el.innerHTML='Tap Start and speak…';}else{wrap.className='voice-transcript';el.innerHTML=(fin?`<span class="voice-final">${escHtml(fin)}</span>`:'')+(inter?`<span class="voice-interim"> ${escHtml(inter)}</span>`:'');}}
function setVoiceStatus(st,tx){document.getElementById('voiceStatusDot').className='voice-status-dot'+(st?' '+st:'');document.getElementById('voiceStatusText').textContent=tx;}
function sendVoiceToAI(){const t=(voiceState.finalText+' '+voiceState.interimText).trim();if(!t)return;stopVoiceRecording();closeVoiceModal();const inp=document.getElementById('chatInput');inp.value=t;autoResizeTextarea(inp);setTimeout(()=>sendChatMessage(),120);}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('voiceOverlay').classList.contains('show'))closeVoiceModal();});
