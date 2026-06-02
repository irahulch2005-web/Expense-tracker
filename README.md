# 💰 Spendly — Smart Expense Tracker

A **portfolio-worthy**, full-featured Expense Tracker web app built with **pure HTML, CSS, and JavaScript** — no frameworks, no build tools, just open and run.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Dashboard** | Balance, Income, Expense cards + savings % indicator |
| **Add / Edit / Delete** | Full CRUD for transactions with smooth modal |
| **Validation** | Client-side validation with inline error messages |
| **Search & Filter** | Filter by name, category, and type |
| **Charts** | Monthly bar chart, category donut, income vs expense |
| **Budget** | Set monthly limit, progress bar, % alert at 80%/100% |
| **Dark / Light Mode** | Toggle with localStorage persistence |
| **Export CSV** | Download all transactions as a .csv file |
| **Responsive** | Works on desktop, tablet, and mobile |
| **LocalStorage** | All data persists across page refreshes |
| **Toasts** | Non-blocking success/error notifications |

---

## 🗂 Folder Structure

```
expense-tracker/
├── index.html      ← App shell & all markup
├── style.css       ← CSS design system (dark+light tokens, animations)
├── script.js       ← All app logic, state, chart builds, CRUD
└── README.md       ← You're here
```

---

## 🚀 Setup & Running

### Option 1 — Open directly (simplest)
1. Download or clone this folder.
2. Double-click **`index.html`** in your file manager.
3. It opens in your browser — that's it!

> ⚠️ Chrome may block some CDN fonts when opened as a local file.  
> Use Option 2 for a better experience.

---

### Option 2 — VS Code Live Server (recommended)
1. Install [VS Code](https://code.visualstudio.com/) + the **Live Server** extension.
2. Open the `expense-tracker/` folder in VS Code.
3. Right-click `index.html` → **"Open with Live Server"**.
4. App runs at `http://127.0.0.1:5500`.

---

### Option 3 — Python simple server
```bash
cd expense-tracker
python -m http.server 8080
# Open http://localhost:8080 in your browser
```

---

### Option 4 — Node http-server
```bash
npm install -g http-server
cd expense-tracker
http-server -p 8080
# Open http://localhost:8080
```

---

## 🔧 Dependencies (CDN — no install needed)

| Library | Purpose | Version |
|---|---|---|
| [Chart.js](https://www.chartjs.org/) | Bar, donut, and pie charts | 4.4.0 |
| [Lucide Icons](https://lucide.dev/) | Clean SVG icon set | latest |
| [Google Fonts](https://fonts.google.com/) | Syne (display) + DM Sans (body) | — |

All loaded via CDN — requires an internet connection on first load. Fonts cache after that.

---

## 🎨 Design System

- **Dark theme** — Deep navy (`#0d0f18`) + amber accent (`#f5b942`)
- **Light theme** — Soft white with muted contrasts
- **Typography** — Syne (headings) + DM Sans (body text)
- **Animations** — CSS keyframes + Chart.js enter animations
- **Layout** — CSS Grid + Flexbox, fully responsive

---

## 📱 Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| `> 1024px` | Full sidebar + 3-column cards |
| `768–1024px` | Sidebar + 2-column cards |
| `< 768px` | Hidden sidebar (hamburger menu) + 1-column |

---

## 💡 How It Works

1. **State** — All transactions stored in a plain JS array.
2. **Persistence** — `localStorage` serializes the array on every change.
3. **Charts** — Chart.js canvases rebuilt on section switch so colours always match the active theme.
4. **Validation** — Pure JS, no libraries — checks name, amount, category, date.
5. **Security** — All user-input rendered via `textContent` / `escHtml()` helper to prevent XSS.

---

## 🙌 Credits

Built by **[Your Name]** as a portfolio project.  
Feel free to fork, extend, and showcase on GitHub!

---

## 📄 License

MIT — free to use, modify, and distribute.
