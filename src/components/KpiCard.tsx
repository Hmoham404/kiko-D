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
      border: 'border-l-4 border-red-500 hover:border-red-600',
      iconBg: 'bg-red-50 text-red-600 border border-red-100 shadow-sm shadow-red-50',
      textValue: 'text-red-600',
      glow: 'hover:shadow-red-500/10'
    },
    green: {
      border: 'border-l-4 border-emerald-500 hover:border-emerald-600',
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm shadow-emerald-50',
      textValue: 'text-emerald-600',
      glow: 'hover:shadow-emerald-500/10'
    },
    orange: {
      border: 'border-l-4 border-amber-500 hover:border-amber-600',
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-100 shadow-sm shadow-amber-50',
      textValue: 'text-amber-600',
      glow: 'hover:shadow-amber-500/10'
    },
    gray: {
      border: 'border-l-4 border-slate-600 hover:border-slate-700',
      iconBg: 'bg-slate-50 text-slate-600 border border-slate-200/80 shadow-sm shadow-slate-100',
      textValue: 'text-slate-800',
      glow: 'hover:shadow-slate-500/10'
    }
  };

  const currentTheme = themes[color] || themes.red;

  return (
    <div className={`bg-white/95 backdrop-blur-md rounded-2xl shadow-md p-6 ${currentTheme.border} ${currentTheme.glow} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">{title}</p>
          <h3 className={`text-2xl font-black tracking-tight ${currentTheme.textValue} font-mono`}>{value}</h3>
          {trend && (
            <div className={`flex items-center space-x-1 mt-2.5 text-xs font-bold ${trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
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
