import React, { useState, useEffect, useMemo } from 'react';
import { Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import MandiPageHeader from '@/components/app/mandi-page-header';
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
    EVENT_BANKING_UPDATED,
} from '@/lib/banking-store';

interface DbTransaction {
    id: string;
    date: string;
    type: string;
    from: string;
    to: string;
    amount: number;
    description: string;
}

interface Props {
    liveCashGalla?: number;
    dbTransactions?: DbTransaction[];
}

export default function BankAccountsPage({ liveCashGalla = 0, dbTransactions = [] }: Props) {
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
        return 'Rs ' + Number(val || 0).toLocaleString('en-US');
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

    // Stored transfers from local banking store
    const storedTransfers = getStoredTransfers();

    const cleanDescription = (desc?: string) => {
        return (desc || '')
            .replace(/Merchant Wasooli/gi, 'Customer Recovery')
            .replace(/Online Sale Wasooli/gi, 'Online Sale Recovery')
            .replace(/Wasooli/gi, 'Recovery');
    };

    const cleanAccountName = (acc?: string) => {
        return (acc || '')
            .replace(/Naqad \/ Counter/gi, 'Cash / Counter')
            .replace(/Gahak \(Wasooli\)/gi, 'Customer (Recovery)');
    };

    // Combined unified transactions list for the table
    const allTransactions = useMemo(() => {
        const list: Array<{
            id: string | number;
            date: string;
            type: string;
            typeBadge: 'jama' | 'nikasi' | 'transfer';
            from: string;
            to: string;
            amount: number;
            description: string;
        }> = [];

        // 1. Stored local transfers
        storedTransfers.forEach((st) => {
            let fromAcc = 'Cash Register';
            let toAcc = st.bankName || 'Bank Account';
            let badge: 'jama' | 'nikasi' | 'transfer' = 'jama';
            let typeLabel = 'Deposit';

            if (st.type === 'withdraw') {
                fromAcc = st.bankName || 'Bank Account';
                toAcc = 'Cash Register';
                badge = 'nikasi';
                typeLabel = 'Withdrawal';
            } else if (st.type === 'transfer') {
                const parts = (st.title || '').split('→');
                fromAcc = parts[0]?.trim() || st.bankName || 'Bank';
                toAcc = parts[1]?.trim() || 'Bank';
                badge = 'transfer';
                typeLabel = 'Transfer';
            }

            list.push({
                id: 'transfer_' + st.id,
                date: st.date || '2026-11-23',
                type: typeLabel,
                typeBadge: badge,
                from: cleanAccountName(fromAcc),
                to: cleanAccountName(toAcc),
                amount: st.amount,
                description: cleanDescription(st.title || 'Bank / Cash Transfer'),
            });
        });

        // 2. Real DB transactions
        dbTransactions.forEach((dt) => {
            const typeLabel = dt.type === 'Jama' ? 'Recovery' : (dt.type || 'Deposit');
            list.push({
                id: dt.id,
                date: dt.date,
                type: typeLabel,
                typeBadge: 'jama',
                from: cleanAccountName(dt.from),
                to: cleanAccountName(dt.to),
                amount: dt.amount,
                description: cleanDescription(dt.description),
            });
        });

        return list;
    }, [storedTransfers, dbTransactions]);

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
            <Head title={isUrdu ? 'بینک کھاتہ اور نقد گلہ' : 'Banking & Cash Accounts - Vegetable POS'} />

            <div className="-mt-4 -mx-4 -mb-4 pb-28 bg-[#eef2ee] min-h-full space-y-4" dir={isUrdu ? 'rtl' : 'ltr'}>
                {/* Green Header Section */}
                <MandiPageHeader
                    title={isUrdu ? t('banking.accounts_title') : 'Banking & Cash Accounts'}
                    subtitle={isUrdu ? t('banking.accounts_subtitle') : 'Bank account balances, deposits, withdrawals and transfers'}
                    isUrdu={isUrdu}
                >
                    <button
                        type="button"
                        onClick={handleOpenModal}
                        className="h-9 px-4 rounded-xl text-xs md:text-sm font-semibold bg-white text-emerald-900 hover:bg-emerald-50 shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                        <span>+ {isUrdu ? t('banking.new_account') : 'New Account'}</span>
                    </button>
                </MandiPageHeader>

                <div className="w-full px-4 md:px-6 -mt-6 md:-mt-8 space-y-6">
                    {/* 4 Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Mandi Naqad Galla (Cash Counter) */}
                    <div className="bg-white dark:bg-card border border-emerald-100 dark:border-border rounded-2xl p-4 shadow-xs relative flex flex-col justify-between hover:shadow-md transition-shadow min-h-[145px]">
                        <div>
                            {/* Top Row: Type Badge and Cash Icon */}
                            <div className="flex items-center justify-between">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                                    {isUrdu ? 'نقد گلہ' : 'CASH REGISTER'}
                                </span>
                                <div className="text-emerald-700/70 p-1">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect width="20" height="12" x="2" y="6" rx="2" />
                                        <circle cx="12" cy="12" r="2" />
                                        <path d="M6 12h.01M18 12h.01" />
                                    </svg>
                                </div>
                            </div>

                            {/* Account Name & Code */}
                            <div className="mt-2.5">
                                <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white leading-snug">
                                    {isUrdu ? 'منڈی نقد گلہ (کاؤنٹر)' : 'Main Cash Register'}
                                </h3>
                                <p className="text-xs text-gray-400 font-mono mt-0.5 tracking-tight">
                                    CASH-01
                                </p>
                            </div>
                        </div>

                        {/* Mojooda Balance */}
                        <div className="mt-3 pt-2 border-t border-gray-100 dark:border-border flex items-baseline justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                {isUrdu ? 'موجودہ بیلنس:' : 'Current Balance:'}
                            </span>
                            <span className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                                {formatCurrency(liveCashGalla)}
                            </span>
                        </div>
                    </div>

                    {/* Cards 2+: Bank & Mobile Wallet Accounts */}
                    {accounts.map((acc) => {
                        const isWallet = acc.type === 'Wallet' || (acc.rawType && acc.rawType.includes('Wallet'));
                        const typeLabel = isWallet 
                            ? (isUrdu ? 'موبائل والیٹ' : 'MOBILE WALLET') 
                            : (isUrdu ? 'بینک اکاؤنٹ' : 'BANK ACCOUNT');

                        return (
                            <div
                                key={acc.id}
                                className="bg-white dark:bg-card border border-emerald-100 dark:border-border rounded-2xl p-4 shadow-xs relative flex flex-col justify-between hover:shadow-md transition-shadow min-h-[145px]"
                            >
                                <div>
                                    {/* Top Row: Type Badge and Actions */}
                                    <div className="flex items-center justify-between">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                                            {typeLabel}
                                        </span>

                                        <div className="flex items-center gap-1">
                                            {/* Bank / Wallet Icon */}
                                            <div className="text-emerald-700/70 p-1">
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 21h18" />
                                                    <path d="M3 10h18" />
                                                    <path d="M5 6l7-3 7 3" />
                                                    <path d="M4 10v11" />
                                                    <path d="M20 10v11" />
                                                </svg>
                                            </div>

                                            {/* Edit Icon */}
                                            <button
                                                type="button"
                                                onClick={() => handleEditClick(acc)}
                                                title="Edit account"
                                                className="p-1 text-gray-400 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                            >
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                                    <path d="m15 5 4 4" />
                                                </svg>
                                            </button>

                                            {/* Delete Icon */}
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteClick(acc)}
                                                title="Delete account"
                                                className="p-1 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                            >
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 6h18" />
                                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Account Name & Code */}
                                    <div className="mt-2.5">
                                        <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white leading-snug">
                                            {acc.name}
                                        </h3>
                                        <p className="text-xs text-gray-400 font-mono mt-0.5 tracking-tight truncate" title={acc.account_number}>
                                            {acc.account_number}
                                        </p>
                                    </div>
                                </div>

                                {/* Mojooda Balance */}
                                <div className="mt-3 pt-2 border-t border-gray-100 dark:border-border flex items-baseline justify-between">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        {isUrdu ? 'موجودہ بیلنس:' : 'Current Balance:'}
                                    </span>
                                    <span className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                                        {formatCurrency(acc.current_balance)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Bank aur Cash Transactions Record Table */}
                <div className="space-y-2.5 pt-4">
                    <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        {isUrdu ? t('banking.transactions_record') : 'Bank & Cash Transactions Record'}
                    </h2>

                    <div className="w-full bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-start border-collapse text-xs sm:text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 dark:border-border bg-gray-50/70 dark:bg-muted/30">
                                        {/* Column 1: Tareekh */}
                                        <th className="py-3 px-4 text-start font-bold text-gray-700 dark:text-gray-300">
                                            {isUrdu ? t('banking.date') : 'Date'}
                                        </th>
                                        {/* Column 2: Qism */}
                                        <th className="py-3 px-3 text-start font-bold text-gray-700 dark:text-gray-300">
                                            {isUrdu ? t('banking.type') : 'Type'}
                                        </th>
                                        {/* Column 3: Account Se (From) */}
                                        <th className="py-3 px-3 text-start font-bold text-gray-700 dark:text-gray-300">
                                            {isUrdu ? t('banking.from') : 'Account (From)'}
                                        </th>
                                        {/* Column 4: Account Mein (To) */}
                                        <th className="py-3 px-3 text-start font-bold text-gray-700 dark:text-gray-300">
                                            {isUrdu ? t('banking.to') : 'Account (To)'}
                                        </th>
                                        {/* Column 5: Raqam (Rs) */}
                                        <th className="py-3 px-3 text-end font-bold text-gray-700 dark:text-gray-300">
                                            {isUrdu ? t('banking.amount') : 'Amount (Rs)'}
                                        </th>
                                        {/* Column 6: Tafseel (Description) */}
                                        <th className="py-3 px-4 text-start font-bold text-gray-700 dark:text-gray-300">
                                            {isUrdu ? t('banking.description') : 'Description'}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-border">
                                    {allTransactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-10 px-4 text-center text-xs text-gray-400">
                                                No transaction records found.
                                            </td>
                                        </tr>
                                    ) : (
                                        allTransactions.map((tx) => (
                                            <tr key={tx.id} className="hover:bg-gray-50/60 dark:hover:bg-muted/20 transition-colors">
                                                {/* 1. Tareekh */}
                                                <td className="py-3 px-4 align-middle text-gray-700 dark:text-gray-300 whitespace-nowrap font-medium">
                                                    {tx.date}
                                                </td>

                                                {/* 2. Qism */}
                                                <td className="py-3 px-3 align-middle whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                                            tx.typeBadge === 'jama'
                                                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                                : tx.typeBadge === 'nikasi'
                                                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                                                : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                                        }`}
                                                    >
                                                        {tx.type}
                                                    </span>
                                                </td>

                                                {/* 3. Account Se (From) */}
                                                <td className="py-3 px-3 align-middle text-gray-800 dark:text-gray-200 font-semibold whitespace-nowrap">
                                                    {tx.from}
                                                </td>

                                                {/* 4. Account Mein (To) */}
                                                <td className="py-3 px-3 align-middle text-gray-800 dark:text-gray-200 font-semibold whitespace-nowrap">
                                                    {tx.to}
                                                </td>

                                                {/* 5. Raqam (Rs) */}
                                                <td className="py-3 px-3 align-middle text-end font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                                    {formatCurrency(tx.amount)}
                                                </td>

                                                {/* 6. Tafseel (Description) */}
                                                <td className="py-3 px-4 align-middle text-gray-600 dark:text-gray-400 text-xs">
                                                    {tx.description}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
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
                                    : 'New Bank Account'}
                            </DialogTitle>
                        </DialogHeader>

                        <form onSubmit={handleSave} className="space-y-4 mt-2">
                            {/* Account ka naam */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    {isUrdu ? 'اکاؤنٹ کا نام' : 'Account Name'}
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. HBL Market Branch A/C"
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
                                    : `Are you sure you want to permanently delete "${deleteTargetAccount.name}"? This record will be permanently removed.`}
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
