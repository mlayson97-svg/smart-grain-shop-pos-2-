/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'cashier' | 'storekeeper';
export type Language = 'en' | 'sw';

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  status: 'active' | 'inactive';
  avatar?: string;
  email?: string;
}

export type UnitType = 'kg' | 'g' | 'sack' | 'quarter' | 'half' | 'full' | 'custom';

export interface Category {
  id: string;
  nameEn: string;
  nameSw: string;
}

export interface Product {
  id: string;
  nameEn: string;
  nameSw: string;
  categoryId?: string;
  sku: string;
  purchasePrice: number; // cost price in TSh (for profit calculations)
  sellingPrice: number;  // base selling price in TSh
  unit: UnitType;        // base inventory unit
  currentStock: number;  // available quantity in base unit
  minStockAlert: number; // quantity threshold for low-stock alerts
  lastPurchasedDate?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;       // quantity in selected unit
  selectedUnit: UnitType; // chosen unit for selling
  unitMultiplier: number; // coefficient to convert chosen unit to base unit (e.g., Sack = 50, Quarter = 0.25)
  sellingPrice: number;   // price per chosen unit
}

export type PaymentMethod = 'cash' | 'mpesa' | 'tigopesa' | 'airtelmoney' | 'halopesa' | 'bank';

export interface TransactionItem {
  productId: string;
  productNameEn: string;
  productNameSw: string;
  quantity: number;       // sold quantity in selected unit
  selectedUnit: UnitType;
  unitPrice: number;      // price of selected unit at sale
  totalPrice: number;     // final total
  purchasePriceAtSale: number; // cost price per base unit at time of sale (for retrospect profit)
  unitMultiplier: number; // multiplier to base unit
}

export interface Transaction {
  id: string;
  receiptNo: string;
  date: string;
  cashierId: string;
  cashierName: string;
  items: TransactionItem[];
  subtotal: number;
  discount: number; // in TSh
  tax: number;      // in TSh
  total: number;    // final paid amount
  paymentMethod: PaymentMethod;
  customerName?: string;
  status: 'completed' | 'cancelled';
  cancelledBy?: string;
  cancelledReason?: string;
  offlineSynced?: boolean;
}

export interface StockMovement {
  id: string;
  productId: string;
  productNameEn: string;
  productNameSw: string;
  type: 'in' | 'out' | 'sale' | 'adjustment' | 'cancel_return';
  quantity: number; // base unit change (+ for stock in, - for stock out)
  remainingStock: number;
  date: string;
  recordedBy: string;
  notes?: string;
}

export interface PurchaseRecord {
  id: string;
  date: string;
  supplier?: string;
  items: {
    productId: string;
    productNameEn: string;
    productNameSw: string;
    quantity: number;   // base unit quantity purchased
    unitPrice: number;  // cost per base unit
    totalPrice: number;
  }[];
  totalCost: number;
  recordedBy: string;
  invoiceNo?: string;
}

export interface ShopSettings {
  name: string;
  address: string;
  phone: string;
  currency: string;
  taxRate: number; // percentage (e.g. 18 for VAT, 0 for tax-free)
  receiptMessageEn: string;
  receiptMessageSw: string;
  logoUrl?: string;
}

export interface AuditLog {
  id: string;
  date: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  actionEn: string;
  actionSw: string;
  details?: string;
}
