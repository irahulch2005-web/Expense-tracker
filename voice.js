(() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = document.getElementById('aiMicBtn');
  const speakBtn = document.getElementById('aiSpeakBtn');
  const aiInput = document.getElementById('aiInput');
  const sendBtn = document.getElementById('aiSendBtn');
  const messages = document.getElementById('aiMessages');

  if (!SR) {
    micBtn.style.display = 'none';
    console.warn('Speech recognition not supported in this browser');
  }

  let speakOn = true;
  let lastSpoken = '';
  let lastUserText = '';

  const toast = (msg) => {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  };

  // ---- Voice command: add expense / income ----
  const CATS = {
    food: ['food', 'dining', 'lunch', 'dinner', 'breakfast', 'swiggy', 'zomato', 'snacks'],
    transport: ['transport', 'bus', 'auto', 'uber', 'ola', 'petrol', 'fuel', 'metro', 'train'],
    shopping: ['shopping', 'clothes', 'amazon', 'flipkart'],
    entertainment: ['entertainment', 'movie', 'netflix', 'game', 'spotify'],
    health: ['health', 'medicine', 'doctor', 'hospital'],
    utilities: ['utilities', 'electricity', 'recharge', 'wifi', 'bill', 'rent'],
    education: ['education', 'book', 'books', 'course', 'fees', 'tuition'],
    salary: ['salary'],
    freelance: ['freelance'],
    investment: ['investment', 'sip', 'stocks']
  };
  const INCOME = ['salary', 'freelance', 'investment'];

  function tryAddCommand(text) {
    const t = text.toLowerCase();
    if (!/^(add|log|spent|received|got)\b/.test(t)) return false;
    const amt = t.match(/(\d+(?:\.\d+)?)/);
    if (!amt) return false;

    let category = 'other';
    for (const [cat, words] of Object.entries(CATS)) {
      if (words.some(w => new RegExp(`\\b${w}\\b`).test(t))) { category = cat; break; }
    }
    const isIncome = INCOME.includes(category) || /\b(income|received|got)\b/.test(t);

    const name = t
      .replace(/^(add|log|spent|received|got)\s*(an?\s*)?(expense|income)?/, '')
      .replace(/(\d+(?:\.\d+)?)/, '')
      .replace(/\b(rupees?|rs|inr|for|on|in|category)\b/g, '')
      .replace(/\s+/g, ' ').trim();

    document.getElementById('openAddModal').click();
    document.getElementById(isIncome ? 'btnIncome' : 'btnExpense').click();
    document.getElementById('txName').value = name ? name.charAt(0).toUpperCase() + name.slice(1) : category;
    document.getElementById('txAmount').value = amt[1];
    document.getElementById('txCategory').value = category;
    document.getElementById('txDate').value = new Date().toISOString().slice(0, 10);
    speak(`Filled ${amt[1]} rupees for ${category}. Please confirm.`);
    return true;
  }

  // ---- Speech recognition (mic) ----
  if (SR) {
    const rec = new SR();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    micBtn.addEventListener('click', () => {
      if (micBtn.classList.contains('listening')) { rec.stop(); return; }
      try { rec.start(); } catch (e) {}
    });
    rec.onstart = () => micBtn.classList.add('listening');
    rec.onend = () => micBtn.classList.remove('listening');
    rec.onerror = (e) => {
      micBtn.classList.remove('listening');
      toast(e.error === 'not-allowed' ? 'Allow microphone access' : 'Voice error: ' + e.error);
    };
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript.trim();
      if (tryAddCommand(text)) return;
      aiInput.value = text;
      lastUserText = text;
      sendBtn.click();
    };
  }

  // ---- Speech synthesis (read replies) ----
  function speak(text) {
    if (!speakOn || !('speechSynthesis' in window) || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN';
    u.rate = 1;
    speechSynthesis.speak(u);
  }

  speakBtn.addEventListener('click', () => {
    speakOn = !speakOn;
    speakBtn.classList.toggle('off', !speakOn);
    if (!speakOn) speechSynthesis.cancel();
  });

  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const all = messages.querySelectorAll('.ai-message');
      const last = all[all.length - 1];
      if (!last || last.classList.contains('ai-welcome')) return;
      const bubble = last.querySelector('.ai-bubble') || last;
      const text = bubble.innerText.replace(/^Spendly AI\s*/i, '').trim();
      if (!text || text === lastSpoken || text === lastUserText) return;
      lastSpoken = text;
      speak(text);
    }, 700);
  }).observe(messages, { childList: true, subtree: true });
})();
