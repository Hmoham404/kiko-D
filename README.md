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
« Tous les clients » affiche le total. Après un import Assemblage réussi, le
formulaire **Répartir l’objectif par client** s’ouvre sur la dernière semaine
importée. Le total hebdomadaire provient du fichier de targets, ou à défaut de
l’import de production. Renseignez un objectif entier positif ou nul pour chaque
client ; l’enregistrement est possible uniquement lorsque leur somme correspond
exactement au total Assemblage. Les semaines sont indépendantes.
Le choix **Par jour** convertit les objectifs en objectifs hebdomadaires sur six
jours, du lundi au samedi. Par exemple, CT à 0 et KIKO à 10 500 par jour donnent
un total de 63 000 pièces par semaine. Si ce total diffère de la référence
importée, **Ajuster le total Assemblage** permet de remplacer le total de cette
semaine par la répartition saisie. Le total et les objectifs clients sont alors
enregistrés ensemble ; les autres semaines sont conservées.

Pour modifier une répartition plus tard, sélectionnez **Assemblage → Objectifs
par client**. Quand un client est sélectionné, les indicateurs et graphiques
utilisent son objectif hebdomadaire, réparti sur six jours pour la vue journalière.
Un objectif client absent est signalé et ne reprend pas le total du département.
Le suivi de commande KIKO conserve son plan dédié à 10 500 pièces par jour actif.

Les objectifs clients sont conservés dans la table existante `weekly_targets`,
avec des clés `assembly-client::<client encodé>::<semaine>`. Les réimports de
production et des objectifs de département les conservent. La sauvegarde vérifie
également le total côté serveur ; une erreur laisse le formulaire ouvert.

Le détail client est conservé dans `dashboard_metadata`, avec une entrée
`assembly_clients::<date>` par journée. Si cette table est absente d'une ancienne
base, le service utilise `dashboard_snapshots` (`id`, `payload`, `updated_at`) pour
ces métadonnées. Chaque journée possède un identifiant stable et le type
`production-dashboard-metadata` ; les autres snapshots sont conservés.
Les totaux journaliers restent dans `production_reports`. Un ancien import ayant
perdu le détail client doit être réimporté après cette correction.

Vérification de l'import et de la sauvegarde : `npm run test:clients`.

## Cercle de progression KIKO Assemblage

Le suivi de commande en tête du dashboard cumule les quantités **conformes** des
lignes Assemblage identifiées `KIKO`, à partir du **26/10/2026 inclus** et jusqu'à
la date sélectionnée. Il affiche
l'objectif total de **350 000 pièces**, un palier de **265 000 pièces** et
l'échéance du **19/12/2026**. Ces valeurs sont définies dans
`src/lib/kikoProductionProgress.ts`.

Dans le même bloc, la courbe du cumul conforme est comparée au cumul planifié :
**10 500 pièces par jour avec une activité KIKO Assemblage** (quantité produite,
conforme ou rebutée positive). Chaque date est comptée une seule fois. Les jours
sans activité et les jours absents des imports n'ajoutent aucun objectif ; un
week-end travaillé compte. Le planifié s'arrête à la date sélectionnée, comme le
cumul conforme. Les rebuts sont exclus de la réalisation conforme.
La courbe conforme est verte au-dessus du planifié, orange à égalité et rouge
en dessous, à chaque date. L'écart et la légende suivent la situation à la date
sélectionnée. Sans objectif planifié, la couleur est neutre.

Le cumul conserve les journées importées à partir du 26/10/2026 et ne repart pas à
zéro chaque semaine ou chaque mois. Les journées antérieures et les quantités sans
client restent exclues : réimportez
les fichiers avec la colonne Client pour les attribuer. Après l'échéance, la
production réalisée au plus tard le 19/12 reste affichée séparément pour
distinguer une réalisation tardive.
