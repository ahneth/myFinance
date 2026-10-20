# myFinance — Executive Wealth & Cashflow Forecasting Suite

A modular, local-first personal finance web application designed for **GitHub Pages** hosting. Built with compartmentalized HTML, CSS, and JavaScript modules, interactive **Chart.js** visualizations, **SheetJS (.xlsx)** Excel backup/restore, **Android Home Screen / PC Bookmark Icons**, and a live **Run-Time Log & Error Diagnostics Console**.

## Key Features & Productive Asset Return Model

- **Split Productive Asset Return Rates & Auto-Calculated Total Return**:
  - Each productive asset splits its return rate into **Yearly Cash Return Rate (`%/yr`)** and **Yearly Capital Growth Rate (`%/yr`)**.
  - **Total Return Rate (`%/yr`)** is automatically calculated by summing `Yearly Cash Return Rate + Yearly Capital Growth Rate`.
- **Split Annual Cash Returns & Annual Capital Gains Across Metrics, Calculations & Graphs**:
  - **Executive KPI Cards & Ratios Scorecard**: Separate metrics and weighted rates for **Annual Cash Returns (`$/yr` & `%`)**, **Annual Capital Gain (`$/yr` & `%`)**, and **Total Productive Return (`$/yr` & `%`)**.
  - **Assets Ledger Table**: Displays individual and total **Cash Return Rate**, **Capital Growth Rate**, **Total Return Rate**, **Annual Cash Return (`$/yr`)**, **Annual Capital Gain (`$/yr`)**, and **Total Annual Return (`$/yr`)**.
  - **Interactive Chart.js Visualizations**: Stacked horizontal bar chart comparing **Annual Cash Return (`$`)** vs. **Annual Capital Gain (`$`)** per productive asset on the Balance Sheet, plus split **Annual Cash Return (`$`)** and **Annual Capital Gain (`$`)** bars and crossover curves on the Yearly Cashflows & Forecast tab.
  - **1-Click Balance Sheet → Forecast Sync**: Syncs **Initial Savings**, **Weighted Yearly Cash Return Rate**, and **Weighted Yearly Capital Growth Rate** directly from Productive Assets into the Yearly Cashflows & Forecast model.

## Compartmentalized File Architecture

- `index.html` — Application shell, unnumbered segmented navigation bar, Balance Sheet & Cashflow Forecast views, and PC/Android/iOS icon & Web App Manifest links.
- `styles.css` — Executive fintech design system, custom scrollbars, animations, and responsive surface styling.
- `logger.js` — Run-Time Log & Error Diagnostics module capturing lifecycle events, calculation audits, and uncaught exceptions.
- `storage.js` — Local device persistence (`localStorage`) and multi-sheet Excel (`.xlsx`) export/import module with split Cash Return and Capital Growth columns.
- `charts.js` — Interactive Chart.js visualizations for asset allocation, balance sheet structure, stacked productive asset cash returns vs. capital gains, and retirement wealth trajectories.
- `balanceSheet.js` — Assets (Liquid / Fixed, Productive flag, Yearly Cash Return Rate, Yearly Capital Growth Rate, and auto-summed Total Return Rate), Liabilities (Short-Term / Long-Term), Net Worth, and 8 Financial Health Ratios.
- `cashflow.js` — Yearly Cashflows & Forecast engine from Current Age to Life Expectancy, including **Initial Savings** (after Current Age), split **Yearly Cash Return Rate** & **Yearly Capital Growth Rate** (with auto-summed **Total Return Rate**), and one-time **Expected Pension (Lump Sum)** (after Target Retirement Age).
- `app.js` — Main application controller coordinating tabs, modals, toast notifications, and module initialization.
- `favicon.ico` & `favicon-32x32.png` — Desktop bookmark icons for Windows/macOS browsers.
- `icon-192.png` & `icon-512.png` — High-resolution Android home screen shortcut icons (`192×192` and `512×512` PNG).
- `apple-touch-icon.png` — iOS / iPadOS home screen shortcut icon (`180×180` PNG).
- `manifest.json` & `site.webmanifest` — Web App Manifest files enabling Android Chrome **"Add to Home screen"** / **"Install app"** standalone installation.
- `sw.js` — Offline-capable Service Worker for Android PWA installation.

## Hosting on GitHub Pages

1. Upload all files in this folder (`index.html`, `styles.css`, `logger.js`, `storage.js`, `charts.js`, `balanceSheet.js`, `cashflow.js`, `app.js`, `sw.js`, `manifest.json`, `site.webmanifest`, `favicon.ico`, `favicon-32x32.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, and `README.md`) to the root of your GitHub repository.
2. In your repository settings, go to **Settings → Pages**, select your branch (`main` / `root`), and click **Save**.
