/**
 * ai.js — Paisa AI Chat (OpenAI Version)
 * - No API key required from the user.
 * - Simple expenses handled locally.
 * - Complex queries sent to backend /api/chat.
 */

let chatHistory = [];

// ─── INIT ────────────────────────────────────────────────────────────────────
function initAIChat() {
  addAIMessage(
    `Hi! I'm **Paisa AI** 👋\n\n` +
    `I can help you track and analyze your expenses.\n\n` +
    `⚡ **Smart Local Mode** handles basic commands instantly:\n` +
    `• "chai 30, auto 60"\n` +
    `• "set budget to 5000"\n` +
    `• "how much have I spent?"\n\n` +
    `🤖 For advanced insights, I automatically use AI.`
  );
}

// ─── SEND MESSAGE ────────────────────────────────────────────────────────────
async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const text = input.value.trim();
  if (!text) return;

  sendBtn.disabled = true;
  input.value = '';
  addUserMessage(text);

  const { isQuestion, isBudgetSet, hasNumbers } = classifyInput(text);

  // 1. Set Budget Locally
  if (isBudgetSet) {
    const amt = localParseBudget(text);
    if (amt) {
      await saveBudget(amt);
      playSuccessSound();
      addAIMessage(`✅ Budget set to **₹${fmtAmount(amt)}**!`);
      sendBtn.disabled = false;
      return;
    }
  }

  // 2. Answer Questions Locally
  if (isQuestion) {
    const localAnswer = localAnswerQuestion(text);
    if (localAnswer) {
      addAIMessage(localAnswer);
      sendBtn.disabled = false;
      return;
    }
  }

  // 3. Parse Expenses Locally
  if (hasNumbers && !isQuestion) {
    const parsed = localParseExpenses(text);
    if (parsed.length > 0) {
      const added = [];
      for (const e of parsed) {
        const result = await addExpenseCore(
          e.desc,
          e.amount,
          e.date,
          e.cat
        );
        if (result.ok) added.push(e);
      }

      if (added.length > 0) {
        renderAll();
        updateAIContext();
        playSuccessSound();
        addAIMessage(
          added.length === 1
            ? `✅ Added **${added[0].desc}** — ₹${fmtAmount(
                added[0].amount
              )}`
            : `✅ Added **${added.length} expenses** totalling ₹${fmtAmount(
                added.reduce((s, e) => s + e.amount, 0)
              )}`,
          added
        );
        sendBtn.disabled = false;
        return;
      }
    }
  }

  // 4. Fallback to OpenAI for complex queries
  showTypingIndicator();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });

    hideTypingIndicator();

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const aiText =
      data.choices?.[0]?.message?.content ||
      "I'm sorry, I couldn't process that.";

    addAIMessage(aiText);

    chatHistory.push({ role: 'user', content: text });
    chatHistory.push({ role: 'assistant', content: aiText });

  } catch (error) {
    hideTypingIndicator();
    playErrorSound();
    addAIMessage(`❌ Error: ${error.message}`);
  }

  sendBtn.disabled = false;
  setTimeout(() => input.focus(), 80);
}

// ─── CLASSIFICATION ──────────────────────────────────────────────────────────
function classifyInput(text) {
  const t = text.toLowerCase().trim();
  const questionWords = [
    'how much','how many','what','which','when','why',
    'show','tell me','give me','list','analyze','suggest'
  ];
  const isQuestion =
    questionWords.some(w => t.startsWith(w)) || t.endsWith('?');
  const isBudgetSet = /set.*(budget|limit)/i.test(t);
  const hasNumbers = /\d/.test(t);
  return { isQuestion, isBudgetSet, hasNumbers };
}