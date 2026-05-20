'use client';
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, ComposedChart
} from 'recharts';
import { ProductionData } from '@/store/useStore';

interface ChartsProps {
  data: ProductionData[];
}

const COLORS = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fee2e2', '#7f1d1d'];

export const DashboardCharts: React.FC<ChartsProps> = ({ data }) => {
  if (!data || data.length === 0) return null;

  // Aggregate by department
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

  // Aggregate by week for trend
  const weekDataMap = data.reduce((acc, curr) => {
    const key = curr.week || curr.date;
    if (!acc[key]) {
      acc[key] = { week: key, target: 0, actual: 0 };
    }
    acc[key].target += curr.target;
    acc[key].actual += curr.actualProduction;
    return acc;
  }, {} as Record<string, any>);
  
  const lineChartData = Object.values(weekDataMap).map((d: any) => ({
    ...d,
    progress: d.target > 0 ? (d.actual / d.target) * 100 : 0
  })).sort((a: any, b: any) => a.week.localeCompare(b.week));

  const formatNumber = (value: number) => new Intl.NumberFormat('fr-FR').format(value);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Target vs Actual */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <span className="w-2 h-6 bg-red-600 rounded-sm mr-2"></span>
          Target vs Actual Production
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(val) => `${val / 1000}k`} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <RechartsTooltip cursor={{ fill: '#fef2f2' }} formatter={(value: any) => formatNumber(Number(value))} />
              <Legend iconType="circle" />
              <Bar dataKey="target" name="Target" fill="#fca5a5" radius={[4, 4, 0, 0]} maxBarSize={50} />
              <Bar dataKey="actual" name="Actual Prod." fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Progress Trend */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <span className="w-2 h-6 bg-red-600 rounded-sm mr-2"></span>
          Progress % per Week/Date
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(val) => `${val}%`} domain={[0, 'auto']} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <RechartsTooltip formatter={(value: any) => `${Number(value).toFixed(1)}%`} cursor={{ stroke: '#fca5a5', strokeWidth: 2, strokeDasharray: '3 3' }} />
              <Legend iconType="circle" />
              <Line type="monotone" dataKey="progress" name="Progress %" stroke="#dc2626" strokeWidth={3} dot={{ r: 4, fill: '#dc2626', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scrap per Department */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <span className="w-2 h-6 bg-red-600 rounded-sm mr-2"></span>
          Scrap Quantity per Department
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <RechartsTooltip cursor={{ fill: '#fef2f2' }} formatter={(value: any) => formatNumber(Number(value))} />
              <Legend iconType="circle" />
              <Bar dataKey="scrap" name="Scrap Qty" fill="#991b1b" radius={[0, 4, 4, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Contribution Pie */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <span className="w-2 h-6 bg-red-600 rounded-sm mr-2"></span>
          Production Contribution
        </h3>
        <div className="h-80 flex justify-center items-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={barChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="actual"
                nameKey="name"
                label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                labelLine={false}
              >
                {barChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value: any) => formatNumber(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
