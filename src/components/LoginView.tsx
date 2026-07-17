/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, firebaseConfig } from '../firebase';
import { checkIsUsersCollectionEmpty, saveUserToFirestore, fetchUserProfile } from '../firebaseService';
import { User, UserRole } from '../types';
import { translations } from '../translations';
import { ShieldCheck, Lock, Mail, User as UserIcon, RefreshCw, AlertTriangle, KeyRound, ArrowRight, Layers } from 'lucide-react';

interface LoginViewProps {
  currentLanguage: 'en' | 'sw';
  setLanguage: (lang: 'en' | 'sw') => void;
  onLoginSuccess: (user: User) => void;
}

export default function LoginView({
  currentLanguage,
  setLanguage,
  onLoginSuccess,
}: LoginViewProps) {
  const t = translations[currentLanguage];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // First administrator registration states
  const [isDbEmpty, setIsDbEmpty] = useState<boolean | null>(null);
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Paste raw Firebase config states
  const [pastedConfigText, setPastedConfigText] = useState('');
  const [showPasteConfig, setShowPasteConfig] = useState(false);

  // Offline Login States
  const [isOfflineLogin, setIsOfflineLogin] = useState(false);
  const [cachedUsers, setCachedUsers] = useState<User[]>([]);
  const [selectedOfflineUid, setSelectedOfflineUid] = useState('local-admin');

  useEffect(() => {
    const cached = localStorage.getItem('kaberege_cached_users');
    if (cached) {
      try {
        const list = JSON.parse(cached) as User[];
        setCachedUsers(list);
        if (list.length > 0) {
          setSelectedOfflineUid(list[0].id);
        }
      } catch (e) {
        console.error('Failed to parse cached users:', e);
      }
    }
  }, []);

  const handleSavePastedConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!pastedConfigText.trim()) {
      setError(currentLanguage === 'sw' ? 'Tafadhali bandika sifa zako kwanza!' : 'Please paste your credentials first!');
      return;
    }

    try {
      const keys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
      const parsedConfig: Record<string, string> = {};
      
      keys.forEach(key => {
        const regex = new RegExp(`['"]?${key}['"]?\\s*:\\s*['"]([^'"]+)['"]`, 'i');
        const match = pastedConfigText.match(regex);
        if (match && match[1]) {
          parsedConfig[key] = match[1].trim();
        }
      });

      if (Object.keys(parsedConfig).length === 0) {
        try {
          let cleaned = pastedConfigText.trim();
          cleaned = cleaned.replace(/^(const|let|var|window\.)\s*[\w\d_.]+\s*=\s*/i, '');
          cleaned = cleaned.replace(/;\s*$/, '');
          const jsonObj = JSON.parse(cleaned);
          keys.forEach(key => {
            if (jsonObj[key]) {
              parsedConfig[key] = String(jsonObj[key]).trim();
            }
          });
        } catch (e) {
          // Ignore
        }
      }

      if (!parsedConfig.apiKey || !parsedConfig.projectId) {
        setError(currentLanguage === 'sw' 
          ? 'Kosa la upakuaji! Tafadhali bandika "firebaseConfig" nzima kama inavyoonyeshwa kwenye Firebase Console (lazima iwe na apiKey na projectId).' 
          : 'Parsing failed! Please copy and paste the entire "firebaseConfig" object exactly as shown in Firebase Console (must contain apiKey and projectId).');
        return;
      }

      localStorage.setItem('kaberege_firebase_config', JSON.stringify(parsedConfig));
      localStorage.removeItem('kaberege_pos_mode');
      localStorage.removeItem('kaberege_pos_offline_user');

      setSuccess(currentLanguage === 'sw' 
        ? 'Sifa zimehifadhiwa kikamilifu! Ukurasa unapakia upya kuziunganisha...' 
        : 'Firebase credentials saved successfully! Reloading to connect...');

      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err: any) {
      console.error('Error parsing pasted config:', err);
      setError(currentLanguage === 'sw'
        ? 'Hitilafu imetokea wakati wa kuchakata maandishi uliyobandika!'
        : 'An error occurred while parsing the text. Please check the formatting.');
    }
  };

  const handleClearCustomConfig = () => {
    localStorage.removeItem('kaberege_firebase_config');
    setSuccess(currentLanguage === 'sw' ? 'Sifa zimefutwa! Inapakia upya...' : 'Credentials cleared! Reloading...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  useEffect(() => {
    async function checkFirstSetup() {
      if (localStorage.getItem('kaberege_pos_mode') === 'offline' || firebaseConfig.apiKey === "dummy-key-kaberege-pos") {
        setIsDbEmpty(false);
        setChecking(false);
        return;
      }

      try {
        const isEmpty = await checkIsUsersCollectionEmpty();
        setIsDbEmpty(isEmpty);
      } catch (err) {
        console.error('Error during setup check:', err);
        // Fallback to false so standard login is shown
        setIsDbEmpty(false);
      } finally {
        setChecking(false);
      }
    }
    checkFirstSetup();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError(currentLanguage === 'sw' ? 'Tafadhali jaza barua pepe na nenosiri!' : 'Please enter both email and password!');
      return;
    }

    setLoading(true);
    try {
      // 1. Authenticate with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const uid = userCredential.user.uid;

      // 2. Fetch profile from Firestore 'users' collection
      let profile = await fetchUserProfile(uid);

      if (!profile) {
        // If auth user exists but has no Firestore doc, we automatically create an Admin profile for them on the fly!
        const defaultName = email.split('@')[0];
        const defaultProfile: User = {
          id: uid,
          name: defaultName.charAt(0).toUpperCase() + defaultName.slice(1),
          username: defaultName.toLowerCase(),
          role: 'admin', // Promote them to Admin so they can manage the store
          status: 'active',
          avatar: '👑',
          email: email.trim().toLowerCase()
        };
        
        try {
          await saveUserToFirestore(defaultProfile);
          profile = defaultProfile;
        } catch (saveErr) {
          console.error("Failed to auto-create user profile in Firestore:", saveErr);
          // If Firestore is still initializing or rules block it, let them log in anyway using this profile
          profile = defaultProfile;
        }
      }

      if (profile.status === 'inactive') {
        setError(currentLanguage === 'sw' 
          ? 'Akaunti hii imefungwa kwa sasa na haiwezi kutumika!' 
          : 'Your account is suspended. Please contact your administrator.');
        return;
      }

      setSuccess(currentLanguage === 'sw' ? 'Umeingia kikamilifu!' : 'Login successful!');
      setTimeout(() => {
        onLoginSuccess(profile);
      }, 500);

    } catch (err: any) {
      console.error('Login error:', err);
      let errMsg = currentLanguage === 'sw' ? 'Barua pepe au nenosiri si sahihi!' : 'Invalid email or password!';
      const errStr = (err.code || err.message || '').toLowerCase();
      
      if (err.code === 'auth/user-not-found') {
        errMsg = currentLanguage === 'sw' ? 'Mtumiaji huyu hajasajiliwa kwenye mfumo!' : 'User account not found!';
      } else if (err.code === 'auth/wrong-password') {
        errMsg = currentLanguage === 'sw' ? 'Nenosiri si sahihi!' : 'Incorrect password!';
      } else if (err.code === 'auth/network-request-failed') {
        errMsg = currentLanguage === 'sw' ? 'Tatizo la mtandao, tafadhali jaribu tena!' : 'Network connection failed. Please check your internet connection.';
      } else if (err.code === 'auth/operation-not-allowed' || errStr.includes('operation-not-allowed')) {
        errMsg = currentLanguage === 'sw'
          ? "Njia ya kuingia kwa Barua Pepe/Nenosiri haijawezeshwa katika Firebase Console! Tafadhali nenda kwenye Firebase Console -> Authentication -> Sign-in method na uwashe 'Email/Password' kisha uhifadhi mabadiliko."
          : "Email/Password sign-in is disabled in your Firebase project. Please go to Firebase Console -> Authentication -> Sign-in method -> Click on 'Email/Password' -> Enable it and click Save.";
      } else if (err.code === 'auth/configuration-not-found' || errStr.includes('configuration-not-found') || errStr.includes('configuration')) {
        errMsg = currentLanguage === 'sw'
          ? "HUJAWEZESHA AUTHENTICATION! Tafadhali fungua Firebase Console (console.firebase.google.com) -> chagua mradi wako -> nenda 'Authentication' -> bofya 'Get Started' -> kisha nenda tab ya 'Sign-in method' na uwashe 'Email/Password' (Email/Password)."
          : "AUTHENTICATION NOT ENABLED! Please open Firebase Console (console.firebase.google.com) -> select your project -> go to 'Authentication' -> click 'Get Started' -> then go to 'Sign-in method' and enable 'Email/Password'.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEnableLocalOfflineMode = () => {
    setIsOfflineLogin(true);
    setError('');
    setSuccess('');
  };

  const handleOfflineLoginConfirm = () => {
    // Save to local storage that we are running locally/offline
    localStorage.setItem('kaberege_pos_mode', 'offline');
    
    let localUser: User;
    
    if (selectedOfflineUid === 'local-admin') {
      localUser = {
        id: 'local-admin-uid',
        name: currentLanguage === 'sw' ? 'Msimamizi wa Ndani (Local Admin)' : 'Local Administrator',
        username: 'admin',
        role: 'admin',
        status: 'active',
        email: 'local-admin@grainshop.com',
        avatar: '👑'
      };
    } else {
      const found = cachedUsers.find(u => u.id === selectedOfflineUid);
      if (found) {
        localUser = found;
      } else {
        // Fallback
        localUser = {
          id: 'local-admin-uid',
          name: currentLanguage === 'sw' ? 'Msimamizi wa Ndani (Local Admin)' : 'Local Administrator',
          username: 'admin',
          role: 'admin',
          status: 'active',
          email: 'local-admin@grainshop.com',
          avatar: '👑'
        };
      }
    }
    
    // Save offline user to localStorage
    localStorage.setItem('kaberege_pos_offline_user', JSON.stringify(localUser));
    
    setSuccess(currentLanguage === 'sw' ? 'Hali ya Nje ya Mtandao Imeamilishwa! Unafunguliwa sasa...' : 'Offline Local Mode activated! Entering now...');
    
    setTimeout(() => {
      // Force page reload to trigger clean mount on local mode
      window.location.reload();
    }, 1000);
  };

  const handleCreateFirstAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password || !adminName || !adminUsername) {
      setError(currentLanguage === 'sw' ? 'Tafadhali jaza uga zote kikamilifu!' : 'Please fill out all fields completely!');
      return;
    }

    if (password.length < 6) {
      setError(currentLanguage === 'sw' ? 'Nenosiri lazima liwe na herufi zisizopungua 6!' : 'Password must be at least 6 characters long!');
      return;
    }

    setLoading(true);
    try {
      // 1. Create auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const uid = userCredential.user.uid;

      // 2. Map profile with Admin privileges
      const newAdminUser: User = {
        id: uid,
        name: adminName.trim(),
        username: adminUsername.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        role: 'admin',
        status: 'active',
        avatar: '👴'
      };

      await saveUserToFirestore(newAdminUser);
      setSuccess(currentLanguage === 'sw' ? 'Akaunti ya kwanza ya Admin imeundwa kikamilifu!' : 'First Admin account created successfully!');
      
      // Update local state to show standard login or directly login
      setIsDbEmpty(false);
      setTimeout(() => {
        onLoginSuccess(newAdminUser);
      }, 1000);

    } catch (err: any) {
      console.error('First setup error:', err);
      const errStr = (err.code || err.message || '').toLowerCase();
      let errMsg = err.message || (currentLanguage === 'sw' ? 'Imeshindwa kuunda akaunti ya Admin!' : 'Failed to initialize system administrator account!');
      
      if (err.code === 'auth/operation-not-allowed' || errStr.includes('operation-not-allowed')) {
        errMsg = currentLanguage === 'sw'
          ? "Njia ya kuingia kwa Barua Pepe/Nenosiri haijawezeshwa katika Firebase Console! Tafadhali nenda kwenye Firebase Console -> Authentication -> Sign-in method na uwashe 'Email/Password' kisha uhifadhi mabadiliko."
          : "Email/Password sign-in is disabled in your Firebase project. Please go to Firebase Console -> Authentication -> Sign-in method -> Click on 'Email/Password' -> Enable it and click Save.";
      } else if (err.code === 'auth/configuration-not-found' || errStr.includes('configuration-not-found') || errStr.includes('configuration')) {
        errMsg = currentLanguage === 'sw'
          ? "HUJAWEZESHA AUTHENTICATION! Tafadhali fungua Firebase Console (console.firebase.google.com) -> chagua mradi wako -> nenda 'Authentication' -> bofya 'Get Started' -> kisha nenda tab ya 'Sign-in method' na uwashe 'Email/Password' (Email/Password)."
          : "AUTHENTICATION NOT ENABLED! Please open Firebase Console (console.firebase.google.com) -> select your project -> go to 'Authentication' -> click 'Get Started' -> then go to 'Sign-in method' and enable 'Email/Password'.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-6">
        <div className="flex flex-col items-center space-y-4 max-w-md text-center">
          <RefreshCw className="w-12 h-12 text-amber-500 animate-spin" />
          <h1 className="text-xl font-extrabold tracking-tight text-white font-sans">
            Smart Grain Shop POS
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            {currentLanguage === 'sw' 
              ? 'Inakagua mazingira ya mfumo...' 
              : 'Checking system security context...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-6 font-sans relative overflow-hidden">
      
      {/* Background soft ambient glowing details */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-amber-600/5 blur-[120px] pointer-events-none"></div>

      {/* HEADER BAR WITH LANGUAGE TOGGLE */}
      <div className="flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-bold font-display text-sm">
            SG
          </div>
          <span className="font-display font-extrabold text-white text-sm tracking-tight hidden sm:inline">
            Smart Grain Shop
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setLanguage('sw')}
            className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-colors ${
              currentLanguage === 'sw' 
                ? 'bg-amber-500 text-slate-950 shadow-xs' 
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Kiswahili
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-colors ${
              currentLanguage === 'en' 
                ? 'bg-amber-500 text-slate-950 shadow-xs' 
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* CENTRAL AUTHENTICATION CARD CONTAINER */}
      <div className="w-full max-w-md mx-auto my-auto z-10">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-2">
              <ShieldCheck className="w-6 h-6 text-amber-500" />
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-black tracking-tight text-white">
              {isDbEmpty 
                ? (currentLanguage === 'sw' ? 'Sanidi Mfumo' : 'System Setup')
                : (currentLanguage === 'sw' ? 'Ingia Kwenye Mfumo' : 'Secure Login')}
            </h1>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              {isDbEmpty
                ? (currentLanguage === 'sw' 
                    ? 'Sajili akaunti ya kwanza ya Meneja Mkuu (Admin) ili kuanza kutumia mfumo.' 
                    : 'Configure the primary system Administrator account to begin using the POS application.')
                : (currentLanguage === 'sw' 
                    ? 'Weka barua pepe na nenosiri lako ili kufikia mauzo na ripoti za duka.' 
                    : 'Enter your valid authorized email and password to access the grain shop platform.')}
            </p>
          </div>

          {/* ALERTS */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs flex items-start gap-2 leading-relaxed">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* FORM SETUP */}
          {isDbEmpty ? (
            // FIRST ADMIN SIGNUP
            <form onSubmit={handleCreateFirstAdmin} className="space-y-4 text-xs text-slate-300">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  {currentLanguage === 'sw' ? 'Jina Kamili' : 'Full Name'}
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g. Mzee Layson"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  {currentLanguage === 'sw' ? 'Jina la Mtumiaji (Username)' : 'Username'}
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="e.g. layson_admin"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  {currentLanguage === 'sw' ? 'Barua Pepe (Email)' : 'Primary Email Address'}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@grainshop.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  {currentLanguage === 'sw' ? 'Nenosiri la Kuingia' : 'Security Password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 mt-4 text-[13px]"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <KeyRound className="w-4 h-4 text-slate-950" />
                )}
                {currentLanguage === 'sw' ? 'Sajili Admin na Ingia' : 'Initialize Administrator & Login'}
              </button>
            </form>
          ) : isOfflineLogin ? (
            // OFFLINE LOGIN FORM WITH USER OPTIONS
            <div className="space-y-4 text-xs text-slate-300">
              <p className="text-[11px] text-amber-500/80 bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-xl text-center leading-normal">
                {currentLanguage === 'sw'
                  ? 'Umechagua kuingia bila mtandao. Chagua akaunti yako hapa chini ili kuendelea kuuza.'
                  : 'You are entering offline mode. Select your user profile below to continue.'}
              </p>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  {currentLanguage === 'sw' ? 'Chagua Jina Lako (Mtumiaji)' : 'Select Your Account'}
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <select
                    value={selectedOfflineUid}
                    onChange={(e) => setSelectedOfflineUid(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium"
                  >
                    {cachedUsers.map((u) => (
                      <option key={u.id} value={u.id} className="bg-slate-950 text-white">
                        {u.name} ({u.role === 'admin' ? (currentLanguage === 'sw' ? 'Msimamizi' : 'Admin') : u.role === 'cashier' ? (currentLanguage === 'sw' ? 'Muuzaji' : 'Cashier') : (currentLanguage === 'sw' ? 'Mshika Stoo' : 'Storekeeper')})
                      </option>
                    ))}
                    <option value="local-admin" className="bg-slate-950 text-white">
                      {currentLanguage === 'sw' ? 'Msimamizi wa Ndani (Local Admin)' : 'Local Administrator'}
                    </option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOfflineLoginConfirm}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 mt-4 text-[13px] cursor-pointer"
              >
                <Layers className="w-4 h-4 text-slate-950" />
                {currentLanguage === 'sw' ? 'Ingia Bila Mtandao Sasa' : 'Login Offline Now'}
              </button>

              <button
                type="button"
                onClick={() => setIsOfflineLogin(false)}
                className="w-full py-2 bg-transparent hover:bg-slate-800/25 text-slate-400 hover:text-slate-200 rounded-xl font-medium transition-all flex items-center justify-center gap-1 text-[11px] mt-2 cursor-pointer"
              >
                {currentLanguage === 'sw' ? '← Rudi Kwenye Login ya Mtandao' : '← Back to Online Sign-in'}
              </button>
            </div>
          ) : (
            // STANDARD SECURE LOGIN FORM
            <form onSubmit={handleLogin} className="space-y-4 text-xs text-slate-300">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  {currentLanguage === 'sw' ? 'Barua Pepe' : 'Email Address'}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    {currentLanguage === 'sw' ? 'Nenosiri' : 'Password'}
                  </label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 mt-4 text-[13px]"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-slate-950" />
                )}
                {currentLanguage === 'sw' ? 'Ingia Salama' : 'Secure Authorization'}
              </button>

              <div className="relative flex py-2.5 items-center">
                <div className="flex-grow border-t border-slate-800/40"></div>
                <span className="flex-shrink mx-4 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                  {currentLanguage === 'sw' ? 'Au' : 'Or'}
                </span>
                <div className="flex-grow border-t border-slate-800/40"></div>
              </div>

              <button
                type="button"
                onClick={handleEnableLocalOfflineMode}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 text-amber-400 hover:text-amber-300 border border-slate-800 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs cursor-pointer shadow-sm"
              >
                <Layers className="w-4 h-4" />
                {currentLanguage === 'sw' ? 'Fungua Bila Mtandao (Offline POS)' : 'Open Offline (Local POS)'}
              </button>

              <p className="text-[10px] text-slate-500 text-center leading-relaxed mt-1">
                {currentLanguage === 'sw'
                  ? 'Bofya hapa kama upo dukani na huna mtandao au upo mbali. Mauzo yatahifadhiwa na kusawazishwa pindi ukipata mtandao.'
                  : 'Click here if you are at the shop with no internet or far away. Sales will be saved locally and sync once online.'}
              </p>
            </form>
          )}



        </div>
      </div>

      {/* FOOTER FOOTNOTE */}
      <div className="text-center z-10 space-y-1">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
          {currentLanguage === 'sw' 
            ? 'Ulinzi na Usalama umeidhinishwa na Firebase Auth' 
            : 'Security and Auth governed by Firebase Auth protocols'}
        </p>
        <p className="text-[9px] text-slate-600">
          © 2026 Kariakoo Grain Center POS. All rights reserved.
        </p>
      </div>

    </div>
  );
}
