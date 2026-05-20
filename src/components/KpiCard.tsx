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
  const textColor = color === 'red' ? 'text-red-600' : color === 'green' ? 'text-green-600' : color === 'orange' ? 'text-orange-500' : 'text-gray-900';
  
  return (
    <div className="bg-white border-l-4 border-red-600 rounded-lg shadow p-5 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <h3 className={`text-2xl font-bold ${textColor}`}>{value}</h3>
          {trend && (
            <p className={`text-xs mt-2 font-medium ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
              {trendUp ? '↑' : '↓'} {trend}
            </p>
          )}
        </div>
        <div className="p-3 bg-red-50 rounded-full">
          <Icon className="w-5 h-5 text-red-600" />
        </div>
      </div>
    </div>
  );
};
