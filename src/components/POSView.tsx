/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Product, Category, CartItem, PaymentMethod, Transaction, User, ShopSettings, UnitType } from '../types';
import { translations } from '../translations';
import { getUnitMultiplierAndPrice, formatTSh } from '../mockData';
import { Search, ShoppingCart, Trash2, Plus, Minus, Tag, Check, Receipt, RefreshCw, X, AlertCircle, Printer, Download } from 'lucide-react';
import { downloadReceiptPDF } from '../utils/receiptPdf';

interface POSViewProps {
  currentLanguage: Language;
  currentUser: User;
  products: Product[];
  categories: Category[];
  settings: ShopSettings;
  onAddTransaction: (tx: Transaction, updatedProducts: Product[]) => void;
}

type Language = 'en' | 'sw';

export default function POSView({
  currentLanguage,
  currentUser,
  products,
  categories,
  settings,
  onAddTransaction,
}: POSViewProps) {
  const t = translations[currentLanguage];

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountInput, setDiscountInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  // Unit Selector Modal State (for products that can be sold by split units like Kg, sacks, half, quarter)
  const [activeConfigProduct, setActiveConfigProduct] = useState<Product | null>(null);
  const [selectedSellUnit, setSelectedSellUnit] = useState<UnitType>('kg');
  const [unitQuantity, setUnitQuantity] = useState<number>(1);

  // Completed Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastCompletedTransaction, setLastCompletedTransaction] = useState<Transaction | null>(null);

  // Toast / Status banner
  const [posError, setPosError] = useState<string | null>(null);
  const [posSuccess, setPosSuccess] = useState<string | null>(null);

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
      const lowerQuery = searchQuery.toLowerCase();
      const matchSearch =
        p.nameEn.toLowerCase().includes(lowerQuery) ||
        p.nameSw.toLowerCase().includes(lowerQuery) ||
        p.sku.toLowerCase().includes(lowerQuery);
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Click on a product card
  const handleProductClick = (product: Product) => {
    if (product.currentStock <= 0) {
      triggerError(`${currentLanguage === 'sw' ? product.nameSw : product.nameEn} ${t.noStock}`);
      return;
    }

    if (product.unit === 'kg') {
      // Bring up unit selection modal (since grains are sold in sacks, Kgs, halves, quarters, etc.)
      setActiveConfigProduct(product);
      setSelectedSellUnit('kg');
      setUnitQuantity(1);
    } else {
      // Fast-add single unit items (like beverages, soap packs, etc.)
      addProductToCart(product, 'full', 1);
    }
  };

  // Logic to add item with specified unit configuration to cart
  const addProductToCart = (product: Product, sellUnit: UnitType, qty: number) => {
    const pricingInfo = getUnitMultiplierAndPrice(product, sellUnit);
    const baseUnitRequired = qty * pricingInfo.multiplier;

    // Check if total required base unit exceeds stock, taking already-carted items of this product into account
    const alreadyCartedBaseQty = cart
      .filter((item) => item.product.id === product.id)
      .reduce((acc, item) => acc + item.quantity * item.unitMultiplier, 0);

    if (alreadyCartedBaseQty + baseUnitRequired > product.currentStock) {
      triggerError(t.invalidQty);
      return;
    }

    // Check if matching unit already exists in cart, if yes increment it
    const existingIndex = cart.findIndex(
      (item) => item.product.id === product.id && item.selectedUnit === sellUnit
    );

    if (existingIndex > -1) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += qty;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          product,
          quantity: qty,
          selectedUnit: sellUnit,
          unitMultiplier: pricingInfo.multiplier,
          sellingPrice: pricingInfo.price,
        },
      ]);
    }

    setPosSuccess(`${currentLanguage === 'sw' ? product.nameSw : product.nameEn} -> ${t.cart}`);
    setTimeout(() => setPosSuccess(null), 1500);
    setActiveConfigProduct(null);
  };

  // Quick error flash
  const triggerError = (msg: string) => {
    setPosError(msg);
    setTimeout(() => setPosError(null), 3000);
  };

  // Cart quantity controls
  const handleUpdateCartQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveCartItem(index);
      return;
    }

    const item = cart[index];
    const diffQty = newQty - item.quantity;
    const baseUnitsDiff = diffQty * item.unitMultiplier;

    // Total already carted (excluding this index)
    const otherCartedBaseQty = cart
      .filter((cItm, idx) => cItm.product.id === item.product.id && idx !== index)
      .reduce((acc, cItm) => acc + cItm.quantity * cItm.unitMultiplier, 0);

    if (otherCartedBaseQty + newQty * item.unitMultiplier > item.product.currentStock) {
      triggerError(t.invalidQty);
      return;
    }

    const newCart = [...cart];
    newCart[index].quantity = newQty;
    setCart(newCart);
  };

  const handleRemoveCartItem = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const handleClearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setDiscountInput('');
    setCustomerName('');
  };

  // Math summary
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.sellingPrice * item.quantity, 0);
  }, [cart]);

  const taxAmount = useMemo(() => {
    // VAT rate (e.g. 18%) is included in the selling price
    const taxableAmount = subtotal - discountAmount;
    if (taxableAmount <= 0) return 0;
    return Math.round(taxableAmount - taxableAmount / (1 + settings.taxRate / 100));
  }, [subtotal, discountAmount, settings.taxRate]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  // Apply discount input
  const handleApplyDiscount = () => {
    const parsed = parseInt(discountInput);
    if (!isNaN(parsed) && parsed >= 0) {
      if (parsed > subtotal) {
        triggerError('Discount cannot exceed subtotal!');
        return;
      }
      setDiscountAmount(parsed);
    } else {
      setDiscountAmount(0);
      setDiscountInput('');
    }
  };

  // Checkout Execution
  const handleCheckout = () => {
    if (cart.length === 0) return;

    // Create a copy of products list to decrement stocks
    const updatedProductsList = [...products];
    const txItems = cart.map((item) => {
      // Find and subtract stock
      const prodIdx = updatedProductsList.findIndex((p) => p.id === item.product.id);
      if (prodIdx > -1) {
        const consumedBaseQty = item.quantity * item.unitMultiplier;
        updatedProductsList[prodIdx] = {
          ...updatedProductsList[prodIdx],
          currentStock: Math.max(0, updatedProductsList[prodIdx].currentStock - consumedBaseQty),
        };
      }

      return {
        productId: item.product.id,
        productNameEn: item.product.nameEn,
        productNameSw: item.product.nameSw,
        quantity: item.quantity,
        selectedUnit: item.selectedUnit,
        unitPrice: item.sellingPrice,
        totalPrice: item.sellingPrice * item.quantity,
        purchasePriceAtSale: item.product.purchasePrice,
        unitMultiplier: item.unitMultiplier,
      };
    });

    const receiptNo = `KGD-${Date.now().toString().slice(-5)}`;

    const transaction: Transaction = {
      id: `tx-${Date.now()}`,
      receiptNo,
      date: new Date().toISOString(),
      cashierId: currentUser.id,
      cashierName: currentUser.name,
      items: txItems,
      subtotal,
      discount: discountAmount,
      tax: taxAmount,
      total: grandTotal,
      paymentMethod,
      customerName: customerName.trim() || undefined,
      status: 'completed',
    };

    // Save transaction state up to parent app
    onAddTransaction(transaction, updatedProductsList);

    // Prompt receipt view
    setLastCompletedTransaction(transaction);
    setShowReceiptModal(true);

    // Clear POS desk
    handleClearCart();
    setPosSuccess(t.checkoutSuccess);
    setTimeout(() => setPosSuccess(null), 3000);
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-65px)] overflow-hidden font-sans">
      
      {/* LEFT PANEL: PRODUCT SHELF (60%) */}
      <div className="flex-1 flex flex-col bg-slate-50 p-4 overflow-y-auto border-r border-slate-200">
        
        {/* Alerts & Errors */}
        {posError && (
          <div className="mb-3 bg-rose-150 border-l-4 border-rose-600 p-3 rounded-r-lg flex items-center gap-2 shadow-sm animate-bounce text-slate-800 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            {posError}
          </div>
        )}
        {posSuccess && (
          <div className="mb-3 bg-emerald-100 border-l-4 border-emerald-600 p-3 rounded-r-lg flex items-center gap-2 shadow-sm text-slate-800 text-xs font-semibold">
            <Check className="w-4 h-4 text-emerald-600" />
            {posSuccess}
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4 bg-white p-3 rounded-xl shadow-sm border border-slate-150">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-250 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-slate-700 bg-slate-50"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.allCategories}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {currentLanguage === 'sw' ? cat.nameSw : cat.nameEn}
              </button>
            ))}
          </div>
        </div>

        {/* Product Card Shelf */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredProducts.map((product) => {
            const isLow = product.currentStock <= product.minStockAlert && product.currentStock > 0;
            const isOut = product.currentStock <= 0;

            return (
              <div
                key={product.id}
                onClick={() => handleProductClick(product)}
                className={`group cursor-pointer bg-white rounded-xl border p-3 hover:shadow-md transition-all flex flex-col justify-between ${
                  isOut
                    ? 'border-rose-300 bg-rose-50/20 opacity-75'
                    : isLow
                    ? 'border-amber-300 bg-amber-50/10'
                    : 'border-slate-200 hover:border-amber-400'
                }`}
              >
                <div>
                  {/* Stock tag */}
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md border border-slate-200/50">
                      {product.sku}
                    </span>
                    {isOut ? (
                      <span className="text-[9px] font-bold bg-rose-600 text-white px-2 py-0.5 rounded-md">
                        {t.noStock}
                      </span>
                    ) : isLow ? (
                      <span className="text-[9px] font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md animate-pulse">
                        {product.currentStock} {product.unit === 'kg' ? 'Kg' : 'pcs'}
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                        {product.currentStock} {product.unit === 'kg' ? 'Kg' : 'pcs'}
                      </span>
                    )}
                  </div>

                  <h3 className="font-display font-bold text-slate-900 text-sm tracking-tight leading-tight group-hover:text-amber-600 transition-colors">
                    {currentLanguage === 'sw' ? product.nameSw : product.nameEn}
                  </h3>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-baseline">
                  <span className="text-[10px] text-slate-500 font-sans font-medium uppercase">
                    per {product.unit === 'kg' ? 'Kg' : 'unit'}
                  </span>
                  <span className="font-mono font-bold text-slate-950 text-sm">
                    {formatTSh(product.sellingPrice)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <span className="text-4xl text-slate-300">🌾</span>
            <p className="text-slate-400 text-xs font-semibold mt-3">{t.reportNoData}</p>
          </div>
        )}

      </div>

      {/* RIGHT PANEL: CHECKOUT DESK (40%) */}
      <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col justify-between shadow-lg">
        
        {/* Basket Header */}
        <div className="p-3 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-amber-400" />
            <h2 className="font-display font-bold text-xs uppercase tracking-wider">{t.cart}</h2>
          </div>
          <span className="bg-amber-500 text-slate-950 text-xs font-bold px-2 py-0.5 rounded-full">
            {cart.length}
          </span>
        </div>

        {/* Basket Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-20 text-center">
              <ShoppingCart className="w-10 h-10 text-slate-300 mb-2 stroke-[1.5]" />
              <p className="text-slate-400 text-xs font-semibold">{t.cartEmpty}</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={`${item.product.id}-${item.selectedUnit}-${idx}`} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-display font-bold text-slate-900 text-xs leading-snug">
                      {currentLanguage === 'sw' ? item.product.nameSw : item.product.nameEn}
                    </h4>
                    <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                      {t[item.selectedUnit as keyof typeof t] || item.selectedUnit} @ {formatTSh(item.sellingPrice)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveCartItem(idx)}
                    className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Adjuster controls */}
                <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleUpdateCartQty(idx, item.quantity - 1)}
                      className="p-1 border border-slate-300 hover:border-amber-500 rounded text-slate-600 hover:bg-slate-100"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono font-bold text-xs text-slate-900 w-8 text-center bg-slate-50 py-0.5 rounded border border-slate-200">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateCartQty(idx, item.quantity + 1)}
                      className="p-1 border border-slate-300 hover:border-amber-500 rounded text-slate-600 hover:bg-slate-100"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="font-mono font-bold text-xs text-slate-900">
                    {formatTSh(item.sellingPrice * item.quantity)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Customer & Discounts Info */}
        <div className="p-3 border-t border-slate-200 bg-white space-y-3">
          {/* Customer Input */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.customerName}</label>
            <input
              type="text"
              placeholder="e.g. Mama Maria, Haji"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full text-xs font-medium border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-700 bg-slate-50/50"
            />
          </div>

          {/* Discount Block */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.discount}</label>
            <div className="flex gap-1.5">
              <input
                type="number"
                placeholder="e.g. 1000"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                className="flex-1 text-xs font-mono font-bold border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-700 bg-slate-50/50"
              />
              <button
                onClick={handleApplyDiscount}
                className="px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Apply
              </button>
            </div>
            {discountAmount > 0 && (
              <div className="mt-1 flex justify-between items-center text-[10px] bg-amber-50 text-amber-800 px-2 py-1 rounded border border-amber-200">
                <span className="font-medium">Applied Discount:</span>
                <span className="font-bold font-mono">-{formatTSh(discountAmount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Calculation Table & Check out */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-2">
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>{t.subtotal}</span>
              <span className="font-mono font-medium text-slate-900">{formatTSh(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-amber-600 font-medium">
                <span>{t.discount}</span>
                <span className="font-mono">-{formatTSh(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-[10px]">
              <span>{t.tax} ({settings.taxRate}% included)</span>
              <span className="font-mono text-slate-900">{formatTSh(taxAmount)}</span>
            </div>
          </div>

          <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
            <span className="font-display font-bold text-slate-900 text-xs uppercase">{t.total}</span>
            <span className="font-mono font-extrabold text-slate-950 text-base">
              {formatTSh(grandTotal)}
            </span>
          </div>

          {/* Payment Methods Bar */}
          <div className="pt-2">
            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">
              {t.payMethod}
            </label>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'cash', label: 'Cash', color: 'bg-emerald-500/10 border-emerald-500 text-emerald-700 font-bold hover:bg-emerald-500/20' },
                { id: 'mpesa', label: 'M-Pesa', color: 'bg-rose-500/10 border-rose-500 text-rose-700 font-bold hover:bg-rose-500/20' },
                { id: 'tigopesa', label: 'Tigo Pesa', color: 'bg-blue-500/10 border-blue-500 text-blue-700 font-bold hover:bg-blue-500/20' },
                { id: 'airtelmoney', label: 'Airtel', color: 'bg-red-500/10 border-red-500 text-red-700 font-bold hover:bg-red-500/20' },
                { id: 'halopesa', label: 'HaloPesa', color: 'bg-orange-500/10 border-orange-500 text-orange-700 font-bold hover:bg-orange-500/20' },
                { id: 'bank', label: 'Benki/Lipa', color: 'bg-indigo-500/10 border-indigo-500 text-indigo-700 font-bold hover:bg-indigo-500/20' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setPaymentMethod(item.id as PaymentMethod)}
                  className={`py-1.5 border rounded-lg text-[10px] text-center transition-all ${
                    paymentMethod === item.id
                      ? `${item.color} shadow-sm border-2 ring-1 ring-amber-400`
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Checkout triggers */}
          <div className="pt-2 flex gap-1.5">
            <button
              onClick={handleClearCart}
              disabled={cart.length === 0}
              className="px-3 border border-slate-300 hover:border-rose-400 text-slate-500 hover:text-rose-600 rounded-lg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed bg-white"
            >
              Futa
            </button>
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Receipt className="w-4 h-4" />
              {t.completeSale}
            </button>
          </div>
        </div>

      </div>

      {/* MODAL 1: GRAIN SPLIT UNIT SELECTION FOR BULK PRODUCTS */}
      {activeConfigProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-display font-bold text-slate-900 text-sm">
                  {currentLanguage === 'sw' ? activeConfigProduct.nameSw : activeConfigProduct.nameEn}
                </h3>
                <p className="text-[10px] text-slate-500">Base Unit price: {formatTSh(activeConfigProduct.sellingPrice)}/Kg</p>
              </div>
              <button
                onClick={() => setActiveConfigProduct(null)}
                className="p-1 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Choose Unit type */}
            <div className="space-y-3 text-xs text-slate-700">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Select Sales Unit</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'kg', label: 'Kilogram (Kg)', desc: '1.0x price' },
                    { id: 'sack', label: 'Gunia (Sack - 50Kg)', desc: 'Wholesale Discount' },
                    { id: 'half', label: 'Nusu (0.5Kg)', desc: 'Split Bag' },
                    { id: 'quarter', label: 'Robo (0.25Kg)', desc: 'Retail portion' },
                    { id: 'g', label: 'Gramu (g)', desc: '1g fractional' },
                  ].map((unit) => {
                    const priceInfo = getUnitMultiplierAndPrice(activeConfigProduct, unit.id as UnitType);
                    return (
                      <button
                        key={unit.id}
                        onClick={() => {
                          setSelectedSellUnit(unit.id as UnitType);
                        }}
                        className={`p-2.5 border rounded-xl text-left transition-all ${
                          selectedSellUnit === unit.id
                            ? 'bg-amber-50 border-amber-500 font-bold text-slate-900 shadow-sm ring-1 ring-amber-500'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        <p className="text-[11px] leading-tight">{unit.label}</p>
                        <p className="text-[9px] text-amber-700 font-bold font-mono mt-0.5">{formatTSh(priceInfo.price)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Enter Quantity */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Enter Quantity</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUnitQuantity(Math.max(1, unitQuantity - 1))}
                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    step={selectedSellUnit === 'g' ? '50' : '1'}
                    min="1"
                    value={unitQuantity}
                    onChange={(e) => setUnitQuantity(Math.max(1, parseFloat(e.target.value) || 1))}
                    className="flex-1 text-center font-mono font-bold border border-slate-300 rounded-lg py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    onClick={() => setUnitQuantity(unitQuantity + 1)}
                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Summary Calculations */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Unit price:</span>
                  <span className="font-semibold font-mono text-slate-800">
                    {formatTSh(getUnitMultiplierAndPrice(activeConfigProduct, selectedSellUnit).price)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Base Weight required:</span>
                  <span className="font-semibold font-mono text-slate-800">
                    {(getUnitMultiplierAndPrice(activeConfigProduct, selectedSellUnit).multiplier * unitQuantity).toFixed(3)} Kg
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 mt-2 border-t border-slate-200 font-bold">
                  <span className="text-slate-900">Total Price:</span>
                  <span className="text-amber-700 font-mono">
                    {formatTSh(getUnitMultiplierAndPrice(activeConfigProduct, selectedSellUnit).price * unitQuantity)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => addProductToCart(activeConfigProduct, selectedSellUnit, unitQuantity)}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-md transition-all mt-2"
              >
                {t.addToCart}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: THERMAL RECEIPT DISPLAY */}
      {showReceiptModal && lastCompletedTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
            
            {/* Header controls */}
            <div className="p-3 bg-slate-900 text-white flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 text-amber-400">
                <Receipt className="w-4 h-4" />
                {t.printReceipt}
              </span>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Receipt body */}
            <div className="flex-1 overflow-y-auto p-6 bg-stone-50" id="receipt-print-area">
              <div id="receipt-to-print" className="bg-white p-5 border border-stone-200 shadow-inner text-slate-850 font-mono text-xs space-y-4 max-w-xs mx-auto rounded-lg">
                
                {/* Shop Banner */}
                <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
                  <h2 className="font-bold text-sm tracking-tight">{settings.name}</h2>
                  <p className="text-[10px] leading-tight text-slate-600">{settings.address}</p>
                  <p className="text-[10px] text-slate-600">Simu: {settings.phone}</p>
                  <p className="text-[9px] font-semibold tracking-wider text-slate-500 uppercase mt-2">
                    ** RISITI / RECEIPT **
                  </p>
                </div>

                {/* Metadata */}
                <div className="space-y-0.5 text-[10px] text-slate-700">
                  <div className="flex justify-between">
                    <span>Namba:</span>
                    <span className="font-bold">{lastCompletedTransaction.receiptNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tarehe:</span>
                    <span>{new Date(lastCompletedTransaction.date).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Muuza:</span>
                    <span>{lastCompletedTransaction.cashierName}</span>
                  </div>
                  {lastCompletedTransaction.customerName && (
                    <div className="flex justify-between font-semibold">
                      <span>Mteja:</span>
                      <span>{lastCompletedTransaction.customerName}</span>
                    </div>
                  )}
                </div>

                {/* Items listing */}
                <table className="w-full text-[10px] border-t border-b border-dashed border-slate-300 py-2">
                  <thead>
                    <tr className="border-b border-dashed border-slate-200">
                      <th className="text-left font-bold pb-1">Maelezo (Item)</th>
                      <th className="text-center font-bold pb-1">Idadi</th>
                      <th className="text-right font-bold pb-1">Bei</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastCompletedTransaction.items.map((itm, idx) => (
                      <tr key={idx} className="border-b border-dashed border-stone-100 last:border-0">
                        <td className="py-1">
                          <p className="font-bold">{currentLanguage === 'sw' ? itm.productNameSw : itm.productNameEn}</p>
                          <span className="text-[8px] text-slate-500">
                            Unit: {t[itm.selectedUnit as keyof typeof t] || itm.selectedUnit}
                          </span>
                        </td>
                        <td className="text-center font-bold py-1">{itm.quantity}</td>
                        <td className="text-right font-mono py-1">{formatTSh(itm.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Financial Summary */}
                <div className="space-y-1 text-[10px] pt-1">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatTSh(lastCompletedTransaction.subtotal)}</span>
                  </div>
                  {lastCompletedTransaction.discount > 0 && (
                    <div className="flex justify-between text-amber-800 font-bold">
                      <span>Discount (Punguzo):</span>
                      <span>-{formatTSh(lastCompletedTransaction.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>Tax VAT included ({settings.taxRate}%):</span>
                    <span>{formatTSh(lastCompletedTransaction.tax)}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-sm border-t border-dashed border-slate-300 pt-2 text-slate-950">
                    <span>JUMLA / TOTAL:</span>
                    <span>{formatTSh(lastCompletedTransaction.total)}</span>
                  </div>
                </div>

                {/* Footer messages */}
                <div className="text-center space-y-1 pt-3 border-t border-dashed border-slate-350 text-[9px] text-slate-600 leading-tight">
                  <p className="font-semibold uppercase text-slate-900">
                    LIPA KWA: {lastCompletedTransaction.paymentMethod.toUpperCase()}
                  </p>
                  <p className="mt-2">
                    {currentLanguage === 'sw' ? settings.receiptMessageSw : settings.receiptMessageEn}
                  </p>
                  <p className="text-[8px] text-slate-400 mt-2 font-sans tracking-wide">
                    Powered by Kariakoo Grain POS - 2026
                  </p>
                </div>

              </div>
            </div>

            {/* Print trigger buttons */}
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                {t.printReceipt}
              </button>
              <button
                onClick={() => downloadReceiptPDF(lastCompletedTransaction, settings, currentLanguage)}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-xs font-bold transition-colors"
              >
                {t.close}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
