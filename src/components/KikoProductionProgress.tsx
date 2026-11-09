'use client';

import { useId, useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarDays, Check, Factory, Flag, Minus, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ProductionData } from '@/lib/dashboardTypes';
import { getKikoPlanStatus, getKikoProductionProgress, KIKO_PRODUCTION_PLAN } from '@/lib/kikoProductionProgress';

interface KikoProductionProgressProps {
  data: ProductionData[];
  selectedDate: string;
}

const number = (value: number) => new Intl.NumberFormat('fr-FR').format(Math.round(value));
const percent = (value: number) => `${(value * 100).toFixed(1).replace('.', ',')} %`;
const dateLabel = (value: string) => value ? format(parseISO(value), 'dd/MM/yyyy') : '—';
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const planStyles = {
  green: { color: '#15803d', label: 'Au-dessus du planifié' },
  orange: { color: '#c2410c', label: 'Égal au planifié' },
  red: { color: '#dc2626', label: 'En dessous du planifié' },
  neutral: { color: '#64748b', label: 'Aucun objectif planifié' },
};

export function KikoProductionProgress({ data, selectedDate }: KikoProductionProgressProps) {
  const progress = useMemo(() => getKikoProductionProgress(data, selectedDate), [data, selectedDate]);
  const planStyle = planStyles[progress.planStatus];
  const gradientId = useId();
  const curveStops = progress.history.flatMap((day, index, history) => {
    const next = history[index + 1];
    const difference = day.cumulative - day.plannedCumulative;
    const offset = history.length > 1 ? index / (history.length - 1) : 0;
    if (!next) return [{ offset, color: planStyles[getKikoPlanStatus(day.cumulative, day.plannedCumulative)].color }];
    const nextDifference = next.cumulative - next.plannedCumulative;
    const endOffset = (index + 1) / (history.length - 1);
    const startDay = difference === 0 ? next : day;
    const endDay = nextDifference === 0 ? day : next;
    const startColor = planStyles[getKikoPlanStatus(startDay.cumulative, startDay.plannedCumulative)].color;
    const endColor = planStyles[getKikoPlanStatus(endDay.cumulative, endDay.plannedCumulative)].color;
    const stops = [{ offset, color: startColor }];
    if (difference * nextDifference < 0) {
      const crossing = offset + (endOffset - offset) * difference / (difference - nextDifference);
      stops.push({ offset: crossing, color: startColor }, { offset: crossing, color: endColor });
    }
    stops.push({ offset: endOffset, color: endColor });
    return stops;
  });
  const attainment = progress.plannedCumulative > 0 ? progress.cumulative / progress.plannedCumulative : null;
  const StatusIcon = progress.planStatus === 'green' ? ArrowUpRight : progress.planStatus === 'red' ? ArrowDownRight : Minus;
  const hasCurveHeight = progress.history.some((day) => day.cumulative !== progress.history[0]?.cumulative);
  const outerRadius = 110;
  const outerLength = 2 * Math.PI * outerRadius;

  return (
    <section aria-labelledby="kiko-progress-title" className="min-w-0 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_-36px_rgba(16,40,63,0.32)]">
      <div className="grid lg:grid-cols-[21rem_minmax(0,1fr)]">
        <div className="relative overflow-hidden bg-[#123047] p-5 text-white sm:p-6">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border-[32px] border-white/[0.035]" />
          <div className="relative flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">Suivi de commande</span>
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em]">KIKO · Assemblage</span>
          </div>
          <h2 id="kiko-progress-title" className="relative mt-3 text-xl font-bold tracking-tight">Chaque jour compte.</h2>
          <div className="relative mt-2 flex flex-col items-center justify-center gap-3 min-[400px]:flex-row">
            <div
              role="progressbar"
              aria-label="Quantité conforme cumulée KIKO Assemblage sur l’objectif total"
              aria-valuemin={0}
              aria-valuemax={KIKO_PRODUCTION_PLAN.total}
              aria-valuenow={Math.min(KIKO_PRODUCTION_PLAN.total, Math.max(0, progress.cumulative))}
              aria-valuetext={`${number(progress.cumulative)} pièces sur ${number(KIKO_PRODUCTION_PLAN.total)}, ${percent(progress.totalProgress)}`}
              className="relative h-40 w-40 shrink-0"
            >
              <svg viewBox="0 0 256 256" className="h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="128" cy="128" r={outerRadius} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="10" />
                <circle cx="128" cy="128" r={outerRadius} fill="none" stroke="#ffac7d" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={outerLength} strokeDashoffset={outerLength * (1 - clamp(progress.totalProgress))}
                  className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none" />
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[2.15rem] font-bold tracking-[-0.05em] tabular-nums">{percent(progress.totalProgress)}</span>
                <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/50">de la commande</span>
              </div>
            </div>
            <div className="min-w-0 text-center min-[400px]:border-l min-[400px]:border-white/15 min-[400px]:pl-4 min-[400px]:text-left">
              <p className="text-2xl font-bold tracking-tight tabular-nums">{number(progress.cumulative)}</p>
              <p className="mt-1 text-[11px] leading-4 text-white/60">pièces conformes</p>
              <div className="mt-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/40">Objectif total</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">{number(KIKO_PRODUCTION_PLAN.total)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Cumul depuis le {dateLabel(KIKO_PRODUCTION_PLAN.startDate)}</p>
              <p className="mt-1.5 text-lg font-bold tracking-tight text-slate-900">Situation au {dateLabel(selectedDate)}</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
              <CalendarDays className="h-3.5 w-3.5" />Échéance {dateLabel(KIKO_PRODUCTION_PLAN.deadline)}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-orange-100 bg-[#fff8f2] p-3.5">
              <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-orange-800"><Factory className="h-3.5 w-3.5 shrink-0" />Qté conforme / jour</p>
              <p className="mt-2 text-[1.75rem] font-bold leading-none tracking-tight text-slate-950 tabular-nums">+{number(progress.dailyQuantity)}</p>
              <p className="mt-1.5 text-[10px] text-slate-500">pièces conformes ce jour</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
              <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500"><Flag className="h-3.5 w-3.5 shrink-0" />Conforme restant</p>
              <p className="mt-2 text-[1.75rem] font-bold leading-none tracking-tight text-slate-950 tabular-nums">{number(progress.remainingTotal)}</p>
              <p className="mt-1.5 text-[10px] text-slate-500">sur la commande totale</p>
            </div>
            <div className="rounded-xl border p-3.5" style={{ borderColor: `${planStyle.color}30`, backgroundColor: `${planStyle.color}08` }}>
              <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em]" style={{ color: planStyle.color }}><TrendingUp className="h-3.5 w-3.5 shrink-0" />Réalisation du planifié</p>
              <p className="mt-2 text-[1.75rem] font-bold leading-none tracking-tight tabular-nums" style={{ color: planStyle.color }}>{attainment === null ? '—' : percent(attainment)}</p>
              <p className="mt-1.5 text-[10px] text-slate-500">{progress.workingDays} jours avec activité</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px]">
              <p className="font-bold text-slate-700">Palier de {number(KIKO_PRODUCTION_PLAN.milestone)} pièces</p>
              <p className="inline-flex items-center gap-1.5 text-slate-500">
                {progress.milestoneReachedOn ? <Check className="h-3.5 w-3.5 text-teal-600" /> : null}
                {progress.milestoneReachedOn
                  ? `Palier atteint le ${dateLabel(progress.milestoneReachedOn)}${progress.milestoneReachedOn > KIKO_PRODUCTION_PLAN.deadline ? ' · après l’échéance' : ''}`
                  : `${number(progress.remainingMilestone)} pièces restantes`}
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              <div className="h-full rounded-full bg-[#527b87] transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${clamp(progress.milestoneProgress) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-0 border-t border-slate-200/80 bg-[#fbfcfd] p-5 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-slate-800">Cumul conforme / planifié</h3>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ backgroundColor: planStyle.color }} />Conforme : {number(progress.cumulative)}</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-[#123047]" />Planifié : {number(progress.plannedCumulative)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border bg-white px-3 py-2" style={{ borderColor: `${planStyle.color}30`, color: planStyle.color }}>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${planStyle.color}0d` }}><StatusIcon className="h-4 w-4" /></div>
            <div>
              <p className="text-xs font-bold tabular-nums">Écart : {progress.variance > 0 ? '+' : ''}{number(progress.variance)} pièces</p>
              <p className="mt-0.5 text-[10px] opacity-80">{planStyle.label}</p>
            </div>
          </div>
        </div>

        {progress.hasClientData ? (
          <>
            <div className="mt-4 h-48 w-full min-w-0 sm:h-52" role="img" aria-label={`Cumul conforme : ${number(progress.cumulative)} pièces ; planifié : ${number(progress.plannedCumulative)} pièces sur ${progress.workingDays} jours travaillés. ${planStyle.label}.`}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 800, height: 208 }}>
                <LineChart data={progress.history} margin={{ top: 10, right: 18, bottom: 0, left: 0 }} accessibilityLayer>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                      {curveStops.map((stop, index) => <stop key={index} offset={`${stop.offset * 100}%`} stopColor={stop.color} />)}
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(value: string) => format(parseISO(value), 'dd/MM')} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickMargin={10} minTickGap={28} />
                  <YAxis tickFormatter={(value: number) => value >= 1000 ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1000)} k` : number(value)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={46} domain={[0, 'auto']} />
                  <Tooltip labelFormatter={(value) => dateLabel(String(value))} formatter={(value, name) => [`${number(Number(value))} pièces`, name]} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px -12px #12304740', fontSize: 12 }} />
                  <Line type="linear" dataKey="plannedCumulative" name="Cumul planifié" stroke="#123047" strokeOpacity={0.65} strokeWidth={2} strokeDasharray="6 5" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                  <Line type="linear" dataKey="cumulative" name="Cumul conforme" stroke={hasCurveHeight ? `url(#${gradientId})` : planStyle.color} strokeWidth={3}
                    dot={({ cx, cy, payload }) => <circle key={payload.date} cx={cx} cy={cy} r={3.5} fill="white" stroke={planStyles[getKikoPlanStatus(payload.cumulative, payload.plannedCumulative)].color} strokeWidth={2} />}
                    activeDot={({ cx, cy, payload }) => <circle cx={cx} cy={cy} r={6} fill={planStyles[getKikoPlanStatus(payload.cumulative, payload.plannedCumulative)].color} stroke="white" strokeWidth={2} />}
                    isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-[10px] text-slate-500">
              <p>{number(KIKO_PRODUCTION_PLAN.dailyTarget)} pièces × {progress.workingDays} jours avec activité KIKO Assemblage</p>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#15803d]" />Au-dessus</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#c2410c]" />Égal</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#dc2626]" />En dessous</span>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-4 flex min-h-36 items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-center text-sm text-slate-500">
            {selectedDate < KIKO_PRODUCTION_PLAN.startDate ? <>Début du suivi : {dateLabel(KIKO_PRODUCTION_PLAN.startDate)}.</> : <>Aucune donnée KIKO sur cette période.</>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-[10px] text-slate-500 sm:px-6">
        <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3 w-3" />{progress.isPastDeadline ? 'Échéance passée' : `${progress.daysUntilDeadline} jours avant l’échéance`}</span>
        {progress.totalReachedOn && <span className="font-semibold text-emerald-700">Objectif total atteint le {dateLabel(progress.totalReachedOn)}{progress.totalReachedOn > KIKO_PRODUCTION_PLAN.deadline ? ' · hors délai' : ''}</span>}
        {progress.isPastDeadline && <span>Quantité conforme au {dateLabel(KIKO_PRODUCTION_PLAN.deadline)} : <strong>{number(progress.producedByDeadline)} pièces</strong>.</span>}
      </div>
    </section>
  );
}
