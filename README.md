# KIKO Milano & MYC Beauty - Production Performance Audit Dashboard

This is a premium, high-performance Next.js production auditing dashboard built for **MYC Beauty** and **KIKO Milano**.

## 🚀 Key Features

* **Subtle Industrial Layout Integration:** Visuals styled around active production views with glassmorphic cards and headers.
* **Excel Data Parser:** Advanced bilingual (French/English) parser to import, validate, and clean Excel sheets for daily production files.
* **Automated Target Syncing:** Dynamically extracts daily target values directly from Excel sheets or falls back to standard department defaults.
* **Interactive Tables & Tabs:**
  * **Daily Tracking Sheet:** Direct replica of original Excel spreadsheet views, with automatic 1-day date shift corrections.
  * **Synthèse par Département:** Includes detailed breakdown of Injection (`Injection (Base)`, `Injection (Cover)`, `Injection (Insert)`).
  * **Détail Injection:** Sub-components performance breakdown.
* **Performance Analytics:** Rich charts representing Target vs Actual, Progress Trends, Scrap per Department, and Production Contribution.

## 🛠️ Tech Stack

* **Framework:** Next.js (App Router, TailwindCSS/PostCSS)
* **Icons:** Lucide React
* **Charts:** Recharts
* **State Management:** Zustand
* **Parsing:** SheetJS (xlsx)

## 📦 Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

4. Deploy to Vercel in one click.
