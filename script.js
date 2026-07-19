/**
 * SPENDLY V2 — script.js
 * Firebase Auth + Firestore + AI Insights + PDF Export
 * ─────────────────────────────────────────────────────
 * IMPORTANT: Replace the firebaseConfig below with YOUR config from Firebase console!
 */

/* ─── FIREBASE CONFIG — REPLACE WITH YOURS ─── */
const firebaseConfig = {
  apiKey: "AIzaSyBfvvanA2jqXSdEMm9GtbBQ7aYEZLhzFHM",
  authDomain: "spendly-a91d4.firebaseapp.com",
  projectId: "spendly-a91d4",
  storageBucket: "spendly-a91d4.firebasestorage.app",
  messagingSenderId: "174221764741",
  appId: "1:174221764741:web:b3bd129bc9277b896161ec",
  measurementId: "G-73V6CBJFGS"
};

/* ─── INIT FIREBASE ─── */
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

/* ─── CONSTANTS ─── */
const THEME_KEY  = 'spendly_theme';
const BUDGET_KEY = 'spendly_budget_';

const CATEGORY_META = {
  food         : { emoji:'🍔', color:'#f59e0b', label:'Food & Dining'  },
  transport    : { emoji:'🚗', color:'#3b82f6', label:'Transport'      },
  shopping     : { emoji:'🛍', color:'#ec4899', label:'Shopping'       },
  entertainment: { emoji:'🎬', color:'#8b5cf6', label:'Entertainment'  },
  health       : { emoji:'💊', color:'#10b981', label:'Health'         },
  utilities    : { emoji:'💡', color:'#06b6d4', label:'Utilities'      },
  education    : { emoji:'📚', color:'#f97316', label:'Education'      },
  other        : { emoji:'📦', color:'#6b7280', label:'Other'          },
  salary       : { emoji:'💼', color:'#34d399', label:'Salary'         },
  freelance    : { emoji:'💻', color:'#a3e635', label:'Freelance'      },
  investment   : { emoji:'📈', color:'#22d3ee', label:'Investment'     },
};

/* ─── STATE ─── */
let currentUser  = null;
let transactions = [];
let budget       = null;
let editingId    = null;
let deleteTarget = null;
let charts       = {};
let chartColors  = {};
let analyticsperiod = 'month';
let unsubscribe  = null; // Firestore listener

/* ─── DOM ─── */
const $ = id => document.getElementById(id);
const DOM = {
  loader: $('loader'), loginScreen: $('loginScreen'), app: $('app'),
  googleLoginBtn: $('googleLoginBtn'), logoutBtn: $('logoutBtn'),
  userAvatar: $('userAvatar'), userName: $('userName'), userEmail: $('userEmail'),
  sidebar: $('sidebar'), sidebarClose: $('sidebarClose'), hamburger: $('hamburger'),
  themeToggle: null, themeIcon: null, themeLabel: null,
  pageTitle: $('pageTitle'), exportBtn: $('exportBtn'), openAddModal: $('openAddModal'),
  totalBalance: $('totalBalance'), totalIncome: $('totalIncome'), totalExpense: $('totalExpense'),
  savingsRate: $('savingsRate'), recentList: $('recentList'),
  donutCenter: $('donutCenter'), donutLegend: $('donutLegend'),
  searchInput: $('searchInput'), filterCategory: $('filterCategory'), filterType: $('filterType'),
  transactionList: $('transactionList'),
  budgetInput: $('budgetInput'), saveBudgetBtn: $('saveBudgetBtn'),
  budgetSpent: $('budgetSpent'), budgetLimit: $('budgetLimit'),
  budgetBar: $('budgetBar'), budgetPercent: $('budgetPercent'),
  budgetAlert: $('budgetAlert'), budgetAlertMsg: $('budgetAlertMsg'),
  categorySpendList: $('categorySpendList'),
  analyzeBtn: $('analyzeBtn'), aiInput: $('aiInput'), aiSendBtn: $('aiSendBtn'),
  aiMessages: $('aiMessages'),
  modalOverlay: $('modalOverlay'), modalClose: $('modalClose'), modalTitle: $('modalTitle'),
  transactionForm: $('transactionForm'), txId: $('txId'),
  txName: $('txName'), txAmount: $('txAmount'), txCategory: $('txCategory'),
  txDate: $('txDate'), txNote: $('txNote'),
  btnExpense: $('btnExpense'), btnIncome: $('btnIncome'), submitLabel: $('submitLabel'),
  exportModalOverlay: $('exportModalOverlay'), exportModalClose: $('exportModalClose'),
  exportCSVBtn: $('exportCSVBtn'), exportPDFBtn: $('exportPDFBtn'),
  deleteModalOverlay: $('deleteModalOverlay'),
  deleteCancelBtn: $('deleteCancelBtn'), deleteConfirmBtn: $('deleteConfirmBtn'),
  toastContainer: $('toastContainer'),
};

/* ─────────────────────────────────────────────
   UTILS
───────────────────────────────────────────── */
const uid    = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const fmt    = n  => '₹' + Math.abs(n).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
const fmtDate= d  => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
const today  = () => new Date().toISOString().split('T')[0];
const escHtml= s  => { const d=document.createElement('div'); d.appendChild(document.createTextNode(s)); return d.innerHTML; };
const monthKey= d => d.slice(0,7);

const lastNMonths = n => {
  const keys=[]; const d=new Date();
  for(let i=0;i<n;i++){
    const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0');
    keys.unshift(`${y}-${m}`); d.setMonth(d.getMonth()-1);
  }
  return keys;
};
const monthLabel = mk => {
  const [y,m]=mk.split('-');
  return new Date(+y,+m-1,1).toLocaleDateString('en-IN',{month:'short'}) + ' \''+y.slice(2);
};

/* ─────────────────────────────────────────────
   THEME
───────────────────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(saved, false);
}

function applyTheme(theme, rebuild=true) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  // Update active dot
  document.querySelectorAll('.theme-dot').forEach(d => {
    d.classList.toggle('active', d.dataset.theme === theme);
  });
  updateChartColors();
  if(rebuild) rebuildAllCharts();
}
function updateChartColors() {
  const s = getComputedStyle(document.documentElement);
  const g = v => s.getPropertyValue(v).trim();
  chartColors = { text:g('--text-primary'), muted:g('--text-muted'), grid:g('--border'), accent:g('--accent'), income:g('--income'), expense:g('--expense'), surface:g('--bg-surface') };
}

/* ─────────────────────────────────────────────
   AUTH
───────────────────────────────────────────── */
auth.onAuthStateChanged(user => {
  if(user) {
    currentUser = user;
    DOM.userAvatar.src  = user.photoURL || '';
    DOM.userName.textContent  = user.displayName || 'User';
    DOM.userEmail.textContent = user.email || '';
    loadBudget();
    subscribeTransactions();
    showApp();
  } else {
    currentUser = null;
    if(unsubscribe){ unsubscribe(); unsubscribe=null; }
    transactions = [];
    showLogin();
  }
});

function showLogin() {
  DOM.loader.classList.add('hidden');
  DOM.loginScreen.classList.remove('hidden');
  DOM.app.classList.add('hidden');
  lucide.createIcons();
}
function showApp() {
  DOM.loader.classList.add('hidden');
  DOM.loginScreen.classList.add('hidden');
  DOM.app.classList.remove('hidden');
  lucide.createIcons();
}

DOM.googleLoginBtn.addEventListener('click', async () => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  } catch(e) {
    showToast('Login failed: ' + e.message, 'error');
  }
});

DOM.logoutBtn.addEventListener('click', async () => {
  await auth.signOut();
  showToast('Signed out!', 'info');
});

/* ─────────────────────────────────────────────
   FIRESTORE — REAL-TIME LISTENER
───────────────────────────────────────────── */
function subscribeTransactions() {
  if(!currentUser) return;
  if(unsubscribe){ unsubscribe(); }
  unsubscribe = db.collection('users').doc(currentUser.uid)
    .collection('transactions')
    .orderBy('createdAt','desc')
    .onSnapshot(snap => {
      transactions = snap.docs.map(d => ({id:d.id, ...d.data()}));
      renderAll();
    }, err => {
      showToast('Data sync error: ' + err.message, 'error');
    });
}

async function saveTransaction(tx) {
  if(!currentUser) return;
  const ref = db.collection('users').doc(currentUser.uid).collection('transactions');
  if(tx.id && editingId) {
    await ref.doc(tx.id).set(tx);
  } else {
    await ref.add({...tx, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
  }
}

async function deleteTransaction(id) {
  if(!currentUser) return;
  await db.collection('users').doc(currentUser.uid).collection('transactions').doc(id).delete();
}

/* ─────────────────────────────────────────────
   BUDGET (localStorage per user)
───────────────────────────────────────────── */
function loadBudget() {
  const key = BUDGET_KEY + (currentUser?.uid || '');
  const raw = localStorage.getItem(key);
  budget = raw ? parseFloat(raw) : null;
}
function saveBudget(val) {
  const key = BUDGET_KEY + (currentUser?.uid || '');
  budget = val;
  localStorage.setItem(key, val);
}

/* ─────────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────────── */
const SECTION_TITLES = { dashboard:'Dashboard', transactions:'Transactions', analytics:'Analytics', budget:'Budget', ai:'AI Insights' };

function switchSection(name) {
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const sec = $(`section-${name}`);
  if(sec) sec.classList.add('active');
  const nav = document.querySelector(`.nav-item[data-section="${name}"]`);
  if(nav) nav.classList.add('active');
  DOM.pageTitle.textContent = SECTION_TITLES[name] || 'Spendly';
  if(name==='analytics') rebuildAllCharts();
  if(name==='budget')    renderBudgetSection();
  if(name==='dashboard') renderDashboard();
  closeSidebar();
}

/* ─────────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────────── */
function openSidebar() {
  DOM.sidebar.classList.add('open');
  let overlay = document.querySelector('.sidebar-overlay');
  if(!overlay){ overlay=document.createElement('div'); overlay.className='sidebar-overlay'; document.body.appendChild(overlay); overlay.addEventListener('click',closeSidebar); }
  overlay.classList.add('visible');
}
function closeSidebar() {
  DOM.sidebar.classList.remove('open');
  const o=document.querySelector('.sidebar-overlay');
  if(o) o.classList.remove('visible');
}

/* ─────────────────────────────────────────────
   MODAL
───────────────────────────────────────────── */
function openModal(mode='add', txData=null) {
  resetForm();
  if(mode==='edit' && txData) {
    editingId=txData.id;
    DOM.txId.value=txData.id; DOM.txName.value=txData.name; DOM.txAmount.value=txData.amount;
    DOM.txCategory.value=txData.category; DOM.txDate.value=txData.date; DOM.txNote.value=txData.note||'';
    setType(txData.type); DOM.modalTitle.textContent='Edit Transaction'; DOM.submitLabel.textContent='Save Changes';
  } else {
    editingId=null; DOM.txDate.value=today();
    DOM.modalTitle.textContent='Add Transaction'; DOM.submitLabel.textContent='Add Transaction';
  }
  DOM.modalOverlay.classList.add('open');
  setTimeout(()=>DOM.txName.focus(),80);
}
function closeModal() { DOM.modalOverlay.classList.remove('open'); resetForm(); editingId=null; }
function resetForm() { DOM.transactionForm.reset(); DOM.txId.value=''; clearErrors(); setType('expense'); }
function setType(t) { DOM.btnExpense.classList.toggle('active',t==='expense'); DOM.btnIncome.classList.toggle('active',t==='income'); }
function getType() { return DOM.btnIncome.classList.contains('active')?'income':'expense'; }

/* ─────────────────────────────────────────────
   VALIDATION
───────────────────────────────────────────── */
function clearErrors() {
  ['Name','Amount','Category','Date'].forEach(f=>{
    const e=$(`err${f}`); if(e) e.textContent='';
    const g=DOM[`tx${f}`]?.closest('.form-group'); if(g) g.classList.remove('has-error');
  });
}
function showError(field, msg) {
  const e=$(`err${field}`); if(e) e.textContent=msg;
  DOM[`tx${field}`]?.closest('.form-group')?.classList.add('has-error');
}
function validateForm() {
  clearErrors(); let valid=true;
  const name=DOM.txName.value.trim();
  if(!name){ showError('Name','Please enter a name.'); valid=false; }
  const amt=parseFloat(DOM.txAmount.value);
  if(!DOM.txAmount.value||isNaN(amt)){ showError('Amount','Enter a valid amount.'); valid=false; }
  else if(amt<=0){ showError('Amount','Amount must be > ₹0.'); valid=false; }
  if(!DOM.txCategory.value){ showError('Category','Select a category.'); valid=false; }
  if(!DOM.txDate.value){ showError('Date','Select a date.'); valid=false; }
  return valid;
}

/* ─────────────────────────────────────────────
   FORM SUBMIT
───────────────────────────────────────────── */
DOM.transactionForm.addEventListener('submit', async e => {
  e.preventDefault();
  if(!validateForm()) return;
  const tx = {
    id      : editingId || uid(),
    name    : DOM.txName.value.trim(),
    amount  : parseFloat(parseFloat(DOM.txAmount.value).toFixed(2)),
    category: DOM.txCategory.value,
    date    : DOM.txDate.value,
    note    : DOM.txNote.value.trim(),
    type    : getType(),
  };
  try {
    await saveTransaction(tx);
    showToast(editingId?'Transaction updated!':'Transaction added!', 'success');
    closeModal();
  } catch(err) {
    showToast('Error saving: '+err.message, 'error');
  }
});

/* ─────────────────────────────────────────────
   DELETE (with confirm modal)
───────────────────────────────────────────── */
function confirmDelete(id) {
  deleteTarget=id;
  DOM.deleteModalOverlay.classList.add('open');
}
DOM.deleteCancelBtn.addEventListener('click',()=>{ DOM.deleteModalOverlay.classList.remove('open'); deleteTarget=null; });
DOM.deleteConfirmBtn.addEventListener('click', async ()=>{
  if(!deleteTarget) return;
  try {
    await deleteTransaction(deleteTarget);
    showToast('Transaction deleted.','info');
  } catch(e) {
    showToast('Error deleting: '+e.message,'error');
  }
  DOM.deleteModalOverlay.classList.remove('open');
  deleteTarget=null;
});

/* ─────────────────────────────────────────────
   AGGREGATES
───────────────────────────────────────────── */
function sumTx(list) {
  return list.reduce((a,t)=>{ if(t.type==='income') a.income+=t.amount; else a.expense+=t.amount; return a; },{income:0,expense:0});
}
function currentMonthTx() {
  const mk=today().slice(0,7);
  return transactions.filter(t=>t.date?.slice(0,7)===mk);
}
function filterByPeriod(period) {
  const now=new Date(); const d=new Date();
  if(period==='month') d.setMonth(d.getMonth()-1);
  else if(period==='3month') d.setMonth(d.getMonth()-3);
  else if(period==='6month') d.setMonth(d.getMonth()-6);
  else if(period==='year') d.setFullYear(d.getFullYear()-1);
  else return transactions;
  return transactions.filter(t=>new Date(t.date+'T00:00:00')>=d);
}

/* ─────────────────────────────────────────────
   RENDER — MASTER
───────────────────────────────────────────── */
function renderAll() {
  renderDashboard();
  renderTransactions();
  const active=document.querySelector('.section.active')?.id?.replace('section-','');
  if(active==='analytics') rebuildAllCharts();
  if(active==='budget') renderBudgetSection();
}

/* ─────────────────────────────────────────────
   RENDER — DASHBOARD
───────────────────────────────────────────── */
function renderDashboard() {
  const totals=sumTx(transactions);
  const balance=totals.income-totals.expense;
  DOM.totalBalance.textContent=(balance<0?'-':'')+fmt(balance);
  DOM.totalIncome.textContent=fmt(totals.income);
  DOM.totalExpense.textContent=fmt(totals.expense);
  const rate=totals.income>0?Math.round(((totals.income-totals.expense)/totals.income)*100):0;
  const icon=rate>=0?'trending-up':'trending-down';
  DOM.savingsRate.innerHTML=`<i data-lucide="${icon}"></i> <span>${rate}% savings rate</span>`;
  lucide.createIcons({nodes:[DOM.savingsRate]});
  renderRecentList();
  renderMiniDonut();
}

function renderRecentList() {
  const recent=transactions.slice(0,6);
  if(!recent.length){
    DOM.recentList.innerHTML=`<li class="empty-state"><i data-lucide="inbox"></i><p>No transactions yet</p></li>`;
    lucide.createIcons({nodes:[DOM.recentList]}); return;
  }
  DOM.recentList.innerHTML=recent.map(t=>{
    const m=CATEGORY_META[t.category]||CATEGORY_META.other;
    return `<li class="recent-item">
      <div class="tx-icon" style="background:${m.color}22;">${m.emoji}</div>
      <div class="tx-info">
        <div class="tx-name">${escHtml(t.name)}</div>
        <div class="tx-meta">${fmtDate(t.date)} · ${m.label}</div>
      </div>
      <div class="tx-amount ${t.type}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</div>
    </li>`;
  }).join('');
}

function renderMiniDonut() {
  const exp=transactions.filter(t=>t.type==='expense');
  const ct={}; exp.forEach(t=>{ ct[t.category]=(ct[t.category]||0)+t.amount; });
  const entries=Object.entries(ct).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const total=entries.reduce((s,[,v])=>s+v,0);
  DOM.donutCenter.textContent=total?fmt(total):'No data';
  DOM.donutLegend.innerHTML='';
  if(!entries.length){ if(charts.miniDonut){charts.miniDonut.destroy();charts.miniDonut=null;} return; }
  DOM.donutLegend.innerHTML=entries.map(([k,v])=>{
    const m=CATEGORY_META[k]||CATEGORY_META.other;
    return `<li class="legend-item"><span class="legend-dot" style="background:${m.color}"></span><span class="legend-label">${m.label}</span><span class="legend-val">${fmt(v)}</span></li>`;
  }).join('');
  buildDonutChart('miniDonut', entries.map(([k])=>CATEGORY_META[k]?.label||k), entries.map(([,v])=>v), entries.map(([k])=>CATEGORY_META[k]?.color||'#888'));
}

/* ─────────────────────────────────────────────
   RENDER — TRANSACTIONS
───────────────────────────────────────────── */
function renderTransactions() {
  const search=DOM.searchInput.value.trim().toLowerCase();
  const cat=DOM.filterCategory.value; const typ=DOM.filterType.value;
  const filtered=transactions.filter(t=>{
    const ms=!search||t.name.toLowerCase().includes(search)||(t.note||'').toLowerCase().includes(search);
    return ms && (cat==='all'||t.category===cat) && (typ==='all'||t.type===typ);
  });
  if(!filtered.length){
    DOM.transactionList.innerHTML=`<li class="empty-state"><i data-lucide="inbox"></i><p>No transactions found</p></li>`;
    lucide.createIcons({nodes:[DOM.transactionList]}); return;
  }
  DOM.transactionList.innerHTML=filtered.map(t=>{
    const m=CATEGORY_META[t.category]||CATEGORY_META.other;
    return `<li class="tx-row">
      <div class="tx-icon" style="background:${m.color}22;">${m.emoji}</div>
      <div class="tx-info">
        <div class="tx-name">${escHtml(t.name)}</div>
        <div class="tx-meta">${fmtDate(t.date)} · ${m.label}${t.note?' · '+escHtml(t.note):''}</div>
      </div>
      <div class="tx-row-amount ${t.type}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</div>
      <div class="tx-actions">
        <button class="action-btn edit-btn" data-id="${t.id}" title="Edit"><i data-lucide="pencil"></i></button>
        <button class="action-btn delete-btn" data-id="${t.id}" title="Delete"><i data-lucide="trash-2"></i></button>
      </div>
    </li>`;
  }).join('');
  lucide.createIcons({nodes:[DOM.transactionList]});
  DOM.transactionList.querySelectorAll('.edit-btn').forEach(b=>{
    b.addEventListener('click',()=>{ const tx=transactions.find(t=>t.id===b.dataset.id); if(tx) openModal('edit',tx); });
  });
  DOM.transactionList.querySelectorAll('.delete-btn').forEach(b=>{
    b.addEventListener('click',()=>confirmDelete(b.dataset.id));
  });
}

/* ─────────────────────────────────────────────
   RENDER — ANALYTICS CHARTS
───────────────────────────────────────────── */
function rebuildAllCharts() {
  updateChartColors();
  const filtered=filterByPeriod(analyticsperiod);
  renderMonthlyChart(filtered);
  renderCategoryChart(filtered);
  renderIncomeExpenseChart(filtered);
  renderMiniDonut();
}
function renderMonthlyChart(list) {
  const months=lastNMonths(6);
  const inc=months.map(mk=>(list||transactions).filter(t=>t.type==='income'&&t.date?.slice(0,7)===mk).reduce((s,t)=>s+t.amount,0));
  const exp=months.map(mk=>(list||transactions).filter(t=>t.type==='expense'&&t.date?.slice(0,7)===mk).reduce((s,t)=>s+t.amount,0));
  buildBarChart('monthlyChart',{labels:months.map(monthLabel),datasets:[
    {label:'Income',data:inc,backgroundColor:chartColors.income+'cc',borderRadius:6},
    {label:'Expense',data:exp,backgroundColor:chartColors.expense+'cc',borderRadius:6},
  ]});
}
function renderCategoryChart(list) {
  const exp=(list||transactions).filter(t=>t.type==='expense');
  if(!exp.length){clearCanvas('categoryChart');return;}
  const ct={}; exp.forEach(t=>{ ct[t.category]=(ct[t.category]||0)+t.amount; });
  const entries=Object.entries(ct).sort((a,b)=>b[1]-a[1]);
  buildDonutChart('categoryChart', entries.map(([k])=>CATEGORY_META[k]?.label||k), entries.map(([,v])=>v), entries.map(([k])=>CATEGORY_META[k]?.color||'#888'));
}
function renderIncomeExpenseChart(list) {
  const totals=sumTx(list||transactions);
  buildBarChart('incomeExpenseChart',{labels:['Income','Expenses'],datasets:[{label:'Amount',data:[totals.income,totals.expense],backgroundColor:[chartColors.income+'cc',chartColors.expense+'cc'],borderRadius:6}]}, true);
}

/* ─────────────────────────────────────────────
   CHART BUILDERS
───────────────────────────────────────────── */
function buildBarChart(id, data, horizontal=false) {
  const canvas=$(id); if(!canvas) return;
  if(charts[id]) charts[id].destroy();
  charts[id]=new Chart(canvas,{type:'bar',data,options:{indexAxis:horizontal?'y':'x',responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:chartColors.text,font:{family:'DM Sans',size:12}}},tooltip:{callbacks:{label:ctx=>' '+fmt(ctx.raw)}}},scales:{x:{grid:{color:chartColors.grid},ticks:{color:chartColors.muted,font:{family:'DM Sans',size:11}}},y:{grid:{color:chartColors.grid},ticks:{color:chartColors.muted,font:{family:'DM Sans',size:11},callback:v=>'₹'+(v>=1000?(v/1000).toFixed(0)+'k':v)}}}}});
}
function buildDonutChart(id, labels, data, colors) {
  const canvas=$(id); if(!canvas) return;
  if(charts[id]) charts[id].destroy();
  charts[id]=new Chart(canvas,{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:2,borderColor:chartColors.surface}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{display:id==='categoryChart',position:'right',labels:{color:chartColors.text,font:{family:'DM Sans',size:11},boxWidth:10}},tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${fmt(ctx.raw)}`}}}}});
}
function clearCanvas(id) { if(charts[id]){charts[id].destroy();charts[id]=null;} }

/* ─────────────────────────────────────────────
   RENDER — BUDGET
───────────────────────────────────────────── */
function renderBudgetSection() {
  if(budget!==null) DOM.budgetInput.value=budget;
  const thisMonth=currentMonthTx();
  const {expense:spent}=sumTx(thisMonth);
  DOM.budgetSpent.textContent=fmt(spent);
  DOM.budgetLimit.textContent=budget!==null?fmt(budget):'Not set';
  if(budget!==null&&budget>0){
    const pct=Math.min((spent/budget)*100,100);
    DOM.budgetBar.style.width=pct+'%'; DOM.budgetPercent.textContent=`${pct.toFixed(0)}% used`;
    DOM.budgetBar.className='progress-bar-fill';
    if(pct>=90) DOM.budgetBar.classList.add('danger');
    else if(pct>=70) DOM.budgetBar.classList.add('warning');
    if(pct>=100){ DOM.budgetAlert.style.display='flex'; DOM.budgetAlertMsg.textContent=`You exceeded your budget by ${fmt(spent-budget)}!`; }
    else if(pct>=80){ DOM.budgetAlert.style.display='flex'; DOM.budgetAlertMsg.textContent=`⚠️ You've used ${pct.toFixed(0)}% of your budget!`; }
    else DOM.budgetAlert.style.display='none';
  } else { DOM.budgetBar.style.width='0%'; DOM.budgetPercent.textContent='Set a budget above'; DOM.budgetAlert.style.display='none'; }
  renderCategorySpend(thisMonth);
}
function renderCategorySpend(list) {
  const exp=list.filter(t=>t.type==='expense');
  if(!exp.length){ DOM.categorySpendList.innerHTML=`<li class="empty-state"><i data-lucide="inbox"></i><p>No expenses this month</p></li>`; lucide.createIcons({nodes:[DOM.categorySpendList]}); return; }
  const ct={}; exp.forEach(t=>{ct[t.category]=(ct[t.category]||0)+t.amount;});
  const max=Math.max(...Object.values(ct));
  DOM.categorySpendList.innerHTML=Object.entries(ct).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>{
    const m=CATEGORY_META[cat]||CATEGORY_META.other;
    return `<li class="cat-spend-item"><div class="cat-spend-top"><span>${m.emoji} ${m.label}</span><span>${fmt(val)}</span></div><div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${((val/max)*100).toFixed(0)}%;background:${m.color}"></div></div></li>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   AI INSIGHTS
───────────────────────────────────────────── */
function buildTransactionSummary() {
  const totals=sumTx(transactions);
  const balance=totals.income-totals.expense;
  const rate=totals.income>0?((balance/totals.income)*100).toFixed(1):0;
  const ct={}; transactions.filter(t=>t.type==='expense').forEach(t=>{ ct[t.category]=(ct[t.category]||0)+t.amount; });
  const topCats=Object.entries(ct).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`${CATEGORY_META[k]?.label||k}: ₹${v.toFixed(0)}`).join(', ');
  const recent=transactions.slice(0,10).map(t=>`${t.name} (${t.type==='expense'?'-':'+'}₹${t.amount}, ${t.category}, ${t.date})`).join('\n');
  return `User: ${currentUser?.displayName||'User'}
Total Income: ₹${totals.income.toFixed(0)}
Total Expenses: ₹${totals.expense.toFixed(0)}
Net Balance: ₹${balance.toFixed(0)}
Savings Rate: ${rate}%
Monthly Budget: ${budget?'₹'+budget:'Not set'}
Top Spending Categories: ${topCats||'None'}
Total Transactions: ${transactions.length}
Recent Transactions:
${recent||'None'}`;
}

async function askAI(userMessage) {
  if(!transactions.length) { addAIMessage('ai','Please add some transactions first so I can analyze your spending! 📊'); return; }
  addAIMessage('user', userMessage);
  const thinkingEl=addAIMessage('ai','⏳ Analyzing your finances...', true);
  try {
    const summary=buildTransactionSummary();
    const systemPrompt=`You are Spendly AI, a friendly and helpful personal finance advisor. You have access to the user's transaction data. Be concise, practical, and encouraging. Use ₹ for Indian Rupees. Give specific actionable advice based on their actual data. Keep responses under 200 words.`;
    const userPrompt=`Here is my financial data:\n${summary}\n\nMy question: ${userMessage}`;
    const response=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1000,system:systemPrompt,messages:[{role:'user',content:userPrompt}]})});
    const data=await response.json();
    thinkingEl.remove();
    const reply=data.content?.[0]?.text||'Sorry, I could not analyze your data right now.';
    addAIMessage('ai', reply);
  } catch(e) {
    thinkingEl.remove();
    addAIMessage('ai','Sorry, AI is unavailable right now. Please try again later.');
  }
}

function addAIMessage(role, text, isThinking=false) {
  const div=document.createElement('div');
  div.className=`ai-message ${role==='user'?'user-msg':''} ${isThinking?'ai-thinking':''}`;
  if(role==='ai') {
    div.innerHTML=`<div class="ai-avatar"><i data-lucide="brain"></i></div><div class="ai-bubble"><strong>Spendly AI</strong><p>${escHtml(text)}</p></div>`;
  } else {
    div.innerHTML=`<div class="ai-bubble"><p>${escHtml(text)}</p></div>`;
  }
  DOM.aiMessages.appendChild(div);
  lucide.createIcons({nodes:[div]});
  DOM.aiMessages.scrollTop=DOM.aiMessages.scrollHeight;
  return div;
}

/* ─────────────────────────────────────────────
   EXPORT — CSV
───────────────────────────────────────────── */
function exportCSV() {
  if(!transactions.length){showToast('No transactions to export.','error');return;}
  const cell=v=>`"${String(v).replace(/"/g,'""')}"`;
  const totals=sumTx(transactions); const balance=totals.income-totals.expense;
  const rate=totals.income>0?((balance/totals.income)*100).toFixed(1):'0.0';
  const summary=[
    ['SPENDLY EXPENSE REPORT','','','','','',''],
    ['Generated',new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}),'','','','',''],
    ['User',currentUser?.displayName||'','','','','',''],['','','','','','',''],
    ['SUMMARY','','','','','',''],
    ['Total Income','₹'+totals.income.toFixed(2),'','','','',''],
    ['Total Expenses','₹'+totals.expense.toFixed(2),'','','','',''],
    ['Net Balance','₹'+balance.toFixed(2),'','','','',''],
    ['Savings Rate',rate+'%','','','','',''],
    ['','','','','','',''],['TRANSACTIONS','','','','','',''],
  ];
  const headers=['#','Name','Amount (₹)','Type','Category','Date','Note'];
  const rows=transactions.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).map((t,i)=>[
    i+1, cell(t.name), t.type==='expense'?-Math.abs(t.amount):t.amount,
    t.type.charAt(0).toUpperCase()+t.type.slice(1),
    cell(CATEGORY_META[t.category]?.label||t.category), cell(fmtDate(t.date)), cell(t.note||'—'),
  ]);
  const allRows=[...summary.map(r=>r.map(v=>v?cell(v):v).join(',')), headers.map(h=>cell(h)).join(','), ...rows.map(r=>r.join(','))];
  const blob=new Blob(['\uFEFF'+allRows.join('\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`Spendly_Report_${today()}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast('CSV exported! Open in Excel or Google Sheets.','success');
}

/* ─────────────────────────────────────────────
   EXPORT — PDF
───────────────────────────────────────────── */
function exportPDF() {
  if(!transactions.length){showToast('No transactions to export.','error');return;}
  const totals=sumTx(transactions); const balance=totals.income-totals.expense;
  const rate=totals.income>0?((balance/totals.income)*100).toFixed(1):'0.0';
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  const rows=transactions.slice(0,50).map((t,i)=>{
    const m=CATEGORY_META[t.category]||CATEGORY_META.other;
    const amt=t.type==='income'?`<span style="color:#059669">+${fmt(t.amount)}</span>`:`<span style="color:#dc2626">-${fmt(t.amount)}</span>`;
    return `<tr style="background:${i%2===0?'#f9fafb':'#fff'}"><td>${i+1}</td><td>${escHtml(t.name)}</td><td>${amt}</td><td>${m.emoji} ${m.label}</td><td>${fmtDate(t.date)}</td><td>${escHtml(t.note||'—')}</td></tr>`;
  }).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Spendly Report</title><style>
    *{margin:0;padding:0;box-sizing:border-box} body{font-family:'Segoe UI',sans-serif;color:#111;padding:32px}
    .header{background:linear-gradient(135deg,#1c2033,#252a42);color:#fff;padding:28px 32px;border-radius:16px;margin-bottom:24px}
    .header h1{font-size:2rem;color:#f5b942;margin-bottom:4px} .header p{color:#8b90b0;font-size:.9rem}
    .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
    .card{padding:20px;border-radius:12px;border:1px solid #e5e7eb}
    .card-label{font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:8px}
    .card-value{font-size:1.5rem;font-weight:700}
    .income-card{background:#f0fdf4}.income-card .card-value{color:#059669}
    .expense-card{background:#fef2f2}.expense-card .card-value{color:#dc2626}
    .balance-card{background:#f5f3ff}.balance-card .card-value{color:#7c3aed}
    .savings-card{background:#fff7ed}.savings-card .card-value{color:#d97706}
    table{width:100%;border-collapse:collapse;font-size:.88rem}
    th{background:#1c2033;color:#fff;padding:10px 12px;text-align:left;font-size:.8rem;text-transform:uppercase}
    td{padding:10px 12px;border-bottom:1px solid #f3f4f6}
    .footer{margin-top:24px;text-align:center;color:#9ca3af;font-size:.8rem}
  </style></head><body>
    <div class="header"><h1>💰 Spendly Report</h1><p>Generated on ${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · ${currentUser?.displayName||'User'}</p></div>
    <div class="cards">
      <div class="card income-card"><div class="card-label">Total Income</div><div class="card-value">${fmt(totals.income)}</div></div>
      <div class="card expense-card"><div class="card-label">Total Expenses</div><div class="card-value">${fmt(totals.expense)}</div></div>
      <div class="card balance-card"><div class="card-label">Net Balance</div><div class="card-value">${fmt(balance)}</div></div>
      <div class="card savings-card"><div class="card-label">Savings Rate</div><div class="card-value">${rate}%</div></div>
    </div>
    <table><thead><tr><th>#</th><th>Name</th><th>Amount</th><th>Category</th><th>Date</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>
    ${transactions.length>50?`<p style="margin-top:12px;color:#6b7280;font-size:.85rem">Showing first 50 of ${transactions.length} transactions.</p>`:''}
    <div class="footer">Generated by Spendly · Your Smart Finance Tracker</div>
  </body></html>`;
  const win=window.open('','_blank'); win.document.write(html); win.document.close();
  setTimeout(()=>win.print(), 500);
  showToast('PDF ready to print or save!','success');
}

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
function showToast(message, type='info') {
  const icons={success:'check-circle',error:'x-circle',info:'info'};
  const toast=document.createElement('div'); toast.className=`toast ${type}`;
  toast.innerHTML=`<i data-lucide="${icons[type]||'info'}"></i><span>${escHtml(message)}</span>`;
  DOM.toastContainer.appendChild(toast); lucide.createIcons({nodes:[toast]});
  setTimeout(()=>{ toast.classList.add('removing'); setTimeout(()=>toast.remove(),350); },3500);
}

/* ─────────────────────────────────────────────
   EVENT LISTENERS
───────────────────────────────────────────── */
function bindEvents() {
  // Nav
  document.querySelectorAll('.nav-item').forEach(l=>l.addEventListener('click',e=>{e.preventDefault();switchSection(l.dataset.section);}));
  document.querySelectorAll('.view-all').forEach(l=>l.addEventListener('click',e=>{e.preventDefault();switchSection(l.dataset.section);}));
  // Sidebar
  DOM.hamburger.addEventListener('click',openSidebar);
  DOM.sidebarClose.addEventListener('click',closeSidebar);
  // Theme dots
  document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.addEventListener('click', () => applyTheme(dot.dataset.theme));
  });
  // Modal
  DOM.openAddModal.addEventListener('click',()=>openModal('add'));
  DOM.modalClose.addEventListener('click',closeModal);
  DOM.modalOverlay.addEventListener('click',e=>{if(e.target===DOM.modalOverlay)closeModal();});
  // Type toggle
  DOM.btnExpense.addEventListener('click',()=>setType('expense'));
  DOM.btnIncome.addEventListener('click',()=>setType('income'));
  // Filters
  DOM.searchInput.addEventListener('input',renderTransactions);
  DOM.filterCategory.addEventListener('change',renderTransactions);
  DOM.filterType.addEventListener('change',renderTransactions);
  // Budget
  DOM.saveBudgetBtn.addEventListener('click',()=>{
    const v=parseFloat(DOM.budgetInput.value);
    if(isNaN(v)||v<0){showToast('Enter a valid budget amount.','error');return;}
    saveBudget(v); renderBudgetSection(); showToast('Budget saved!','success');
  });
  // Analytics date filter
  document.querySelectorAll('.date-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('.date-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); analyticsperiod=b.dataset.period; rebuildAllCharts();
    });
  });
  // Export modal
  DOM.exportBtn.addEventListener('click',()=>DOM.exportModalOverlay.classList.add('open'));
  DOM.exportModalClose.addEventListener('click',()=>DOM.exportModalOverlay.classList.remove('open'));
  DOM.exportModalOverlay.addEventListener('click',e=>{if(e.target===DOM.exportModalOverlay)DOM.exportModalOverlay.classList.remove('open');});
  DOM.exportCSVBtn.addEventListener('click',()=>{DOM.exportModalOverlay.classList.remove('open');exportCSV();});
  DOM.exportPDFBtn.addEventListener('click',()=>{DOM.exportModalOverlay.classList.remove('open');exportPDF();});
  // Delete modal close on overlay
  DOM.deleteModalOverlay.addEventListener('click',e=>{if(e.target===DOM.deleteModalOverlay){DOM.deleteModalOverlay.classList.remove('open');deleteTarget=null;}});
  // AI
  DOM.analyzeBtn.addEventListener('click',()=>askAI('Give me a complete analysis of my spending habits and top recommendations to improve my finances.'));
  DOM.aiSendBtn.addEventListener('click',sendAIMessage);
  DOM.aiInput.addEventListener('keydown',e=>{if(e.key==='Enter')sendAIMessage();});
  document.querySelectorAll('.prompt-btn').forEach(b=>{
    b.addEventListener('click',()=>{ switchSection('ai'); askAI(b.dataset.prompt); });
  });
  // Keyboard
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();DOM.exportModalOverlay.classList.remove('open');DOM.deleteModalOverlay.classList.remove('open');}});
}

function sendAIMessage() {
  const msg=DOM.aiInput.value.trim();
  if(!msg) return;
  DOM.aiInput.value='';
  askAI(msg);
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
function init() {
  initTheme();
  bindEvents();
  DOM.txDate.value=today();
  lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', init);
