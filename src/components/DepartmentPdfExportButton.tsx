'use client';

import React, { useMemo, useState } from 'react';
import { FileDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

import type { ProductionData } from '@/lib/dashboardTypes';

interface DepartmentPdfExportButtonProps {
  data: ProductionData[];
}

type DepartmentReport = {
  department: string;
  items: ProductionData[];
  dateStart: string;
  dateEnd: string;
  target: number;
  actual: number;
  conform: number;
  scrap: number;
  progress: number;
};

const formatNumber = (value: number) => new Intl.NumberFormat('fr-FR').format(Math.round(value));
const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const formatDateLabel = (date: string) => {
  try {
    return format(parseISO(date), 'dd/MM/yyyy', { locale: fr });
  } catch {
    return date;
  }
};

const escapeHtml = (value: string | number) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const getToneColor = (progress: number) => {
  if (progress > 0.95) return '#1f9d55';
  if (progress >= 0.85) return '#d97706';
  return '#d6455d';
};

export const DepartmentPdfExportButton: React.FC<DepartmentPdfExportButtonProps> = ({ data }) => {
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const reports = useMemo<DepartmentReport[]>(() => {
    const grouped = new Map<string, ProductionData[]>();

    data.forEach((item) => {
      const existing = grouped.get(item.department) ?? [];
      existing.push(item);
      grouped.set(item.department, existing);
    });

    return Array.from(grouped.entries())
      .map(([department, items]) => {
        const orderedItems = items
          .slice()
          .sort((left, right) => left.date.localeCompare(right.date) || left.machine?.localeCompare(right.machine ?? '') || 0);
        const target = orderedItems.reduce((sum, item) => sum + item.target, 0);
        const actual = orderedItems.reduce((sum, item) => sum + item.actualProduction, 0);
        const conform = orderedItems.reduce((sum, item) => sum + item.conformQty, 0);
        const scrap = orderedItems.reduce((sum, item) => sum + item.scrapQty, 0);

        return {
          department,
          items: orderedItems,
          dateStart: orderedItems[0]?.date ?? '',
          dateEnd: orderedItems[orderedItems.length - 1]?.date ?? '',
          target,
          actual,
          conform,
          scrap,
          progress: target > 0 ? actual / target : 0,
        };
      })
      .sort((left, right) => left.department.localeCompare(right.department));
  }, [data]);

  const handleExport = () => {
    if (reports.length === 0) return;

    setExportError(null);
    setIsExporting(true);

    const logoUrl = `${window.location.origin}/logo%20myc.jpg`;
    const generatedAt = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr });

    const sections = reports
      .map((report, index) => {
        const detailRows = report.items
          .map((item) => {
            const gap = item.actualProduction - item.target;
            const rate = item.target > 0 ? item.actualProduction / item.target : 0;

            return `
              <tr>
                <td>${escapeHtml(formatDateLabel(item.date))}</td>
                <td>${escapeHtml(item.week)}</td>
                <td>${escapeHtml(item.machine ?? item.shift ?? '-')}</td>
                <td>${escapeHtml(item.partNumber ?? '-')}</td>
                <td class="right">${escapeHtml(formatNumber(item.target))}</td>
                <td class="right">${escapeHtml(formatNumber(item.actualProduction))}</td>
                <td class="right">${escapeHtml(formatNumber(item.conformQty))}</td>
                <td class="right">${escapeHtml(formatNumber(item.scrapQty))}</td>
                <td class="right">${escapeHtml(`${gap > 0 ? '+' : ''}${formatNumber(gap)}`)}</td>
                <td class="right">${escapeHtml(formatPercent(rate))}</td>
              </tr>
            `;
          })
          .join('');

        return `
          <section class="department ${index > 0 ? 'page-break' : ''}">
            <div class="report-header">
              <div class="brand-row">
                <img src="${escapeHtml(logoUrl)}" alt="MYC Beauty" class="logo" />
                <div>
                  <p class="eyebrow">Manufacturing cockpit</p>
                  <h1>Rapport detaille departement</h1>
                  <p class="muted">Genere le ${escapeHtml(generatedAt)}</p>
                </div>
              </div>
              <div class="hero-card">
                <p class="eyebrow">Departement</p>
                <h2>${escapeHtml(report.department)}</h2>
                <p class="muted">Periode couverte: ${escapeHtml(formatDateLabel(report.dateStart))} au ${escapeHtml(formatDateLabel(report.dateEnd))}</p>
              </div>
            </div>

            <div class="kpi-grid">
              <div class="kpi-card">
                <p class="kpi-label">Objectif total</p>
                <p class="kpi-value">${escapeHtml(formatNumber(report.target))}</p>
              </div>
              <div class="kpi-card">
                <p class="kpi-label">Realise total</p>
                <p class="kpi-value">${escapeHtml(formatNumber(report.actual))}</p>
              </div>
              <div class="kpi-card">
                <p class="kpi-label">Conforme</p>
                <p class="kpi-value">${escapeHtml(formatNumber(report.conform))}</p>
              </div>
              <div class="kpi-card">
                <p class="kpi-label">Taux</p>
                <p class="kpi-value" style="color:${getToneColor(report.progress)}">${escapeHtml(formatPercent(report.progress))}</p>
              </div>
            </div>

            <div class="table-card">
              <h3>Detail journalier</h3>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Semaine</th>
                    <th>Machine / Shift</th>
                    <th>Reference</th>
                    <th class="right">Target</th>
                    <th class="right">Realise</th>
                    <th class="right">Conforme</th>
                    <th class="right">Scrap</th>
                    <th class="right">Ecart</th>
                    <th class="right">Taux</th>
                  </tr>
                </thead>
                <tbody>
                  ${detailRows}
                </tbody>
              </table>
            </div>
          </section>
        `;
      })
      .join('');

    const printableDocument = `
      <!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>Rapports PDF par departement</title>
          <style>
            body {
              font-family: Aptos, "Segoe UI", sans-serif;
              color: #16202b;
              margin: 0;
              background: #f3f6f9;
            }
            .department {
              padding: 28px;
            }
            .page-break {
              page-break-before: always;
            }
            .report-header {
              border: 1px solid #d9e3ea;
              border-radius: 22px;
              padding: 24px;
              background: linear-gradient(135deg, #ffffff, #eef3f7);
              box-shadow: 0 20px 44px -34px rgba(15, 23, 42, 0.22);
            }
            .brand-row {
              display: flex;
              align-items: center;
              gap: 16px;
            }
            .logo {
              width: 96px;
              height: auto;
              object-fit: contain;
              border-radius: 16px;
              border: 1px solid #d9e3ea;
              background: white;
              padding: 10px;
            }
            .eyebrow {
              margin: 0;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: .18em;
              text-transform: uppercase;
              color: #7b8ba1;
            }
            h1 {
              margin: 8px 0 4px;
              font-size: 30px;
              font-weight: 900;
              color: #0f172a;
            }
            h2 {
              margin: 8px 0 0;
              font-size: 28px;
              font-weight: 900;
              color: #13304d;
            }
            h3 {
              margin: 0 0 14px;
              font-size: 18px;
              font-weight: 900;
              color: #0f172a;
            }
            .muted {
              margin: 6px 0 0;
              color: #526173;
              font-size: 13px;
            }
            .hero-card {
              margin-top: 18px;
              border: 1px solid #d9e3ea;
              border-radius: 18px;
              background: white;
              padding: 18px;
            }
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 14px;
              margin-top: 18px;
            }
            .kpi-card {
              border: 1px solid #d9e3ea;
              border-radius: 16px;
              background: white;
              padding: 16px;
            }
            .kpi-label {
              margin: 0;
              font-size: 10px;
              font-weight: 800;
              letter-spacing: .14em;
              text-transform: uppercase;
              color: #7b8ba1;
            }
            .kpi-value {
              margin: 10px 0 0;
              font-size: 24px;
              font-weight: 900;
              color: #0f172a;
            }
            .table-card {
              margin-top: 18px;
              border: 1px solid #d9e3ea;
              border-radius: 18px;
              background: white;
              padding: 18px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              border: 1px solid #d9e3ea;
              padding: 10px 12px;
              text-align: left;
              font-size: 12px;
            }
            th {
              background: #eef3f7;
              font-size: 10px;
              font-weight: 900;
              letter-spacing: .12em;
              text-transform: uppercase;
              color: #475569;
            }
            .right {
              text-align: right;
            }
            @media print {
              body {
                background: white;
              }
              .department {
                padding: 16px;
              }
            }
          </style>
        </head>
        <body>${sections}</body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';

    const cleanup = () => {
      window.setTimeout(() => {
        iframe.remove();
        setIsExporting(false);
      }, 400);
    };

    iframe.onload = () => {
      const frameWindow = iframe.contentWindow;
      if (!frameWindow) {
        setExportError("L'aperçu PDF n'a pas pu être ouvert.");
        cleanup();
        return;
      }

      window.setTimeout(() => {
        try {
          frameWindow.focus();
          frameWindow.print();
        } catch {
          setExportError("Le navigateur a bloque l'impression PDF.");
        } finally {
          cleanup();
        }
      }, 900);
    };

    document.body.appendChild(iframe);

    const frameDocument = iframe.contentDocument;
    if (!frameDocument) {
      setExportError("Le document PDF n'a pas pu être préparé.");
      cleanup();
      return;
    }

    frameDocument.open();
    frameDocument.write(printableDocument);
    frameDocument.close();
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={reports.length === 0 || isExporting}
        className="group relative inline-flex items-center rounded-[1.1rem] border border-slate-200/90 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-[0_18px_35px_-28px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-[var(--dashboard-accent-red)] hover:text-[var(--dashboard-accent-red-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FileDown className="mr-2 h-4 w-4" />
        {isExporting ? 'Preparation PDF...' : 'Exporter PDF'}
      </button>

      {exportError ? (
        <p className="max-w-xs text-right text-xs font-semibold text-rose-600">{exportError}</p>
      ) : (
        <p className="max-w-[14rem] text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Impression puis Enregistrer en PDF
        </p>
      )}
    </div>
  );
};
