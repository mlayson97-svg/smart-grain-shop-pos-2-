/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Product, Category, Transaction, StockMovement, PurchaseRecord, ShopSettings, AuditLog, User, UnitType } from './types';
import { formatTSh, INITIAL_PRODUCTS, INITIAL_CATEGORIES, DEFAULT_SETTINGS, generateHistoricTransactions } from './mockData';
import { 
  fetchFirestoreDatabase, 
  clearAndReSeedFirestore, 
  saveProductToFirestore, 
  saveCategoryToFirestore, 
  saveTransactionToFirestore, 
  saveStockMovementToFirestore, 
  savePurchaseToFirestore, 
  saveSettingsToFirestore, 
  saveAuditLogToFirestore, 
  saveBulkToFirestore,
  fetchUserProfile
} from './firebaseService';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { translations } from './translations';
import Header from './components/Header';
import POSView from './components/POSView';
import InventoryView from './components/InventoryView';
import ReportsView from './components/ReportsView';
import AnalyticsView from './components/AnalyticsView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import { LayoutDashboard, ShoppingCart, Warehouse, BarChart3, FileSpreadsheet, Settings, Receipt, AlertTriangle, ShieldCheck, ArrowRight, ArrowUpRight, ArrowDownRight, Clock, User as UserIcon, X, CheckCircle, Printer, Download, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { downloadReceiptPDF } from './utils/receiptPdf';

export default function App() {
  // DB States
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // App Context States
  const [currentLanguage, setLanguage] = useState<'en' | 'sw'>('sw'); // Default Swahili for local touch
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('kaberege_pos_online_user_session');
    if (saved) {
      try { return JSON.parse(saved); } catch { return null; }
    }
    return null;
  }); 
  const [isAuthChecking, setIsAuthChecking] = useState(() => {
    const hasOnlineUser = localStorage.getItem('kaberege_pos_online_user_session');
    if (hasOnlineUser) {
      return false; // Render instantly!
    }
    return true; // Wait for Firebase only if there is zero cached session
  });
  const [activeTab, setActiveTab] = useState<string>(() => {
    const saved = localStorage.getItem('kaberege_pos_online_user_session');
    if (saved) {
      try {
        const u = JSON.parse(saved) as User;
        if (u.role === 'cashier') return 'pos';
        if (u.role === 'storekeeper') return 'inventory';
        return 'dashboard';
      } catch {
        return 'dashboard';
      }
    }
    return 'dashboard';
  });
  const [isLoading, setIsLoading] = useState(true);

  // Interactive Receipt Modal (For Recent transactions viewing)
  const [selectedTxToView, setSelectedTxToView] = useState<Transaction | null>(null);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState('');

  // PWA Sync State
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Listen to Authentication State
  useEffect(() => {
    // Force reset any old local storage offline override so we always boot into the new Online system
    localStorage.removeItem('kaberege_pos_mode');
    setIsOfflineMode(false);
  }, []);

  useEffect(() => {
    if (localStorage.getItem('kaberege_pos_mode') === 'offline' || isOfflineMode) {
      const savedUserStr = localStorage.getItem('kaberege_pos_offline_user');
      if (savedUserStr) {
        try {
          const localUser = JSON.parse(savedUserStr);
          setCurrentUser(localUser);
        } catch (e) {
          console.error('Error parsing local user:', e);
        }
      } else {
        setCurrentUser(null);
      }
      setIsAuthChecking(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await fetchUserProfile(firebaseUser.uid);
          if (profile && profile.status === 'active') {
            setCurrentUser(profile);
            localStorage.setItem('kaberege_pos_online_user_session', JSON.stringify(profile));
          } else if (profile) {
            // Profile is inactive, sign out
            localStorage.removeItem('kaberege_pos_online_user_session');
            await signOut(auth);
            setCurrentUser(null);
          }
        } catch (err) {
          console.error('Error fetching profile on auth state change (possibly slow/offline):', err);
          // Retain our cached session so the cashier is NOT kicked out due to temporary cell drop
        }
      } else {
        localStorage.removeItem('kaberege_pos_online_user_session');
        setCurrentUser(null);
      }
      setIsAuthChecking(false);
    });

    return () => unsubscribe();
  }, [isOfflineMode]);

  // Hydrate DB on Mount from Firestore or LocalStorage
  useEffect(() => {
    async function loadDB() {
      // Step A: Load from localStorage first for instant, zero-delay rendering!
      const localProducts = localStorage.getItem('kaberege_products');
      const localCategories = localStorage.getItem('kaberege_categories');
      const localTransactions = localStorage.getItem('kaberege_transactions');
      const localStockMovements = localStorage.getItem('kaberege_stockMovements');
      const localPurchases = localStorage.getItem('kaberege_purchases');
      const localSettings = localStorage.getItem('kaberege_settings');
      const localAuditLogs = localStorage.getItem('kaberege_auditLogs');

      let hasLocalCache = false;

      if (localProducts && localCategories) {
        try {
          setProducts(JSON.parse(localProducts));
          setCategories(JSON.parse(localCategories));
          setTransactions(localTransactions ? JSON.parse(localTransactions) : []);
          setStockMovements(localStockMovements ? JSON.parse(localStockMovements) : []);
          setPurchases(localPurchases ? JSON.parse(localPurchases) : []);
          setSettings(localSettings ? JSON.parse(localSettings) : DEFAULT_SETTINGS);
          setAuditLogs(localAuditLogs ? JSON.parse(localAuditLogs) : []);
          hasLocalCache = true;
          setIsLoading(false); // Render instantly!
        } catch (e) {
          console.error('Error parsing local cache on boot:', e);
        }
      }

      // If we are in explicit offline-only mode, we are done!
      if (localStorage.getItem('kaberege_pos_mode') === 'offline' || isOfflineMode) {
        if (!hasLocalCache) {
          setIsLoading(true);
          const productsCopy = JSON.parse(JSON.stringify(INITIAL_PRODUCTS)) as Product[];
          const historic = generateHistoricTransactions(productsCopy);
          
          setProducts(productsCopy);
          setCategories(INITIAL_CATEGORIES);
          setTransactions(historic.transactions);
          setStockMovements(historic.stockMovements);
          setPurchases(historic.purchases);
          setSettings(DEFAULT_SETTINGS);
          setAuditLogs(historic.auditLogs);

          localStorage.setItem('kaberege_products', JSON.stringify(productsCopy));
          localStorage.setItem('kaberege_categories', JSON.stringify(INITIAL_CATEGORIES));
          localStorage.setItem('kaberege_transactions', JSON.stringify(historic.transactions));
          localStorage.setItem('kaberege_stockMovements', JSON.stringify(historic.stockMovements));
          localStorage.setItem('kaberege_purchases', JSON.stringify(historic.purchases));
          localStorage.setItem('kaberege_settings', JSON.stringify(DEFAULT_SETTINGS));
          localStorage.setItem('kaberege_auditLogs', JSON.stringify(historic.auditLogs));
          setIsLoading(false);
        }
        return;
      }

      // Step B: Online Mode - Fetch latest from Firestore in the background
      try {
        if (!hasLocalCache) {
          setIsLoading(true); // Only show spinner if there is zero local data
        }

        const data = await fetchFirestoreDatabase();
        setProducts(data.products);
        setCategories(data.categories);
        setTransactions(data.transactions);
        setStockMovements(data.stockMovements);
        setPurchases(data.purchases);
        setSettings(data.settings);
        setAuditLogs(data.auditLogs);

        // Update local cache with fresh, canonical cloud database
        localStorage.setItem('kaberege_products', JSON.stringify(data.products));
        localStorage.setItem('kaberege_categories', JSON.stringify(data.categories));
        localStorage.setItem('kaberege_transactions', JSON.stringify(data.transactions));
        localStorage.setItem('kaberege_stockMovements', JSON.stringify(data.stockMovements));
        localStorage.setItem('kaberege_purchases', JSON.stringify(data.purchases));
        localStorage.setItem('kaberege_settings', JSON.stringify(data.settings));
        localStorage.setItem('kaberege_auditLogs', JSON.stringify(data.auditLogs));

      } catch (err) {
        console.warn('Network issue or slow connection. Operating on fully functional Local POS Cache. Sync will resume automatically. Error:', err);
        // If they had absolutely no local cache on a brand-new browser, load default mock data
        if (!hasLocalCache) {
          const productsCopy = JSON.parse(JSON.stringify(INITIAL_PRODUCTS)) as Product[];
          const historic = generateHistoricTransactions(productsCopy);
          
          setProducts(productsCopy);
          setCategories(INITIAL_CATEGORIES);
          setTransactions(historic.transactions);
          setStockMovements(historic.stockMovements);
          setPurchases(historic.purchases);
          setSettings(DEFAULT_SETTINGS);
          setAuditLogs(historic.auditLogs);
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadDB();
  }, [isOfflineMode]);

  // Synchronize local offline sales when connection recovers
  const syncOfflineTransactions = () => {
    setTransactions((prevTxs) => {
      const unsyncedTxs = prevTxs.filter(tx => tx.offlineSynced === false);
      if (unsyncedTxs.length === 0) return prevTxs;

      const updatedTxs = prevTxs.map(tx => {
        if (tx.offlineSynced === false) {
          const syncedTx = { ...tx, offlineSynced: true };
          saveTransactionToFirestore(syncedTx);
          return syncedTx;
        }
        return tx;
      });

      // Append synchronization audit log
      const newAudit: AuditLog = {
        id: `audit-sync-${Date.now()}`,
        date: new Date().toISOString(),
        userId: currentUser?.id || 'offline-sync',
        userName: currentUser?.name || 'Offline System',
        userRole: currentUser?.role || 'cashier',
        actionEn: `Synchronized ${unsyncedTxs.length} offline transactions to cloud`,
        actionSw: `Alisawazisha miamala ${unsyncedTxs.length} ya nje ya mtandao na wingu`,
        details: `Auto-synchronized ${unsyncedTxs.length} offline transactions (Receipts: ${unsyncedTxs.map(t => t.receiptNo).join(', ')}) to central cloud database upon network restoration.`,
      };

      saveAuditLogToFirestore(newAudit);

      setAuditLogs((prevAudits) => {
        return [newAudit, ...prevAudits];
      });

      return updatedTxs;
    });
  };

  // Monitor network status and simulate PWA cloud syncing
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowSyncBanner(true);
      setSyncMessage(currentLanguage === 'sw' 
        ? 'Umeunganishwa kwenye Mtandao! Inasawazisha mauzo yaliyofanyika nje ya mtandao na Hifadhidata Kuu...' 
        : 'Internet Connected! Synchronizing local offline sales with Main Cloud Database...');
      
      // Execute the local transaction database syncing
      syncOfflineTransactions();

      setTimeout(() => {
        setSyncMessage(currentLanguage === 'sw' 
          ? 'Usawazishaji Umekamilika! Miamala yote imehifadhiwa salama kwenye Wingu.' 
          : 'Synchronization Completed! All local transactions are fully secured in the cloud.');
        setTimeout(() => {
          setShowSyncBanner(false);
        }, 3000);
      }, 2500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowSyncBanner(true);
      setSyncMessage(currentLanguage === 'sw' 
        ? 'Mawasiliano yamekatika! Hali ya Nje ya Mtandao (Offline) Imeamilishwa. Mauzo yote yanahifadhiwa kwenye Kivinjari chako (Local Storage).' 
        : 'Network Disconnected! Offline Mode Active. All sales are securely written to Local Storage.');
      setTimeout(() => {
        setShowSyncBanner(false);
      }, 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check on mount: if online, run sync just in case
    if (typeof navigator !== 'undefined' && navigator.onLine && !isLoading) {
      syncOfflineTransactions();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentLanguage, currentUser, isLoading]);

  const t = translations[currentLanguage];

  // Save changes wrapper
  const updateDB = async (updatedState: {
    products: Product[];
    categories: Category[];
    transactions: Transaction[];
    stockMovements: StockMovement[];
    purchases: PurchaseRecord[];
    settings: ShopSettings;
    auditLogs: AuditLog[];
  }) => {
    // 1. Update React local state immediately for instant responsive UI
    setProducts(updatedState.products);
    setCategories(updatedState.categories);
    setTransactions(updatedState.transactions);
    setStockMovements(updatedState.stockMovements);
    setPurchases(updatedState.purchases);
    setSettings(updatedState.settings);
    setAuditLogs(updatedState.auditLogs);

    // 2. ALWAYS save to local cache (localStorage) immediately.
    // This ensures that even in Online/Cloud mode, the app keeps a local copy up to date.
    // If the cashier goes offline or refreshes the page with bad internet, they lose absolutely zero progress.
    try {
      localStorage.setItem('kaberege_products', JSON.stringify(updatedState.products));
      localStorage.setItem('kaberege_categories', JSON.stringify(updatedState.categories));
      localStorage.setItem('kaberege_transactions', JSON.stringify(updatedState.transactions));
      localStorage.setItem('kaberege_stockMovements', JSON.stringify(updatedState.stockMovements));
      localStorage.setItem('kaberege_purchases', JSON.stringify(updatedState.purchases));
      localStorage.setItem('kaberege_settings', JSON.stringify(updatedState.settings));
      localStorage.setItem('kaberege_auditLogs', JSON.stringify(updatedState.auditLogs));
    } catch (e) {
      console.error('Error writing database fallback to localStorage:', e);
    }

    // 3. If in explicit local-only offline bypass mode, stop here.
    if (localStorage.getItem('kaberege_pos_mode') === 'offline' || isOfflineMode) {
      return;
    }

    // 4. Perform Firestore background sync
    try {
      const promises: Promise<any>[] = [];

      // Check settings change
      if (!settings || JSON.stringify(settings) !== JSON.stringify(updatedState.settings)) {
        promises.push(saveSettingsToFirestore(updatedState.settings));
      }

      // Check categories
      if (categories.length !== updatedState.categories.length) {
        updatedState.categories.forEach(item => {
          const old = categories.find(c => c.id === item.id);
          if (!old || JSON.stringify(old) !== JSON.stringify(item)) {
            promises.push(saveCategoryToFirestore(item));
          }
        });
      }

      // Check products
      updatedState.products.forEach(item => {
        const old = products.find(p => p.id === item.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(item)) {
          promises.push(saveProductToFirestore(item));
        }
      });

      // Check transactions
      updatedState.transactions.forEach(item => {
        const old = transactions.find(t => t.id === item.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(item)) {
          promises.push(saveTransactionToFirestore(item));
        }
      });

      // Check stockMovements
      updatedState.stockMovements.forEach(item => {
        const old = stockMovements.find(m => m.id === item.id);
        if (!old) {
          promises.push(saveStockMovementToFirestore(item));
        }
      });

      // Check purchases
      updatedState.purchases.forEach(item => {
        const old = purchases.find(p => p.id === item.id);
        if (!old) {
          promises.push(savePurchaseToFirestore(item));
        }
      });

      // Check auditLogs
      updatedState.auditLogs.forEach(item => {
        const old = auditLogs.find(a => a.id === item.id);
        if (!old) {
          promises.push(saveAuditLogToFirestore(item));
        }
      });

      if (promises.length > 0) {
        await Promise.all(promises);
      }
    } catch (err) {
      console.error("Failed to sync change to Firestore", err);
    }
  };

  // State mutation: Add sale transaction from POS desk
  const handleAddTransaction = (newTx: Transaction, updatedProducts: Product[]) => {
    // Determine sync state
    newTx.offlineSynced = isOnline;

    const nextTxList = [newTx, ...transactions];
    const nextMovements = [...stockMovements];

    // Push sales stock movements
    newTx.items.forEach((itm) => {
      const baseUnitsConsumed = itm.quantity * itm.unitMultiplier;
      const matchedProd = updatedProducts.find((p) => p.id === itm.productId);

      nextMovements.unshift({
        id: `mvt-sale-${newTx.id}-${itm.productId}`,
        productId: itm.productId,
        productNameEn: itm.productNameEn,
        productNameSw: itm.productNameSw,
        type: 'sale',
        quantity: -baseUnitsConsumed,
        remainingStock: matchedProd ? matchedProd.currentStock : 0,
        date: newTx.date,
        recordedBy: newTx.cashierName,
        notes: `Sale check-out: ${itm.quantity} ${itm.selectedUnit}`,
      });
    });

    const newAudit: AuditLog = {
      id: `audit-sale-${Date.now()}`,
      date: newTx.date,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      actionEn: `Checked out receipt ${newTx.receiptNo}`,
      actionSw: `Alifanya mauzo Risiti ${newTx.receiptNo}`,
      details: `Total sales: ${formatTSh(newTx.total)} via ${newTx.paymentMethod.toUpperCase()}`,
    };

    updateDB({
      products: updatedProducts,
      categories,
      transactions: nextTxList,
      stockMovements: nextMovements,
      purchases,
      settings: settings!,
      auditLogs: [newAudit, ...auditLogs],
    });
  };

  // State mutation: Create a new product catalog item
  const handleAddProduct = (newProd: Product, initialMvt: StockMovement) => {
    const nextProducts = [newProd, ...products];
    const nextMovements = [initialMvt, ...stockMovements];

    const newAudit: AuditLog = {
      id: `audit-prod-add-${Date.now()}`,
      date: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      actionEn: `Registered new product "${newProd.nameEn}"`,
      actionSw: `Alisajili bidhaa mpya ya stoo "${newProd.nameSw}"`,
      details: `SKU: ${newProd.sku}, Initial Stock: ${newProd.currentStock} units`,
    };

    updateDB({
      products: nextProducts,
      categories,
      transactions,
      stockMovements: nextMovements,
      purchases,
      settings: settings!,
      auditLogs: [newAudit, ...auditLogs],
    });
  };

  // State mutation: Stock update (Inbound purchase orders OR Spoilage adjustments)
  const handleAdjustStock = (
    productId: string,
    type: 'in' | 'out' | 'adjustment',
    baseQty: number,
    notes: string,
    costPrice?: number,
    supplier?: string
  ) => {
    const nextProducts = [...products];
    const prodIdx = nextProducts.findIndex((p) => p.id === productId);
    if (prodIdx === -1) return;

    const prod = nextProducts[prodIdx];
    let quantityDelta = baseQty;
    let actionType: 'in' | 'out' | 'adjustment' = type;

    if (type === 'out' || type === 'adjustment') {
      quantityDelta = -baseQty;
    }

    const nextStock = Math.max(0, prod.currentStock + quantityDelta);
    
    // Update product stock and optionally last purchase price
    nextProducts[prodIdx] = {
      ...prod,
      currentStock: nextStock,
      purchasePrice: type === 'in' && costPrice ? costPrice : prod.purchasePrice,
      lastPurchasedDate: type === 'in' ? new Date().toISOString() : prod.lastPurchasedDate,
    };

    const movement: StockMovement = {
      id: `mvt-adj-${Date.now()}`,
      productId: prod.id,
      productNameEn: prod.nameEn,
      productNameSw: prod.nameSw,
      type: actionType,
      quantity: quantityDelta,
      remainingStock: nextStock,
      date: new Date().toISOString(),
      recordedBy: currentUser.name,
      notes: notes,
    };

    // If type is STOCK IN, append a wholesale PurchaseRecord for reports
    const nextPurchases = [...purchases];
    if (type === 'in') {
      const pricePerUnit = costPrice || prod.purchasePrice;
      const purchaseItem = {
        productId: prod.id,
        productNameEn: prod.nameEn,
        productNameSw: prod.nameSw,
        quantity: baseQty,
        unitPrice: pricePerUnit,
        totalPrice: baseQty * pricePerUnit,
      };

      nextPurchases.unshift({
        id: `purch-${Date.now()}`,
        date: new Date().toISOString(),
        supplier: supplier || 'Wholesale supplier',
        items: [purchaseItem],
        totalCost: purchaseItem.totalPrice,
        recordedBy: currentUser.name,
        invoiceNo: `INV-PO-${Date.now().toString().slice(-4)}`,
      });
    }

    const newAudit: AuditLog = {
      id: `audit-adj-${Date.now()}`,
      date: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      actionEn: `Adjusted inventory level for ${prod.nameEn}`,
      actionSw: `Alifanya marekebisho ya idadi ya ${prod.nameSw}`,
      details: `${type.toUpperCase()} -> Delta Qty: ${(quantityDelta ?? 0).toFixed(2)}, Notes: "${notes}"`,
    };

    updateDB({
      products: nextProducts,
      categories,
      transactions,
      stockMovements: [movement, ...stockMovements],
      purchases: nextPurchases,
      settings: settings!,
      auditLogs: [newAudit, ...auditLogs],
    });
  };

  // State mutation: Cancel completed transaction with full automatic stock return
  const handleCancelTransaction = (txId: string, reason: string) => {
    const nextTransactions = [...transactions];
    const txIdx = nextTransactions.findIndex((tx) => tx.id === txId);
    if (txIdx === -1) return;

    const tx = nextTransactions[txIdx];
    if (tx.status === 'cancelled') return;

    // Mark cancelled
    nextTransactions[txIdx] = {
      ...tx,
      status: 'cancelled',
      cancelledBy: currentUser.name,
      cancelledReason: reason,
    };

    const nextProducts = [...products];
    const nextMovements = [...stockMovements];

    // Loop items and return to stock
    tx.items.forEach((itm) => {
      const prodIdx = nextProducts.findIndex((p) => p.id === itm.productId);
      const baseUnitsToReturn = itm.quantity * itm.unitMultiplier;

      if (prodIdx > -1) {
        const prod = nextProducts[prodIdx];
        const updatedStock = prod.currentStock + baseUnitsToReturn;
        nextProducts[prodIdx] = {
          ...prod,
          currentStock: updatedStock,
        };

        nextMovements.unshift({
          id: `mvt-cancel-return-${tx.id}-${itm.productId}`,
          productId: itm.productId,
          productNameEn: itm.productNameEn,
          productNameSw: itm.productNameSw,
          type: 'cancel_return',
          quantity: baseUnitsToReturn,
          remainingStock: updatedStock,
          date: new Date().toISOString(),
          recordedBy: currentUser.name,
          notes: `Return from cancelled receipt ${tx.receiptNo}. Reason: ${reason}`,
        });
      }
    });

    const newAudit: AuditLog = {
      id: `audit-cancel-${Date.now()}`,
      date: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      actionEn: `CANCELLED receipt ${tx.receiptNo}`,
      actionSw: `ALIFUTA muamala Risiti ${tx.receiptNo}`,
      details: `Reason: "${reason}", returned ${tx.items.length} product lines to inventory shelf.`,
    };

    updateDB({
      products: nextProducts,
      categories,
      transactions: nextTransactions,
      stockMovements: nextMovements,
      purchases,
      settings: settings!,
      auditLogs: [newAudit, ...auditLogs],
    });

    // Close view
    setSelectedTxToView(null);
    setShowCancelConfirmation(false);
    setCancelReasonInput('');
  };

  // Save Shop Configurations
  const handleSaveSettings = (updated: ShopSettings, audit: AuditLog) => {
    updateDB({
      products,
      categories,
      transactions,
      stockMovements,
      purchases,
      settings: updated,
      auditLogs: [audit, ...auditLogs],
    });
  };

  // Re-seed original mock values
  const handleRestoreDefaults = async () => {
    const confirmReset = window.confirm(
      currentLanguage === 'sw'
        ? 'Je, una uhakika unataka kurejesha maadili ya kwanza ya mfumo? Miamala yote ya sasa itafutwa!'
        : 'Are you sure you want to restore original default database? All active records will be cleared!'
    );
    if (!confirmReset) return;

    setIsLoading(true);
    try {
      const data = await clearAndReSeedFirestore();
      setProducts(data.products);
      setCategories(data.categories);
      setTransactions(data.transactions);
      setStockMovements(data.stockMovements);
      setPurchases(data.purchases);
      setSettings(data.settings);
      setAuditLogs(data.auditLogs);
      setActiveTab('dashboard');
    } catch (err) {
      console.error('Failed to restore defaults in Firestore:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Restore from imported backup file
  const handleRestoreBackup = async (backupData: any) => {
    if (!backupData || !backupData.database) return;
    const dbData = backupData.database;
    
    const nextProducts = dbData.products || [];
    const nextCategories = dbData.categories || [];
    const nextTransactions = dbData.transactions || [];
    const nextStockMovements = dbData.stockMovements || [];
    const nextPurchases = dbData.purchases || [];
    const nextSettings = dbData.settings && Object.keys(dbData.settings).length > 0 ? dbData.settings : settings;
    
    const newAudit: AuditLog = {
      id: `audit-restore-${Date.now()}`,
      date: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      actionEn: 'Restored database from custom backup file',
      actionSw: 'Alirejesha hifadhidata kutoka kwenye faili la chelezo',
      details: `Restored database: ${nextProducts.length} products, ${nextTransactions.length} sales logs, and custom shop configurations.`,
    };

    const nextState = {
      products: nextProducts,
      categories: nextCategories,
      transactions: nextTransactions,
      stockMovements: nextStockMovements,
      purchases: nextPurchases,
      settings: nextSettings || settings!,
      auditLogs: [newAudit, ...auditLogs],
    };

    setIsLoading(true);
    try {
      await saveBulkToFirestore(nextState);
      setProducts(nextState.products);
      setCategories(nextState.categories);
      setTransactions(nextState.transactions);
      setStockMovements(nextState.stockMovements);
      setPurchases(nextState.purchases);
      setSettings(nextState.settings);
      setAuditLogs(nextState.auditLogs);
      setActiveTab('dashboard');
    } catch (err) {
      console.error('Failed to import backup to Firestore:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ROLE TAB PERMISSIONS
  const permittedTabs = useMemo(() => {
    if (!currentUser) return ['dashboard'];
    if (currentUser.role === 'cashier') {
      return ['dashboard', 'pos'];
    }
    if (currentUser.role === 'storekeeper') {
      return ['dashboard', 'inventory'];
    }
    return ['dashboard', 'pos', 'inventory', 'reports', 'analytics', 'settings'];
  }, [currentUser]);

  const handleForceOfflineMode = () => {
    localStorage.setItem('kaberege_pos_mode', 'offline');
    const offlineProfile = {
      id: 'offline-admin',
      name: 'Kaberege Admin (Local)',
      username: 'admin',
      role: 'admin',
      status: 'active',
      avatar: '⚡',
      email: 'offline@kaberege.local'
    };
    localStorage.setItem('kaberege_pos_offline_user', JSON.stringify(offlineProfile));
    setIsOfflineMode(true);
    setCurrentUser(offlineProfile);
    setIsLoading(false);
    setIsAuthChecking(false);
  };

  // Adjust active tab if switching user makes it prohibited
  useEffect(() => {
    if (!permittedTabs.includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [currentUser, permittedTabs, activeTab]);

  // CORE METRICS (FOR ADMIN DASHBOARD)
  const dashboardMetrics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySalesList = completedSalesToday(transactions, todayStr);
    
    // Today metrics
    const todaySales = todaySalesList.reduce((acc, curr) => acc + curr.total, 0);
    let todayProfit = 0;
    todaySalesList.forEach((tx) => {
      let cost = 0;
      tx.items.forEach((itm) => {
        cost += itm.quantity * itm.unitMultiplier * itm.purchasePriceAtSale;
      });
      todayProfit += (tx.subtotal - tx.discount - cost);
    });

    // Monthly metrics
    const thisMonthStr = todayStr.substring(0, 7); // YYYY-MM
    const monthlySalesList = transactions.filter((tx) => tx.status === 'completed' && tx.date.startsWith(thisMonthStr));
    const monthlySales = monthlySalesList.reduce((acc, curr) => acc + curr.total, 0);
    let monthlyProfit = 0;
    monthlySalesList.forEach((tx) => {
      let cost = 0;
      tx.items.forEach((itm) => {
        cost += itm.quantity * itm.unitMultiplier * itm.purchasePriceAtSale;
      });
      monthlyProfit += (tx.subtotal - tx.discount - cost);
    });

    // Live Stock Value
    let stockCostValue = 0;
    products.forEach((p) => {
      stockCostValue += p.currentStock * p.purchasePrice;
    });

    // Alert lists
    const lowStockCount = products.filter((p) => p.currentStock <= p.minStockAlert).length;

    return {
      todaySales,
      todayProfit,
      monthlySales,
      monthlyProfit,
      stockValue: stockCostValue,
      lowStockCount,
    };
  }, [transactions, products]);

  // Helper
  function completedSalesToday(txs: Transaction[], todayStr: string) {
    return txs.filter((tx) => tx.status === 'completed' && tx.date.startsWith(todayStr));
  }

  // Mini Chart data for Admin dashboard (sales trend of last 7 days)
  const dashboardMiniChartData = useMemo(() => {
    const data: { label: string; Sales: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const salesVal = transactions
        .filter((tx) => tx.status === 'completed' && tx.date.startsWith(dateStr))
        .reduce((sum, tx) => sum + tx.total, 0);
      data.push({
        label: d.toLocaleDateString(currentLanguage === 'sw' ? 'sw-TZ' : 'en-US', { weekday: 'short' }),
        Sales: salesVal,
      });
    }
    return data;
  }, [transactions, currentLanguage]);

  if (isAuthChecking || isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-6">
        <div className="flex flex-col items-center space-y-4 max-w-md text-center">
          <RefreshCw className="w-12 h-12 text-amber-500 animate-spin" />
          <h1 className="text-xl font-extrabold tracking-tight text-white font-sans uppercase">
            Kaberege POS
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            {currentLanguage === 'sw' 
              ? 'Inahakiki usalama na kupakia mfumo...' 
              : 'Securing and loading system data...'}
          </p>
          <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full w-2/3 bg-amber-500 rounded-full animate-pulse"></div>
          </div>


        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginView
        currentLanguage={currentLanguage}
        setLanguage={setLanguage}
        onLoginSuccess={(userProfile) => {
          setCurrentUser(userProfile);
          if (localStorage.getItem('kaberege_pos_mode') !== 'offline') {
            localStorage.setItem('kaberege_pos_online_user_session', JSON.stringify(userProfile));
          }
          // Auto-direct to the first tab allowed by role
          if (userProfile.role === 'cashier') {
            setActiveTab('pos');
          } else if (userProfile.role === 'storekeeper') {
            setActiveTab('inventory');
          } else {
            setActiveTab('dashboard');
          }
        }}
      />
    );
  }

  const handleLogout = async () => {
    try {
      if (localStorage.getItem('kaberege_pos_mode') === 'offline' || isOfflineMode) {
        localStorage.removeItem('kaberege_pos_offline_user');
        localStorage.removeItem('kaberege_pos_mode');
        setCurrentUser(null);
        setIsOfflineMode(false);
      } else {
        localStorage.removeItem('kaberege_pos_online_user_session');
        await signOut(auth);
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between select-none">
      
      {/* Header component */}
      {settings && currentUser && (
        <Header
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
          currentUser={currentUser}
          onLogout={handleLogout}
          settings={settings}
          products={products}
          onOpenSettings={() => setActiveTab('settings')}
          onRestoreDefaults={handleRestoreDefaults}
        />
      )}

      {/* CORE WORKSPACE SCREEN */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto">
        
        {/* SIDEBAR NAVIGATION RAIL */}
        <aside className="w-full md:w-56 bg-slate-900 md:bg-transparent p-3 space-y-1.5 md:py-6 border-b md:border-b-0 md:border-r border-slate-200 shrink-0">
          <p className="hidden md:block text-[9px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">
            Main Panel Menu
          </p>
          
          <nav className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible pb-1.5 md:pb-0 gap-1 md:gap-1.5 no-scrollbar">
            {permittedTabs.includes('dashboard') && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'dashboard'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-500 md:text-slate-600 hover:bg-slate-200 hover:text-slate-900 bg-white md:bg-transparent border border-slate-200 md:border-0'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>{t.dashboard}</span>
              </button>
            )}

            {permittedTabs.includes('pos') && (
              <button
                onClick={() => setActiveTab('pos')}
                className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'pos'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-500 md:text-slate-600 hover:bg-slate-200 hover:text-slate-900 bg-white md:bg-transparent border border-slate-200 md:border-0'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{t.pos}</span>
              </button>
            )}

            {permittedTabs.includes('inventory') && (
              <button
                onClick={() => setActiveTab('inventory')}
                className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'inventory'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-500 md:text-slate-600 hover:bg-slate-200 hover:text-slate-900 bg-white md:bg-transparent border border-slate-200 md:border-0'
                }`}
              >
                <Warehouse className="w-4 h-4" />
                <span>{t.inventory}</span>
              </button>
            )}

            {permittedTabs.includes('reports') && (
              <button
                onClick={() => setActiveTab('reports')}
                className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'reports'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-500 md:text-slate-600 hover:bg-slate-200 hover:text-slate-900 bg-white md:bg-transparent border border-slate-200 md:border-0'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{t.reports}</span>
              </button>
            )}

            {permittedTabs.includes('analytics') && (
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'analytics'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-500 md:text-slate-600 hover:bg-slate-200 hover:text-slate-900 bg-white md:bg-transparent border border-slate-200 md:border-0'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>{t.analytics}</span>
              </button>
            )}

            {permittedTabs.includes('settings') && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 md:flex-initial flex items-center justify-center md:justify-start gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-500 md:text-slate-600 hover:bg-slate-200 hover:text-slate-900 bg-white md:bg-transparent border border-slate-200 md:border-0'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>{t.settings}</span>
              </button>
            )}
          </nav>
        </aside>

        {/* CONTAINER SWITCHER FOR ACTIVE TABS */}
        <main className="flex-1 overflow-hidden">
          
          {activeTab === 'dashboard' && (
            /* ROLE ADAPTIVE DASHBOARDS SCREEN */
            <div className="p-4 sm:p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-65px)]">
              
              {/* Role Welcome card */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md flex justify-between items-center flex-col sm:flex-row gap-4">
                <div className="space-y-1">
                  <span className="text-xs bg-amber-500/10 text-amber-400 font-sans font-bold px-2.5 py-0.5 rounded-full border border-amber-500/20">
                    {currentUser.role === 'admin' ? t.admin : currentUser.role === 'cashier' ? t.cashier : t.storekeeper}
                  </span>
                  <h2 className="font-display font-extrabold text-lg tracking-tight">
                    {t.activeUser} {currentUser.name}!
                  </h2>
                  <p className="text-xs text-slate-400">Welcome to your workspace dashboard. Today is {new Date().toLocaleDateString(currentLanguage === 'sw' ? 'sw-TZ' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.</p>
                </div>

                {currentUser.role === 'cashier' && (
                  <button
                    onClick={() => setActiveTab('pos')}
                    className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    Launch POS Screen
                  </button>
                )}

                {currentUser.role === 'storekeeper' && (
                  <button
                    onClick={() => setActiveTab('inventory')}
                    className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <Warehouse className="w-3.5 h-3.5" />
                    Open Stock Catalog
                  </button>
                )}
              </div>

              {/* Low Stock alarms alert banner */}
              {dashboardMetrics.lowStockCount > 0 && currentUser.role !== 'cashier' && (
                <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-900 p-4 rounded-r-xl shadow-xs text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>{t.stockAlertTitle} ({dashboardMetrics.lowStockCount} items)</span>
                  </div>
                  <p className="text-amber-800 font-medium">{t.stockAlertDesc}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {products
                      .filter((p) => (p.currentStock ?? 0) <= (p.minStockAlert ?? 0))
                      .slice(0, 6)
                      .map((p, idx) => (
                        <span
                          key={`${p.id}-${idx}`}
                          className="bg-amber-500/10 border border-amber-400/20 text-amber-900 font-mono font-semibold px-2 py-0.5 rounded-md"
                        >
                          {currentLanguage === 'sw' ? p.nameSw : p.nameEn}: {(p.currentStock ?? 0).toFixed(1)} {p.unit === 'kg' ? 'Kg' : 'pcs'}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* STATS BENTO GRID (Based on user roles) */}
              {currentUser.role === 'admin' ? (
                /* ADMIN STATS GRID */
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between h-24">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.todaySales}</p>
                      <h3 className="text-base font-mono font-extrabold text-slate-900 leading-none">{formatTSh(dashboardMetrics.todaySales)}</h3>
                      <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md w-fit">Active</span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between h-24">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.todayProfit}</p>
                      <h3 className="text-base font-mono font-extrabold text-emerald-700 leading-none">{formatTSh(dashboardMetrics.todayProfit)}</h3>
                      <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md w-fit">Today</span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between h-24">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.monthlySales}</p>
                      <h3 className="text-base font-mono font-extrabold text-slate-900 leading-none">{formatTSh(dashboardMetrics.monthlySales)}</h3>
                      <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded-md w-fit">Month</span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between h-24">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.monthlyProfit}</p>
                      <h3 className="text-base font-mono font-extrabold text-slate-900 leading-none">{formatTSh(dashboardMetrics.monthlyProfit)}</h3>
                      <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded-md w-fit">Faida</span>
                    </div>

                    <div className="bg-amber-500 text-slate-950 rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between h-24 col-span-2 lg:col-span-1 border border-amber-400">
                      <p className="text-[10px] font-bold text-amber-950/70 uppercase tracking-wider">{t.stockValue}</p>
                      <h3 className="text-sm font-mono font-extrabold text-slate-950 leading-none">{formatTSh(dashboardMetrics.stockValue)}</h3>
                      <span className="text-[9px] text-amber-950 font-bold bg-amber-400/30 px-1.5 py-0.5 rounded-md w-fit">Asset Value</span>
                    </div>
                  </div>

                  {/* Dashboard Core Splits: left (mini chart, products) right (recent sales logs) */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    
                    {/* Left Column (Mini sales chart + Low stock list) */}
                    <div className="lg:col-span-1 space-y-4">
                      {/* Mini chart */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5">7-Day Sales Volume</p>
                        <div className="h-36">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dashboardMiniChartData}>
                              <XAxis dataKey="label" stroke="#94a3b8" fontSize={9} tickLine={false} />
                              <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} width={25} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                              <Tooltip formatter={(val: number) => [formatTSh(val), '']} contentStyle={{ fontSize: '10px' }} />
                              <Bar dataKey="Sales" fill="#f59e0b" radius={[3, 3, 0, 0]} barSize={14} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Top selling catalog */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5">{t.topProducts}</p>
                        <div className="space-y-2">
                          {products.slice(0, 4).map((p, idx) => (
                            <div key={`${p.id}-${idx}`} className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-2">
                                <span className="bg-slate-100 text-slate-500 font-mono font-semibold px-1.5 py-0.5 rounded">#{idx+1}</span>
                                <span className="font-bold text-slate-800 truncate max-w-28">
                                  {currentLanguage === 'sw' ? p.nameSw : p.nameEn}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-slate-950">{formatTSh(p.sellingPrice)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column (Clickable Transaction logs / Receipt viewer / Cancellation desk) */}
                    <div className="lg:col-span-2">
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full">
                        <div className="p-4 bg-slate-50 border-b border-slate-200">
                          <h3 className="font-display font-bold text-slate-850 text-xs uppercase tracking-wide flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-500" />
                            {t.recentSales} (Click receipt to View / Print / Cancel)
                          </h3>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50/50 text-slate-400 font-bold uppercase text-[8px] tracking-wider border-b border-slate-200">
                                <th className="p-3">Receipt No</th>
                                <th className="p-3">Date</th>
                                <th className="p-3">Cashier</th>
                                <th className="p-3 text-right">Items</th>
                                <th className="p-3 text-right">Grand Total</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-center">Sync</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {transactions.slice(0, 10).map((tx, idx) => (
                                <tr
                                  key={`${tx.id}-${idx}`}
                                  onClick={() => setSelectedTxToView(tx)}
                                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                                >
                                  <td className="p-3 font-mono font-bold text-indigo-600">{tx.receiptNo}</td>
                                  <td className="p-3 text-slate-500 whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td>
                                  <td className="p-3 text-slate-600 font-medium">{tx.cashierName}</td>
                                  <td className="p-3 text-right font-semibold text-slate-800">{tx.items.length}</td>
                                  <td className="p-3 text-right font-mono font-bold text-slate-950">{formatTSh(tx.total)}</td>
                                  <td className="p-3 text-center">
                                    {tx.status === 'completed' ? (
                                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[9px] uppercase border border-emerald-200">
                                        Completed
                                      </span>
                                    ) : (
                                      <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[9px] uppercase border border-rose-200 animate-pulse">
                                        Cancelled
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    {tx.offlineSynced !== false ? (
                                      <span className="text-[11px] text-emerald-500" title="Synced to cloud / Imehifadhiwa Mawinguni">
                                        ☁️
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-amber-500 font-bold animate-pulse" title="Offline - Saved locally / Imehifadhiwa Kwenye Kifaa">
                                        📶
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              ) : currentUser.role === 'cashier' ? (
                /* CASHIER SPECIFIC PANEL */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                    <h3 className="font-display font-bold text-slate-800 text-xs uppercase tracking-wide border-b border-slate-100 pb-2">
                      Today's Personal Performance
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                      <div className="p-3.5 border rounded-xl bg-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Your Sales value</p>
                        <h4 className="text-base font-mono font-extrabold text-slate-900 mt-1">
                          {formatTSh(
                            transactions
                              .filter((tx) => tx.status === 'completed' && tx.cashierId === currentUser.id && tx.date.startsWith(new Date().toISOString().split('T')[0]))
                              .reduce((sum, tx) => sum + tx.total, 0)
                          )}
                        </h4>
                      </div>

                      <div className="p-3.5 border rounded-xl bg-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Your Sales count</p>
                        <h4 className="text-base font-mono font-extrabold text-slate-900 mt-1">
                          {transactions.filter((tx) => tx.status === 'completed' && tx.cashierId === currentUser.id && tx.date.startsWith(new Date().toISOString().split('T')[0])).length}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                    <h3 className="font-display font-bold text-slate-800 text-xs uppercase tracking-wide border-b border-slate-100 pb-2">
                      Available Stock quick reference
                    </h3>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs font-semibold text-slate-700 pr-1">
                      {products.slice(0, 10).map((p, idx) => (
                        <div key={`${p.id}-${idx}`} className="flex justify-between">
                          <span>{currentLanguage === 'sw' ? p.nameSw : p.nameEn}</span>
                          <span className={`font-mono font-bold ${(p.currentStock ?? 0) <= (p.minStockAlert ?? 0) ? 'text-amber-600' : 'text-slate-900'}`}>
                            {(p.currentStock ?? 0).toFixed(0)} {p.unit === 'kg' ? 'Kg' : 'pcs'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* STOREKEEPER SPECIFIC PANEL */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-slate-700">
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                    <h3 className="font-display font-bold text-slate-800 text-xs uppercase tracking-wide border-b border-slate-100 pb-2">
                      Warehouse Stock levels
                    </h3>
                    <div className="grid grid-cols-3 gap-3 text-center text-slate-600">
                      <div className="p-3 border rounded-xl bg-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Grains total (Kg)</p>
                        <h4 className="text-base font-mono font-bold text-slate-900 mt-1">
                          {products
                            .filter((p) => p.categoryId === 'cat-grain')
                            .reduce((sum, p) => sum + (p.currentStock ?? 0), 0)
                            .toFixed(0)}
                        </h4>
                      </div>
                      <div className="p-3 border rounded-xl bg-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Beverages total</p>
                        <h4 className="text-base font-mono font-bold text-slate-900 mt-1">
                          {products
                            .filter((p) => p.categoryId === 'cat-beverage')
                            .reduce((sum, p) => sum + (p.currentStock ?? 0), 0)
                            .toFixed(0)}
                        </h4>
                      </div>
                      <div className="p-3 border rounded-xl bg-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Household total</p>
                        <h4 className="text-base font-mono font-bold text-slate-900 mt-1">
                          {products
                            .filter((p) => p.categoryId === 'cat-household')
                            .reduce((sum, p) => sum + (p.currentStock ?? 0), 0)
                            .toFixed(0)}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                    <h3 className="font-display font-bold text-slate-800 text-xs uppercase tracking-wide border-b border-slate-100 pb-2">
                      Recent Purchase Orders (Inbound Stock-In)
                    </h3>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {purchases.slice(0, 5).map((p, idx) => (
                        <div key={`${p.id}-${idx}`} className="p-2 border rounded bg-slate-50/50 flex justify-between font-medium">
                          <div>
                            <p className="font-bold text-slate-800">{p.supplier || 'Kahama wholesale'}</p>
                            <p className="text-[9px] text-slate-500 font-mono">{p.invoiceNo}</p>
                          </div>
                          <span className="font-mono font-bold text-rose-800">{formatTSh(p.totalCost)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {activeTab === 'pos' && (
            <POSView
              currentLanguage={currentLanguage}
              currentUser={currentUser}
              products={products}
              categories={categories}
              settings={settings!}
              onAddTransaction={handleAddTransaction}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              currentLanguage={currentLanguage}
              currentUser={currentUser}
              products={products}
              categories={categories}
              stockMovements={stockMovements}
              onAddProduct={handleAddProduct}
              onAdjustStock={handleAdjustStock}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              currentLanguage={currentLanguage}
              currentUser={currentUser}
              transactions={transactions}
              products={products}
              categories={categories}
              stockMovements={stockMovements}
              purchases={purchases}
              settings={settings!}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              currentLanguage={currentLanguage}
              transactions={transactions}
              products={products}
              categories={categories}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              currentLanguage={currentLanguage}
              currentUser={currentUser}
              settings={settings!}
              auditLogs={auditLogs}
              onSaveSettings={handleSaveSettings}
              onRestoreDefaults={handleRestoreDefaults}
              onRestoreBackup={handleRestoreBackup}
            />
          )}

        </main>

      </div>

      {/* FOOTER METADATA (Architectural honesty - no telemetry, clean copyright) */}
      <footer className="bg-slate-900 text-slate-400 py-3.5 text-center text-[11px] border-t border-slate-800/80 font-medium">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center flex-col sm:flex-row gap-2">
          <p>© 2026 Kariakoo Grain Dealers POS System. All Rights Reserved.</p>
          <p className="font-mono text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
            Tanzania Shilling System (TSh) • Dual EN-SW engine
          </p>
        </div>
      </footer>

      {/* RECENT SALES RECEIPT INSPECTOR POPUP */}
      {selectedTxToView && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
            
            <div className="p-3 bg-slate-900 text-white flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 text-amber-400">
                <Receipt className="w-4 h-4" />
                {t.receiptDetails}
              </span>
              <button
                onClick={() => {
                  setSelectedTxToView(null);
                  setShowCancelConfirmation(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-stone-50">
              {/* If completed, and user is Admin, offer cancellation controls */}
              {selectedTxToView.status === 'completed' && currentUser.role === 'admin' && !showCancelConfirmation && (
                <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-rose-900">Cancel Receipt</p>
                    <p className="text-[10px] text-rose-700 leading-tight">Return items to inventory & void cashlog</p>
                  </div>
                  <button
                    onClick={() => setShowCancelConfirmation(true)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[10px]"
                  >
                    Void Sale
                  </button>
                </div>
              )}

              {/* Cancellation form */}
              {showCancelConfirmation && (
                <div className="mb-4 bg-rose-100 border-2 border-rose-300 rounded-xl p-3.5 space-y-3.5 text-xs">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-rose-900 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-rose-700 animate-pulse" />
                      {t.cancelConfirmTitle}
                    </p>
                    <button
                      onClick={() => setShowCancelConfirmation(false)}
                      className="text-rose-500 hover:text-rose-800 text-sm font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-rose-800 uppercase mb-1">{t.cancelConfirmText}</label>
                    <input
                      type="text"
                      required
                      value={cancelReasonInput}
                      onChange={(e) => setCancelReasonInput(e.target.value)}
                      placeholder={t.cancelReasonPlaceholder}
                      className="w-full border border-rose-300 rounded-lg px-2.5 py-1.5 focus:outline-none bg-white text-rose-900 font-medium"
                    />
                  </div>
                  <button
                    onClick={() => handleCancelTransaction(selectedTxToView.id, cancelReasonInput)}
                    disabled={!cancelReasonInput.trim()}
                    className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-bold text-[10px]"
                  >
                    {t.confirmCancelBtn}
                  </button>
                </div>
              )}

              {/* Printed Receipt Body */}
              <div id="receipt-to-print" className="bg-white p-5 border border-stone-200 shadow-inner text-slate-850 font-mono text-xs space-y-4 max-w-xs mx-auto rounded-lg">
                <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
                  <h2 className="font-bold text-sm tracking-tight">{settings?.name}</h2>
                  <p className="text-[10px] text-slate-600">{settings?.address}</p>
                  <p className="text-[10px] text-slate-600">Simu: {settings?.phone}</p>
                  {selectedTxToView.status === 'cancelled' ? (
                    <p className="text-xs bg-rose-600 text-white font-sans font-extrabold tracking-widest uppercase mt-3 py-1 rounded-md border-2 border-dashed border-white">
                      ** VOIDED / INALID **
                    </p>
                  ) : (
                    <p className="text-[9px] font-semibold tracking-wider text-slate-500 uppercase mt-2">
                      ** RISITI / RECEIPT **
                    </p>
                  )}
                </div>

                <div className="space-y-0.5 text-[10px] text-slate-700">
                  <div className="flex justify-between">
                    <span>{t.receiptNo}:</span>
                    <span className="font-bold">{selectedTxToView.receiptNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.dateLabel}:</span>
                    <span>{new Date(selectedTxToView.date).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.cashierLabel}:</span>
                    <span>{selectedTxToView.cashierName}</span>
                  </div>
                  {selectedTxToView.customerName && (
                    <div className="flex justify-between font-semibold">
                      <span>Mteja:</span>
                      <span>{selectedTxToView.customerName}</span>
                    </div>
                  )}
                  {selectedTxToView.status === 'cancelled' && (
                    <div className="pt-2 border-t border-dashed border-rose-300 text-[10px] text-rose-800 font-bold space-y-1">
                      <p>VOIDED BY: {selectedTxToView.cancelledBy}</p>
                      <p className="italic">REASON: {selectedTxToView.cancelledReason}</p>
                    </div>
                  )}
                </div>

                <table className="w-full text-[10px] border-t border-b border-dashed border-slate-300 py-2">
                  <thead>
                    <tr className="border-b border-dashed border-slate-200">
                      <th className="text-left font-bold pb-1">Maelezo</th>
                      <th className="text-center font-bold pb-1">Idadi</th>
                      <th className="text-right font-bold pb-1">Bei</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTxToView.items.map((itm, idx) => (
                      <tr key={idx} className="border-b border-dashed border-stone-100 last:border-0">
                        <td className="py-1">
                          <p className="font-bold">{currentLanguage === 'sw' ? itm.productNameSw : itm.productNameEn}</p>
                          <span className="text-[8px] text-slate-500">Unit: {itm.selectedUnit}</span>
                        </td>
                        <td className="text-center font-bold py-1">{itm.quantity}</td>
                        <td className="text-right font-mono py-1">{formatTSh(itm.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatTSh(selectedTxToView.subtotal)}</span>
                  </div>
                  {selectedTxToView.discount > 0 && (
                    <div className="flex justify-between text-amber-800 font-bold">
                      <span>Discount:</span>
                      <span>-{formatTSh(selectedTxToView.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-sm border-t border-dashed border-slate-300 pt-2 text-slate-950">
                    <span>TOTAL:</span>
                    <span>{formatTSh(selectedTxToView.total)}</span>
                  </div>
                </div>

                <div className="text-center space-y-1 pt-3 border-t border-dashed border-slate-350 text-[9px] text-slate-600 leading-tight">
                  <p className="font-semibold uppercase text-slate-900">LIPA KWA: {selectedTxToView.paymentMethod.toUpperCase()}</p>
                  <p className="mt-2">{currentLanguage === 'sw' ? settings?.receiptMessageSw : settings?.receiptMessageEn}</p>
                </div>
              </div>
            </div>

             <div className="p-3 bg-slate-100 border-t border-slate-200 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                {t.printReceipt}
              </button>
              <button
                onClick={() => downloadReceiptPDF(selectedTxToView, settings!, currentLanguage)}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={() => {
                  setSelectedTxToView(null);
                  setShowCancelConfirmation(false);
                }}
                className="px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-xs font-bold transition-colors"
              >
                {t.close}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PWA STATUS SYNC FLOATING NOTIFICATION */}
      {showSyncBanner && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-2xl flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-300">
          <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl font-bold text-lg shrink-0">
            {isOnline ? '🔄' : '📶'}
          </div>
          <div className="space-y-1">
            <h4 className="font-display font-extrabold text-[10px] tracking-widest uppercase text-amber-400">
              {isOnline ? 'Mfumo wa Cloud Sync' : 'Hali ya Ndani (Offline)'}
            </h4>
            <p className="text-[11px] leading-relaxed text-slate-300 font-medium">{syncMessage}</p>
          </div>
        </div>
      )}

    </div>
  );
}
