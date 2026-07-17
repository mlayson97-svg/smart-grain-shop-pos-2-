import { initializeApp, getApp, getApps } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const getFirebaseConfig = () => {
  // Try to load custom configuration saved directly in the browser
  const saved = typeof window !== 'undefined' ? localStorage.getItem('kaberege_firebase_config') : null;
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.apiKey && parsed.apiKey !== "dummy-key-kaberege-pos") {
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing saved firebase config:', e);
    }
  }

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBATlCCDCFuqObzYb5-a76aq4UmjHc9p4Q",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "smart-grain-shop-pos.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "smart-grain-shop-pos",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "smart-grain-shop-pos.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "681501899397",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:681501899397:web:3b7cd0ffe5fd1685eec7ec"
  };
};

export const firebaseConfig = getFirebaseConfig();

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

const auth = getAuth(app);

export { db, auth };

