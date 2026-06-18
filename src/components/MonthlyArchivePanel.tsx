'use client';

import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Archive, CalendarRange, FileDown, FolderKanban } from 'lucide-react';

import type { ProductionData } from '@/lib/dashboardTypes';

interface MonthlyArchivePanelProps {
  data: ProductionData[];
}

type MonthlyArchiveRow = {
  monthKey: string;
  monthLabel: string;
  dateStart: string;
  dateEnd: string;
  workingDays: number;
  departments: string[];
  target: number;
  actual: number;
  conform: number;
  scrap: number;
  progress: number;
  status: 'En cours' | 'Classe';
  items: ProductionData[];
};

const formatNumber = (value: number) => new Intl.NumberFormat('fr-FR').format(Math.round(value));
const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const formatMonthLabel = (monthKey: string) => {
  try {
    return format(parseISO(`${monthKey}-01`), 'MMMM yyyy', { locale: fr });
  } catch {
    return monthKey;
  }
};

const formatDateLabel = (date: string) => {
  try {
    return format(parseISO(date), 'dd/MM/yyyy', { locale: fr });
  } catch {
    return date;
  }
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const buildPrintableHtml = (report: MonthlyArchiveRow) => {
  const departmentRows = report.departments.map((department) => {
    const items = report.items.filter((item) => item.department === department);
    const target = items.reduce((sum, item) => sum + item.target, 0);
    const actual = items.reduce((sum, item) => sum + item.actualProduction, 0);
    const conform = items.reduce((sum, item) => sum + item.conformQty, 0);
    const scrap = items.reduce((sum, item) => sum + item.scrapQty, 0);
    const progress = target > 0 ? actual / target : 0;

    return `
      <tr>
        <td>${escapeHtml(department)}</td>
        <td>${formatNumber(target)}</td>
        <td>${formatNumber(actual)}</td>
        <td>${formatNumber(conform)}</td>
        <td>${formatNumber(scrap)}</td>
        <td>${formatPercent(progress)}</td>
      </tr>
    `;
  }).join('');

  const dailyRows = report.items
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date) || left.department.localeCompare(right.department))
    .map((item) => {
      const rate = item.target > 0 ? item.actualProduction / item.target : 0;

      return `
        <tr>
          <td>${escapeHtml(formatDateLabel(item.date))}</td>
          <td>${escapeHtml(item.department)}</td>
          <td>${formatNumber(item.target)}</td>
          <td>${formatNumber(item.actualProduction)}</td>
          <td>${formatNumber(item.conformQty)}</td>
          <td>${formatNumber(item.scrapQty)}</td>
          <td>${formatPercent(rate)}</td>
        </tr>
      `;
    }).join('');

  return `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Rapport ${escapeHtml(report.monthLabel)}</title>
        <style>
          body {
            font-family: Aptos, "Segoe UI", sans-serif;
            color: #16202b;
            margin: 32px;
          }
          h1, h2, h3, p {
            margin: 0;
          }
          .header {
            margin-bottom: 24px;
            padding: 24px;
            border: 1px solid #d9e3ea;
            border-radius: 18px;
            background: linear-gradient(135deg, #f8fbfd, #eef3f6);
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
            margin-top: 18px;
          }
          .card {
            border: 1px solid #d9e3ea;
            border-radius: 14px;
            padding: 14px;
            background: white;
          }
          .label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: .14em;
            color: #708090;
          }
          .value {
            margin-top: 8px;
            font-size: 22px;
            font-weight: 800;
          }
          .section {
            margin-top: 26px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
          }
          th, td {
            border: 1px solid #d9e3ea;
            padding: 10px 12px;
            text-align: left;
            font-size: 13px;
          }
          th {
            background: #eef3f6;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: .12em;
          }
          .muted {
            color: #64748b;
            margin-top: 8px;
            font-size: 13px;
          }
          @media print {
            body {
              margin: 16px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <p class="label">Archive mensuelle</p>
          <h1 style="margin-top: 10px; font-size: 34px; text-transform: capitalize;">${escapeHtml(report.monthLabel)}</h1>
          <p class="muted">Periode: ${escapeHtml(formatDateLabel(report.dateStart))} au ${escapeHtml(formatDateLabel(report.dateEnd))}</p>
          <p class="muted">Statut: ${escapeHtml(report.status)}</p>
          <div class="grid">
            <div class="card">
              <p class="label">Objectif</p>
              <p class="value">${formatNumber(report.target)}</p>
            </div>
            <div class="card">
              <p class="label">Realise</p>
              <p class="value">${formatNumber(report.actual)}</p>
            </div>
            <div class="card">
              <p class="label">Conforme</p>
              <p class="value">${formatNumber(report.conform)}</p>
            </div>
            <div class="card">
              <p class="label">Performance</p>
              <p class="value">${formatPercent(report.progress)}</p>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Resume par departement</h2>
          <table>
            <thead>
              <tr>
                <th>Departement</th>
                <th>Objectif</th>
                <th>Realise</th>
                <th>Conforme</th>
                <th>Rebut</th>
                <th>Taux</th>
              </tr>
            </thead>
            <tbody>${departmentRows}</tbody>
          </table>
        </div>

        <div class="section">
          <h2>Detail journalier</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Departement</th>
                <th>Objectif</th>
                <th>Realise</th>
                <th>Conforme</th>
                <th>Rebut</th>
                <th>Taux</th>
              </tr>
            </thead>
            <tbody>${dailyRows}</tbody>
          </table>
        </div>
      </body>
    </html>
  `;
};

export const MonthlyArchivePanel: React.FC<MonthlyArchivePanelProps> = ({ data }) => {
  const monthlyRows = useMemo<MonthlyArchiveRow[]>(() => {
    const grouped = new Map<string, ProductionData[]>();

    data.forEach((item) => {
      const monthKey = item.date.slice(0, 7);
      const existing = grouped.get(monthKey) ?? [];
      existing.push(item);
      grouped.set(monthKey, existing);
    });

    const orderedMonthKeys = Array.from(grouped.keys()).sort();
    const latestMonthKey = orderedMonthKeys[orderedMonthKeys.length - 1] ?? '';

    return orderedMonthKeys
      .map((monthKey) => {
        const items = (grouped.get(monthKey) ?? [])
          .slice()
          .sort((left, right) => left.date.localeCompare(right.date) || left.department.localeCompare(right.department));
        const departments = Array.from(new Set(items.map((item) => item.department))).sort();
        const dates = Array.from(new Set(items.map((item) => item.date))).sort();
        const target = items.reduce((sum, item) => sum + item.target, 0);
        const actual = items.reduce((sum, item) => sum + item.actualProduction, 0);
        const conform = items.reduce((sum, item) => sum + item.conformQty, 0);
        const scrap = items.reduce((sum, item) => sum + item.scrapQty, 0);

        return {
          monthKey,
          monthLabel: formatMonthLabel(monthKey),
          dateStart: dates[0] ?? `${monthKey}-01`,
          dateEnd: dates[dates.length - 1] ?? `${monthKey}-01`,
          workingDays: dates.length,
          departments,
          target,
          actual,
          conform,
          scrap,
          progress: target > 0 ? actual / target : 0,
          status: monthKey === latestMonthKey ? 'En cours' : 'Classe',
          items,
        };
      })
      .sort((left, right) => right.monthKey.localeCompare(left.monthKey));
  }, [data]);

  const completedMonths = monthlyRows.filter((row) => row.status === 'Classe');
  const activeMonth = monthlyRows.find((row) => row.status === 'En cours') ?? null;

  const handleExportPdf = (report: MonthlyArchiveRow) => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1080,height=920');

    if (!printWindow) {
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildPrintableHtml(report));
    printWindow.document.close();
    printWindow.focus();

    window.setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (monthlyRows.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Archives mensuelles</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Mois classes et export PDF</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Quand un nouveau mois commence, le mois precedent passe automatiquement en statut classe. Vous pouvez ensuite
            l&apos;exporter en PDF.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Mois classes</span>
            <p className="mt-2 text-2xl font-black text-slate-900">{completedMonths.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Mois actif</span>
            <p className="mt-2 text-xl font-black capitalize text-slate-900">{activeMonth?.monthLabel ?? '-'}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {monthlyRows.map((row) => (
          <article key={row.monthKey} className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-[var(--dashboard-primary)]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Dossier mensuel</p>
                </div>
                <h3 className="mt-2 text-2xl font-black capitalize tracking-tight text-slate-950">{row.monthLabel}</h3>
                <p className="mt-2 text-sm text-slate-600">
                  {formatDateLabel(row.dateStart)} au {formatDateLabel(row.dateEnd)}
                </p>
              </div>

              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                  row.status === 'Classe' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {row.status === 'Classe' ? <Archive className="h-3.5 w-3.5" /> : <CalendarRange className="h-3.5 w-3.5" />}
                {row.status}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Objectif</p>
                <p className="mt-2 text-xl font-black text-slate-900">{formatNumber(row.target)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Realise</p>
                <p className="mt-2 text-xl font-black text-slate-900">{formatNumber(row.actual)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Jours</p>
                <p className="mt-2 text-xl font-black text-slate-900">{row.workingDays}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Taux</p>
                <p className="mt-2 text-xl font-black text-slate-900">{formatPercent(row.progress)}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Departements</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">{row.departments.join(', ')}</p>
              </div>

              <button
                type="button"
                onClick={() => handleExportPdf(row)}
                className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#13304d,#1f4f72)] px-4 py-2 text-sm font-black text-white shadow-[0_18px_36px_-18px_rgba(19,48,77,0.75)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                <FileDown className="h-4 w-4" />
                Exporter PDF
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
