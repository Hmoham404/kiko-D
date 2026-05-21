'use client';
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, ComposedChart
} from 'recharts';
import { ProductionData, useStore } from '@/store/useStore';

interface ChartsProps {
  data: ProductionData[];
}

const COLORS = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fee2e2', '#7f1d1d'];

const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  const value = payload.progress;
  let color = '#dc2626'; // Red (< 80%)
  if (value >= 100) {
    color = '#16a34a'; // Green (>= 100%)
  } else if (value >= 80) {
    color = '#f97316'; // Orange (80% - 100%)
  }
  return (
    <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="#fff" strokeWidth={1.5} />
  );
};

const CustomActiveDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  const value = payload.progress;
  let color = '#dc2626'; // Red
  if (value >= 100) {
    color = '#16a34a'; // Green
  } else if (value >= 80) {
    color = '#f97316'; // Orange
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={color} opacity={0.3} />
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={1.5} />
    </g>
  );
};

const SCRAP_COLORS = ['#0ea5e9', '#06b6d4', '#0891b2', '#0284c7', '#0369a1', '#075985', '#0c4a6e'];

export const DashboardCharts: React.FC<ChartsProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  const [selectedDept, setSelectedDept] = React.useState<string>('Global');

  // Extract unique list of departments for the filter dropdown
  const departmentsList = React.useMemo(() => {
    const depts = Array.from(new Set(data.map(d => d.department))).filter(Boolean);
    return ['Global', ...depts];
  }, [data]);

  // Aggregate by department for general charts
  const deptData = data.reduce((acc, curr) => {
    if (!acc[curr.department]) {
      acc[curr.department] = { name: curr.department, target: 0, actual: 0, scrap: 0, conform: 0 };
    }
    acc[curr.department].target += curr.target;
    acc[curr.department].actual += curr.actualProduction;
    acc[curr.department].scrap += curr.scrapQty;
    acc[curr.department].conform += curr.conformQty;
    return acc;
  }, {} as Record<string, any>);

  const barChartData = Object.values(deptData);

  // Filter trend data based on selected department
  const filteredTrendData = React.useMemo(() => {
    if (selectedDept === 'Global') {
      return data;
    }
    return data.filter(d => d.department === selectedDept);
  }, [data, selectedDept]);

  // Aggregate by day for trend based on the filtered data using conformQty and scrap
  const dayDataMap = filteredTrendData.reduce((acc, curr) => {
    const key = curr.date; // use date as key
    if (!acc[key]) {
      acc[key] = { date: key, target: 0, conform: 0, scrap: 0 };
    }
    acc[key].target += curr.target;
    acc[key].conform += curr.conformQty;
    acc[key].scrap += curr.scrapQty;
    return acc;
  }, {} as Record<string, any>);

  const lineChartData = Object.values(dayDataMap)
    .map((d: any) => ({
      ...d,
      progress: d.target > 0 ? (d.conform / d.target) * 100 : 0,
    }))
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  // Daily scrap percentage data for department chart
  const dailyScrapData = Object.values(dayDataMap)
    .map((d: any) => ({
      date: d.date,
      scrapPercent: d.target > 0 ? (d.scrap / d.target) * 100 : 0,
    }))
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  // Calculate total scrap and scrap contribution pie data
  const totalScrapQty = barChartData.reduce((sum, d) => sum + d.scrap, 0);
  const scrapPieData = React.useMemo(() => {
    return barChartData
      .filter(d => d.scrap > 0)
      .map(d => ({
        name: d.name,
        value: d.scrap,
        percentage: totalScrapQty > 0 ? (d.scrap / totalScrapQty) * 100 : 0
      }));
  }, [barChartData, totalScrapQty]);

  const formatNumber = (value: number) => new Intl.NumberFormat('fr-FR').format(value);
  const scrapPercData = barChartData.map(d => ({
    name: d.name,
    percentage: d.actual > 0 ? (d.scrap / d.actual) * 100 : 0,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Target vs Actual */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <span className="w-2 h-6 bg-slate-700 rounded-sm mr-2"></span>
          Target vs Actual Production
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(val) => `${val / 1000}k`} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <RechartsTooltip cursor={{ fill: '#f8fafc' }} formatter={(value: any) => formatNumber(Number(value))} />
              <Legend iconType="circle" />
              <Bar dataKey="target" name="Target" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={50} />
              <Bar dataKey="actual" name="Actual Prod." fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Progress Trend with filter dropdown */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2 border-b border-gray-50 pb-2">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <span className="w-2 h-6 bg-slate-700 rounded-sm mr-2"></span>
              Conform Qty Progress % per Day
            </h3>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500 font-semibold uppercase">Filtre:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-200 rounded-md py-1 px-2.5 focus:outline-none focus:ring-1 focus:ring-red-500 font-medium text-gray-700 cursor-pointer shadow-sm hover:bg-gray-100 transition-colors"
            >
              {departmentsList.map(dept => (
                <option key={dept} value={dept}>
                  {dept === 'Global' ? 'Global Performance' : dept}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={1} />
                  <stop offset="40%" stopColor="#f97316" stopOpacity={1} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(val) => `${val}%`} domain={[0, 'auto']} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <RechartsTooltip formatter={(value: any) => `${Number(value).toFixed(1)}%`} cursor={{ stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '3 3' }} />
              <Legend iconType="circle" />
              <Line 
                type="monotone" 
                dataKey="progress" 
                name="Progress %" 
                stroke="url(#colorProgress)" 
                strokeWidth={3} 
                dot={<CustomDot />} 
                activeDot={<CustomActiveDot />} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200/80 shadow-md bg-white/90 backdrop-blur-md p-4 transition-all duration-300 hover:shadow-lg">
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-2 h-4 bg-indigo-600 rounded-full animate-pulse"></div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Détails Suivi Journalier (Conform Qty / Target)</h4>
          </div>
          <table className="min-w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-900 text-slate-200 font-extrabold uppercase">
                <th className="px-4 py-2.5 rounded-l-lg tracking-wider text-[10px]">Date</th>
                <th className="px-4 py-2.5 tracking-wider text-[10px]">Conform / Target</th>
                <th className="px-4 py-2.5 rounded-r-lg text-right tracking-wider text-[10px]">% Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lineChartData.map((d, index) => {
                let progressBg = 'bg-red-50 text-red-700 border-red-100';
                if (d.progress >= 100) progressBg = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                else if (d.progress >= 80) progressBg = 'bg-amber-50 text-amber-700 border-amber-100';
                return (
                  <tr key={d.date} className={`transition-colors duration-150 ${index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-50'}`}>
                    <td className="px-4 py-2.5 font-bold text-slate-800">{d.date}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-600 font-mono">{formatNumber(d.conform)} / {formatNumber(d.target)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md border font-extrabold text-[11px] ${progressBg} shadow-sm`}>
                        {d.progress.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>


      {/* Daily Scrap Percentage */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <span className="w-2 h-6 bg-slate-700 rounded-sm mr-2"></span>
          Daily Scrap Percentage %
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyScrapData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(val) => `${val}%`} domain={[0, 'auto']} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <RechartsTooltip formatter={(value: any) => `${Number(value).toFixed(1)}%`} />
              <Legend iconType="circle" />
              <Line type="monotone" dataKey="scrapPercent" name="Scrap %" stroke="#f97316" strokeWidth={3} dot={{}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scrap per Department */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <span className="w-2 h-6 bg-slate-700 rounded-sm mr-2"></span>
          Scrap Percentage per Department
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scrapPercData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val.toFixed(1)}%`} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <RechartsTooltip cursor={{ fill: '#f8fafc' }} formatter={(value: any) => `${Number(value).toFixed(1)}%`} />
              <Legend iconType="circle" />
              <Bar dataKey="percentage" name="Scrap %" fill="#f97316" radius={[0, 4, 4, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scrap Contribution Pie */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <span className="w-2 h-6 bg-slate-700 rounded-sm mr-2"></span>
          Scrap Contribution % by Department
        </h3>
        <div className="h-80 flex justify-center items-center">
          {totalScrapQty === 0 ? (
            <div className="text-sm text-gray-500 font-medium">Aucun scrap enregistré</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={scrapPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {scrapPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={SCRAP_COLORS[index % SCRAP_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: any) => [`${formatNumber(Number(value))} pcs`, 'Scrap Qty']} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
