'use client';

import React, { useMemo, useState } from 'react';
import { FileDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

const getImageDataUrl = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Logo indisponible.');
  }

  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Lecture du logo impossible.'));
    };
    reader.onerror = () => reject(new Error('Lecture du logo impossible.'));
    reader.readAsDataURL(blob);
  });
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

  const handleExport = async () => {
    if (reports.length === 0) return;

    setExportError(null);
    setIsExporting(true);

    try {
      const logoDataUrl = await getImageDataUrl(`${window.location.origin}/logo%20myc.jpg`).catch(() => null);
      const generatedAt = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr });
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      reports.forEach((report, index) => {
        if (index > 0) {
          doc.addPage();
        }

        const pageWidth = doc.internal.pageSize.getWidth();
        let cursorY = 16;

        doc.setFillColor(248, 251, 253);
        doc.roundedRect(10, 10, pageWidth - 20, 42, 6, 6, 'F');
        doc.setDrawColor(217, 227, 234);
        doc.roundedRect(10, 10, pageWidth - 20, 42, 6, 6, 'S');

        if (logoDataUrl) {
          doc.addImage(logoDataUrl, 'JPEG', 14, 14, 26, 14);
        }

        doc.setTextColor(123, 139, 161);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('MANUFACTURING COCKPIT', 44, 18);

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(18);
        doc.text('Rapport detaille departement', 44, 25);

        doc.setFontSize(10);
        doc.setTextColor(82, 97, 115);
        doc.text(`Genere le ${generatedAt}`, 44, 31);

        doc.setTextColor(19, 48, 77);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(report.department, 14, 42);

        doc.setTextColor(82, 97, 115);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(
          `Periode couverte: ${formatDateLabel(report.dateStart)} au ${formatDateLabel(report.dateEnd)}`,
          14,
          48
        );

        const metricCards = [
          { label: 'Objectif total', value: formatNumber(report.target), color: [15, 23, 42] as const },
          { label: 'Realise total', value: formatNumber(report.actual), color: [15, 23, 42] as const },
          { label: 'Conforme', value: formatNumber(report.conform), color: [15, 23, 42] as const },
          {
            label: 'Taux',
            value: formatPercent(report.progress),
            color:
              report.progress > 0.95 ? ([31, 157, 85] as const) : report.progress >= 0.85 ? ([217, 119, 6] as const) : ([214, 69, 93] as const),
          },
        ];

        const cardWidth = (pageWidth - 34) / 4;
        metricCards.forEach((card, cardIndex) => {
          const x = 10 + cardIndex * (cardWidth + 4);
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(x, 58, cardWidth, 20, 4, 4, 'F');
          doc.setDrawColor(217, 227, 234);
          doc.roundedRect(x, 58, cardWidth, 20, 4, 4, 'S');
          doc.setTextColor(123, 139, 161);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.text(card.label.toUpperCase(), x + 4, 64);
          doc.setTextColor(card.color[0], card.color[1], card.color[2]);
          doc.setFontSize(13);
          doc.text(card.value, x + 4, 72);
        });

        cursorY = 86;
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Detail journalier', 14, cursorY);

        autoTable(doc, {
          startY: cursorY + 4,
          margin: { left: 10, right: 10 },
          head: [[
            'Date',
            'Semaine',
            'Machine / Shift',
            'Reference',
            'Target',
            'Realise',
            'Conforme',
            'Scrap',
            'Ecart',
            'Taux',
          ]],
          body: report.items.map((item) => {
            const gap = item.actualProduction - item.target;
            const rate = item.target > 0 ? item.actualProduction / item.target : 0;

            return [
              formatDateLabel(item.date),
              item.week,
              item.machine ?? item.shift ?? '-',
              item.partNumber ?? '-',
              formatNumber(item.target),
              formatNumber(item.actualProduction),
              formatNumber(item.conformQty),
              formatNumber(item.scrapQty),
              `${gap > 0 ? '+' : ''}${formatNumber(gap)}`,
              formatPercent(rate),
            ];
          }),
          theme: 'grid',
          headStyles: {
            fillColor: [238, 243, 247],
            textColor: [71, 85, 105],
            fontStyle: 'bold',
            fontSize: 8,
          },
          bodyStyles: {
            fontSize: 8,
            textColor: [22, 32, 43],
          },
          alternateRowStyles: {
            fillColor: [250, 252, 253],
          },
          styles: {
            lineColor: [217, 227, 234],
            lineWidth: 0.1,
            cellPadding: 2.5,
          },
          didDrawPage: () => {
            const pageCount = doc.getNumberOfPages();
            const currentPage = doc.getCurrentPageInfo().pageNumber;
            doc.setFontSize(8);
            doc.setTextColor(123, 139, 161);
            doc.text(
              `Page ${currentPage}/${pageCount}`,
              pageWidth - 24,
              doc.internal.pageSize.getHeight() - 8
            );
          },
        });
      });

      const fileStamp = format(new Date(), 'yyyyMMdd-HHmm');
      doc.save(`rapport-departements-${fileStamp}.pdf`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "L'export PDF a echoue.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={reports.length === 0 || isExporting}
        className="group relative flex min-h-[5.9rem] min-w-[10.75rem] flex-col justify-between overflow-hidden rounded-[1.5rem] border border-slate-200/90 bg-white px-4 py-3 text-left text-slate-700 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-0.5 hover:border-[var(--dashboard-accent-red)] hover:text-[var(--dashboard-accent-red-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Rapport</p>
            <p className="mt-2 text-sm font-black text-slate-800">
              {isExporting ? 'Preparation PDF...' : 'Exporter PDF'}
            </p>
          </div>
          <FileDown className="h-4 w-4" />
        </div>
        <div className="flex items-end justify-between gap-3">
          <p className="max-w-[9rem] text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Fichier telecharge directement
          </p>
          <span className="inline-flex rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
            Direct
          </span>
        </div>
      </button>

      {exportError ? (
        <p className="max-w-[12rem] text-xs font-semibold text-rose-600">{exportError}</p>
      ) : null}
    </div>
  );
};
