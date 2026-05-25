'use client';
import React, { useState, useMemo } from 'react';
import { Target, TrendingUp, AlertTriangle, Crosshair, Award, AlertCircle, FileSpreadsheet, Trash2, List, Calendar, LayoutGrid, Activity } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { ImportModal } from '@/components/ImportModal';
import { KpiCard } from '@/components/KpiCard';
import { PerformanceTable } from '@/components/PerformanceTable';
import { DailyTrackingSheet } from '@/components/DailyTrackingSheet';
import { SubComponentsTable } from '@/components/SubComponentsTable';
import { DashboardCharts } from '@/components/Charts';
import { InjectionDayView } from '@/components/InjectionDayView';
import { GlobalDailyView } from '@/components/GlobalDailyView';
import { WeeklyTargetsModal } from '@/components/WeeklyTargetsModal';
import { buildWeeklyTargetOverrideKey, sumWeeklyTargets } from '@/lib/weeklyMetrics';

type TabType = 'daily' | 'summary' | 'subcomponents' | 'injection-day' | 'report-day';

export default function DashboardPage() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTargetsModalOpen, setIsTargetsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const { productionData, subComponentsData, warnings, weeklyTargets, clearData } = useStore();

  const [showWarnings, setShowWarnings] = useState(true);
  // Calculate Global KPIs
  const kpis = useMemo(() => {
    if (!productionData || productionData.length === 0) return null;

    let totalActual = 0;
    let totalConform = 0;
    let totalScrap = 0;
    
    const deptStats: Record<string, { target: number, actual: number, conform: number, scrap: number }> = {};
    const totalTarget = sumWeeklyTargets(
      productionData,
      (item) => item.department,
      (item) => weeklyTargets[buildWeeklyTargetOverrideKey('department', item.department, item.weekKey)] ?? item.weeklyTarget
    );

    productionData.forEach(d => {
      totalActual += d.actualProduction;
      totalConform += d.conformQty;
      totalScrap += d.scrapQty;

      if (!deptStats[d.department]) {
        deptStats[d.department] = { target: 0, actual: 0, conform: 0, scrap: 0 };
      }
      deptStats[d.department].actual += d.actualProduction;
      deptStats[d.department].conform += d.conformQty;
      deptStats[d.department].scrap += d.scrapQty;
    });

    Object.entries(deptStats).forEach(([department]) => {
      deptStats[department].target = sumWeeklyTargets(
        productionData.filter((item) => item.department === department),
        (item) => item.department,
        (item) => weeklyTargets[buildWeeklyTargetOverrideKey('department', item.department, item.weekKey)] ?? item.weeklyTarget
      );
    });

    const globalGap = totalTarget - totalConform;
    const globalProgress = totalTarget > 0 ? totalConform / totalTarget : 0;
    const globalScrapRate = totalActual > 0 ? totalScrap / totalActual : 0;

    let bestDept = '';
    let highestProgress = -1;
    let criticalDept = '';
    let highestScrap = -1;

    Object.entries(deptStats).forEach(([dept, stats]) => {
      const progress = stats.target > 0 ? stats.conform / stats.target : 0;
      const scrapRate = stats.actual > 0 ? stats.scrap / stats.actual : 0;
      
      if (progress > highestProgress || (progress === highestProgress && scrapRate < (deptStats[bestDept]?.scrap / deptStats[bestDept]?.actual || Infinity))) {
        highestProgress = progress;
        bestDept = dept;
      }
      
      if (scrapRate > highestScrap) {
        highestScrap = scrapRate;
        criticalDept = dept;
      }
    });

    return {
      totalTarget,
      totalActual,
      totalConform,
      globalGap,
      globalProgress,
      totalScrap,
      globalScrapRate,
      bestDept,
      criticalDept
    };
  }, [productionData, weeklyTargets]);

  const [mounted, setMounted] = React.useState(() => useStore.persist.hasHydrated());
  React.useEffect(() => {
    return useStore.persist.onFinishHydration(() => {
      setMounted(true);
    });
  }, []);

  const formatNumber = (num: number) => new Intl.NumberFormat('fr-FR').format(num);
  const formatPercent = (num: number) => `${(num * 100).toFixed(2)}%`;

  if (!mounted) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed relative"
        style={{ backgroundImage: 'url("/BACK VIEW (1).png")' }}
      >
        <div className="absolute inset-0 bg-[#f8f9fa]/90 backdrop-blur-[1px] z-0"></div>
        <div className="relative z-10 flex flex-col min-h-screen items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed relative"
      style={{ backgroundImage: 'url("/BACK VIEW (1).png")' }}
    >
      {/* Soft light overlay to blend background image and ensure readability */}
      <div className="absolute inset-0 bg-[#f8f9fa]/90 backdrop-blur-[1px] z-0"></div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-white/85 backdrop-blur-md border-b-2 border-red-600 sticky top-0 z-50 shadow-sm">
          <div className="max-w-[96rem] mx-auto px-3 sm:px-5 lg:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 bg-gray-50 p-2 rounded-lg border border-gray-100 shadow-sm">

              <div className="h-6 w-px bg-gray-300"></div>
              <img src="/logo myc.jpg" alt="MYC Beauty" className="h-8 object-contain rounded" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 leading-tight">MYC Performance</h1>
              <p className="text-sm text-gray-500 font-medium tracking-wide uppercase">MYC Dashboard</p>
            </div>
          </div>
          <div className="flex gap-3">
            {productionData.length > 0 && (
              <button 
                onClick={() => setIsTargetsModalOpen(true)}
                className="flex items-center px-4 py-2 bg-white text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-sm text-base font-medium"
              >
                <Target className="w-4 h-4 mr-2" />
                Targets Hebdo
              </button>
            )}
            {productionData.length > 0 && (
              <button 
                onClick={clearData}
                className="flex items-center px-4 py-2 bg-white text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-sm text-base font-medium"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Effacer
              </button>
            )}
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-sm text-base font-medium"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Importer Daily Prod
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[96rem] mx-auto px-3 sm:px-5 lg:px-6 py-8 flex-grow">

        {!productionData || productionData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 bg-red-50 rounded-full mb-6">
              <FileSpreadsheet className="w-16 h-16 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Aucune donnée de production</h2>
            <p className="text-gray-500 mb-8 max-w-md text-center">
              Commencez par importer les fichiers Excel Daily Prod pour chaque département afin de visualiser les performances.
            </p>
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-md hover:shadow-lg flex items-center"
            >
              <FileSpreadsheet className="w-5 h-5 mr-2" />
              Importer des données
            </button>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Warning Banner */}
          {showWarnings && warnings.length > 0 && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-md shadow-sm animate-in slide-in-from-top duration-300">
              <div className="flex items-start justify-between">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-bold text-amber-800">
                      Alertes qualité / Alertes de cohérence des données ({warnings.length})
                    </h3>
                    <div className="mt-2 text-xs text-amber-700 space-y-1">
                      <ul className="list-disc pl-5 space-y-1">
                        {warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowWarnings(false)}
                  className="ml-2 text-amber-600 hover:text-amber-800"
                >
                  Hide
                </button>
              </div>
            </div>
          )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KpiCard 
                title="Weekly Objective" 
                value={formatNumber(kpis?.totalTarget || 0)} 
                icon={Target} 
                color="gray"
              />
              <KpiCard 
                title="Actual Production" 
                value={formatNumber(kpis?.totalActual || 0)} 
                icon={TrendingUp} 
                color={(kpis?.totalConform ?? 0) >= (kpis?.totalTarget ?? 0) ? 'green' : 'red'}
              />
              <KpiCard 
                title="Weekly Gap" 
                value={(kpis?.globalGap || 0) > 0 ? `+${formatNumber(kpis?.globalGap || 0)}` : formatNumber(kpis?.globalGap || 0)} 
                icon={Crosshair} 
                color={(kpis?.globalGap || 0) <= 0 ? 'green' : 'red'}
              />
              <KpiCard 
                title="Weekly Progress" 
                value={formatPercent(kpis?.globalProgress || 0)} 
                icon={Target} 
                color={(kpis?.globalProgress || 0) >= 1 ? 'green' : (kpis?.globalProgress || 0) >= 0.8 ? 'orange' : 'red'}
              />
              
              <KpiCard 
                title="Total Scrap" 
                value={formatNumber(kpis?.totalScrap || 0)} 
                icon={AlertTriangle} 
                color="red"
              />
              <KpiCard 
                title="Scrap Rate" 
                value={formatPercent(kpis?.globalScrapRate || 0)} 
                icon={AlertCircle} 
                color={(kpis?.globalScrapRate || 0) > 0.05 ? 'red' : 'green'}
              />
              <KpiCard 
                title="Best Department" 
                value={kpis?.bestDept || '-'} 
                icon={Award} 
                color="green"
              />
              <KpiCard 
                title="Critical Department" 
                value={kpis?.criticalDept || '-'} 
                icon={AlertTriangle} 
                color="red"
              />
            </div>

            {/* Navigation Tabs for Tables */}
            <div className="border-b border-gray-200">
              <div className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('report-day')}
                  className={`py-4 px-2 border-b-2 font-bold text-base flex items-center transition-colors ${
                    activeTab === 'report-day'
                      ? 'border-red-600 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Rapport Journalier Premium
                </button>

                <button
                  onClick={() => setActiveTab('daily')}
                  className={`py-4 px-2 border-b-2 font-bold text-base flex items-center transition-colors ${
                    activeTab === 'daily'
                      ? 'border-red-600 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Tableau Journalier Global
                </button>
                
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`py-4 px-2 border-b-2 font-bold text-base flex items-center transition-colors ${
                    activeTab === 'summary'
                      ? 'border-red-600 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <List className="w-4 h-4 mr-2" />
                  Synthèse Totale Dept
                </button>

                <button
                  onClick={() => setActiveTab('subcomponents')}
                  className={`py-4 px-2 border-b-2 font-bold text-base flex items-center transition-colors ${
                    activeTab === 'subcomponents'
                      ? 'border-red-600 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4 mr-2" />
                  Détail Injection
                </button>
              </div>
            </div>

            {/* Performance Tables Render */}
            <div className="animate-in fade-in duration-300">
              {activeTab === 'report-day' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                    <span className="w-2 h-6 bg-red-600 rounded-sm mr-2"></span>
                    Daily Performance Overview — All Departments
                  </h2>
                  <GlobalDailyView data={productionData} subComponentsData={subComponentsData} />
                </div>
              )}

              {activeTab === 'daily' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                    <span className="w-2 h-6 bg-red-600 rounded-sm mr-2"></span>
                    Daily Tracking Sheet
                  </h2>
                  <DailyTrackingSheet data={productionData} subComponentsData={subComponentsData} />
                </div>
              )}

              {activeTab === 'summary' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                    <span className="w-2 h-6 bg-red-600 rounded-sm mr-2"></span>
                    Department Performance Summary
                  </h2>
                  <PerformanceTable data={productionData} subComponentsData={subComponentsData} />
                </div>
              )}

              {activeTab === 'subcomponents' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                    <span className="w-2 h-6 bg-red-600 rounded-sm mr-2"></span>
                    Injection Sub-Components Breakdown
                  </h2>
                  <SubComponentsTable data={subComponentsData} />
                </div>
              )}

              {activeTab === 'injection-day' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                    <span className="w-2 h-6 bg-purple-600 rounded-sm mr-2"></span>
                    Injection — Vue par Jour (Base, Cover, Insert)
                  </h2>
                  <InjectionDayView data={subComponentsData} />
                </div>
              )}
            </div>

            {/* Charts */}
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                <span className="w-2 h-6 bg-red-600 rounded-sm mr-2"></span>
                Performance Analytics
              </h2>
              <DashboardCharts data={productionData} />
            </div>
          </div>
        )}
      </main>

      <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
      <WeeklyTargetsModal isOpen={isTargetsModalOpen} onClose={() => setIsTargetsModalOpen(false)} />
      </div>
    </div>
  );
}
