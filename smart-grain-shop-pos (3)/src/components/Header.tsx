/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Language, User, ShopSettings, Product } from '../types';
import { translations } from '../translations';
import { MOCK_USERS } from '../mockData';
import { Globe, Bell, Shield, UserCheck, AlertTriangle, Settings, RefreshCw, Layers } from 'lucide-react';

interface HeaderProps {
  currentLanguage: Language;
  setLanguage: (lang: Language) => void;
  currentUser: User;
  onLogout: () => void;
  settings: ShopSettings;
  products: Product[];
  onOpenSettings: () => void;
  onRestoreDefaults: () => void;
}

export default function Header({
  currentLanguage,
  setLanguage,
  currentUser,
  onLogout,
  settings,
  products,
  onOpenSettings,
  onRestoreDefaults,
}: HeaderProps) {
  const t = translations[currentLanguage];
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Real-time PWA Online / Offline state detection
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Compute stock alerts
  const lowStockProducts = products.filter((p) => p.currentStock <= p.minStockAlert && p.currentStock > 0);
  const outOfStockProducts = products.filter((p) => p.currentStock <= 0);
  const totalAlerts = lowStockProducts.length + outOfStockProducts.length;

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 text-slate-950 p-2 rounded-xl shadow-inner font-display font-bold text-xl flex items-center justify-center tracking-tight h-10 w-10">
            🌾
          </div>
          <div>
            <h1 className="font-display font-bold text-lg tracking-tight text-white flex items-center gap-2">
              {settings.name}
              <span className="text-xs bg-amber-500/20 text-amber-400 font-sans font-medium px-2 py-0.5 rounded-full border border-amber-500/30">
                POS
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-sans">{t.tagline}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Storage Mode Badge: Cloud vs Local */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-xs">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>{currentLanguage === 'sw' ? 'Hifadhi ya Wingu (Cloud)' : 'Cloud Firestore'}</span>
          </div>

          {/* Online / Offline Network Badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold select-none transition-all shadow-xs ${
            isOnline 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span>{isOnline ? (currentLanguage === 'sw' ? 'Mtandao upo' : 'Online') : (currentLanguage === 'sw' ? 'Bila Mtandao' : 'Offline')}</span>
          </div>
          
          {/* Language Selector */}
          <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/60 shadow-sm text-xs">
            <button
              onClick={() => setLanguage('sw')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                currentLanguage === 'sw'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              TZ 🇹🇿 {t.swahili}
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                currentLanguage === 'en'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              US 🇺🇸 {t.english}
            </button>
          </div>

          {/* Real-time Alerts Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg border border-slate-700/80 transition-all flex items-center justify-center shadow-sm relative"
              id="notifications-bell"
            >
              <Bell className="w-4 h-4" />
              {totalAlerts > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-sans font-bold text-[10px] w-5 h-5 flex items-center justify-center rounded-full animate-pulse border border-slate-900 shadow-md">
                  {totalAlerts}
                </span>
              )}
            </button>

            {/* Notifications Popover */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                  <h3 className="font-semibold text-xs text-amber-400 tracking-wide uppercase flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {t.notifications}
                  </h3>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-slate-400 hover:text-white text-xs font-semibold px-1"
                  >
                    ×
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto p-3 space-y-2">
                  {totalAlerts === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">{t.noAlerts}</p>
                  ) : (
                    <>
                      {/* Out of Stock */}
                      {outOfStockProducts.map((p) => (
                        <div
                          key={p.id}
                          className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5 flex gap-2 items-start text-xs"
                        >
                          <span className="text-rose-500 font-bold mt-0.5 text-base leading-none">⚠️</span>
                          <div>
                            <p className="font-semibold text-rose-300">
                              {t.alertOutOfStock.replace('{name}', currentLanguage === 'sw' ? p.nameSw : p.nameEn)}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {p.sku}</p>
                          </div>
                        </div>
                      ))}

                      {/* Low Stock */}
                      {lowStockProducts.map((p) => (
                        <div
                          key={p.id}
                          className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 flex gap-2 items-start text-xs"
                        >
                          <span className="text-amber-500 font-bold mt-0.5 text-base leading-none">⚠️</span>
                          <div>
                            <p className="font-semibold text-amber-200">
                              {t.alertLowStock
                                .replace('{name}', currentLanguage === 'sw' ? p.nameSw : p.nameEn)
                                .replace('{stock}', String(p.currentStock))
                                .replace('{unit}', p.unit === 'kg' ? 'Kg' : 'pcs')}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {p.sku}</p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Active Professional Auth Session controls */}
          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-100 rounded-lg border border-slate-700 transition-all text-xs font-medium shadow-sm"
              id="role-switcher-btn"
            >
              <span className="text-base">{currentUser.avatar || '👤'}</span>
              <div className="text-left hidden sm:block">
                <p className="font-bold text-[10px] text-slate-400 uppercase tracking-wider leading-none">
                  {currentUser.role === 'admin' ? t.admin : currentUser.role === 'cashier' ? t.cashier : t.storekeeper}
                </p>
                <p className="text-xs text-slate-200 mt-0.5 leading-none">{currentUser.name}</p>
              </div>
              <UserCheck className="w-3.5 h-3.5 text-amber-400 ml-1.5" />
            </button>

            {/* Session Actions Popover */}
            {showRoleDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-3 bg-slate-800 border-b border-slate-700">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                    {currentLanguage === 'sw' ? 'Akaunti Yako' : 'Your Account'}
                  </p>
                </div>
                
                <div className="p-3 text-xs space-y-1 bg-slate-950/20">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{currentUser.avatar || '👤'}</span>
                    <div>
                      <p className="font-bold text-slate-200">{currentUser.name}</p>
                      <p className="text-[10px] text-indigo-400 font-mono">@{currentUser.username}</p>
                    </div>
                  </div>
                  {currentUser.email && (
                    <p className="text-[10px] text-slate-400 font-mono mt-1 border-t border-slate-800/60 pt-1">
                      {currentUser.email}
                    </p>
                  )}
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${
                      currentUser.role === 'admin'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : currentUser.role === 'storekeeper'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}>
                      {currentUser.role === 'admin' ? t.admin : currentUser.role === 'cashier' ? t.cashier : t.storekeeper}
                    </span>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded">
                      {currentLanguage === 'sw' ? 'Imekubaliwa' : 'Authorized'}
                    </span>
                  </div>
                </div>

                <div className="p-1.5 bg-slate-950/60 border-t border-slate-800 flex flex-col gap-1.5">
                  {currentUser.role === 'admin' && (
                    <button
                      onClick={() => {
                        setShowRoleDropdown(false);
                        onOpenSettings();
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-[10px] text-slate-300 rounded-md font-bold transition-all"
                    >
                      <Settings className="w-3 h-3 text-slate-400" />
                      {t.settings}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowRoleDropdown(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-lg transition-all shadow-md"
                  >
                    <RefreshCw className="w-3.5 h-3.5 rotate-180 shrink-0" />
                    {currentLanguage === 'sw' ? 'Ondoka Kwenye Mfumo' : 'Log Out Account'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  );
}
