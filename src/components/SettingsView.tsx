/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ShopSettings, AuditLog, User, UserRole } from '../types';
import { translations } from '../translations';
import { 
  Save, 
  RefreshCw, 
  Download, 
  Settings, 
  ShieldCheck, 
  HelpCircle, 
  Store, 
  AlertTriangle,
  Users,
  UserPlus,
  Check,
  X,
  Key,
  Edit,
  Trash2
} from 'lucide-react';
import { 
  createAuthUserWithoutSignOut, 
  fetchUsersFromFirestore, 
  saveUserToFirestore, 
  deleteUserFromFirestore, 
  sendUserPasswordResetEmail 
} from '../firebaseService';

interface SettingsViewProps {
  currentLanguage: Language;
  currentUser: User;
  settings: ShopSettings;
  auditLogs: AuditLog[];
  onSaveSettings: (updated: ShopSettings, audit: AuditLog) => void;
  onRestoreDefaults: () => void;
  onRestoreBackup: (backupData: any) => void;
}

type Language = 'en' | 'sw';

export default function SettingsView({
  currentLanguage,
  currentUser,
  settings,
  auditLogs,
  onSaveSettings,
  onRestoreDefaults,
  onRestoreBackup,
}: SettingsViewProps) {
  const t = translations[currentLanguage];

  // Form states
  const [shopName, setShopName] = useState(settings.name);
  const [shopAddress, setShopAddress] = useState(settings.address);
  const [shopPhone, setShopPhone] = useState(settings.phone);
  const [currencySymbol, setCurrencySymbol] = useState(settings.currency);
  const [taxRateInput, setTaxRateInput] = useState(String(settings.taxRate));
  const [receiptMsgEn, setReceiptMsgEn] = useState(settings.receiptMessageEn);
  const [receiptMsgSw, setReceiptMsgSw] = useState(settings.receiptMessageSw);

  // Status banner
  const [saveSuccess, setSaveSuccess] = useState(false);

  // User Management states
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userSuccess, setUserSuccess] = useState('');
  const [userError, setUserError] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  // New User Form fields
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('cashier');
  const [newStatus, setNewStatus] = useState<'active' | 'inactive'>('active');

  // Editing User states
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('cashier');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');

  // Load users list on mount
  useEffect(() => {
    async function loadUsers() {
      if (currentUser.role !== 'admin') return;
      setUserLoading(true);
      try {
        const list = await fetchUsersFromFirestore();
        setUsers(list);
      } catch (err) {
        console.error('Failed to load users:', err);
      } finally {
        setUserLoading(false);
      }
    }
    loadUsers();
  }, [currentUser]);

  // Create secondary user accounts
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    setUserSuccess('');

    if (!newName.trim() || !newUsername.trim() || !newEmail.trim() || !newPassword.trim()) {
      setUserError(currentLanguage === 'sw' ? 'Tafadhali jaza uga zote!' : 'Please fill all fields!');
      return;
    }

    if (newPassword.length < 6) {
      setUserError(currentLanguage === 'sw' ? 'Nenosiri lazima liwe na herufi angalau 6!' : 'Password must be at least 6 characters!');
      return;
    }

    setUserLoading(true);
    try {
      // 1. Create firebase auth user using utility to keep current admin logged in
      const uid = await createAuthUserWithoutSignOut(newEmail.trim().toLowerCase(), newPassword);

      // 2. Save user profile to Firestore
      const newUser: User = {
        id: uid,
        name: newName.trim(),
        username: newUsername.trim().toLowerCase(),
        email: newEmail.trim().toLowerCase(),
        role: newRole,
        status: newStatus,
        avatar: newRole === 'admin' ? '👴' : newRole === 'storekeeper' ? '📦' : '🪙'
      };

      await saveUserToFirestore(newUser);

      // 3. Clear form and update local list
      setUsers(prev => [...prev, newUser]);
      setIsCreatingUser(false);
      setNewName('');
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('cashier');
      setNewStatus('active');

      setUserSuccess(currentLanguage === 'sw' ? 'Mtumiaji mpya amesajiliwa kikamilifu!' : 'New user registered successfully!');
    } catch (err: any) {
      console.error('Create user error:', err);
      setUserError(err.message || (currentLanguage === 'sw' ? 'Imeshindwa kusajili mtumiaji mpya.' : 'Failed to register new user.'));
    } finally {
      setUserLoading(false);
    }
  };

  const handleStartEditUser = (u: User) => {
    setEditingUserId(u.id);
    setEditName(u.name);
    setEditUsername(u.username);
    setEditRole(u.role);
    setEditStatus(u.status);
  };

  const handleSaveEditUser = async (userId: string) => {
    setUserError('');
    setUserSuccess('');

    if (!editName.trim() || !editUsername.trim()) {
      setUserError(currentLanguage === 'sw' ? 'Jina na jina la mtumiaji hayawezi kuwa tupu!' : 'Name and username cannot be empty!');
      return;
    }

    setUserLoading(true);
    try {
      const existingUser = users.find(u => u.id === userId);
      if (!existingUser) throw new Error('User not found');

      const updatedUser: User = {
        ...existingUser,
        name: editName.trim(),
        username: editUsername.trim().toLowerCase(),
        role: editRole,
        status: editStatus,
        avatar: editRole === 'admin' ? '👴' : editRole === 'storekeeper' ? '📦' : '🪙'
      };

      await saveUserToFirestore(updatedUser);

      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
      setEditingUserId(null);
      setUserSuccess(currentLanguage === 'sw' ? 'Mabadiliko yamehifadhiwa kikamilifu!' : 'Changes saved successfully!');
    } catch (err: any) {
      console.error('Edit user error:', err);
      setUserError(err.message || (currentLanguage === 'sw' ? 'Imeshindwa kuhifadhi mabadiliko.' : 'Failed to save changes.'));
    } finally {
      setUserLoading(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    setUserError('');
    setUserSuccess('');
    try {
      await sendUserPasswordResetEmail(email);
      setUserSuccess(currentLanguage === 'sw' 
        ? `Barua pepe ya kuweka upya nenosiri imetumwa kwa ${email}` 
        : `Password reset email sent to ${email}`);
    } catch (err: any) {
      console.error('Reset password error:', err);
      setUserError(err.message || (currentLanguage === 'sw' ? 'Imeshindwa kutuma barua pepe ya kuweka upya nenosiri.' : 'Failed to send password reset email.'));
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    const confirmDelete = confirm(currentLanguage === 'sw'
      ? `Je, una uhakika unataka kufuta wasifu wa ${name}?`
      : `Are you sure you want to delete profile for ${name}?`);
    if (!confirmDelete) return;

    setUserError('');
    setUserSuccess('');
    setUserLoading(true);
    try {
      await deleteUserFromFirestore(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      setUserSuccess(currentLanguage === 'sw' ? 'Mtumiaji amefutwa kwenye mfumo.' : 'User deleted from system.');
    } catch (err: any) {
      console.error('Delete user error:', err);
      setUserError(err.message || (currentLanguage === 'sw' ? 'Imeshindwa kufuta mtumiaji.' : 'Failed to delete user.'));
    } finally {
      setUserLoading(false);
    }
  };

  // Submit Settings
  const handleSubmitSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);

    const tax = parseFloat(taxRateInput);
    const updatedSettings: ShopSettings = {
      name: shopName.trim(),
      address: shopAddress.trim(),
      phone: shopPhone.trim(),
      currency: currencySymbol.trim(),
      taxRate: isNaN(tax) || tax < 0 ? 0 : tax,
      receiptMessageEn: receiptMsgEn.trim(),
      receiptMessageSw: receiptMsgSw.trim(),
    };

    const newAuditLog: AuditLog = {
      id: `audit-settings-${Date.now()}`,
      date: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      actionEn: `Updated shop configuration variables`,
      actionSw: `Alisajili mabadiliko ya mipangilio ya duka`,
      details: `Changed tax rate to ${updatedSettings.taxRate}% and renamed store to "${updatedSettings.name}"`,
    };

    onSaveSettings(updatedSettings, newAuditLog);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Local JSON Backup download
  const handleBackupDownload = () => {
    const backupObj = {
      timestamp: new Date().toISOString(),
      exportUser: currentUser.name,
      database: {
        products: JSON.parse(localStorage.getItem('grain_shop_products') || '[]'),
        categories: JSON.parse(localStorage.getItem('grain_shop_categories') || '[]'),
        transactions: JSON.parse(localStorage.getItem('grain_shop_transactions') || '[]'),
        stockMovements: JSON.parse(localStorage.getItem('grain_shop_stock_movements') || '[]'),
        purchases: JSON.parse(localStorage.getItem('grain_shop_purchases') || '[]'),
        settings: JSON.parse(localStorage.getItem('grain_shop_settings') || '{}'),
      }
    };

    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Kariakoo_Grain_POS_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Local JSON Backup upload & validation
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && json.database) {
          const hasConfirm = confirm(currentLanguage === 'sw' 
            ? 'Je, una uhakika unataka kurejesha data kutoka kwenye faili hili la chelezo? Hii itafuta mauzo yako yote ya sasa!' 
            : 'Are you sure you want to restore data from this backup file? This will overwrite all your current sales and inventory records.');
          if (hasConfirm) {
            onRestoreBackup(json);
            alert(currentLanguage === 'sw' ? 'Hifadhidata imerejeshwa kikamilifu!' : 'Database restored successfully from backup file!');
          }
        } else {
          alert(currentLanguage === 'sw' ? 'Faili hili halina muundo sahihi wa chelezo ya mfumo!' : 'Invalid backup file format! Missing database block.');
        }
      } catch (err) {
        alert(currentLanguage === 'sw' ? 'Kushindwa kusoma faili! Hakikisha ni faili sahihi la JSON.' : 'Failed to parse file! Ensure it is a valid JSON backup.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6 font-sans">
      
      {/* RESTRICT NON-ADMIN FROM MODIFYING SETTINGS EXCEPT VIEWING AUDIT */}
      {currentUser.role !== 'admin' ? (
        <div className="bg-amber-50 border-l-4 border-amber-600 p-4 rounded-r-xl flex items-start gap-2.5 shadow-xs text-xs text-amber-900">
          <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold">{t.unauthorized}</p>
            <p className="mt-1 text-amber-800">Only shop managers with **Administrator** credentials can alter currency, taxes, and receipt footnotes.</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SHOP VARIABLES FORM (2 COLUMNS) */}
        <div className="lg:col-span-2 space-y-4">
          <form onSubmit={handleSubmitSettings} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center gap-2">
              <Store className="w-4.5 h-4.5 text-amber-500" />
              <h3 className="font-display font-bold text-slate-900 text-xs uppercase tracking-wide">
                {t.shopInfoTitle}
              </h3>
            </div>

            {saveSuccess && (
              <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold p-2.5 rounded-lg text-xs">
                {t.settingsSaved}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.shopName}</label>
                <input
                  type="text"
                  disabled={currentUser.role !== 'admin'}
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50 text-slate-800 font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.phone}</label>
                <input
                  type="text"
                  disabled={currentUser.role !== 'admin'}
                  value={shopPhone}
                  onChange={(e) => setShopPhone(e.target.value)}
                  className="w-full border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50 text-slate-850 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.address}</label>
                <input
                  type="text"
                  disabled={currentUser.role !== 'admin'}
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  className="w-full border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.taxRate} (%)</label>
                <input
                  type="number"
                  disabled={currentUser.role !== 'admin'}
                  value={taxRateInput}
                  onChange={(e) => setTaxRateInput(e.target.value)}
                  className="w-full border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50 font-mono font-bold text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.receiptMsgSw} (Kiswahili)</label>
                <textarea
                  disabled={currentUser.role !== 'admin'}
                  value={receiptMsgSw}
                  onChange={(e) => setReceiptMsgSw(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50 text-slate-750 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.receiptMsgEn} (English)</label>
                <textarea
                  disabled={currentUser.role !== 'admin'}
                  value={receiptMsgEn}
                  onChange={(e) => setReceiptMsgEn(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-250 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-slate-50/50 text-slate-750 font-medium"
                />
              </div>
            </div>

            {currentUser.role === 'admin' && (
              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {t.saveSettings}
                </button>
              </div>
            )}
          </form>

          {/* USER PROFILE & ROLE MANAGEMENT PANEL */}
          {currentUser.role === 'admin' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h4 className="font-display font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-2">
                    <Users className="w-4.5 h-4.5 text-amber-500" />
                    {currentLanguage === 'sw' ? 'Usimamizi wa Watumiaji na Majukumu' : 'User Profiles & Role Management'}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {currentLanguage === 'sw' 
                      ? 'Sajili wauzaji na watunza stoo wapya, hariri majukumu au badilisha nenosiri.' 
                      : 'Register cashiers and storekeepers, update active roles, reset passwords, or suspend access.'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsCreatingUser(!isCreatingUser);
                    setUserSuccess('');
                    setUserError('');
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors self-start sm:self-auto"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {isCreatingUser 
                    ? (currentLanguage === 'sw' ? 'Funga' : 'Close Form')
                    : (currentLanguage === 'sw' ? 'Sajili Mtumiaji' : 'New User')}
                </button>
              </div>

              {userSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-xs font-medium">
                  {userSuccess}
                </div>
              )}

              {userError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-lg text-xs font-medium">
                  {userError}
                </div>
              )}

              {isCreatingUser && (
                <form onSubmit={handleCreateUser} className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3 text-xs">
                  <h5 className="font-display font-bold text-slate-800 text-[10px] uppercase tracking-wide flex items-center gap-1">
                    <UserPlus className="w-3.5 h-3.5 text-amber-500" />
                    {currentLanguage === 'sw' ? 'Sajili Akaunti Mpya' : 'Create New Account'}
                  </h5>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        {currentLanguage === 'sw' ? 'Jina Kamili' : 'Full Name'}
                      </label>
                      <input
                        type="text"
                        required
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white text-slate-800 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        {currentLanguage === 'sw' ? 'Jina la Mtumiaji (Username)' : 'Username'}
                      </label>
                      <input
                        type="text"
                        required
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="e.g. johndoe"
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white text-slate-805 font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="e.g. john@example.com"
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white text-slate-800 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        {currentLanguage === 'sw' ? 'Nenosiri' : 'Password'}
                      </label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white text-slate-800 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        {currentLanguage === 'sw' ? 'Jukumu la Mfumo' : 'Access Role'}
                      </label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as UserRole)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white text-slate-800 font-medium"
                      >
                        <option value="admin">{currentLanguage === 'sw' ? 'Meneja Mkuu (Admin)' : 'Admin'}</option>
                        <option value="cashier">{currentLanguage === 'sw' ? 'Mshika Fedha (Cashier)' : 'Cashier'}</option>
                        <option value="storekeeper">{currentLanguage === 'sw' ? 'Mtunza Stoo (Storekeeper)' : 'Store Keeper'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        {currentLanguage === 'sw' ? 'Hali ya Akaunti' : 'Account Status'}
                      </label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as 'active' | 'inactive')}
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white text-slate-800 font-medium"
                      >
                        <option value="active">{currentLanguage === 'sw' ? 'Inafanya Kazi' : 'Active'}</option>
                        <option value="inactive">{currentLanguage === 'sw' ? 'Imefungwa' : 'Inactive'}</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingUser(false)}
                      className="px-4 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 bg-white hover:bg-slate-100 transition-colors"
                    >
                      {currentLanguage === 'sw' ? 'Ghairi' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={userLoading}
                      className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      {userLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      {currentLanguage === 'sw' ? 'Hifadhi Mtumiaji' : 'Save User'}
                    </button>
                  </div>
                </form>
              )}

              {/* USERS DIRECTORY GRID */}
              <div className="space-y-2">
                {userLoading && users.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs font-mono flex items-center justify-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    {currentLanguage === 'sw' ? 'Inapakia watumiaji...' : 'Loading registered users...'}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-150">
                    <table className="min-w-full divide-y divide-slate-150 text-left text-xs text-slate-700 bg-white">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
                        <tr>
                          <th className="px-3 py-2.5">{currentLanguage === 'sw' ? 'Mtumiaji' : 'User'}</th>
                          <th className="px-3 py-2.5">Email</th>
                          <th className="px-3 py-2.5">{currentLanguage === 'sw' ? 'Jukumu' : 'Role'}</th>
                          <th className="px-3 py-2.5">Status</th>
                          <th className="px-3 py-2.5 text-right">{currentLanguage === 'sw' ? 'Hatua' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {users.map((u) => {
                          const isEditing = editingUserId === u.id;
                          return (
                            <tr key={u.id} className="hover:bg-slate-50/55 transition-colors">
                              <td className="px-3 py-2.5">
                                {isEditing ? (
                                  <div className="space-y-1">
                                    <input
                                      type="text"
                                      value={editName}
                                      onChange={(e) => setEditName(e.target.value)}
                                      className="border border-slate-250 rounded px-2 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold text-slate-800"
                                      placeholder="Full name"
                                    />
                                    <input
                                      type="text"
                                      value={editUsername}
                                      onChange={(e) => setEditUsername(e.target.value)}
                                      className="border border-slate-250 rounded px-2 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-[11px] text-slate-800"
                                      placeholder="username"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="text-base shrink-0 bg-slate-100 w-7 h-7 rounded-full flex items-center justify-center">
                                      {u.avatar || '👤'}
                                    </span>
                                    <div>
                                      <p className="font-bold text-slate-900">{u.name}</p>
                                      <p className="text-[10px] text-slate-400 font-mono">@{u.username}</p>
                                    </div>
                                  </div>
                                )}
                              </td>
                              
                              <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">
                                {u.email || '-'}
                              </td>

                              <td className="px-3 py-2.5">
                                {isEditing ? (
                                  <select
                                    value={editRole}
                                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                                    className="border border-slate-250 rounded px-1.5 py-0.5 focus:outline-none bg-white font-medium text-slate-800"
                                  >
                                    <option value="admin">Admin</option>
                                    <option value="cashier">Cashier</option>
                                    <option value="storekeeper">Storekeeper</option>
                                  </select>
                                ) : (
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider ${
                                    u.role === 'admin' 
                                      ? 'bg-purple-100 text-purple-700 border border-purple-250' 
                                      : u.role === 'storekeeper'
                                      ? 'bg-blue-100 text-blue-700 border border-blue-250'
                                      : 'bg-amber-100 text-amber-700 border border-amber-250'
                                  }`}>
                                    {u.role === 'storekeeper' ? (currentLanguage === 'sw' ? 'Stoo' : 'Store keeper') : u.role}
                                  </span>
                                )}
                              </td>

                              <td className="px-3 py-2.5">
                                {isEditing ? (
                                  <select
                                    value={editStatus}
                                    onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive')}
                                    className="border border-slate-250 rounded px-1.5 py-0.5 focus:outline-none bg-white font-medium text-slate-800"
                                  >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                  </select>
                                ) : (
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                                    u.status === 'active' ? 'text-emerald-600' : 'text-slate-400 line-through'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      u.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                    }`}></span>
                                    {u.status === 'active' ? (currentLanguage === 'sw' ? 'Inafanya' : 'Active') : (currentLanguage === 'sw' ? 'Imefungwa' : 'Suspended')}
                                  </span>
                                )}
                              </td>

                              <td className="px-3 py-2.5 text-right">
                                {isEditing ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleSaveEditUser(u.id)}
                                      disabled={userLoading}
                                      className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded border border-emerald-200"
                                      title="Save changes"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditingUserId(null)}
                                      className="p-1 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded border border-slate-200"
                                      title="Cancel edit"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1.5">
                                    {u.email && (
                                      <button
                                        onClick={() => handleResetPassword(u.email!)}
                                        className="p-1 hover:bg-amber-100 text-slate-600 rounded border border-slate-200"
                                        title={currentLanguage === 'sw' ? 'Tuma upya nenosiri' : 'Send password reset email'}
                                      >
                                        <Key className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleStartEditUser(u)}
                                      className="p-1 hover:bg-indigo-100 text-indigo-600 rounded border border-slate-200"
                                      title="Edit profile & role"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(u.id, u.name)}
                                      disabled={userLoading}
                                      className="p-1 hover:bg-rose-100 text-rose-600 rounded border border-slate-200"
                                      title="Delete profile"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BACKUP & RESTORE BANNER */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h4 className="font-display font-bold text-slate-900 text-xs uppercase tracking-wide">
                {t.backupTitle}
              </h4>
              <p className="text-[10px] text-slate-400 mt-1">{t.backupDesc}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleBackupDownload}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-750 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Download className="w-4 h-4 text-amber-400 animate-bounce" />
                {t.backupBtn}
              </button>

              {currentUser.role === 'admin' && (
                <button
                  onClick={() => {
                    if (confirm(t.restoreConfirm)) {
                      onRestoreDefaults();
                      alert(t.restoredSuccess);
                    }
                  }}
                  className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className="w-4 h-4 text-rose-600" />
                  {t.restoreBtn}
                </button>
              )}
            </div>

            {currentUser.role === 'admin' && (
              <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row items-center gap-3">
                <div className="text-[11px] text-slate-500 flex-1 leading-normal">
                  <span className="font-bold text-slate-700 block">
                    {currentLanguage === 'sw' ? 'Pakia Data Kutoka Chelezo (.json)' : 'Restore Active Database from JSON'}
                  </span>
                  {currentLanguage === 'sw' 
                    ? 'Pakia faili la chelezo uliyopakua hapo awali ili kurejesha bidhaa, stoo, mauzo na mipangilio.' 
                    : 'Select a previously saved backup JSON file to overwrite and restore all your transactions, products, stock logs, and shop settings.'}
                </div>
                <label
                  htmlFor="restore-backup-file-upload"
                  className="cursor-pointer shrink-0 px-4.5 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-slate-800 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-hover" />
                  {currentLanguage === 'sw' ? 'Pakia Faili (Upload)' : 'Upload Backup (.json)'}
                </label>
                <input
                  id="restore-backup-file-upload"
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </div>
            )}
          </div>
        </div>

        {/* SECURITY AUDIT LOG SIDEBAR (1 COLUMN) */}
        <div className="space-y-4 lg:col-span-1">
          <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-4 shadow-md space-y-3 h-full flex flex-col">
            <div className="pb-2 border-b border-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" />
              <h3 className="font-display font-bold text-xs uppercase tracking-wider">
                System Security Audit
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-96 lg:max-h-[500px]">
              {auditLogs.map((log) => (
                <div key={log.id} className="bg-slate-800/60 rounded-xl p-3 border border-slate-800 space-y-1.5 text-[11px] leading-relaxed">
                  <div className="flex justify-between items-baseline text-[9px] text-slate-400">
                    <span className="font-mono">{new Date(log.date).toLocaleString()}</span>
                    <span className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-400 uppercase font-bold text-[8px]">
                      {log.userRole}
                    </span>
                  </div>
                  <p className="font-bold text-slate-200">
                    {currentLanguage === 'sw' ? log.actionSw : log.actionEn}
                  </p>
                  <p className="text-slate-400 text-[10px] font-sans">
                    By: <span className="font-semibold text-slate-300">{log.userName}</span>
                  </p>
                  {log.details && (
                    <p className="text-slate-500 font-mono text-[9px] bg-slate-950/40 p-1 rounded mt-1 overflow-x-auto whitespace-pre-wrap">
                      {log.details}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
