import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  color?: 'red' | 'gray' | 'green' | 'orange';
}

export const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon: Icon, trend, trendUp, color = 'red' }) => {
  // Premium Theme Config mapping
  const themes = {
    red: {
      border: 'border-l-4 border-[var(--dashboard-danger)] hover:border-[var(--dashboard-danger-strong)]',
      iconBg: 'border border-[color-mix(in_srgb,var(--dashboard-danger)_18%,white)] bg-[color-mix(in_srgb,var(--dashboard-danger)_10%,white)] text-[var(--dashboard-danger)] shadow-sm',
      textValue: 'text-[var(--dashboard-danger)]',
      glow: 'hover:ring-1 hover:ring-[color-mix(in_srgb,var(--dashboard-danger)_18%,white)]'
    },
    green: {
      border: 'border-l-4 border-[var(--dashboard-success)] hover:border-[color-mix(in_srgb,var(--dashboard-success)_84%,black)]',
      iconBg: 'border border-[color-mix(in_srgb,var(--dashboard-success)_18%,white)] bg-[color-mix(in_srgb,var(--dashboard-success)_10%,white)] text-[var(--dashboard-success)] shadow-sm',
      textValue: 'text-[var(--dashboard-success)]',
      glow: 'hover:ring-1 hover:ring-[color-mix(in_srgb,var(--dashboard-success)_18%,white)]'
    },
    orange: {
      border: 'border-l-4 border-[var(--dashboard-warning)] hover:border-[color-mix(in_srgb,var(--dashboard-warning)_84%,black)]',
      iconBg: 'border border-[color-mix(in_srgb,var(--dashboard-warning)_24%,white)] bg-[color-mix(in_srgb,var(--dashboard-warning)_14%,white)] text-[color-mix(in_srgb,var(--dashboard-warning)_78%,black)] shadow-sm',
      textValue: 'text-[color-mix(in_srgb,var(--dashboard-warning)_78%,black)]',
      glow: 'hover:ring-1 hover:ring-[color-mix(in_srgb,var(--dashboard-warning)_22%,white)]'
    },
    gray: {
      border: 'border-l-4 border-[var(--dashboard-secondary)] hover:border-[var(--dashboard-primary)]',
      iconBg: 'border border-[var(--dashboard-neutral)] bg-[var(--dashboard-surface-muted)] text-[var(--dashboard-secondary)] shadow-sm shadow-slate-100',
      textValue: 'text-[var(--dashboard-primary)]',
      glow: 'hover:ring-1 hover:ring-[color-mix(in_srgb,var(--dashboard-secondary)_16%,white)]'
    }
  };

  const currentTheme = themes[color] || themes.red;

  return (
    <div className={`rounded-2xl bg-white/95 p-6 shadow-md backdrop-blur-md ${currentTheme.border} ${currentTheme.glow} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">{title}</p>
          <h3 className={`text-2xl font-black tracking-tight ${currentTheme.textValue} font-mono`}>{value}</h3>
          {trend && (
            <div className={`mt-2.5 flex items-center space-x-1 text-xs font-bold ${trendUp ? 'text-[var(--dashboard-success)]' : 'text-[var(--dashboard-danger)]'}`}>
              <span className="text-sm">{trendUp ? '↑' : '↓'}</span>
              <span>{trend}</span>
            </div>
          )}
        </div>
        
        <div className={`p-3.5 rounded-xl transition-all duration-300 ${currentTheme.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
