import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    type BankAccount,
    getStoredBankAccounts,
    saveStoredBankAccounts,
    getStoredTransfers,
    getStoredCheques,
    EVENT_BANKING_UPDATED,
} from '@/lib/banking-store';

export default function BankAccountsPage() {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    // Accounts state loaded from centralized store
    const [accounts, setAccounts] = useState<BankAccount[]>(() => getStoredBankAccounts());

    // Listen for storage updates
    useEffect(() => {
        const handleUpdate = () => {
            setAccounts(getStoredBankAccounts());
        };
        window.addEventListener(EVENT_BANKING_UPDATED, handleUpdate);
        window.addEventListener('storage', handleUpdate);
        return () => {
            window.removeEventListener(EVENT_BANKING_UPDATED, handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, []);

    // Popup modal state
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Track which account is being edited (null = adding new)
    const [editingAccountId, setEditingAccountId] = useState<number | string | null>(null);

    // Track account for delete confirmation
    const [deleteTargetAccount, setDeleteTargetAccount] = useState<BankAccount | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        type: '',
        account_number: '',
        opening_balance: '0',
    });

    const formatCurrency = (val: number) => {
        return 'Rs. ' + Number(val || 0).toLocaleString('en-US');
    };

    // Open modal to add a brand new account
    const handleOpenModal = () => {
        setEditingAccountId(null);
        setFormData({
            name: '',
            type: '',
            account_number: '',
            opening_balance: '0',
        });
        setIsModalOpen(true);
    };

    // Open modal to edit an existing account
    const handleEditClick = (acc: BankAccount) => {
        setEditingAccountId(acc.id);

        let selectedType = acc.rawType || '';
        if (!selectedType) {
            if (acc.type === 'Wallet') {
                selectedType = acc.name.toLowerCase().includes('easypaisa')
                    ? 'Wallet (EasyPaisa)'
                    : 'Wallet (JazzCash / Raast)';
            } else {
                selectedType = 'Bank (Current)';
            }
        }

        setFormData({
            name: acc.name,
            type: selectedType,
            account_number: acc.account_number,
            opening_balance: (acc.current_balance ?? acc.opening_balance).toString(),
        });
        setIsModalOpen(true);
    };

    // Handle delete click - open confirmation
    const handleDeleteClick = (acc: BankAccount) => {
        setDeleteTargetAccount(acc);
    };

    // Confirm permanent deletion
    const handleConfirmDelete = () => {
        if (!deleteTargetAccount) return;

        const updated = accounts.filter((a) => a.id !== deleteTargetAccount.id);
        setAccounts(updated);
        saveStoredBankAccounts(updated);

        toast.success(
            isUrdu
                ? `بینک اکاؤنٹ "${deleteTargetAccount.name}" مستقل طور پر ڈیلیٹ کر دیا گیا ہے`
                : `Bank account "${deleteTargetAccount.name}" permanently deleted`
        );
        setDeleteTargetAccount(null);
    };

    // Handle Form Submit (Create or Edit)
    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error(isUrdu ? 'برائے مہربانی اکاؤنٹ کا نام درج کریں' : 'Please enter an account name');
            return;
        }

        if (!formData.type) {
            toast.error(isUrdu ? 'برائے مہربانی اکاؤنٹ کی قسم منتخب کریں' : 'Please select account type');
            return;
        }

        const rawBalance = formData.opening_balance.replace(/,/g, '').trim();
        const numBalance = parseFloat(rawBalance) || 0;

        let updatedAccounts: BankAccount[] = [];

        if (editingAccountId !== null) {
            // Edit existing account
            updatedAccounts = accounts.map((acc) => {
                if (acc.id === editingAccountId) {
                    return {
                        ...acc,
                        name: formData.name.trim(),
                        account_number: formData.account_number.trim() || acc.account_number,
                        type: formData.type.includes('Wallet') ? 'Wallet' : 'Current',
                        rawType: formData.type,
                        opening_balance: numBalance,
                        current_balance: numBalance,
                    };
                }
                return acc;
            });

            toast.success(isUrdu ? 'بینک اکاؤنٹ کی تفصیلات اپ ڈیٹ ہو گئی ہیں' : 'Bank account updated successfully');
        } else {
            // Add new account
            const newAccount: BankAccount = {
                id: Date.now(),
                name: formData.name.trim(),
                account_number: formData.account_number.trim() || 'PK00 XXXX 0000 •••• 0000',
                type: formData.type.includes('Wallet') ? 'Wallet' : 'Current',
                rawType: formData.type,
                opening_balance: numBalance,
                current_balance: numBalance,
                status: 'Active',
            };

            updatedAccounts = [...accounts, newAccount];
            toast.success(isUrdu ? 'نیا بینک اکاؤنٹ شامل کر دیا گیا ہے' : 'New bank account added successfully');
        }

        setAccounts(updatedAccounts);
        saveStoredBankAccounts(updatedAccounts);

        setIsModalOpen(false);
        setEditingAccountId(null);
        setFormData({
            name: '',
            type: '',
            account_number: '',
            opening_balance: '0',
        });
    };

    const handleCancel = () => {
        setIsModalOpen(false);
        setEditingAccountId(null);
        setFormData({
            name: '',
            type: '',
            account_number: '',
            opening_balance: '0',
        });
    };

    // Calculate total bank balance from current accounts
    const totalBankBalance = accounts.reduce((acc, curr) => acc + (Number(curr.current_balance) || 0), 0);

    // Dynamic stats from transfers and cheques
    const transfers = getStoredTransfers();
    const todayDeposits = transfers
        .filter((t) => t.type === 'deposit')
        .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    const cheques = getStoredCheques();
    const pendingCheques = cheques
        .filter((c) => c.status === 'Pending')
        .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const pendingChequesCount = cheques.filter((c) => c.status === 'Pending').length;

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: isUrdu ? 'ڈیش بورڈ' : 'Dashboard',
            href: '/dashboard',
        },
        {
            title: isUrdu ? 'بینکنگ' : 'Banking',
            href: '/banking/accounts',
        },
        {
            title: isUrdu ? 'بینک اکاؤنٹس' : 'Bank Accounts',
            href: '/banking/accounts',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'بینک اکاؤنٹس - ویجیٹیبل پی او ایس' : 'Bank Accounts - Vegetable POS'} />

            <div className="max-w-7xl mx-auto w-full space-y-6 pb-12">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                            {isUrdu ? 'بینک اکاؤنٹس' : 'Bank Accounts'}
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {isUrdu
                                ? 'سیٹ اپ / بینکنگ: اپنے بزنس کے بینک اور والٹ اکاؤنٹس یہاں ایڈ کریں'
                                : 'Setup / Banking: apne business ke bank aur wallet accounts yahan add karein'}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleOpenModal}
                        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#166534] hover:bg-[#14532d] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                    >
                        <span>{isUrdu ? '+ نیا بینک اکاؤنٹ' : '+ Naya Bank Account'}</span>
                    </button>
                </div>

                {/* 3 Summary Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Card 1: Total Bank Balance */}
                    <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-5 shadow-xs">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {isUrdu ? 'کل بینک بیلنس' : 'Total bank balance'}
                        </div>
                        <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-2 tracking-tight">
                            {formatCurrency(totalBankBalance)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                            {isUrdu ? `${accounts.length} اکاؤنٹس میں` : `${accounts.length} accounts mein`}
                        </div>
                    </div>

                    {/* Card 2: Aaj bank mein aaya */}
                    <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-5 shadow-xs">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {isUrdu ? 'آج بینک میں آیا' : 'Aaj bank mein aaya'}
                        </div>
                        <div className="text-2xl sm:text-3xl font-bold text-[#166534] dark:text-[#4ade80] mt-2 tracking-tight">
                            + {formatCurrency(todayDeposits)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                            {isUrdu
                                ? `${transfers.filter((t) => t.type === 'deposit').length} ڈپازٹ انٹریز`
                                : `${transfers.filter((t) => t.type === 'deposit').length} deposit entries`}
                        </div>
                    </div>

                    {/* Card 3: Pending cheques */}
                    <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-5 shadow-xs">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {isUrdu ? 'زیر التواء چیکس' : 'Pending cheques'}
                        </div>
                        <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-2 tracking-tight">
                            {formatCurrency(pendingCheques)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                            {isUrdu
                                ? `${pendingChequesCount} چیکس کلیئر ہونا باقی`
                                : `${pendingChequesCount} cheques clear hona baqi`}
                        </div>
                    </div>
                </div>

                {/* Account info table - Full width */}
                <div className="w-full bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-start border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-border bg-gray-50/60 dark:bg-muted/30">
                                    <th className="py-3 px-4 text-start text-xs font-semibold text-gray-600 dark:text-gray-400">
                                        {isUrdu ? 'اکاؤنٹ' : 'Account'}
                                    </th>
                                    <th className="py-3 px-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-400">
                                        {isUrdu ? 'قسم' : 'Type'}
                                    </th>
                                    <th className="py-3 px-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-400 leading-tight">
                                        {isUrdu ? 'ابتدائی بیلنس' : (
                                            <>
                                                Opening<br />balance
                                            </>
                                        )}
                                    </th>
                                    <th className="py-3 px-3 text-start text-xs font-semibold text-gray-600 dark:text-gray-400 leading-tight">
                                        {isUrdu ? 'موجودہ بیلنس' : 'Current balance'}
                                    </th>
                                    <th className="py-3 px-4 text-start text-xs font-semibold text-gray-600 dark:text-gray-400">
                                        {isUrdu ? 'حیثیت' : 'Status'}
                                    </th>
                                    <th className="py-3 px-4 text-end text-xs font-semibold text-gray-600 dark:text-gray-400">
                                        {isUrdu ? 'ایکشن' : 'Action'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-border">
                                {accounts.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 px-4 text-center">
                                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                {isUrdu
                                                    ? 'ابھی تک کوئی بینک اکاؤنٹ شامل نہیں ہے۔ نیا اکاؤنٹ شامل کرنے کے لیے اوپر بٹن پر کلک کریں۔'
                                                    : 'Abhi koi bank account mojood nahi hai. Naya account add karne ke liye "+ Naya Bank Account" button click karein.'}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    accounts.map((acc) => (
                                        <tr key={acc.id} className="hover:bg-gray-50/50 dark:hover:bg-muted/20 transition-colors">
                                            {/* Account name & subtitle */}
                                            <td className="py-3.5 px-4 align-middle">
                                                <div className="font-semibold text-sm text-gray-900 dark:text-white">
                                                    {acc.name}
                                                </div>
                                                <div className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-0.5">
                                                    {acc.account_number}
                                                </div>
                                            </td>

                                            {/* Type badge */}
                                            <td className="py-3.5 px-3 align-middle">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#eef2ff] text-[#4338ca] dark:bg-indigo-950/40 dark:text-indigo-300">
                                                    {acc.type}
                                                </span>
                                            </td>

                                            {/* Opening balance */}
                                            <td className="py-3.5 px-3 align-middle text-sm text-gray-600 dark:text-gray-300">
                                                {formatCurrency(acc.opening_balance)}
                                            </td>

                                            {/* Current balance */}
                                            <td className="py-3.5 px-3 align-middle text-sm font-bold text-gray-900 dark:text-white">
                                                {formatCurrency(acc.current_balance)}
                                            </td>

                                            {/* Status badge */}
                                            <td className="py-3.5 px-4 align-middle">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#dcfce7] text-[#15803d] dark:bg-emerald-950/40 dark:text-emerald-300">
                                                    {isUrdu ? 'ایکٹو' : acc.status}
                                                </span>
                                            </td>

                                            {/* Action Icons: Edit & Delete */}
                                            <td className="py-3.5 px-4 align-middle text-end whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* Edit Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditClick(acc)}
                                                        title={isUrdu ? 'اکاؤنٹ ایڈٹ کریں' : 'Edit account'}
                                                        className="p-1.5 text-gray-500 hover:text-[#166534] dark:hover:text-[#4ade80] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                                            <path d="m15 5 4 4" />
                                                        </svg>
                                                    </button>

                                                    {/* Delete Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteClick(acc)}
                                                        title={isUrdu ? 'اکاؤنٹ ڈیلیٹ کریں' : 'Delete account'}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M3 6h18" />
                                                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                            <line x1="10" x2="10" y1="11" y2="17" />
                                                            <line x1="14" x2="14" y1="11" y2="17" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Bottom note */}
                    <div className="border-t border-gray-100 dark:border-border p-4 bg-gray-50/30 dark:bg-muted/10 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        {isUrdu
                            ? 'کیش ڈراور (گلہ) الگ ٹریک ہوتا ہے: بینکنگ میں صرف بینک اور والٹ اکاؤنٹس دکھتے ہیں۔'
                            : 'Cash drawer (galla) alag track hota hai: Banking mein sirf bank/wallet accounts dikhte hain.'}
                    </div>
                </div>

                {/* Pop-up Dialog for "Naya Bank Account" / "Edit Bank Account" */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="sm:max-w-[480px] p-6 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-xl shadow-lg">
                        <DialogHeader>
                            <DialogTitle className="text-base font-bold text-gray-900 dark:text-white">
                                {editingAccountId !== null
                                    ? isUrdu
                                        ? 'بینک اکاؤنٹ ایڈٹ کریں'
                                        : 'Edit Bank Account'
                                    : isUrdu
                                    ? 'نیا بینک اکاؤنٹ'
                                    : 'Naya Bank Account'}
                            </DialogTitle>
                        </DialogHeader>

                        <form onSubmit={handleSave} className="space-y-4 mt-2">
                            {/* Account ka naam */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    {isUrdu ? 'اکاؤنٹ کا نام' : 'Account ka naam'}
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. HBL Mandi A/C"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all"
                                    autoFocus
                                />
                            </div>

                            {/* Type dropdown */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    {isUrdu ? 'قسم' : 'Type'}
                                </label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all cursor-pointer"
                                >
                                    <option value="" disabled>
                                        {isUrdu ? '-- قسم منتخب کریں --' : '-- Select Type --'}
                                    </option>
                                    <option value="Bank (Current)">Bank (Current)</option>
                                    <option value="Bank (Savings)">Bank (Savings)</option>
                                    <option value="Wallet (JazzCash / Raast)">Wallet (JazzCash / Raast)</option>
                                    <option value="Wallet (EasyPaisa)">Wallet (EasyPaisa)</option>
                                </select>
                            </div>

                            {/* Account no. / IBAN */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    {isUrdu ? 'اکاؤنٹ نمبر / IBAN' : 'Account no. / IBAN'}
                                </label>
                                <input
                                    type="text"
                                    value={formData.account_number}
                                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                                    placeholder="PK00 XXXX 0000 0000 0000"
                                    className="w-full px-3 py-2 text-sm font-mono border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all"
                                />
                            </div>

                            {/* Opening balance (Rs.) */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    {isUrdu ? 'ابتدائی بیلنس / رقم (روپے)' : 'Opening balance / Amount (Rs.)'}
                                </label>
                                <input
                                    type="text"
                                    value={formData.opening_balance}
                                    onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                                    placeholder="0"
                                    className="w-full px-3 py-2 text-sm text-end border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all"
                                />
                            </div>

                            {/* Actions Buttons */}
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 px-4 bg-[#166534] hover:bg-[#14532d] text-white text-sm font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                                >
                                    {editingAccountId !== null
                                        ? isUrdu
                                            ? 'تبدیلیاں محفوظ کریں'
                                            : 'Update Account'
                                        : isUrdu
                                        ? 'محفوظ کریں'
                                        : 'Save'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="py-2.5 px-4 border border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                                >
                                    {isUrdu ? 'منسوخ' : 'Cancel'}
                                </button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Permanent Delete Confirmation Modal */}
                {deleteTargetAccount && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
                        <div className="bg-white dark:bg-card border border-gray-200 dark:border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
                            {/* Icon & Title */}
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18" />
                                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                        <line x1="10" x2="10" y1="11" y2="17" />
                                        <line x1="14" x2="14" y1="11" y2="17" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                        {isUrdu ? 'اکاؤنٹ ڈیلیٹ کریں؟' : 'Delete Bank Account?'}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        {deleteTargetAccount.name}
                                    </p>
                                </div>
                            </div>

                            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                {isUrdu
                                    ? `کیا آپ واقعی "${deleteTargetAccount.name}" کو مستقل طور پر ڈیلیٹ کرنا چاہتے ہیں؟ یہ عمل واپس نہیں کیا جا سکتا۔`
                                    : `Kya aap waqai "${deleteTargetAccount.name}" ko permanently delete karna chahte hain? Ye record hamesha ke liye khatam ho jayega.`}
                            </p>

                            <div className="flex items-center justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setDeleteTargetAccount(null)}
                                    className="px-3.5 py-2 border border-gray-300 dark:border-border hover:bg-gray-100 dark:hover:bg-muted text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                >
                                    {isUrdu ? 'منسوخ کریں' : 'Cancel'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                                >
                                    {isUrdu ? 'مستقل ڈیلیٹ کریں' : 'Permanently Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
