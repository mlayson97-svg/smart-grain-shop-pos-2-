/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Product, Category, StockMovement, PurchaseRecord, User, UnitType } from '../types';
import { translations } from '../translations';
import { formatTSh } from '../mockData';
import { Plus, Search, Filter, ShieldAlert, History, Coins, BarChart3, TrendingUp, HelpCircle, X, Edit3, ArrowUpRight, ArrowDownRight, ClipboardList } from 'lucide-react';

interface InventoryViewProps {
  currentLanguage: Language;
  currentUser: User;
  products: Product[];
  categories: Category[];
  stockMovements: StockMovement[];
  onAddProduct: (prod: Product, movement: StockMovement) => void;
  onAdjustStock: (productId: string, type: 'in' | 'out' | 'adjustment', baseQty: number, notes: string, costPrice?: number, supplier?: string) => void;
}

type Language = 'en' | 'sw';

export default function InventoryView({
  currentLanguage,
  currentUser,
  products,
  categories,
  stockMovements,
  onAddProduct,
  onAdjustStock,
}: InventoryViewProps) {
  const t = translations[currentLanguage];

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'status' | 'movements'>('status');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProductToAdjust, setSelectedProductToAdjust] = useState<Product | null>(null);

  // Form states: New Product
  const [newProdNameEn, setNewProdNameEn] = useState('');
  const [newProdNameSw, setNewProdNameSw] = useState('');
  const [newProdCategoryId, setNewProdCategoryId] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdCost, setNewProdCost] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdUnit, setNewProdUnit] = useState<UnitType>('kg');
  const [newProdInitialStock, setNewProdInitialStock] = useState('');
  const [newProdMinStock, setNewProdMinStock] = useState('');

  // Form states: Stock Adjust
  const [adjustType, setAdjustType] = useState<'in' | 'out' | 'adjustment'>('in');
  const [adjustQtyInput, setAdjustQtyInput] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustCostInput, setAdjustCostInput] = useState(''); // purchase cost if Stock In
  const [adjustSupplier, setAdjustSupplier] = useState(''); // supplier if Stock In

  // Error/Success
  const [formError, setFormError] = useState<string | null>(null);

  // Quick Filters
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
      const matchSearch =
        p.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.nameSw.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Stock Valuation calculations
  const valuation = useMemo(() => {
    let totalCostVal = 0;
    let totalSalesVal = 0;
    products.forEach((p) => {
      totalCostVal += p.currentStock * p.purchasePrice;
      totalSalesVal += p.currentStock * p.sellingPrice;
    });
    return {
      cost: totalCostVal,
      sales: totalSalesVal,
      profit: totalSalesVal - totalCostVal,
    };
  }, [products]);

  // Product addition trigger
  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (
      !newProdNameEn ||
      !newProdNameSw ||
      !newProdCategoryId ||
      !newProdSku ||
      !newProdCost ||
      !newProdPrice ||
      !newProdInitialStock ||
      !newProdMinStock
    ) {
      setFormError('Please fill in all input fields.');
      return;
    }

    // Check unique SKU
    if (products.find((p) => p.sku.toLowerCase() === newProdSku.toLowerCase())) {
      setFormError('A product with this SKU already exists!');
      return;
    }

    const cost = parseFloat(newProdCost);
    const price = parseFloat(newProdPrice);
    const initialStock = parseFloat(newProdInitialStock);
    const minStock = parseFloat(newProdMinStock);

    if (isNaN(cost) || isNaN(price) || isNaN(initialStock) || isNaN(minStock)) {
      setFormError('Please enter numeric prices and stock fields.');
      return;
    }

    const newProd: Product = {
      id: `prod-${Date.now()}`,
      nameEn: newProdNameEn.trim(),
      nameSw: newProdNameSw.trim(),
      categoryId: newProdCategoryId,
      sku: newProdSku.toUpperCase().trim(),
      purchasePrice: cost,
      sellingPrice: price,
      unit: newProdUnit,
      currentStock: initialStock,
      minStockAlert: minStock,
    };

    const initialMovement: StockMovement = {
      id: `mvt-init-${Date.now()}`,
      productId: newProd.id,
      productNameEn: newProd.nameEn,
      productNameSw: newProd.nameSw,
      type: 'in',
      quantity: initialStock,
      remainingStock: initialStock,
      date: new Date().toISOString(),
      recordedBy: currentUser.name,
      notes: 'Initial inventory registration stock-in',
    };

    onAddProduct(newProd, initialMovement);

    // Reset fields
    setNewProdNameEn('');
    setNewProdNameSw('');
    setNewProdCategoryId('');
    setNewProdSku('');
    setNewProdCost('');
    setNewProdPrice('');
    setNewProdUnit('kg');
    setNewProdInitialStock('');
    setNewProdMinStock('');
    setShowAddModal(false);
  };

  // Restock / Spoilage adjustments trigger
  const handleAdjustStockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedProductToAdjust || !adjustQtyInput) {
      setFormError('Please choose a quantity.');
      return;
    }

    const qty = parseFloat(adjustQtyInput);
    if (isNaN(qty) || qty <= 0) {
      setFormError('Please enter a valid positive quantity.');
      return;
    }

    if (adjustType !== 'in' && qty > selectedProductToAdjust.currentStock) {
      setFormError('Adjustment quantity exceeds available stock!');
      return;
    }

    const costPrice = adjustCostInput ? parseFloat(adjustCostInput) : undefined;
    const supplier = adjustSupplier.trim() || undefined;

    // Call state adjust
    onAdjustStock(
      selectedProductToAdjust.id,
      adjustType,
      qty,
      adjustNotes.trim() || (adjustType === 'in' ? 'Routine restock' : 'Inventory level adjustment'),
      costPrice,
      supplier
    );

    // Reset states
    setAdjustQtyInput('');
    setAdjustNotes('');
    setAdjustCostInput('');
    setAdjustSupplier('');
    setSelectedProductToAdjust(null);
    setShowAdjustModal(false);
  };

  const handleOpenAdjustModal = (prod: Product) => {
    setSelectedProductToAdjust(prod);
    setAdjustType('in');
    setAdjustCostInput(String(prod.purchasePrice));
    setAdjustSupplier('');
    setAdjustNotes('');
    setShowAdjustModal(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6 font-sans">
      
      {/* BENTO STATS CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm border border-slate-700/50 relative overflow-hidden flex items-center justify-between">
          <div className="space-y-1 z-10">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.totalCostValuation}</p>
            <h3 className="text-xl font-mono font-extrabold text-white">{formatTSh(valuation.cost)}</h3>
            <p className="text-[10px] text-slate-400">Inventory warehouse asset value at cost</p>
          </div>
          <Coins className="w-10 h-10 text-slate-600/40 absolute right-4 bottom-4 stroke-[1.5]" />
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm border border-slate-700/50 relative overflow-hidden flex items-center justify-between">
          <div className="space-y-1 z-10">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.totalSalesValuation}</p>
            <h3 className="text-xl font-mono font-extrabold text-amber-400">{formatTSh(valuation.sales)}</h3>
            <p className="text-[10px] text-slate-400">Expected sales collection (Tax-inclusive)</p>
          </div>
          <BarChart3 className="w-10 h-10 text-slate-600/40 absolute right-4 bottom-4 stroke-[1.5]" />
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 rounded-2xl p-5 shadow-md relative overflow-hidden flex items-center justify-between">
          <div className="space-y-1 z-10">
            <p className="text-[10px] font-bold text-amber-950/70 uppercase tracking-widest">{t.estimatedProfit}</p>
            <h3 className="text-xl font-mono font-extrabold text-slate-950">{formatTSh(valuation.profit)}</h3>
            <p className="text-[10px] text-amber-950/60">Estimated gross margin on current stock</p>
          </div>
          <TrendingUp className="w-10 h-10 text-amber-950/20 absolute right-4 bottom-4 stroke-[1.5]" />
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('status')}
          className={`px-4 py-2.5 font-display font-bold text-xs uppercase tracking-wide border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'status'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          {t.stockStatus}
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`px-4 py-2.5 font-display font-bold text-xs uppercase tracking-wide border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'movements'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="w-4 h-4" />
          {t.stockMovement}
        </button>
      </div>

      {activeTab === 'status' ? (
        /* STATUS TABLE VIEW */
        <div className="space-y-4">
          
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-200 justify-between items-center">
            
            <div className="flex flex-1 w-full gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 border border-slate-250 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-750"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs font-semibold border border-slate-250 rounded-lg px-2 bg-white text-slate-700"
              >
                <option value="all">{t.allCategories}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {currentLanguage === 'sw' ? cat.nameSw : cat.nameEn}
                  </option>
                ))}
              </select>
            </div>

            {currentUser.role !== 'cashier' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.addProduct}
              </button>
            )}

          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                    <th className="p-4">{t.skuLabel}</th>
                    <th className="p-4">Name (Jina)</th>
                    <th className="p-4">{t.category}</th>
                    <th className="p-4">{t.purchasePrice}</th>
                    <th className="p-4">{t.sellingPrice}</th>
                    <th className="p-4 text-center">{t.currentStockLabel}</th>
                    <th className="p-4 text-center">Status</th>
                    {currentUser.role !== 'cashier' && <th className="p-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => {
                    const isLow = p.currentStock <= p.minStockAlert && p.currentStock > 0;
                    const isOut = p.currentStock <= 0;
                    const cat = categories.find((c) => c.id === p.categoryId);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-4 font-mono font-bold text-slate-500">{p.sku}</td>
                        <td className="p-4">
                          <p className="font-display font-bold text-slate-900">
                            {currentLanguage === 'sw' ? p.nameSw : p.nameEn}
                          </p>
                        </td>
                        <td className="p-4">
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-semibold">
                            {cat ? (currentLanguage === 'sw' ? cat.nameSw : cat.nameEn) : 'Retail'}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-slate-600">{formatTSh(p.purchasePrice)}</td>
                        <td className="p-4 font-mono font-bold text-slate-900">{formatTSh(p.sellingPrice)}</td>
                        <td className="p-4 text-center">
                          <span className="font-mono font-extrabold text-slate-950">
                            {p.currentStock} {p.unit === 'kg' ? 'Kg' : 'pcs'}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {isOut ? (
                            <span className="bg-rose-100 text-rose-800 font-bold px-2.5 py-1 rounded-full text-[9px] uppercase border border-rose-200">
                              Out of Stock
                            </span>
                          ) : isLow ? (
                            <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full text-[9px] uppercase border border-amber-200 animate-pulse">
                              Low Stock
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[9px] uppercase border border-emerald-200">
                              Healthy
                            </span>
                          )}
                        </td>
                        {currentUser.role !== 'cashier' && (
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleOpenAdjustModal(p)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-amber-100 text-slate-800 hover:text-amber-900 font-bold rounded-lg border border-slate-200 hover:border-amber-400 transition-all"
                            >
                              {t.updateStock}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* STOCK MOVEMENTS VIEW */
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h3 className="font-display font-bold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <History className="w-4 h-4 text-amber-500" />
                {t.stockMovement} (Latest 100 Movements)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                    <th className="p-4">Date (Tarehe)</th>
                    <th className="p-4">Product Name (Bidhaa)</th>
                    <th className="p-4">Type (Mwendo)</th>
                    <th className="p-4 text-center">Qty (Idadi)</th>
                    <th className="p-4 text-center">Remaining Balance (Stoo)</th>
                    <th className="p-4">Recorded By (Mhusika)</th>
                    <th className="p-4">Notes (Sababu)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockMovements.slice(0, 100).map((m) => {
                    const isPositive = m.type === 'in' || m.type === 'cancel_return';
                    const isSale = m.type === 'sale';

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-4 text-slate-500 whitespace-nowrap">{new Date(m.date).toLocaleString()}</td>
                        <td className="p-4 font-bold text-slate-900">
                          {currentLanguage === 'sw' ? m.productNameSw : m.productNameEn}
                        </td>
                        <td className="p-4">
                          {isPositive ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <ArrowUpRight className="w-3 h-3" />
                              {m.type === 'in' ? 'STOCK IN' : 'RETURN'}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-md border ${
                              isSale 
                                ? 'text-indigo-700 bg-indigo-50 border-indigo-200' 
                                : 'text-rose-700 bg-rose-50 border-rose-200'
                            }`}>
                              <ArrowDownRight className="w-3 h-3" />
                              {m.type === 'sale' ? 'SALE' : 'STOCK OUT'}
                            </span>
                          )}
                        </td>
                        <td className={`p-4 text-center font-mono font-extrabold ${isPositive ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {isPositive ? '+' : ''}{(m.quantity ?? 0).toFixed(2)}
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-slate-800">{(m.remainingStock ?? 0).toFixed(2)}</td>
                        <td className="p-4 text-slate-600">{m.recordedBy}</td>
                        <td className="p-4 text-slate-500 font-medium italic">{m.notes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD PRODUCT FORM */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <span className="font-display font-bold text-xs uppercase tracking-wide text-amber-400">
                {t.addProduct}
              </span>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-5 overflow-y-auto space-y-3.5 text-xs">
              {formError && (
                <div className="bg-rose-100 border border-rose-300 p-2.5 rounded-lg text-rose-800 font-bold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.nameEn}</label>
                  <input
                    type="text"
                    required
                    value={newProdNameEn}
                    onChange={(e) => setNewProdNameEn(e.target.value)}
                    placeholder="e.g. Red Beans Super"
                    className="w-full border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50 text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.nameSw}</label>
                  <input
                    type="text"
                    required
                    value={newProdNameSw}
                    onChange={(e) => setNewProdNameSw(e.target.value)}
                    placeholder="e.g. Maharage ya Mbeya"
                    className="w-full border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50 text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.skuLabel}</label>
                  <input
                    type="text"
                    required
                    value={newProdSku}
                    onChange={(e) => setNewProdSku(e.target.value)}
                    placeholder="e.g. GRN-RED-01"
                    className="w-full border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50 text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.category}</label>
                  <select
                    required
                    value={newProdCategoryId}
                    onChange={(e) => setNewProdCategoryId(e.target.value)}
                    className="w-full border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white text-slate-700"
                  >
                    <option value="">-- Choose Category --</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {currentLanguage === 'sw' ? cat.nameSw : cat.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.purchasePrice} (TSh)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newProdCost}
                    onChange={(e) => setNewProdCost(e.target.value)}
                    placeholder="Cost per unit"
                    className="w-full border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50 font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.sellingPrice} (TSh)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    placeholder="Selling price per unit"
                    className="w-full border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50 font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.baseUnit}</label>
                  <select
                    value={newProdUnit}
                    onChange={(e) => setNewProdUnit(e.target.value as UnitType)}
                    className="w-full border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white text-slate-700"
                  >
                    <option value="kg">Kilogram (Kg)</option>
                    <option value="full">Full Unit (piece)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Initial Stock Quantity</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newProdInitialStock}
                    onChange={(e) => setNewProdInitialStock(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.minStockLabel}</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newProdMinStock}
                    onChange={(e) => setNewProdMinStock(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg font-bold transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg shadow-sm transition-colors"
                >
                  {t.saveProduct}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STOCK ADJUST / RESTOCK TERM */}
      {showAdjustModal && selectedProductToAdjust && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <span className="font-display font-bold text-xs uppercase tracking-wide text-amber-400">
                {t.updateStock}: {currentLanguage === 'sw' ? selectedProductToAdjust.nameSw : selectedProductToAdjust.nameEn}
              </span>
              <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustStockSubmit} className="p-5 space-y-4 text-xs text-slate-700">
              {formError && (
                <div className="bg-rose-100 border border-rose-300 p-2.5 rounded-lg text-rose-800 font-bold">
                  {formError}
                </div>
              )}

              {/* Action tabs */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Adjustment Type</label>
                <div className="flex bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAdjustType('in')}
                    className={`flex-1 py-1.5 text-center font-bold rounded-lg transition-all ${
                      adjustType === 'in' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Stock In
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('out')}
                    className={`flex-1 py-1.5 text-center font-bold rounded-lg transition-all ${
                      adjustType === 'out' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Stock Out
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('adjustment')}
                    className={`flex-1 py-1.5 text-center font-bold rounded-lg transition-all ${
                      adjustType === 'adjustment' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Manual Adjust
                  </button>
                </div>
              </div>

              {/* Quantity input */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Quantity ({selectedProductToAdjust.unit === 'kg' ? 'Kg' : 'pcs'})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  min="0.01"
                  value={adjustQtyInput}
                  onChange={(e) => setAdjustQtyInput(e.target.value)}
                  placeholder={`Enter amount to ${adjustType}`}
                  className="w-full border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50 font-mono font-bold text-slate-800"
                />
              </div>

              {/* Extra conditional items for STOCK IN */}
              {adjustType === 'in' && (
                <div className="space-y-3.5 bg-slate-50 p-3 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-1 duration-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1 mb-2">
                    Purchase Details (Invoice Log)
                  </p>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Supplier (Optional)</label>
                    <input
                      type="text"
                      value={adjustSupplier}
                      onChange={(e) => setAdjustSupplier(e.target.value)}
                      placeholder="e.g. Kahama Mills Ltd"
                      className="w-full border border-slate-250 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Purchase Cost per unit (TSh)</label>
                    <input
                      type="number"
                      value={adjustCostInput}
                      onChange={(e) => setAdjustCostInput(e.target.value)}
                      placeholder="Invoice price per unit"
                      className="w-full border border-slate-250 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white font-mono font-bold text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Reason / Notes */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Notes / Reason for Adjustment</label>
                <textarea
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g., Supplier bulk purchase, dampness spoilage, missing bags discovered in audit..."
                  rows={2}
                  className="w-full border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50 text-slate-750 font-medium"
                />
              </div>

              <div className="pt-2 border-t border-slate-150 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg font-bold transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors shadow-sm"
                >
                  Apply Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
