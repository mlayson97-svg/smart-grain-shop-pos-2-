/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Transaction, Product, Category, StockMovement, PurchaseRecord, User, ShopSettings } from '../types';
import { translations } from '../translations';
import { formatTSh } from '../mockData';
import { Calendar, Download, Printer, Search, FileText, ChevronRight, Calculator, PieChart, Users, Inbox } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ReportsViewProps {
  currentLanguage: Language;
  currentUser: User;
  transactions: Transaction[];
  products: Product[];
  categories: Category[];
  stockMovements: StockMovement[];
  purchases: PurchaseRecord[];
  settings: ShopSettings;
}

type Language = 'en' | 'sw';
type ReportType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'annual'
  | 'profit'
  | 'products'
  | 'cashier'
  | 'stock'
  | 'movements'
  | 'purchases';

export default function ReportsView({
  currentLanguage,
  currentUser,
  transactions,
  products,
  categories,
  stockMovements,
  purchases,
  settings,
}: ReportsViewProps) {
  const t = translations[currentLanguage];

  // Report configurations
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('daily');
  
  // Date ranges (Default: Start of today to end of today, or past month if not daily)
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // default to past 30 days
    return d.toISOString().split('T')[0];
  }, []);

  const defaultEndDate = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [searchQuery, setSearchQuery] = useState('');

  // Helpers to check date inclusion
  const isWithinDateRange = (dateStr: string) => {
    const date = new Date(dateStr);
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);
    return date >= start && date <= end;
  };

  // Compile matching datasets depending on selected report type
  const reportData = useMemo(() => {
    const query = searchQuery.toLowerCase();

    switch (selectedReportType) {
      case 'daily':
      case 'weekly':
      case 'monthly':
      case 'annual': {
        // Filter transactions completed in date range
        const list = transactions.filter(
          (tx) => tx.status === 'completed' && isWithinDateRange(tx.date)
        );

        // Search matches
        const filtered = list.filter(
          (tx) =>
            tx.receiptNo.toLowerCase().includes(query) ||
            (tx.customerName && tx.customerName.toLowerCase().includes(query)) ||
            tx.cashierName.toLowerCase().includes(query)
        );

        // Summaries
        const totalSales = filtered.reduce((acc, curr) => acc + curr.total, 0);
        const totalDiscount = filtered.reduce((acc, curr) => acc + curr.discount, 0);
        const totalTax = filtered.reduce((acc, curr) => acc + curr.tax, 0);

        return {
          type: 'sales',
          rows: filtered,
          summary: { totalSales, totalDiscount, totalTax, count: filtered.length },
        };
      }

      case 'profit': {
        // Profit & Loss Report
        const list = transactions.filter(
          (tx) => tx.status === 'completed' && isWithinDateRange(tx.date)
        );

        let totalRevenue = 0;
        let totalCOGS = 0; // Cost of goods sold
        let totalDiscounts = 0;

        list.forEach((tx) => {
          totalRevenue += tx.subtotal;
          totalDiscounts += tx.discount;
          tx.items.forEach((item) => {
            const baseQty = item.quantity * item.unitMultiplier;
            totalCOGS += baseQty * item.purchasePriceAtSale;
          });
        });

        const grossProfit = totalRevenue - totalCOGS - totalDiscounts;

        return {
          type: 'profit',
          summary: {
            revenue: totalRevenue,
            cogs: totalCOGS,
            discounts: totalDiscounts,
            grossProfit,
          },
          rows: list,
        };
      }

      case 'products': {
        // Product sales statistics
        const completedSales = transactions.filter(
          (tx) => tx.status === 'completed' && isWithinDateRange(tx.date)
        );

        // Map product sales
        const productStatsMap: {
          [id: string]: {
            sku: string;
            nameEn: string;
            nameSw: string;
            baseUnitSold: number;
            totalRevenue: number;
            cost: number;
            profit: number;
          };
        } = {};

        completedSales.forEach((tx) => {
          tx.items.forEach((itm) => {
            if (!productStatsMap[itm.productId]) {
              productStatsMap[itm.productId] = {
                sku: '',
                nameEn: itm.productNameEn,
                nameSw: itm.productNameSw,
                baseUnitSold: 0,
                totalRevenue: 0,
                cost: 0,
                profit: 0,
              };
            }

            const pStat = productStatsMap[itm.productId];
            const baseQty = itm.quantity * itm.unitMultiplier;
            pStat.baseUnitSold += baseQty;
            pStat.totalRevenue += itm.totalPrice;
            pStat.cost += baseQty * itm.purchasePriceAtSale;
          });
        });

        // Fill missing SKUs from current product catalog
        products.forEach((p) => {
          if (productStatsMap[p.id]) {
            productStatsMap[p.id].sku = p.sku;
            productStatsMap[p.id].profit = productStatsMap[p.id].totalRevenue - productStatsMap[p.id].cost;
          }
        });

        const statsArray = Object.values(productStatsMap).filter(
          (item) =>
            item.nameEn.toLowerCase().includes(query) ||
            item.nameSw.toLowerCase().includes(query) ||
            item.sku.toLowerCase().includes(query)
        );

        const sumRevenue = statsArray.reduce((acc, curr) => acc + curr.totalRevenue, 0);
        const sumProfit = statsArray.reduce((acc, curr) => acc + curr.profit, 0);

        return {
          type: 'products',
          rows: statsArray,
          summary: { sumRevenue, sumProfit },
        };
      }

      case 'cashier': {
        // Cashier performance aggregations
        const completedSales = transactions.filter(
          (tx) => tx.status === 'completed' && isWithinDateRange(tx.date)
        );

        const cashierPerformanceMap: {
          [id: string]: {
            name: string;
            role: string;
            salesCount: number;
            totalSales: number;
            discountsGiven: number;
          };
        } = {};

        completedSales.forEach((tx) => {
          if (!cashierPerformanceMap[tx.cashierId]) {
            cashierPerformanceMap[tx.cashierId] = {
              name: tx.cashierName,
              role: 'Cashier',
              salesCount: 0,
              totalSales: 0,
              discountsGiven: 0,
            };
          }
          const perf = cashierPerformanceMap[tx.cashierId];
          perf.salesCount += 1;
          perf.totalSales += tx.total;
          perf.discountsGiven += tx.discount;
        });

        const statsArray = Object.values(cashierPerformanceMap).filter((item) =>
          item.name.toLowerCase().includes(query)
        );

        return {
          type: 'cashier',
          rows: statsArray,
        };
      }

      case 'stock': {
        // Current inventory valuation snapshot (Ignore dates for valuation except displaying current time)
        const stats = products.map((p) => {
          const costVal = p.currentStock * p.purchasePrice;
          const salesVal = p.currentStock * p.sellingPrice;
          const estProfit = salesVal - costVal;
          const cat = categories.find((c) => c.id === p.categoryId);

          return {
            sku: p.sku,
            nameEn: p.nameEn,
            nameSw: p.nameSw,
            category: cat ? (currentLanguage === 'sw' ? cat.nameSw : cat.nameEn) : 'Retail',
            stock: p.currentStock,
            unit: p.unit,
            purchasePrice: p.purchasePrice,
            sellingPrice: p.sellingPrice,
            costValuation: costVal,
            salesValuation: salesVal,
            estimatedProfit: estProfit,
          };
        });

        const filtered = stats.filter(
          (s) =>
            s.nameEn.toLowerCase().includes(query) ||
            s.nameSw.toLowerCase().includes(query) ||
            s.sku.toLowerCase().includes(query)
        );

        const totalCostVal = filtered.reduce((acc, curr) => acc + curr.costValuation, 0);
        const totalSalesVal = filtered.reduce((acc, curr) => acc + curr.salesValuation, 0);

        return {
          type: 'stock',
          rows: filtered,
          summary: { totalCostVal, totalSalesVal, totalProfitVal: totalSalesVal - totalCostVal },
        };
      }

      case 'movements': {
        // Stock Ledger report
        const filtered = stockMovements.filter(
          (m) =>
            isWithinDateRange(m.date) &&
            (m.productNameEn.toLowerCase().includes(query) ||
              m.productNameSw.toLowerCase().includes(query) ||
              m.recordedBy.toLowerCase().includes(query) ||
              (m.notes && m.notes.toLowerCase().includes(query)))
        );

        return {
          type: 'movements',
          rows: filtered,
        };
      }

      case 'purchases': {
        // Store purchase records (Stock In events)
        const list = purchases.filter((p) => isWithinDateRange(p.date));
        const filtered = list.filter(
          (p) =>
            p.recordedBy.toLowerCase().includes(query) ||
            (p.supplier && p.supplier.toLowerCase().includes(query)) ||
            (p.invoiceNo && p.invoiceNo.toLowerCase().includes(query))
        );

        const totalPurchasedSum = filtered.reduce((acc, curr) => acc + curr.totalCost, 0);

        return {
          type: 'purchases',
          rows: filtered,
          summary: { totalPurchasedSum },
        };
      }

      default:
        return { type: 'empty', rows: [] };
    }
  }, [selectedReportType, transactions, products, stockMovements, purchases, startDate, endDate, searchQuery, currentLanguage]);

  // Export to Excel using XLSX
  const handleExportToExcel = () => {
    let sheetData: any[] = [];
    let filename = `${selectedReportType}_report_${startDate}_to_${endDate}`;

    switch (reportData.type) {
      case 'sales':
        sheetData = (reportData.rows as Transaction[]).map((r) => ({
          'Receipt No': r.receiptNo,
          'Date / Time': new Date(r.date).toLocaleString(),
          'Cashier Name': r.cashierName,
          'Customer Name': r.customerName || 'Retail Customer',
          'Subtotal (TSh)': r.subtotal,
          'Discount (TSh)': r.discount,
          'VAT Tax (TSh)': r.tax,
          'Grand Total (TSh)': r.total,
          'Payment Method': r.paymentMethod,
        }));
        break;

      case 'profit':
        sheetData = [
          {
            'Financial Indicator': 'Gross Revenue (Total Sales)',
            'Value (TSh)': reportData.summary.revenue,
          },
          {
            'Financial Indicator': 'Cost of Goods Sold (COGS)',
            'Value (TSh)': reportData.summary.cogs,
          },
          {
            'Financial Indicator': 'Discounts Given',
            'Value (TSh)': reportData.summary.discounts,
          },
          {
            'Financial Indicator': 'Net Gross Profit',
            'Value (TSh)': reportData.summary.grossProfit,
          },
        ];
        break;

      case 'products':
        sheetData = (reportData.rows as any[]).map((r) => ({
          SKU: r.sku,
          'Product Name': currentLanguage === 'sw' ? r.nameSw : r.nameEn,
          'Base Quantity Sold': r.baseUnitSold,
          'Revenue Collected (TSh)': r.totalRevenue,
          'Cost Value (TSh)': r.cost,
          'Margin Profit (TSh)': r.profit,
        }));
        break;

      case 'cashier':
        sheetData = (reportData.rows as any[]).map((r) => ({
          'Cashier Name': r.name,
          Role: r.role,
          'Receipts Checked Out': r.salesCount,
          'Total Sales Managed (TSh)': r.totalSales,
          'Total Discounts Issued (TSh)': r.discountsGiven,
        }));
        break;

      case 'stock':
        sheetData = (reportData.rows as any[]).map((r) => ({
          SKU: r.sku,
          'Product Name': currentLanguage === 'sw' ? r.nameSw : r.nameEn,
          Category: r.category,
          'Current Balance': r.stock,
          'Base Unit': r.unit,
          'Cost Price (TSh)': r.purchasePrice,
          'Retail Price (TSh)': r.sellingPrice,
          'Cost Valuation (TSh)': r.costValuation,
          'Retail Valuation (TSh)': r.salesValuation,
          'Expected Margin (TSh)': r.estimatedProfit,
        }));
        break;

      case 'movements':
        sheetData = (reportData.rows as StockMovement[]).map((r) => ({
          'Log Date': new Date(r.date).toLocaleString(),
          Product: currentLanguage === 'sw' ? r.productNameSw : r.productNameEn,
          'Movement Type': r.type,
          'Quantity Delta': r.quantity,
          'Remaining stock': r.remainingStock,
          'Recorded By': r.recordedBy,
          Notes: r.notes || '',
        }));
        break;

      case 'purchases':
        sheetData = (reportData.rows as PurchaseRecord[]).map((r) => ({
          'Purchase Date': new Date(r.date).toLocaleString(),
          Supplier: r.supplier || 'Main Wholesale Market',
          'Invoice / Reference No': r.invoiceNo || 'N/A',
          'Grand Total Expense (TSh)': r.totalCost,
          'Store Manager': r.recordedBy,
        }));
        break;

      default:
        return;
    }

    // Create Worksheet
    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report Summary');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6 font-sans">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md">
        <div className="space-y-1">
          <h2 className="font-display font-bold text-lg tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            {t.generateReport}
          </h2>
          <p className="text-xs text-slate-400">Generate, print, and export high precision sales, profit, and stock reports.</p>
        </div>

        {/* Action Triggers */}
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 sm:flex-initial px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            {t.printReport}
          </button>
          <button
            onClick={handleExportToExcel}
            className="flex-1 sm:flex-initial px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg"
          >
            <Download className="w-4 h-4" />
            {t.exportExcel}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        
        {/* QUERY SETTINGS DRAWER (25%) */}
        <div className="space-y-4 lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
            
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                {t.reportSettings}
              </h3>
              
              {/* Report Menu List */}
              <div className="space-y-1">
                {[
                  { id: 'daily', label: t.dailyReport },
                  { id: 'profit', label: t.profitReport },
                  { id: 'products', label: t.productSalesReport },
                  { id: 'cashier', label: t.cashierPerformance },
                  { id: 'stock', label: t.stockReport },
                  { id: 'movements', label: t.stockMovementReport },
                  { id: 'purchases', label: t.purchaseReport },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedReportType(item.id as ReportType);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all ${
                      selectedReportType === item.id
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span>{item.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                  </button>
                ))}
              </div>
            </div>

            {/* Date Picker (Skip if Stock Valuation because valuation is live snapshot of warehouse) */}
            {selectedReportType !== 'stock' && (
              <div className="space-y-3.5 pt-4 border-t border-slate-150">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Period</p>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t.startDate}</label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-xs font-medium pl-9 pr-3 py-1.5 border border-slate-250 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t.endDate}</label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-xs font-medium pl-9 pr-3 py-1.5 border border-slate-250 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Filter Search */}
            <div className="pt-4 border-t border-slate-150">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Search within results</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter table rows..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs font-medium pl-9 pr-3 py-1.5 border border-slate-250 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50"
                />
              </div>
            </div>

          </div>
        </div>

        {/* REPORT TABLE DESK (75%) */}
        <div className="lg:col-span-3 space-y-4" id="report-print-sheet">
          
          {/* Dynamic reports render */}
          {selectedReportType === 'profit' ? (
            /* SPECIAL P&L REPORT VIEW */
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
              <div className="text-center border-b border-slate-150 pb-4">
                <h3 className="font-display font-extrabold text-slate-900 text-sm tracking-tight uppercase">
                  {settings.name}
                </h3>
                <h4 className="font-display font-bold text-slate-700 text-xs mt-1">
                  {t.profitReport} (P&L)
                </h4>
                <p className="text-[10px] text-slate-500 font-medium font-mono mt-1">
                  Period: {startDate} to {endDate}
                </p>
              </div>

              {/* Financial statements stats table */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Gross Revenue (Total Sales)</p>
                      <h4 className="text-base font-mono font-extrabold text-slate-900 mt-1">
                        {formatTSh(reportData.summary?.revenue || 0)}
                      </h4>
                    </div>
                    <Calculator className="w-7 h-7 text-indigo-500/35" />
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Discounts Given</p>
                      <h4 className="text-base font-mono font-extrabold text-amber-600 mt-1">
                        -{formatTSh(reportData.summary?.discounts || 0)}
                      </h4>
                    </div>
                    <PieChart className="w-7 h-7 text-amber-500/35" />
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Cost of Goods Sold (COGS)</p>
                      <h4 className="text-base font-mono font-extrabold text-rose-600 mt-1">
                        -{formatTSh(reportData.summary?.cogs || 0)}
                      </h4>
                    </div>
                    <Inbox className="w-7 h-7 text-rose-500/35" />
                  </div>

                  <div className="border border-slate-200 rounded-2xl p-4 bg-emerald-50 border-emerald-300 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-emerald-800/80 uppercase tracking-wide">Net Business Profit (Faida)</p>
                      <h4 className="text-lg font-mono font-extrabold text-emerald-800 mt-1">
                        {formatTSh(reportData.summary?.grossProfit || 0)}
                      </h4>
                    </div>
                    <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-700">
                      🌾
                    </div>
                  </div>
                </div>

                {/* Audit breakdown transactions lists */}
                <div className="pt-3 border-t border-slate-200">
                  <h5 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider mb-2">Audit Traceability (Matching Transactions: {reportData.rows.length})</h5>
                  <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-lg">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[8px] tracking-wider sticky top-0">
                        <tr>
                          <th className="p-3">Receipt</th>
                          <th className="p-3">Date</th>
                          <th className="p-3 text-right">Subtotal</th>
                          <th className="p-3 text-right">Discount</th>
                          <th className="p-3 text-right">Tax</th>
                          <th className="p-3 text-right">Final Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.rows.map((tx: Transaction) => (
                          <tr key={tx.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-bold text-indigo-600">{tx.receiptNo}</td>
                            <td className="p-3 text-slate-500">{new Date(tx.date).toLocaleDateString()}</td>
                            <td className="p-3 text-right font-mono text-slate-600">{formatTSh(tx.subtotal)}</td>
                            <td className="p-3 text-right font-mono text-amber-600">-{formatTSh(tx.discount)}</td>
                            <td className="p-3 text-right font-mono text-slate-500">{formatTSh(tx.tax)}</td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900">{formatTSh(tx.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            /* STANDARD DATA REPORTS TABLE VIEW */
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <h3 className="font-display font-bold text-slate-800 text-xs uppercase tracking-wide">
                  {selectedReportType.toUpperCase()} REPORT ROWS ({reportData.rows.length})
                </h3>
                {selectedReportType === 'stock' && (
                  <p className="text-[10px] text-slate-400 font-mono">Live Valuation Summary</p>
                )}
              </div>

              {reportData.rows.length === 0 ? (
                <div className="p-16 text-center text-slate-400 space-y-2">
                  <span className="text-3xl">🌾</span>
                  <p className="text-xs font-semibold">{t.reportNoData}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                                    {reportData.type === 'sales' && (
                      <>
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[8px] tracking-wider">
                            <th className="p-4">Receipt No</th>
                            <th className="p-4">Date & Time</th>
                            <th className="p-4">Cashier</th>
                            <th className="p-4">Customer</th>
                            <th className="p-4 text-right">Subtotal</th>
                            <th className="p-4 text-right">Discount</th>
                            <th className="p-4 text-right">Tax (VAT)</th>
                            <th className="p-4 text-right font-bold">Grand Total</th>
                            <th className="p-4 text-center">Payment</th>
                            <th className="p-4 text-center">Sync</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(reportData.rows as Transaction[]).map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-50/50">
                              <td className="p-4 font-mono font-bold text-indigo-600">{tx.receiptNo}</td>
                              <td className="p-4 text-slate-500 whitespace-nowrap">{new Date(tx.date).toLocaleString()}</td>
                              <td className="p-4 font-medium text-slate-700">{tx.cashierName}</td>
                              <td className="p-4 text-slate-600">{tx.customerName || 'Retail Client'}</td>
                              <td className="p-4 text-right font-mono text-slate-600">{formatTSh(tx.subtotal)}</td>
                              <td className="p-4 text-right font-mono text-amber-600">-{formatTSh(tx.discount)}</td>
                              <td className="p-4 text-right font-mono text-slate-500">{formatTSh(tx.tax)}</td>
                              <td className="p-4 text-right font-mono font-extrabold text-slate-950">{formatTSh(tx.total)}</td>
                              <td className="p-4 text-center">
                                <span className="bg-slate-100 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                                  {tx.paymentMethod}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  tx.offlineSynced !== false 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-amber-100 text-amber-800 animate-pulse'
                                }`}>
                                  {tx.offlineSynced !== false ? (currentLanguage === 'sw' ? 'Mawingu' : 'Synced') : (currentLanguage === 'sw' ? 'Kifaa' : 'Pending')}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}

                    {reportData.type === 'products' && (
                      <>
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[8px] tracking-wider">
                            <th className="p-4">SKU</th>
                            <th className="p-4">Product Jina</th>
                            <th className="p-4 text-center">Base Qty Sold</th>
                            <th className="p-4 text-right">Revenue (Kiasi cha Mauzo)</th>
                            <th className="p-4 text-right">Cost Value</th>
                            <th className="p-4 text-right font-bold">Gross Profit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(reportData.rows as any[]).map((itm, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-4 font-mono font-bold text-slate-500">{itm.sku || 'N/A'}</td>
                              <td className="p-4 font-display font-bold text-slate-900">
                                {currentLanguage === 'sw' ? itm.nameSw : itm.nameEn}
                              </td>
                              <td className="p-4 text-center font-mono font-bold text-slate-800">{(itm.baseUnitSold ?? 0).toFixed(2)}</td>
                              <td className="p-4 text-right font-mono text-slate-950 font-bold">{formatTSh(itm.totalRevenue)}</td>
                              <td className="p-4 text-right font-mono text-rose-600">-{formatTSh(itm.cost)}</td>
                              <td className="p-4 text-right font-mono font-extrabold text-emerald-800">{formatTSh(itm.profit)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}

                    {reportData.type === 'cashier' && (
                      <>
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[8px] tracking-wider">
                            <th className="p-4">Cashier Name</th>
                            <th className="p-4">Role</th>
                            <th className="p-4 text-center">Total Receipts</th>
                            <th className="p-4 text-right">Total Revenue Managed</th>
                            <th className="p-4 text-right font-bold">Discounts Given</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(reportData.rows as any[]).map((itm, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-4 font-display font-bold text-slate-900 flex items-center gap-2">
                                <span className="text-sm">👤</span> {itm.name}
                              </td>
                              <td className="p-4 text-slate-500">{itm.role}</td>
                              <td className="p-4 text-center font-mono font-bold text-slate-850">{itm.salesCount}</td>
                              <td className="p-4 text-right font-mono font-extrabold text-slate-900">{formatTSh(itm.totalSales)}</td>
                              <td className="p-4 text-right font-mono text-amber-600">-{formatTSh(itm.discountsGiven)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}

                    {reportData.type === 'stock' && (
                      <>
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[8px] tracking-wider">
                            <th className="p-4">SKU</th>
                            <th className="p-4">Product Name</th>
                            <th className="p-4">Category</th>
                            <th className="p-4 text-center">Current Stock</th>
                            <th className="p-4 text-right">Cost per Unit</th>
                            <th className="p-4 text-right">Retail per Unit</th>
                            <th className="p-4 text-right">Cost Valuation</th>
                            <th className="p-4 text-right">Retail Valuation</th>
                            <th className="p-4 text-right font-bold">Expected profit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(reportData.rows as any[]).map((itm, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-4 font-mono font-bold text-slate-500">{itm.sku}</td>
                              <td className="p-4 font-display font-bold text-slate-900">
                                {currentLanguage === 'sw' ? itm.nameSw : itm.nameEn}
                              </td>
                              <td className="p-4 text-slate-600">{itm.category}</td>
                              <td className="p-4 text-center font-mono font-extrabold text-slate-950">
                                {itm.stock} {itm.unit === 'kg' ? 'Kg' : 'pcs'}
                              </td>
                              <td className="p-4 text-right font-mono text-slate-600">{formatTSh(itm.purchasePrice)}</td>
                              <td className="p-4 text-right font-mono text-slate-900">{formatTSh(itm.sellingPrice)}</td>
                              <td className="p-4 text-right font-mono text-slate-500">{formatTSh(itm.costValuation)}</td>
                              <td className="p-4 text-right font-mono text-indigo-700 font-bold">{formatTSh(itm.salesValuation)}</td>
                              <td className="p-4 text-right font-mono font-extrabold text-emerald-800">{formatTSh(itm.estimatedProfit)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}

                    {reportData.type === 'movements' && (
                      <>
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[8px] tracking-wider">
                            <th className="p-4">Log Date & Time</th>
                            <th className="p-4">Product</th>
                            <th className="p-4">Mvt Type</th>
                            <th className="p-4 text-center">Change Qty</th>
                            <th className="p-4 text-center">Remaining Balance</th>
                            <th className="p-4">Recorded By</th>
                            <th className="p-4">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(reportData.rows as StockMovement[]).map((m) => (
                            <tr key={m.id} className="hover:bg-slate-50/50">
                              <td className="p-4 text-slate-500 whitespace-nowrap">{new Date(m.date).toLocaleString()}</td>
                              <td className="p-4 font-bold text-slate-900">
                                {currentLanguage === 'sw' ? m.productNameSw : m.productNameEn}
                              </td>
                              <td className="p-4">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase border ${
                                  m.type === 'in' || m.type === 'cancel_return' 
                                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                                    : 'text-rose-700 bg-rose-50 border-rose-200'
                                }`}>
                                  {m.type}
                                </span>
                              </td>
                              <td className={`p-4 text-center font-mono font-extrabold ${m.quantity > 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                                {m.quantity > 0 ? '+' : ''}{(m.quantity ?? 0).toFixed(2)}
                              </td>
                              <td className="p-4 text-center font-mono font-bold text-slate-700">{(m.remainingStock ?? 0).toFixed(2)}</td>
                              <td className="p-4 text-slate-600">{m.recordedBy}</td>
                              <td className="p-4 text-slate-500 italic font-medium">{m.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}

                    {reportData.type === 'purchases' && (
                      <>
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[8px] tracking-wider">
                            <th className="p-4">Purchase Date</th>
                            <th className="p-4">Supplier</th>
                            <th className="p-4">Reference No</th>
                            <th className="p-4 text-right">Items Purchased</th>
                            <th className="p-4 text-right font-bold">Total Expense (Cost)</th>
                            <th className="p-4">Recorded By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(reportData.rows as PurchaseRecord[]).map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50/50">
                              <td className="p-4 text-slate-500 whitespace-nowrap">{new Date(p.date).toLocaleString()}</td>
                              <td className="p-4 font-display font-bold text-slate-900">{p.supplier || 'Kahama Market wholesale'}</td>
                              <td className="p-4 font-mono font-bold text-indigo-600">{p.invoiceNo || 'N/A'}</td>
                              <td className="p-4 text-right text-slate-600">
                                {p.items.length} product lines
                              </td>
                              <td className="p-4 text-right font-mono font-extrabold text-rose-800">{formatTSh(p.totalCost)}</td>
                              <td className="p-4 text-slate-600">{p.recordedBy}</td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}

                  </table>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
