/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Category, Product, Transaction, StockMovement, PurchaseRecord, ShopSettings, AuditLog, UnitType, PaymentMethod } from './types';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-grain', nameEn: 'Grains & Legumes', nameSw: 'Nafaka na Mikunde' },
  { id: 'cat-flour', nameEn: 'Flours (Unga)', nameSw: 'Unga wa Lishe' },
  { id: 'cat-beverage', nameEn: 'Beverages & Water', nameSw: 'Vinywaji na Maji' },
  { id: 'cat-household', nameEn: 'Household & Retail', nameSw: 'Bidhaa za Nyumbani' },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-rice-kyela',
    nameEn: 'Rice - Kyela Super',
    nameSw: 'Mchele wa Kyela (Super)',
    categoryId: 'cat-grain',
    sku: 'GRN-MCH-001',
    purchasePrice: 2100,
    sellingPrice: 2800,
    unit: 'kg',
    currentStock: 1250,
    minStockAlert: 150,
  },
  {
    id: 'prod-maize-dry',
    nameEn: 'Maize Grains (Dry)',
    nameSw: 'Mahindi Makavu',
    categoryId: 'cat-grain',
    sku: 'GRN-MAH-002',
    purchasePrice: 750,
    sellingPrice: 1100,
    unit: 'kg',
    currentStock: 2500,
    minStockAlert: 300,
  },
  {
    id: 'prod-beans-mbeya',
    nameEn: 'Beans - Mbeya Red',
    nameSw: 'Maharage ya Mbeya (Yekundu)',
    categoryId: 'cat-grain',
    sku: 'GRN-MHR-003',
    purchasePrice: 2200,
    sellingPrice: 3000,
    unit: 'kg',
    currentStock: 680,
    minStockAlert: 100,
  },
  {
    id: 'prod-sugar-kilombero',
    nameEn: 'Sugar - Kilombero',
    nameSw: 'Sukari ya Kilombero',
    categoryId: 'cat-household',
    sku: 'HSD-SUK-001',
    purchasePrice: 2600,
    sellingPrice: 3200,
    unit: 'kg',
    currentStock: 800,
    minStockAlert: 120,
  },
  {
    id: 'prod-wheat-azam',
    nameEn: 'Wheat Flour - Azam 2Kg',
    nameSw: 'Unga wa Ngano - Azam (2Kg)',
    categoryId: 'cat-flour',
    sku: 'FLR-NGN-001',
    purchasePrice: 3100,
    sellingPrice: 3800,
    unit: 'full',
    currentStock: 150,
    minStockAlert: 30,
  },
  {
    id: 'prod-maize-pembe',
    nameEn: 'Maize Flour - Pembe 5Kg',
    nameSw: 'Unga wa Sembe - Pembe (5Kg)',
    categoryId: 'cat-flour',
    sku: 'FLR-SMB-002',
    purchasePrice: 6500,
    sellingPrice: 7800,
    unit: 'full',
    currentStock: 220,
    minStockAlert: 40,
  },
  {
    id: 'prod-oil-korie',
    nameEn: 'Cooking Oil - Korie 5L',
    nameSw: 'Mafuta ya Kupikia - Korie (5L)',
    categoryId: 'cat-household',
    sku: 'HSD-MAF-002',
    purchasePrice: 21500,
    sellingPrice: 25500,
    unit: 'full',
    currentStock: 65,
    minStockAlert: 12,
  },
  {
    id: 'prod-salt-table',
    nameEn: 'Iodized Table Salt',
    nameSw: 'Chumvi ya Chakula (Kensalt)',
    categoryId: 'cat-household',
    sku: 'HSD-CHU-003',
    purchasePrice: 450,
    sellingPrice: 700,
    unit: 'full',
    currentStock: 300,
    minStockAlert: 50,
  },
  {
    id: 'prod-water-afya',
    nameEn: 'Afya Drinking Water 1.5L',
    nameSw: 'Maji ya Kunywa ya Afya (1.5L)',
    categoryId: 'cat-beverage',
    sku: 'BEV-MAJ-001',
    purchasePrice: 600,
    sellingPrice: 1000,
    unit: 'full',
    currentStock: 480,
    minStockAlert: 60,
  },
  {
    id: 'prod-coca-soda',
    nameEn: 'Coca-Cola Soda 350ml',
    nameSw: 'Soda ya Coca-Cola (350ml)',
    categoryId: 'cat-beverage',
    sku: 'BEV-SOD-002',
    purchasePrice: 700,
    sellingPrice: 1000,
    unit: 'full',
    currentStock: 360,
    minStockAlert: 48,
  },
  {
    id: 'prod-soap-jamaa',
    nameEn: 'Jamaa Laundry Soap',
    nameSw: 'Sabuni ya Jamaa (Mche)',
    categoryId: 'cat-household',
    sku: 'HSD-SAB-004',
    purchasePrice: 1600,
    sellingPrice: 2200,
    unit: 'full',
    currentStock: 180,
    minStockAlert: 25,
  },
];

export const DEFAULT_SETTINGS: ShopSettings = {
  name: 'Kaberege Shop POS',
  address: 'Kariakoo Market, Msimbazi St, Dar es Salaam',
  phone: '+255 712 345 678',
  currency: 'TSh',
  taxRate: 18, // 18% VAT
  receiptMessageEn: 'Thank you for buying high quality grains from us! Welcome back.',
  receiptMessageSw: 'Asante kwa kununua nafaka bora kutoka kwetu! Karibu tena.',
};

export const MOCK_USERS = [
  { id: 'usr-admin', name: 'Mzee Layson', username: 'layson', role: 'admin' as const, status: 'active' as const, avatar: '👴' },
  { id: 'usr-cashier-1', name: 'Neema Kipendo', username: 'neema', role: 'cashier' as const, status: 'active' as const, avatar: '👩' },
  { id: 'usr-cashier-2', name: 'Baraka Shayo', username: 'baraka', role: 'cashier' as const, status: 'active' as const, avatar: '👨' },
  { id: 'usr-store', name: 'Juma Mwambene', username: 'juma', role: 'storekeeper' as const, status: 'active' as const, avatar: '🛠️' },
];

export function formatTSh(amount: number): string {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace('TZS', 'TSh');
}

// Pricing and Multipliers depending on sales unit chosen
export function getUnitMultiplierAndPrice(product: Product, selectedUnit: UnitType): { multiplier: number; price: number } {
  // Base price is product.sellingPrice per base unit (e.g. per Kg or per Full unit)
  const sellingPrice = product?.sellingPrice ?? 0;
  switch (selectedUnit) {
    case 'kg':
      return { multiplier: 1, price: sellingPrice };
    case 'g':
      // Grams sell at fractional price
      return { multiplier: 0.001, price: Math.ceil((sellingPrice / 1000) * 1.05) }; // minor premium for split
    case 'sack':
      // A sack is 50Kg of the product. Bulk wholesale discount applied (46x instead of 50x)
      return { multiplier: 50, price: Math.round(sellingPrice * 46) };
    case 'quarter':
      // Robo (0.25 Kg). Rounded up slightly to the nearest 50 TSh
      return { multiplier: 0.25, price: Math.ceil((sellingPrice * 0.25) / 50) * 50 };
    case 'half':
      // Nusu (0.5 Kg). Rounded up to the nearest 50 TSh
      return { multiplier: 0.5, price: Math.ceil((sellingPrice * 0.5) / 50) * 50 };
    case 'full':
      return { multiplier: 1, price: sellingPrice };
    case 'custom':
    default:
      return { multiplier: 1, price: sellingPrice };
  }
}

// Generate past 30 days transactions programmatically to fill the charts nicely
export function generateHistoricTransactions(products: Product[]): {
  transactions: Transaction[];
  stockMovements: StockMovement[];
  purchases: PurchaseRecord[];
  auditLogs: AuditLog[];
} {
  const transactions: Transaction[] = [];
  const stockMovements: StockMovement[] = [];
  const purchases: PurchaseRecord[] = [];
  const auditLogs: AuditLog[] = [];

  const now = new Date();
  let receiptCounter = 10000;

  // Let's seed initial purchases 31 days ago (Restocking the shop)
  const initialPurchaseDate = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
  const purchaseItems = products.map((p) => ({
    productId: p.id,
    productNameEn: p.nameEn,
    productNameSw: p.nameSw,
    quantity: p.currentStock + 1000, // bought more than current stock so past sales could happen
    unitPrice: p.purchasePrice,
    totalPrice: (p.currentStock + 1000) * p.purchasePrice,
  }));
  const totalCost = purchaseItems.reduce((acc, curr) => acc + curr.totalPrice, 0);

  purchases.push({
    id: 'purch-initial',
    date: initialPurchaseDate.toISOString(),
    supplier: 'Kahama Rice Mills & Kilombero Growers',
    items: purchaseItems,
    totalCost,
    recordedBy: 'Juma Mwambene',
    invoiceNo: 'INV-2026-981',
  });

  // Seed purchase movements
  purchaseItems.forEach((itm) => {
    stockMovements.push({
      id: `mvt-purch-${itm.productId}`,
      productId: itm.productId,
      productNameEn: itm.productNameEn,
      productNameSw: itm.productNameSw,
      type: 'in',
      quantity: itm.quantity,
      remainingStock: itm.quantity,
      date: initialPurchaseDate.toISOString(),
      recordedBy: 'Juma Mwambene',
      notes: 'Initial bulk supply purchase stock-in',
    });
  });

  // Programmatically loop over the last 30 days
  for (let d = 30; d >= 0; d--) {
    const currentDate = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    // Set realistic timing (e.g. active from 8:00 AM to 6:30 PM)
    const baseHour = 8;
    
    // Weekend (Sat, Sun) has more sales volume in Kariakoo!
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const salesNum = isWeekend ? Math.floor(Math.random() * 8) + 12 : Math.floor(Math.random() * 6) + 8; // 12-20 sales on weekend, 8-14 on weekdays

    for (let s = 0; s < salesNum; s++) {
      receiptCounter++;
      const saleHour = baseHour + Math.floor((s / salesNum) * 10) + (Math.random() > 0.5 ? 1 : 0);
      const saleMinute = Math.floor(Math.random() * 60);
      const saleSecond = Math.floor(Math.random() * 60);
      const saleDate = new Date(currentDate);
      saleDate.setHours(saleHour, saleMinute, saleSecond);

      // Select cashier
      const cashier = MOCK_USERS[Math.floor(Math.random() * 2) + 1]; // Neema or Baraka

      // Choose 1 to 4 random products for this basket
      const itemsCount = Math.floor(Math.random() * 3) + 1;
      const selectedProducts: Product[] = [];
      while (selectedProducts.length < itemsCount) {
        const randProd = products[Math.floor(Math.random() * products.length)];
        if (!selectedProducts.find((p) => p.id === randProd.id)) {
          selectedProducts.push(randProd);
        }
      }

      const txItems = selectedProducts.map((p) => {
        // Decide a unit
        let sellUnit: UnitType = 'full';
        if (p.unit === 'kg') {
          const randUnit = Math.random();
          if (randUnit < 0.2) sellUnit = 'sack';
          else if (randUnit < 0.4) sellUnit = 'half';
          else if (randUnit < 0.6) sellUnit = 'quarter';
          else sellUnit = 'kg';
        }

        const info = getUnitMultiplierAndPrice(p, sellUnit);
        // Decide quantity
        let qty = 1;
        if (sellUnit === 'kg') qty = Math.floor(Math.random() * 5) + 1; // 1 to 5 Kg
        else if (sellUnit === 'quarter' || sellUnit === 'half') qty = Math.floor(Math.random() * 4) + 1; // 1 to 4 portions
        else if (sellUnit === 'sack') qty = Math.floor(Math.random() * 2) + 1; // 1 to 2 bags
        else qty = Math.floor(Math.random() * 3) + 1; // 1 to 3 items

        const totalPrice = info.price * qty;

        return {
          productId: p.id,
          productNameEn: p.nameEn,
          productNameSw: p.nameSw,
          quantity: qty,
          selectedUnit: sellUnit,
          unitPrice: info.price,
          totalPrice,
          purchasePriceAtSale: p.purchasePrice,
          unitMultiplier: info.multiplier,
        };
      });

      const subtotal = txItems.reduce((acc, itm) => acc + itm.totalPrice, 0);
      
      // Random discount (maybe 5% discount or zero)
      const giveDiscount = Math.random() < 0.25;
      const discount = giveDiscount ? Math.round((subtotal * 0.05) / 100) * 100 : 0; // round to nearest 100
      const vatRate = 0.18; // 18% VAT included
      const taxableAmount = subtotal - discount;
      const tax = Math.round(taxableAmount - taxableAmount / (1 + vatRate));
      const total = taxableAmount; // total paid

      // Payment method selection
      const payMethods: PaymentMethod[] = ['cash', 'mpesa', 'tigopesa', 'airtelmoney', 'halopesa', 'bank'];
      const payWeights = [0.45, 0.25, 0.15, 0.08, 0.02, 0.05]; // cash and M-Pesa dominate
      let cumulative = 0;
      const randPay = Math.random();
      let paymentMethod: PaymentMethod = 'cash';
      for (let i = 0; i < payMethods.length; i++) {
        cumulative += payWeights[i];
        if (randPay <= cumulative) {
          paymentMethod = payMethods[i];
          break;
        }
      }

      const isCancelled = d > 0 && Math.random() < 0.015; // 1.5% past sales get cancelled by Admin for audit log demonstration!
      
      const transaction: Transaction = {
        id: `tx-${receiptCounter}`,
        receiptNo: `KGD-${receiptCounter}`,
        date: saleDate.toISOString(),
        cashierId: cashier.id,
        cashierName: cashier.name,
        items: txItems,
        subtotal,
        discount,
        tax,
        total,
        paymentMethod,
        customerName: Math.random() > 0.6 ? ['Bakhresa', 'Mama Maria', 'Hassan', 'Suleiman', 'Aisha', 'John Mwita'][Math.floor(Math.random() * 6)] : undefined,
        status: isCancelled ? 'cancelled' : 'completed',
        cancelledBy: isCancelled ? 'Mzee Layson' : undefined,
        cancelledReason: isCancelled ? 'Incorrect item selected / Cash input error' : undefined,
      };

      transactions.push(transaction);

      // Record stock movements and adjust inventory
      txItems.forEach((itm) => {
        const totalBaseQty = itm.quantity * itm.unitMultiplier;
        
        // Find stock index and subtract if completed
        const prod = products.find((p) => p.id === itm.productId);
        if (prod && !isCancelled) {
          prod.currentStock = Math.max(0, prod.currentStock - totalBaseQty);
        }

        stockMovements.push({
          id: `mvt-sale-${transaction.id}-${itm.productId}`,
          productId: itm.productId,
          productNameEn: itm.productNameEn,
          productNameSw: itm.productNameSw,
          type: isCancelled ? 'cancel_return' : 'sale',
          quantity: -totalBaseQty,
          remainingStock: prod ? prod.currentStock : 0,
          date: saleDate.toISOString(),
          recordedBy: cashier.name,
          notes: isCancelled ? `Cancelled receipt ${transaction.receiptNo}` : `Sale checkout - ${itm.quantity} ${itm.selectedUnit}`,
        });
      });
    }

    // Insert periodic Audit logs
    if (d % 3 === 0) {
      auditLogs.push({
        id: `audit-${d}`,
        date: currentDate.toISOString(),
        userId: 'usr-admin',
        userName: 'Mzee Layson',
        userRole: 'admin',
        actionEn: `Performed routine inventory audit for Day -${d}`,
        actionSw: `Alifanya ukaguzi wa kawaida wa stoo Siku -${d}`,
        details: `Inspected categories, validated electronic counts with cash logs`,
      });
    }
  }

  return {
    transactions,
    stockMovements: stockMovements.reverse(), // newest first
    purchases,
    auditLogs: auditLogs.reverse(),
  };
}


