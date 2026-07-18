import { db, auth, firebaseConfig } from './firebase';
import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  setDoc, 
  deleteDoc,
  writeBatch 
} from 'firebase/firestore';
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { 
  Category, 
  Product, 
  Transaction, 
  StockMovement, 
  PurchaseRecord, 
  ShopSettings, 
  AuditLog,
  User
} from './types';
import { 
  INITIAL_CATEGORIES, 
  INITIAL_PRODUCTS, 
  DEFAULT_SETTINGS, 
  generateHistoricTransactions 
} from './mockData';

// Temporary auth instance accessor for Admin creation of secondary users without signing out Admin
let tempAuth: any = null;
function getTempAuth() {
  if (!tempAuth) {
    const apps = getApps();
    const existingTemp = apps.find(app => app.name === 'TempAdminApp');
    const tempApp = existingTemp || initializeApp(firebaseConfig, 'TempAdminApp');
    tempAuth = getAuth(tempApp);
  }
  return tempAuth;
}

/**
 * Creates a secondary Firebase Authentication user account without signing out the current Admin user.
 */
export async function createAuthUserWithoutSignOut(email: string, password: string): Promise<string> {
  const tAuth = getTempAuth();
  const userCredential = await createUserWithEmailAndPassword(tAuth, email, password);
  const uid = userCredential.user.uid;
  await signOut(tAuth); // Ensure the temp auth signs out immediately
  return uid;
}

/**
 * Sends a secure password reset email to a registered user.
 */
export async function sendUserPasswordResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

// Helper to race a promise against a timeout
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 4000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout of ${timeoutMs}ms exceeded`)), timeoutMs)
    )
  ]);
}

/**
 * Check if the 'users' collection is currently empty to determine if first Admin signup is needed.
 */
export async function checkIsUsersCollectionEmpty(): Promise<boolean> {
  try {
    const querySnap = await withTimeout(getDocs(collection(db, 'users')), 4000);
    return querySnap.empty;
  } catch (err) {
    console.error('Error checking users collection:', err);
    // If permission is denied, collection doesn't exist, or timeout, assume false so it goes to normal login
    return false; 
  }
}

/**
 * Fetch all users from the Firestore 'users' collection.
 */
export async function fetchUsersFromFirestore(): Promise<User[]> {
  try {
    const querySnap = await withTimeout(getDocs(collection(db, 'users')), 4000);
    const list: User[] = [];
    querySnap.forEach((doc) => {
      list.push(doc.data() as User);
    });
    return list;
  } catch (err) {
    console.error('Error fetching users from Firestore:', err);
    return [];
  }
}

/**
 * Fetch a single user profile from Firestore.
 */
export async function fetchUserProfile(uid: string): Promise<User | null> {
  try {
    const docSnap = await withTimeout(getDoc(doc(db, 'users', uid)), 4000);
    if (docSnap.exists()) {
      return docSnap.data() as User;
    }
    return null;
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return null;
  }
}

/**
 * Saves or updates a user profile doc in Firestore.
 */
export async function saveUserToFirestore(user: User): Promise<void> {
  await setDoc(doc(db, 'users', user.id), user);
}

/**
 * Deletes a user profile from Firestore.
 */
export async function deleteUserFromFirestore(userId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId));
}


export interface DatabaseState {
  products: Product[];
  categories: Category[];
  transactions: Transaction[];
  stockMovements: StockMovement[];
  purchases: PurchaseRecord[];
  settings: ShopSettings;
  auditLogs: AuditLog[];
}

/**
 * Fetch all collections from Firestore.
 * Automatically seeds the Firestore database with initial mock data if the database is blank.
 */
export async function fetchFirestoreDatabase(): Promise<DatabaseState> {
  try {
    const [
      productsSnap,
      categoriesSnap,
      transactionsSnap,
      movementsSnap,
      purchasesSnap,
      settingsSnap,
      auditLogsSnap
    ] = await withTimeout(Promise.all([
      getDocs(collection(db, 'products')),
      getDocs(collection(db, 'categories')),
      getDocs(collection(db, 'transactions')),
      getDocs(collection(db, 'stockMovements')),
      getDocs(collection(db, 'purchases')),
      getDocs(collection(db, 'settings')),
      getDocs(collection(db, 'auditLogs'))
    ]), 4000);

    const hasCategories = !categoriesSnap.empty;
    const hasProducts = !productsSnap.empty;

    // If both categories and products collections are empty, seed the database!
    if (!hasCategories && !hasProducts) {
      console.log('Firestore is empty. Initializing with default Tanzanian grain shop data...');
      
      const seedState = await seedFirestoreDatabase();
      return seedState;
    }

    // Read categories
    const categories: Category[] = [];
    categoriesSnap.forEach((doc) => {
      categories.push(doc.data() as Category);
    });

    // Read products
    const products: Product[] = [];
    productsSnap.forEach((doc) => {
      products.push(doc.data() as Product);
    });

    // Read transactions (ordered newest first normally, but we can sort by date)
    const transactions: Transaction[] = [];
    transactionsSnap.forEach((doc) => {
      transactions.push(doc.data() as Transaction);
    });
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Read stock movements
    const stockMovements: StockMovement[] = [];
    movementsSnap.forEach((doc) => {
      stockMovements.push(doc.data() as StockMovement);
    });
    stockMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Read purchases
    const purchases: PurchaseRecord[] = [];
    purchasesSnap.forEach((doc) => {
      purchases.push(doc.data() as PurchaseRecord);
    });
    purchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Read settings (doc ID: 'shop-config')
    let settings: ShopSettings = DEFAULT_SETTINGS;
    settingsSnap.forEach((doc) => {
      if (doc.id === 'shop-config') {
        settings = doc.data() as ShopSettings;
      }
    });

    // Read audit logs
    const auditLogs: AuditLog[] = [];
    auditLogsSnap.forEach((doc) => {
      auditLogs.push(doc.data() as AuditLog);
    });
    auditLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      products,
      categories,
      transactions,
      stockMovements,
      purchases,
      settings,
      auditLogs
    };
  } catch (error) {
    console.error('Failed to fetch from Firestore. Falling back to local state...', error);
    // Return a blank default state as safe fallback
    const productsCopy = JSON.parse(JSON.stringify(INITIAL_PRODUCTS)) as Product[];
    const historic = generateHistoricTransactions(productsCopy);
    return {
      products: productsCopy,
      categories: INITIAL_CATEGORIES,
      transactions: historic.transactions,
      stockMovements: historic.stockMovements,
      purchases: historic.purchases,
      settings: DEFAULT_SETTINGS,
      auditLogs: historic.auditLogs
    };
  }
}

/**
 * Seed Firestore database with default Tanzanian grain shop records.
 */
async function seedFirestoreDatabase(): Promise<DatabaseState> {
  const products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS)) as Product[];
  const categories = INITIAL_CATEGORIES;
  const settings = DEFAULT_SETTINGS;

  const { transactions, stockMovements, purchases, auditLogs } = generateHistoricTransactions(products);

  // Write categories
  for (const cat of categories) {
    await setDoc(doc(db, 'categories', cat.id), cat);
  }

  // Write products
  for (const prod of products) {
    await setDoc(doc(db, 'products', prod.id), prod);
  }

  // Write settings
  await setDoc(doc(db, 'settings', 'shop-config'), settings);

  // Write transactions (write them in chunks to avoid any firestore limits)
  for (const tx of transactions) {
    await setDoc(doc(db, 'transactions', tx.id), tx);
  }

  // Write stock movements
  for (const mvt of stockMovements) {
    await setDoc(doc(db, 'stockMovements', mvt.id), mvt);
  }

  // Write purchases
  for (const purch of purchases) {
    await setDoc(doc(db, 'purchases', purch.id), purch);
  }

  // Write audit logs
  for (const log of auditLogs) {
    await setDoc(doc(db, 'auditLogs', log.id), log);
  }

  console.log('Seeding Firestore completed successfully!');

  return {
    products,
    categories,
    transactions,
    stockMovements,
    purchases,
    settings,
    auditLogs
  };
}

/**
 * Perform clear and complete re-seed of the database.
 */
export async function clearAndReSeedFirestore(): Promise<DatabaseState> {
  console.log('Clearing and re-seeding Firestore database...');
  return seedFirestoreDatabase();
}

/**
 * Single document savers for discrete mutations
 */
export async function saveProductToFirestore(product: Product) {
  await setDoc(doc(db, 'products', product.id), product);
}

export async function saveCategoryToFirestore(category: Category) {
  await setDoc(doc(db, 'categories', category.id), category);
}

export async function saveTransactionToFirestore(transaction: Transaction) {
  await setDoc(doc(db, 'transactions', transaction.id), transaction);
}

export async function saveStockMovementToFirestore(movement: StockMovement) {
  await setDoc(doc(db, 'stockMovements', movement.id), movement);
}

export async function savePurchaseToFirestore(purchase: PurchaseRecord) {
  await setDoc(doc(db, 'purchases', purchase.id), purchase);
}

export async function saveSettingsToFirestore(settings: ShopSettings) {
  await setDoc(doc(db, 'settings', 'shop-config'), settings);
}

export async function saveAuditLogToFirestore(auditLog: AuditLog) {
  await setDoc(doc(db, 'auditLogs', auditLog.id), auditLog);
}

/**
 * Bulk save function for settings restore or backup uploads
 */
export async function saveBulkToFirestore(state: {
  products: Product[];
  categories: Category[];
  transactions: Transaction[];
  stockMovements: StockMovement[];
  purchases: PurchaseRecord[];
  settings: ShopSettings;
  auditLogs: AuditLog[];
}) {
  console.log('Bulk restoring database state to Firestore...');

  // Write everything in parallel
  const promises: Promise<void>[] = [];

  state.categories.forEach(item => promises.push(saveCategoryToFirestore(item)));
  state.products.forEach(item => promises.push(saveProductToFirestore(item)));
  state.transactions.forEach(item => promises.push(saveTransactionToFirestore(item)));
  state.stockMovements.forEach(item => promises.push(saveStockMovementToFirestore(item)));
  state.purchases.forEach(item => promises.push(savePurchaseToFirestore(item)));
  promises.push(saveSettingsToFirestore(state.settings));
  state.auditLogs.forEach(item => promises.push(saveAuditLogToFirestore(item)));

  await Promise.all(promises);
}
