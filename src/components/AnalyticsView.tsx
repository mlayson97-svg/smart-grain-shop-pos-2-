/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Transaction, Product, Category } from '../types';
import { translations } from '../translations';
import { formatTSh } from '../mockData';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, TrendingUp, DollarSign, PackageCheck, AlertCircle, ShoppingBag } from 'lucide-react';

interface AnalyticsViewProps {
  currentLanguage: Language;
  transactions: Transaction[];
  products: Product[];
  categories: Category[];
}

type Language = 'en' | 'sw';

export default function AnalyticsView({
  currentLanguage,
  transactions,
  products,
  categories,
}: AnalyticsViewProps) {
  const t = translations[currentLanguage];

  const completedSales = useMemo(() => {
    return transactions.filter((tx) => tx.status === 'completed');
  }, [transactions]);

  // Tab selections
  const [trendRange, setTrendRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // 1. Programmatic 14-Day Sales & Profit Trends
  const dailyTrendData = useMemo(() => {
    const dataMap: { [date: string]: { dateStr: string; Revenue: number; Profit: number } } = {};
    const now = new Date();

    // Init last 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString(currentLanguage === 'sw' ? 'sw-TZ' : 'en-US', {
        month: 'short',
        day: 'numeric',
      });
      dataMap[dateStr] = { dateStr: label, Revenue: 0, Profit: 0 };
    }

    // Populate
    completedSales.forEach((tx) => {
      const dateStr = tx.date.split('T')[0];
      if (dataMap[dateStr]) {
        dataMap[dateStr].Revenue += tx.total;
        
        // Calculate COGS
        let cost = 0;
        tx.items.forEach((item) => {
          cost += item.quantity * item.unitMultiplier * item.purchasePriceAtSale;
        });
        
        dataMap[dateStr].Profit += (tx.subtotal - tx.discount - cost);
      }
    });

    return Object.values(dataMap);
  }, [completedSales, currentLanguage]);

  // 2. Weekly Trend (Last 8 Weeks)
  const weeklyTrendData = useMemo(() => {
    const weeks: { weekLabel: string; Revenue: number; Profit: number }[] = [];
    const now = new Date();

    for (let w = 7; w >= 0; w--) {
      const start = new Date(now.getTime() - (w + 1) * 7 * 24 * 60 * 60 * 1000);
      const end = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      const label = `W-${w}`;

      let rev = 0;
      let profit = 0;

      completedSales.forEach((tx) => {
        const txDate = new Date(tx.date);
        if (txDate >= start && txDate <= end) {
          rev += tx.total;
          let cost = 0;
          tx.items.forEach((itm) => {
            cost += itm.quantity * itm.unitMultiplier * itm.purchasePriceAtSale;
          });
          profit += (tx.subtotal - tx.discount - cost);
        }
      });

      weeks.push({
        weekLabel: currentLanguage === 'sw' ? `Wiki -${w}` : `Week -${w}`,
        Revenue: rev,
        Profit: profit,
      });
    }
    return weeks;
  }, [completedSales, currentLanguage]);

  // 3. Monthly Trend (Last 6 Months)
  const monthlyTrendData = useMemo(() => {
    const dataMap: { [month: string]: { monthLabel: string; Revenue: number; Profit: number; index: number } } = {};
    const now = new Date();

    // Init past 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString(currentLanguage === 'sw' ? 'sw-TZ' : 'en-US', {
        month: 'long',
      });
      dataMap[key] = { monthLabel: label, Revenue: 0, Profit: 0, index: i };
    }

    completedSales.forEach((tx) => {
      const txDate = new Date(tx.date);
      const key = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
      if (dataMap[key]) {
        dataMap[key].Revenue += tx.total;
        let cost = 0;
        tx.items.forEach((itm) => {
          cost += itm.quantity * itm.unitMultiplier * itm.purchasePriceAtSale;
        });
        dataMap[key].Profit += (tx.subtotal - tx.discount - cost);
      }
    });

    return Object.values(dataMap).sort((a, b) => b.index - a.index);
  }, [completedSales, currentLanguage]);

  // 4. Product Sales distribution (Top 5 Products)
  const topProductsData = useMemo(() => {
    const stats: { [id: string]: { name: string; Sales: number } } = {};

    completedSales.forEach((tx) => {
      tx.items.forEach((itm) => {
        const name = currentLanguage === 'sw' ? itm.productNameSw : itm.productNameEn;
        if (!stats[itm.productId]) {
          stats[itm.productId] = { name, Sales: 0 };
        }
        stats[itm.productId].Sales += itm.totalPrice;
      });
    });

    return Object.values(stats)
      .sort((a, b) => b.Sales - a.Sales)
      .slice(0, 5);
  }, [completedSales, currentLanguage]);

  // 5. Least Selling Products (Bottom 5 Products in transaction list)
  const slowProductsData = useMemo(() => {
    const stats: { [id: string]: { name: string; Sales: number } } = {};

    // First populate all catalog products with 0
    products.forEach((p) => {
      stats[p.id] = {
        name: currentLanguage === 'sw' ? p.nameSw : p.nameEn,
        Sales: 0,
      };
    });

    completedSales.forEach((tx) => {
      tx.items.forEach((itm) => {
        if (stats[itm.productId]) {
          stats[itm.productId].Sales += itm.totalPrice;
        }
      });
    });

    return Object.values(stats)
      .sort((a, b) => a.Sales - b.Sales)
      .slice(0, 5);
  }, [products, completedSales, currentLanguage]);

  // 6. Sales by Category
  const categoryChartData = useMemo(() => {
    const stats: { [id: string]: { name: string; value: number } } = {};

    completedSales.forEach((tx) => {
      tx.items.forEach((itm) => {
        // Find category of product
        const prod = products.find((p) => p.id === itm.productId);
        const catId = prod ? prod.categoryId : 'other';
        const cat = categories.find((c) => c.id === catId);
        const name = cat
          ? currentLanguage === 'sw'
            ? cat.nameSw
            : cat.nameEn
          : 'Other Retail';

        if (!stats[catId]) {
          stats[catId] = { name, value: 0 };
        }
        stats[catId].value += itm.totalPrice;
      });
    });

    return Object.values(stats);
  }, [completedSales, products, categories, currentLanguage]);

  const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6'];

  // Total summary states
  const totals = useMemo(() => {
    let sales = 0;
    let profit = 0;
    let bagsCount = 0;

    completedSales.forEach((tx) => {
      sales += tx.total;
      
      let cost = 0;
      tx.items.forEach((itm) => {
        cost += itm.quantity * itm.unitMultiplier * itm.purchasePriceAtSale;
        if (itm.selectedUnit === 'sack') {
          bagsCount += itm.quantity;
        }
      });

      profit += (tx.subtotal - tx.discount - cost);
    });

    return {
      sales,
      profit,
      bagsCount,
      txCount: completedSales.length,
    };
  }, [completedSales]);

  // Custom Formatter for TSh
  const renderTooltipValue = (value: number) => {
    return [formatTSh(value), ''];
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6 font-sans">
      
      {/* HIGHLIGHT BANNER CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="bg-amber-100 p-2.5 rounded-xl text-amber-600">
            <TrendingUp className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Sales Value</p>
            <h4 className="text-sm font-mono font-bold text-slate-900 mt-0.5">{formatTSh(totals.sales)}</h4>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-600">
            <DollarSign className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Business Profit</p>
            <h4 className="text-sm font-mono font-bold text-slate-900 mt-0.5">{formatTSh(totals.profit)}</h4>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600">
            <PackageCheck className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Sacks (Bags) Sold</p>
            <h4 className="text-sm font-mono font-bold text-slate-900 mt-0.5">{totals.bagsCount} bags</h4>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-600">
            <ShoppingBag className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Transactions Count</p>
            <h4 className="text-sm font-mono font-bold text-slate-900 mt-0.5">{totals.txCount} sales</h4>
          </div>
        </div>
      </div>

      {/* TRENDING LINE AREA CHART (70% WIDTH EQUIVALENT / GRID) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Main Progression Chart (Span 2) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100">
            <div className="space-y-0.5">
              <h3 className="font-display font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-amber-500" />
                {t.revenueVsProfit}
              </h3>
              <p className="text-[10px] text-slate-400">Progression comparison of gross sales vs accumulated markup profits.</p>
            </div>

            {/* Range controls */}
            <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-[10px] font-bold">
              <button
                onClick={() => setTrendRange('daily')}
                className={`px-2.5 py-1 rounded ${trendRange === 'daily' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500'}`}
              >
                14 Days
              </button>
              <button
                onClick={() => setTrendRange('weekly')}
                className={`px-2.5 py-1 rounded ${trendRange === 'weekly' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500'}`}
              >
                8 Weeks
              </button>
              <button
                onClick={() => setTrendRange('monthly')}
                className={`px-2.5 py-1 rounded ${trendRange === 'monthly' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500'}`}
              >
                6 Months
              </button>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trendRange === 'daily' ? dailyTrendData : trendRange === 'weekly' ? weeklyTrendData : monthlyTrendData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey={trendRange === 'daily' ? 'dateStr' : trendRange === 'weekly' ? 'weekLabel' : 'monthLabel'}
                  stroke="#94a3b8"
                  fontSize={9}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => {
                    const num = Number(val);
                    return isNaN(num) ? '0k' : `${(num / 1000).toFixed(0)}k`;
                  }}
                />
                <Tooltip
                  formatter={renderTooltipValue}
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="Revenue" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProf)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales share by category Pie Chart (Span 1) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-display font-bold text-slate-900 text-xs uppercase tracking-wide">
              {t.salesByCategory}
            </h3>
            <p className="text-[10px] text-slate-400">Revenue split across primary stock groups.</p>
          </div>

          <div className="h-64 flex flex-col justify-between">
            {categoryChartData.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-16">{t.noTransactions}</p>
            ) : (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={renderTooltipValue} contentStyle={{ fontSize: '10.5px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1.5 max-h-20 overflow-y-auto pr-1">
                  {categoryChartData.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-[10px] text-slate-600">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">{formatTSh(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* TOP & LEAST PRODUCT GRAPHS (BENTO BOTTOM ROW) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Top 5 selling */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-display font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-1.5 text-emerald-600">
              <PackageCheck className="w-4 h-4" />
              {t.topProducts}
            </h3>
            <p className="text-[10px] text-slate-400">Top 5 inventory lines generating highest gross sales revenue.</p>
          </div>

          <div className="h-56">
            {topProductsData.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-12">{t.noTransactions}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProductsData} layout="vertical" margin={{ left: 15, right: 10, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={9} tickLine={false} tickFormatter={(val) => {
                    const num = Number(val);
                    return isNaN(num) ? '0k' : `${(num / 1000).toFixed(0)}k`;
                  }} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} width={80} />
                  <Tooltip formatter={renderTooltipValue} contentStyle={{ fontSize: '10.5px' }} />
                  <Bar dataKey="Sales" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Slow moving products */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-display font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-1.5 text-rose-600">
              <AlertCircle className="w-4 h-4" />
              {t.lowSellingProducts}
            </h3>
            <p className="text-[10px] text-slate-400">Slow moving inventory lines generating minimal retail demand.</p>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={slowProductsData} layout="vertical" margin={{ left: 15, right: 10, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" fontSize={9} tickLine={false} tickFormatter={(val) => {
                  const num = Number(val);
                  return isNaN(num) ? '0k' : `${(num / 1000).toFixed(0)}k`;
                }} />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} width={80} />
                <Tooltip formatter={renderTooltipValue} contentStyle={{ fontSize: '10.5px' }} />
                <Bar dataKey="Sales" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
