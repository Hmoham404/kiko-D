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

## Import Assemblage par client

Ajoutez une colonne `Client` (ou `Customer`) au tableau du fichier de production
Assemblage, puis renseignez le client sur chaque ligne, par exemple `KIKO`.
La position de cette colonne est libre. Les cellules vides et les anciens imports
sans client apparaissent sous « Non renseigné » ; seules les cellules fusionnées
reprennent explicitement le client de leur cellule d'origine.

Après réimport, sélectionnez **FG / PF → Assemblage → Client**. Le choix s'applique
aux quantités produites, conformes et rebutées, aux cumuls et aux graphiques.
« Tous les clients » affiche le total. L'objectif reste celui du département
Assemblage, y compris lorsqu'un client est sélectionné.

Le détail client est conservé dans `dashboard_metadata`, avec une entrée
`assembly_clients::<date>` par journée. Si cette table est absente d'une ancienne
base, le service utilise `dashboard_snapshots` (`id`, `payload`, `updated_at`) pour
ces métadonnées. Chaque journée possède un identifiant stable et le type
`production-dashboard-metadata` ; les autres snapshots sont conservés.
Les totaux journaliers restent dans `production_reports`. Un ancien import ayant
perdu le détail client doit être réimporté après cette correction.

Vérification de l'import et de la sauvegarde : `npm run test:clients`.

## Cercle de progression KIKO Assemblage

Le suivi de commande en tête du dashboard cumule les quantités **produites** des
lignes Assemblage identifiées `KIKO`, à partir du **26/10/2026 inclus** et jusqu'à
la date sélectionnée. Il affiche
l'objectif total de **350 000 pièces**, un palier de **265 000 pièces** et
l'échéance du **19/12/2026**. Ces valeurs sont définies dans
`src/lib/kikoProductionProgress.ts`.

Le cumul conserve les journées importées à partir du 26/10/2026 et ne repart pas à
zéro chaque semaine ou chaque mois. Les journées antérieures et les quantités sans
client restent exclues : réimportez
les fichiers avec la colonne Client pour les attribuer. Après l'échéance, la
production réalisée au plus tard le 19/12 reste affichée séparément pour
distinguer une réalisation tardive.
