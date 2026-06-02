/**
 * ═══════════════════════════════════════════════════════════════
 * SPENDLY — EXPENSE TRACKER  |  script.js
 * ───────────────────────────────────────────────────────────────
 * Features:
 *  - Add / Edit / Delete transactions (localStorage)
 *  - Dashboard: Balance, Income, Expense cards + savings %
 *  - Recent transactions widget
 *  - Donut chart (spending by category)
 *  - Transactions page: search + filter
 *  - Analytics: monthly bar chart, category pie, income vs expense bar
 *  - Budget: set limit, progress bar, category spend list, alerts
 *  - Dark / Light mode toggle
 *  - Export to CSV
 *  - Toast notifications
 *  - Input validation
 * ═══════════════════════════════════════════════════════════════
 */

/* ─────────────────────────────────────────────────────────────
   1.  CONSTANTS & CONFIG
───────────────────────────────────────────────────────────── */

// Storage keys
const STORAGE_KEY   = 'spendly_transactions';
const BUDGET_KEY    = 'spendly_budget';
const THEME_KEY     = 'spendly_theme';

// Category emoji + colour mapping
const CATEGORY_META = {
  food         : { emoji: '🍔', color: '#f59e0b', label: 'Food & Dining'  },
  transport    : { emoji: '🚗', color: '#3b82f6', label: 'Transport'      },
  shopping     : { emoji: '🛍', color: '#ec4899', label: 'Shopping'       },
  entertainment: { emoji: '🎬', color: '#8b5cf6', label: 'Entertainment'  },
  health       : { emoji: '💊', color: '#10b981', label: 'Health'         },
  utilities    : { emoji: '💡', color: '#06b6d4', label: 'Utilities'      },
  education    : { emoji: '📚', color: '#f97316', label: 'Education'      },
  other        : { emoji: '📦', color: '#6b7280', label: 'Other'          },
  salary       : { emoji: '💼', color: '#34d399', label: 'Salary'         },
  freelance    : { emoji: '💻', color: '#a3e635', label: 'Freelance'      },
  investment   : { emoji: '📈', color: '#22d3ee', label: 'Investment'     },
};

/* ─────────────────────────────────────────────────────────────
   2.  STATE
───────────────────────────────────────────────────────────── */

let transactions = [];   // Array of transaction objects
let budget       = null; // Monthly budget number (or null)
let editingId    = null; // ID of transaction currently being edited
let charts       = {};   // Chart.js instances keyed by canvas id

// Chart.js theme-aware colours
let chartColors = {};

/* ─────────────────────────────────────────────────────────────
   3.  DOM REFERENCES (cached at startup)
───────────────────────────────────────────────────────────── */

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const DOM = {
  loader          : $('loader'),
  sidebar         : $('sidebar'),
  sidebarClose    : $('sidebarClose'),
  hamburger       : $('hamburger'),
  themeToggle     : $('themeToggle'),
  themeIcon       : $('themeIcon'),
  themeLabel      : $('themeLabel'),
  pageTitle       : $('pageTitle'),
  exportBtn       : $('exportBtn'),
  openAddModal    : $('openAddModal'),
  modalOverlay    : $('modalOverlay'),
  modalClose      : $('modalClose'),
  modalTitle      : $('modalTitle'),

  // Dashboard
  totalBalance    : $('totalBalance'),
  totalIncome     : $('totalIncome'),
  totalExpense    : $('totalExpense'),
  savingsRate     : $('savingsRate'),
  recentList      : $('recentList'),
  donutCenter     : $('donutCenter'),
  donutLegend     : $('donutLegend'),

  // Transactions
  searchInput     : $('searchInput'),
  filterCategory  : $('filterCategory'),
  filterType      : $('filterType'),
  transactionList : $('transactionList'),

  // Budget
  budgetInput     : $('budgetInput'),
  saveBudgetBtn   : $('saveBudgetBtn'),
  budgetSpent     : $('budgetSpent'),
  budgetLimit     : $('budgetLimit'),
  budgetBar       : $('budgetBar'),
  budgetPercent   : $('budgetPercent'),
  budgetAlert     : $('budgetAlert'),
  budgetAlertMsg  : $('budgetAlertMsg'),
  categorySpendList: $('categorySpendList'),

  // Form fields
  transactionForm : $('transactionForm'),
  txId            : $('txId'),
  txName          : $('txName'),
  txAmount        : $('txAmount'),
  txCategory      : $('txCategory'),
  txDate          : $('txDate'),
  txNote          : $('txNote'),
  btnExpense      : $('btnExpense'),
  btnIncome       : $('btnIncome'),
  submitBtn       : $('submitBtn'),
  submitLabel     : $('submitLabel'),
  toastContainer  : $('toastContainer'),
};

/* ─────────────────────────────────────────────────────────────
   4.  UTILITIES
───────────────────────────────────────────────────────────── */

/** Generate a unique ID */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

/** Format currency in Indian Rupees */
const fmt = n => '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Format date string (YYYY-MM-DD) to readable */
const fmtDate = d => {
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Get today's date as YYYY-MM-DD */
const today = () => new Date().toISOString().split('T')[0];

/** Get current month-year key e.g. "2025-06" */
const monthKey = (dateStr) => dateStr.slice(0, 7);

/** Get last N month keys, most-recent first */
const lastNMonths = (n = 6) => {
  const keys = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    keys.unshift(`${y}-${m}`);
    d.setMonth(d.getMonth() - 1);
  }
  return keys;
};

/** Month key → pretty label e.g. "Jun '25" */
const monthLabel = mk => {
  const [y, m] = mk.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-IN', { month: 'short' }) + ' \'' + y.slice(2);
};

/* ─────────────────────────────────────────────────────────────
   5.  LOCAL STORAGE
───────────────────────────────────────────────────────────── */

/** Load transactions from localStorage */
function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    transactions = raw ? JSON.parse(raw) : [];
  } catch {
    transactions = [];
  }
}

/** Save transactions to localStorage */
function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

/** Load budget from localStorage */
function loadBudget() {
  const raw = localStorage.getItem(BUDGET_KEY);
  budget = raw ? parseFloat(raw) : null;
}

/** Save budget to localStorage */
function saveBudget(val) {
  budget = val;
  localStorage.setItem(BUDGET_KEY, val);
}

/* ─────────────────────────────────────────────────────────────
   6.  THEME MANAGEMENT
───────────────────────────────────────────────────────────── */

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  setTheme(saved, false);
}

function setTheme(theme, animate = true) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);

  if (theme === 'dark') {
    DOM.themeIcon.setAttribute('data-lucide', 'sun');
    DOM.themeLabel.textContent = 'Light Mode';
  } else {
    DOM.themeIcon.setAttribute('data-lucide', 'moon');
    DOM.themeLabel.textContent = 'Dark Mode';
  }
  lucide.createIcons(); // Re-render icon

  updateChartColors();
  if (animate) rebuildAllCharts();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
}

/** Read CSS variable colours for charts */
function updateChartColors() {
  const style = getComputedStyle(document.documentElement);
  const get = v => style.getPropertyValue(v).trim();
  chartColors = {
    text     : get('--text-primary'),
    muted    : get('--text-muted'),
    grid     : get('--border'),
    accent   : get('--accent'),
    income   : get('--income'),
    expense  : get('--expense'),
    surface  : get('--bg-surface'),
    elevated : get('--bg-elevated'),
  };
}

/* ─────────────────────────────────────────────────────────────
   7.  NAVIGATION (section switching)
───────────────────────────────────────────────────────────── */

const SECTION_TITLES = {
  dashboard   : 'Dashboard',
  transactions: 'Transactions',
  analytics   : 'Analytics',
  budget      : 'Budget',
};

function switchSection(name) {
  // Hide all sections
  $$('.section').forEach(s => s.classList.remove('active'));
  $$('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target
  const sec = $(`section-${name}`);
  if (sec) sec.classList.add('active');

  const navLink = document.querySelector(`.nav-item[data-section="${name}"]`);
  if (navLink) navLink.classList.add('active');

  DOM.pageTitle.textContent = SECTION_TITLES[name] || 'Spendly';

  // Rebuild charts when switching to analytics
  if (name === 'analytics') rebuildAllCharts();
  if (name === 'budget')    renderBudgetSection();
  if (name === 'dashboard') renderDashboard();

  // Close mobile sidebar
  closeSidebar();
}

/* ─────────────────────────────────────────────────────────────
   8.  SIDEBAR (mobile open/close)
───────────────────────────────────────────────────────────── */

function openSidebar() {
  DOM.sidebar.classList.add('open');
  // Create overlay if needed
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', closeSidebar);
  }
  overlay.classList.add('visible');
}

function closeSidebar() {
  DOM.sidebar.classList.remove('open');
  const overlay = document.querySelector('.sidebar-overlay');
  if (overlay) overlay.classList.remove('visible');
}

/* ─────────────────────────────────────────────────────────────
   9.  MODAL (Add / Edit transaction)
───────────────────────────────────────────────────────────── */

function openModal(mode = 'add', txData = null) {
  resetForm();
  if (mode === 'edit' && txData) {
    // Populate form with existing data
    editingId = txData.id;
    DOM.txId.value       = txData.id;
    DOM.txName.value     = txData.name;
    DOM.txAmount.value   = txData.amount;
    DOM.txCategory.value = txData.category;
    DOM.txDate.value     = txData.date;
    DOM.txNote.value     = txData.note || '';
    setTransactionType(txData.type);
    DOM.modalTitle.textContent = 'Edit Transaction';
    DOM.submitLabel.textContent = 'Save Changes';
  } else {
    editingId = null;
    DOM.txDate.value = today();
    DOM.modalTitle.textContent = 'Add Transaction';
    DOM.submitLabel.textContent = 'Add Transaction';
  }
  DOM.modalOverlay.classList.add('open');
  setTimeout(() => DOM.txName.focus(), 80);
}

function closeModal() {
  DOM.modalOverlay.classList.remove('open');
  resetForm();
  editingId = null;
}

function resetForm() {
  DOM.transactionForm.reset();
  DOM.txId.value = '';
  clearErrors();
  setTransactionType('expense'); // default
}

function setTransactionType(type) {
  DOM.btnExpense.classList.toggle('active', type === 'expense');
  DOM.btnIncome.classList.toggle('active', type === 'income');
}

function getTransactionType() {
  return DOM.btnIncome.classList.contains('active') ? 'income' : 'expense';
}

/* ─────────────────────────────────────────────────────────────
   10.  FORM VALIDATION
───────────────────────────────────────────────────────────── */

function clearErrors() {
  ['Name','Amount','Category','Date'].forEach(f => {
    const err = $(`err${f}`);
    if (err) err.textContent = '';
    const group = DOM[`tx${f}`]?.closest('.form-group');
    if (group) group.classList.remove('has-error');
  });
}

function showError(field, msg) {
  const err = $(`err${field}`);
  if (err) err.textContent = msg;
  const input = DOM[`tx${field}`];
  if (input) input.closest('.form-group')?.classList.add('has-error');
}

function validateForm() {
  clearErrors();
  let valid = true;

  const name = DOM.txName.value.trim();
  if (!name) { showError('Name', 'Please enter a transaction name.'); valid = false; }
  else if (name.length < 2) { showError('Name', 'Name must be at least 2 characters.'); valid = false; }

  const amount = parseFloat(DOM.txAmount.value);
  if (!DOM.txAmount.value || isNaN(amount)) { showError('Amount', 'Please enter a valid amount.'); valid = false; }
  else if (amount <= 0) { showError('Amount', 'Amount must be greater than ₹0.'); valid = false; }

  if (!DOM.txCategory.value) { showError('Category', 'Please select a category.'); valid = false; }

  if (!DOM.txDate.value) { showError('Date', 'Please select a date.'); valid = false; }

  return valid;
}

/* ─────────────────────────────────────────────────────────────
   11.  CRUD OPERATIONS
───────────────────────────────────────────────────────────── */

function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const tx = {
    id      : editingId || uid(),
    name    : DOM.txName.value.trim(),
    amount  : parseFloat(parseFloat(DOM.txAmount.value).toFixed(2)),
    category: DOM.txCategory.value,
    date    : DOM.txDate.value,
    note    : DOM.txNote.value.trim(),
    type    : getTransactionType(),
    createdAt: editingId
      ? (transactions.find(t => t.id === editingId)?.createdAt || Date.now())
      : Date.now(),
  };

  if (editingId) {
    // Update existing
    const idx = transactions.findIndex(t => t.id === editingId);
    if (idx !== -1) transactions[idx] = tx;
    showToast('Transaction updated!', 'success');
  } else {
    // Add new
    transactions.unshift(tx);
    showToast('Transaction added!', 'success');
  }

  saveTransactions();
  closeModal();
  renderAll();
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  renderAll();
  showToast('Transaction deleted.', 'info');
}

/* ─────────────────────────────────────────────────────────────
   12.  COMPUTED AGGREGATES
───────────────────────────────────────────────────────────── */

/** Get current month's transactions */
function currentMonthTx() {
  const mk = today().slice(0, 7);
  return transactions.filter(t => t.date.slice(0, 7) === mk);
}

/** Sum income and expense for a list of transactions */
function sumTx(list) {
  return list.reduce((acc, t) => {
    if (t.type === 'income')  acc.income  += t.amount;
    if (t.type === 'expense') acc.expense += t.amount;
    return acc;
  }, { income: 0, expense: 0 });
}

/* ─────────────────────────────────────────────────────────────
   13.  RENDER — DASHBOARD
───────────────────────────────────────────────────────────── */

function renderDashboard() {
  const all = transactions;
  const totals = sumTx(all);
  const balance = totals.income - totals.expense;

  // Cards
  DOM.totalBalance.textContent = (balance < 0 ? '-' : '') + fmt(balance);
  DOM.totalIncome.textContent  = fmt(totals.income);
  DOM.totalExpense.textContent = fmt(totals.expense);

  // Savings rate
  const rate = totals.income > 0
    ? Math.round(((totals.income - totals.expense) / totals.income) * 100)
    : 0;
  const icon = rate >= 0 ? 'trending-up' : 'trending-down';
  DOM.savingsRate.innerHTML = `<i data-lucide="${icon}"></i> <span>${rate}% savings rate</span>`;
  lucide.createIcons({ nodes: [DOM.savingsRate] });

  renderRecentList();
  renderMiniDonut();
}

function renderRecentList() {
  const recent = transactions.slice(0, 6);
  if (!recent.length) {
    DOM.recentList.innerHTML = `
      <li class="empty-state">
        <i data-lucide="inbox"></i>
        <p>No transactions yet</p>
      </li>`;
    lucide.createIcons({ nodes: [DOM.recentList] });
    return;
  }

  DOM.recentList.innerHTML = recent.map(t => {
    const meta = CATEGORY_META[t.category] || CATEGORY_META.other;
    return `
      <li class="recent-item">
        <div class="tx-icon" style="background:${meta.color}22;">${meta.emoji}</div>
        <div class="tx-info">
          <div class="tx-name">${escHtml(t.name)}</div>
          <div class="tx-meta">${fmtDate(t.date)} · ${meta.label}</div>
        </div>
        <div class="tx-amount ${t.type}">
          ${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}
        </div>
      </li>`;
  }).join('');
}

function renderMiniDonut() {
  // Aggregate expenses by category
  const expenses = transactions.filter(t => t.type === 'expense');
  const catTotals = {};
  expenses.forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  });

  const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, 6);
  const totalExp = top.reduce((s, [, v]) => s + v, 0);

  DOM.donutLegend.innerHTML = '';
  DOM.donutCenter.textContent = totalExp ? fmt(totalExp) : 'No data';

  if (!top.length) {
    if (charts.miniDonut) { charts.miniDonut.destroy(); charts.miniDonut = null; }
    return;
  }

  const labels = top.map(([k]) => CATEGORY_META[k]?.label || k);
  const data   = top.map(([, v]) => v);
  const colors = top.map(([k]) => CATEGORY_META[k]?.color || '#888');

  // Legend
  DOM.donutLegend.innerHTML = top.map(([k, v]) => {
    const meta = CATEGORY_META[k] || CATEGORY_META.other;
    return `<li class="legend-item">
      <span class="legend-dot" style="background:${meta.color}"></span>
      <span class="legend-label">${meta.label}</span>
      <span class="legend-val">${fmt(v)}</span>
    </li>`;
  }).join('');

  buildDonutChart('miniDonut', labels, data, colors);
}

/* ─────────────────────────────────────────────────────────────
   14.  RENDER — TRANSACTIONS LIST
───────────────────────────────────────────────────────────── */

function renderTransactions() {
  const search  = DOM.searchInput.value.trim().toLowerCase();
  const catFilt = DOM.filterCategory.value;
  const typFilt = DOM.filterType.value;

  let filtered = transactions.filter(t => {
    const matchSearch = !search ||
      t.name.toLowerCase().includes(search) ||
      (t.note || '').toLowerCase().includes(search);
    const matchCat  = catFilt === 'all' || t.category === catFilt;
    const matchType = typFilt === 'all' || t.type === typFilt;
    return matchSearch && matchCat && matchType;
  });

  if (!filtered.length) {
    DOM.transactionList.innerHTML = `
      <li class="empty-state">
        <i data-lucide="inbox"></i>
        <p>No transactions found</p>
      </li>`;
    lucide.createIcons({ nodes: [DOM.transactionList] });
    return;
  }

  DOM.transactionList.innerHTML = filtered.map(t => {
    const meta = CATEGORY_META[t.category] || CATEGORY_META.other;
    return `
      <li class="tx-row" data-id="${t.id}">
        <div class="tx-icon" style="background:${meta.color}22;">${meta.emoji}</div>
        <div class="tx-info">
          <div class="tx-name">${escHtml(t.name)}</div>
          <div class="tx-meta">${fmtDate(t.date)} · ${meta.label}${t.note ? ' · ' + escHtml(t.note) : ''}</div>
        </div>
        <div class="tx-row-amount ${t.type}">
          ${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}
        </div>
        <div class="tx-actions">
          <button class="action-btn edit-btn" data-id="${t.id}" title="Edit">
            <i data-lucide="pencil"></i>
          </button>
          <button class="action-btn delete-btn" data-id="${t.id}" title="Delete">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </li>`;
  }).join('');

  lucide.createIcons({ nodes: [DOM.transactionList] });

  // Attach edit / delete listeners
  DOM.transactionList.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tx = transactions.find(t => t.id === btn.dataset.id);
      if (tx) openModal('edit', tx);
    });
  });
  DOM.transactionList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTransaction(btn.dataset.id));
  });
}

/* ─────────────────────────────────────────────────────────────
   15.  RENDER — ANALYTICS CHARTS
───────────────────────────────────────────────────────────── */

function rebuildAllCharts() {
  updateChartColors();
  renderMonthlyChart();
  renderCategoryChart();
  renderIncomeExpenseChart();
  renderMiniDonut();
}

/** Bar chart: income & expense per month for last 6 months */
function renderMonthlyChart() {
  const months = lastNMonths(6);
  const incomeData  = months.map(mk =>
    transactions.filter(t => t.type === 'income'  && t.date.slice(0,7) === mk).reduce((s,t) => s+t.amount, 0)
  );
  const expenseData = months.map(mk =>
    transactions.filter(t => t.type === 'expense' && t.date.slice(0,7) === mk).reduce((s,t) => s+t.amount, 0)
  );

  buildBarChart('monthlyChart', {
    labels: months.map(monthLabel),
    datasets: [
      { label: 'Income',  data: incomeData,  backgroundColor: chartColors.income  + 'cc' },
      { label: 'Expense', data: expenseData, backgroundColor: chartColors.expense + 'cc' },
    ],
  });
}

/** Doughnut: expenses by category */
function renderCategoryChart() {
  const expenses = transactions.filter(t => t.type === 'expense');
  if (!expenses.length) { clearCanvas('categoryChart'); return; }

  const catTotals = {};
  expenses.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
  const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  buildDonutChart(
    'categoryChart',
    entries.map(([k]) => CATEGORY_META[k]?.label || k),
    entries.map(([,v]) => v),
    entries.map(([k]) => CATEGORY_META[k]?.color || '#888'),
  );
}

/** Horizontal bar: income vs expense total */
function renderIncomeExpenseChart() {
  const totals = sumTx(transactions);
  buildBarChart('incomeExpenseChart', {
    labels: ['Income', 'Expenses'],
    datasets: [{
      label: 'Amount',
      data : [totals.income, totals.expense],
      backgroundColor: [chartColors.income + 'cc', chartColors.expense + 'cc'],
    }],
  }, true); // horizontal
}

/* ─────────────────────────────────────────────────────────────
   16.  CHART BUILDERS
───────────────────────────────────────────────────────────── */

function buildBarChart(canvasId, data, horizontal = false) {
  const canvas = $(canvasId);
  if (!canvas) return;

  if (charts[canvasId]) charts[canvasId].destroy();

  charts[canvasId] = new Chart(canvas, {
    type: 'bar',
    data,
    options: {
      indexAxis     : horizontal ? 'y' : 'x',
      responsive    : true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: chartColors.text, font: { family: 'DM Sans', size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + fmt(ctx.raw)
          }
        }
      },
      scales: {
        x: {
          grid : { color: chartColors.grid },
          ticks: { color: chartColors.muted, font: { family: 'DM Sans', size: 11 } }
        },
        y: {
          grid : { color: chartColors.grid },
          ticks: {
            color: chartColors.muted,
            font : { family: 'DM Sans', size: 11 },
            callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v)
          }
        }
      }
    }
  });
}

function buildDonutChart(canvasId, labels, data, colors) {
  const canvas = $(canvasId);
  if (!canvas) return;

  if (charts[canvasId]) charts[canvasId].destroy();

  charts[canvasId] = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: chartColors.surface }] },
    options: {
      responsive          : true,
      maintainAspectRatio : false,
      cutout              : '68%',
      plugins: {
        legend: {
          display: canvasId === 'categoryChart',
          position: 'right',
          labels: { color: chartColors.text, font: { family: 'DM Sans', size: 11 }, boxWidth: 10 }
        },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}` }
        }
      }
    }
  });
}

function clearCanvas(id) {
  if (charts[id]) { charts[id].destroy(); charts[id] = null; }
}

/* ─────────────────────────────────────────────────────────────
   17.  RENDER — BUDGET SECTION
───────────────────────────────────────────────────────────── */

function renderBudgetSection() {
  // Populate input if budget already set
  if (budget !== null) DOM.budgetInput.value = budget;

  const thisMonth  = currentMonthTx();
  const { expense: spent } = sumTx(thisMonth);

  DOM.budgetSpent.textContent = fmt(spent);
  DOM.budgetLimit.textContent = budget !== null ? fmt(budget) : 'Not set';

  if (budget !== null && budget > 0) {
    const pct = Math.min((spent / budget) * 100, 100);
    DOM.budgetBar.style.width = pct + '%';
    DOM.budgetPercent.textContent = `${pct.toFixed(0)}% used`;

    // Colour coding
    DOM.budgetBar.className = 'progress-bar-fill';
    if (pct >= 90)       DOM.budgetBar.classList.add('danger');
    else if (pct >= 70)  DOM.budgetBar.classList.add('warning');

    // Alert
    if (pct >= 100) {
      DOM.budgetAlert.style.display = 'flex';
      DOM.budgetAlertMsg.textContent = `You've exceeded your monthly budget by ${fmt(spent - budget)}!`;
    } else if (pct >= 80) {
      DOM.budgetAlert.style.display = 'flex';
      DOM.budgetAlertMsg.textContent = `⚠️ You've used ${pct.toFixed(0)}% of your budget. Slow down!`;
    } else {
      DOM.budgetAlert.style.display = 'none';
    }
  } else {
    DOM.budgetBar.style.width = '0%';
    DOM.budgetPercent.textContent = 'Set a budget above';
    DOM.budgetAlert.style.display = 'none';
  }

  renderCategorySpend(thisMonth);
}

function renderCategorySpend(txList) {
  const expenses = txList.filter(t => t.type === 'expense');
  if (!expenses.length) {
    DOM.categorySpendList.innerHTML = `
      <li class="empty-state"><i data-lucide="inbox"></i><p>No expenses this month</p></li>`;
    lucide.createIcons({ nodes: [DOM.categorySpendList] });
    return;
  }

  const catTotals = {};
  expenses.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
  const max = Math.max(...Object.values(catTotals));
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  DOM.categorySpendList.innerHTML = sorted.map(([cat, val]) => {
    const meta = CATEGORY_META[cat] || CATEGORY_META.other;
    const pct  = ((val / max) * 100).toFixed(0);
    return `<li class="cat-spend-item">
      <div class="cat-spend-top">
        <span>${meta.emoji} ${meta.label}</span>
        <span>${fmt(val)}</span>
      </div>
      <div class="cat-bar-bg">
        <div class="cat-bar-fill" style="width:${pct}%; background:${meta.color};"></div>
      </div>
    </li>`;
  }).join('');
}

/* ─────────────────────────────────────────────────────────────
   18.  TOAST NOTIFICATIONS
───────────────────────────────────────────────────────────── */

/**
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function showToast(message, type = 'info') {
  const iconMap = { success: 'check-circle', error: 'x-circle', info: 'info' };
  const icon    = iconMap[type] || 'info';

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i data-lucide="${icon}"></i><span>${escHtml(message)}</span>`;
  DOM.toastContainer.appendChild(toast);
  lucide.createIcons({ nodes: [toast] });

  // Auto-remove after 3.5 s
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

/* ─────────────────────────────────────────────────────────────
   19.  EXPORT TO CSV
───────────────────────────────────────────────────────────── */

function exportToCSV() {
  if (!transactions.length) {
    showToast('No transactions to export.', 'error');
    return;
  }

  const headers = ['ID','Name','Amount','Type','Category','Date','Note'];
  const rows = transactions.map(t => [
    t.id,
    `"${t.name.replace(/"/g, '""')}"`,
    t.amount,
    t.type,
    CATEGORY_META[t.category]?.label || t.category,
    t.date,
    `"${(t.note || '').replace(/"/g, '""')}"`,
  ]);

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `spendly_transactions_${today()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('CSV exported successfully!', 'success');
}

/* ─────────────────────────────────────────────────────────────
   20.  SECURITY HELPER
───────────────────────────────────────────────────────────── */

/** Escape HTML to prevent XSS when rendering user input */
function escHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ─────────────────────────────────────────────────────────────
   21.  MASTER RENDER  (renders whichever section is active)
───────────────────────────────────────────────────────────── */

function renderAll() {
  renderDashboard();
  renderTransactions();

  const activeSection = document.querySelector('.section.active')?.id?.replace('section-', '');
  if (activeSection === 'analytics') rebuildAllCharts();
  if (activeSection === 'budget')    renderBudgetSection();
}

/* ─────────────────────────────────────────────────────────────
   22.  EVENT LISTENERS
───────────────────────────────────────────────────────────── */

function bindEvents() {

  /* ── Navigation ── */
  $$('.nav-item').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      switchSection(link.dataset.section);
    });
  });

  /* "View all" links on dashboard */
  $$('.view-all').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      switchSection(link.dataset.section);
    });
  });

  /* ── Sidebar ── */
  DOM.hamburger.addEventListener('click', openSidebar);
  DOM.sidebarClose.addEventListener('click', closeSidebar);

  /* ── Theme ── */
  DOM.themeToggle.addEventListener('click', toggleTheme);

  /* ── Modal open / close ── */
  DOM.openAddModal.addEventListener('click', () => openModal('add'));
  DOM.modalClose.addEventListener('click', closeModal);
  DOM.modalOverlay.addEventListener('click', e => {
    if (e.target === DOM.modalOverlay) closeModal();
  });

  /* ── Type toggle in form ── */
  DOM.btnExpense.addEventListener('click', () => setTransactionType('expense'));
  DOM.btnIncome.addEventListener('click',  () => setTransactionType('income'));

  /* ── Form submit ── */
  DOM.transactionForm.addEventListener('submit', handleFormSubmit);

  /* ── Transactions filters ── */
  DOM.searchInput.addEventListener('input', renderTransactions);
  DOM.filterCategory.addEventListener('change', renderTransactions);
  DOM.filterType.addEventListener('change', renderTransactions);

  /* ── Budget save ── */
  DOM.saveBudgetBtn.addEventListener('click', () => {
    const val = parseFloat(DOM.budgetInput.value);
    if (isNaN(val) || val < 0) {
      showToast('Please enter a valid budget amount.', 'error');
      return;
    }
    saveBudget(val);
    renderBudgetSection();
    showToast('Budget saved!', 'success');
  });

  /* ── Export ── */
  DOM.exportBtn.addEventListener('click', exportToCSV);

  /* ── Keyboard: Esc closes modal ── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

/* ─────────────────────────────────────────────────────────────
   23.  APP INIT
───────────────────────────────────────────────────────────── */

function init() {
  // 1. Load persisted data
  loadTransactions();
  loadBudget();

  // 2. Apply saved theme
  initTheme();

  // 3. Bind UI events
  bindEvents();

  // 4. Set today's date in form
  DOM.txDate.value = today();

  // 5. Render lucide icons (initial pass)
  lucide.createIcons();

  // 6. Initial render
  renderAll();

  // 7. Hide loader after a short delay
  setTimeout(() => {
    DOM.loader.classList.add('hidden');
  }, 1200);
}

// ── Kick off once DOM is ready ──────────────────────────────
document.addEventListener('DOMContentLoaded', init);
