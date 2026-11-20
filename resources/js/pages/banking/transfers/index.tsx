import React, { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { toast } from 'sonner';
import {
    type BankAccount,
    type TransferEntry,
    getStoredBankAccounts,
    updateAccountBalance,
    getStoredTransfers,
    addStoredTransfer,
    EVENT_BANKING_UPDATED,
} from '@/lib/banking-store';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

type TransferTab = 'deposit' | 'withdraw' | 'transfer';

export default function DepositTransferPage() {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    // Active tab
    const [activeTab, setActiveTab] = useState<TransferTab>('deposit');

    // Dynamic accounts from shared banking store
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

    // Form inputs: Dynamic bank selection
    const [selectedBank, setSelectedBank] = useState<string>(() => {
        const accs = getStoredBankAccounts();
        return accs.length > 0 ? accs[0].name : '';
    });

    const [fromBank, setFromBank] = useState<string>(() => {
        const accs = getStoredBankAccounts();
        return accs.length > 0 ? accs[0].name : '';
    });

    const [toBank, setToBank] = useState<string>(() => {
        const accs = getStoredBankAccounts();
        return accs.length > 1 ? accs[1].name : (accs[0]?.name || '');
    });

    // Synchronize default selection if accounts load or change
    useEffect(() => {
        if (accounts.length > 0) {
            if (!accounts.some((a) => a.name === selectedBank)) {
                setSelectedBank(accounts[0].name);
            }
            if (!accounts.some((a) => a.name === fromBank)) {
                setFromBank(accounts[0].name);
            }
            if (!accounts.some((a) => a.name === toBank)) {
                setToBank(accounts[1]?.name || accounts[0].name);
            }
        }
    }, [accounts]);

    // Amount - empty by default as requested
    const [amountStr, setAmountStr] = useState('');

    // Date picker state - proper date sheet
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    // Deposit slip / reference & remarks
    const [referenceNo, setReferenceNo] = useState('');
    const [remark, setRemark] = useState('');

    // Previous entries list from store
    const [entries, setEntries] = useState<TransferEntry[]>(() => getStoredTransfers());

    // Parse amount for live calculations
    const numericAmount = parseFloat(amountStr.replace(/,/g, '').trim()) || 0;

    const formatCurrency = (val: number) => {
        return 'Rs. ' + Math.abs(Number(val) || 0).toLocaleString('en-US');
    };

    // Base Galla (Cash drawer) balance
    const baseGallaBalance = 92000;

    // Helper to find account balance
    const getAccountCurrentBal = (name: string): number => {
        const found = accounts.find((a) => a.name.trim().toLowerCase() === name.trim().toLowerCase());
        return found ? Number(found.current_balance) || 0 : 0;
    };

    // Calculate source and destination ledger balances based on active accounts
    let sourceTitle = 'Cash Drawer (Galla)';
    let sourceBefore = baseGallaBalance;
    let sourceAfter = Math.max(0, baseGallaBalance - numericAmount);

    let destTitle = selectedBank || (isUrdu ? 'بینک اکاؤنٹ منتخب کریں' : 'Select Bank Account');
    let destBefore = getAccountCurrentBal(selectedBank);
    let destAfter = destBefore + numericAmount;

    if (activeTab === 'withdraw') {
        sourceTitle = selectedBank || (isUrdu ? 'بینک اکاؤنٹ منتخب کریں' : 'Select Bank Account');
        sourceBefore = getAccountCurrentBal(selectedBank);
        sourceAfter = Math.max(0, sourceBefore - numericAmount);

        destTitle = 'Cash Drawer (Galla)';
        destBefore = baseGallaBalance;
        destAfter = baseGallaBalance + numericAmount;
    } else if (activeTab === 'transfer') {
        sourceTitle = fromBank || (isUrdu ? 'بینک اکاؤنٹ (From)' : 'From Bank Account');
        sourceBefore = getAccountCurrentBal(fromBank);
        sourceAfter = Math.max(0, sourceBefore - numericAmount);

        destTitle = toBank || (isUrdu ? 'بینک اکاؤنٹ (To)' : 'To Bank Account');
        destBefore = getAccountCurrentBal(toBank);
        destAfter = destBefore + numericAmount;
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (accounts.length === 0) {
            toast.error(
                isUrdu
                    ? 'پہلے بینک اکاؤنٹس پیج پر اکاؤنٹ شامل کریں'
                    : 'Pehle Bank Accounts page par account shamil karein'
            );
            return;
        }

        if (numericAmount <= 0) {
            toast.error(isUrdu ? 'برائے مہربانی درست رقم درج کریں' : 'Please enter a valid amount');
            return;
        }

        if (activeTab === 'transfer' && fromBank === toBank) {
            toast.error(
                isUrdu
                    ? 'دونوں بینک اکاؤنٹس ایک جیسے نہیں ہو سکتے'
                    : 'Source and destination bank accounts cannot be the same'
            );
            return;
        }

        const formattedDate = format(selectedDate, 'dd MMM yyyy');

        // Update account balances in shared store
        if (activeTab === 'deposit') {
            updateAccountBalance(selectedBank, numericAmount);
        } else if (activeTab === 'withdraw') {
            updateAccountBalance(selectedBank, -numericAmount);
        } else if (activeTab === 'transfer') {
            updateAccountBalance(fromBank, -numericAmount);
            updateAccountBalance(toBank, numericAmount);
        }

        // Create new transfer entry
        let newTitle = `Cash Deposit → ${selectedBank}`;
        if (activeTab === 'withdraw') {
            newTitle = `Bank → Cash (${selectedBank})`;
        } else if (activeTab === 'transfer') {
            newTitle = `${fromBank} → ${toBank}`;
        }

        const newEntry: TransferEntry = {
            id: Date.now(),
            title: newTitle,
            subtext: `${formattedDate} · ${referenceNo.trim() ? `Slip ${referenceNo.trim()}` : 'Transfer entry'}`,
            amount: numericAmount,
            date: formattedDate,
            bankName: selectedBank,
            type: activeTab,
        };

        addStoredTransfer(newEntry);
        setEntries((prev) => [newEntry, ...prev]);

        toast.success(
            isUrdu
                ? 'انٹری کامیابی سے محفوظ کر لی گئی ہے اور بینک بیلنس اپ ڈیٹ ہو گیا ہے'
                : 'Entry saved and bank balance updated successfully'
        );

        setAmountStr('');
        setReferenceNo('');
        setRemark('');
    };

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
            title: isUrdu ? 'ڈپازٹ / ٹرانسفر' : 'Deposit / Transfer',
            href: '/banking/transfers',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'ڈپازٹ / ٹرانسفر - ویجیٹیبل پی او ایس' : 'Deposit / Transfer - Vegetable POS'} />

            <div className="max-w-7xl mx-auto w-full space-y-6 pb-12">
                {/* Header Section */}
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                        {isUrdu ? 'ڈپازٹ / ٹرانسفر' : 'Deposit / Transfer'}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {isUrdu
                            ? 'دن کے آخر میں گلہ سے بینک میں پیسے جمع کروائیں، یا بینک سے کیش نکالیں'
                            : 'Din ke aakhir mein galla se bank mein paise jama karwayein, ya bank se cash nikalein'}
                    </p>
                </div>

                {/* Empty Accounts Warning if no account exists yet */}
                {accounts.length === 0 && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-300 text-sm font-medium">
                            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                                <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" />
                                <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" />
                            </svg>
                            <span>
                                {isUrdu
                                    ? 'ابھی تک کوئی بینک اکاؤنٹ شامل نہیں ہے۔ ڈپازٹ یا ٹرانسفر کے لیے پہلے بینک اکاؤنٹ ایڈ کریں۔'
                                    : 'Abhi koi bank account mojood nahi hai. Pehle Bank Accounts page se account add karein.'}
                            </span>
                        </div>
                        <Link
                            href="/banking/accounts"
                            className="px-3 py-1.5 bg-[#166534] hover:bg-[#14532d] text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                            {isUrdu ? '+ بینک اکاؤنٹ ایڈ کریں' : '+ Add Bank Account'}
                        </Link>
                    </div>
                )}

                {/* Main 2 Columns Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column: Transfer Form Card */}
                    <div className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl shadow-xs p-6">
                        {/* 3 Tabs Switcher */}
                        <div className="inline-flex p-1 bg-gray-100 dark:bg-muted rounded-xl mb-6 flex-wrap gap-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab('deposit')}
                                className={`px-4 py-2 text-xs sm:text-sm rounded-lg font-medium transition-all cursor-pointer ${
                                    activeTab === 'deposit'
                                        ? 'bg-white dark:bg-card text-gray-900 dark:text-white shadow-xs font-semibold'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                {isUrdu ? 'کیش ڈپازٹ (گلہ ← بینک)' : 'Cash Deposit (Galla → Bank)'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('withdraw')}
                                className={`px-4 py-2 text-xs sm:text-sm rounded-lg font-medium transition-all cursor-pointer ${
                                    activeTab === 'withdraw'
                                        ? 'bg-white dark:bg-card text-gray-900 dark:text-white shadow-xs font-semibold'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                {isUrdu ? 'بینک ← کیش' : 'Bank → Cash'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('transfer')}
                                className={`px-4 py-2 text-xs sm:text-sm rounded-lg font-medium transition-all cursor-pointer ${
                                    activeTab === 'transfer'
                                        ? 'bg-white dark:bg-card text-gray-900 dark:text-white shadow-xs font-semibold'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                {isUrdu ? 'بینک ← بینک' : 'Bank → Bank'}
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Source and Destination Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {activeTab === 'deposit' && (
                                    <>
                                        {/* Kahan se */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                                {isUrdu ? 'کہاں سے' : 'Kahan se'}
                                            </label>
                                            <div className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-muted/40 border border-gray-200 dark:border-border rounded-lg text-gray-800 dark:text-gray-200 font-medium">
                                                {isUrdu ? 'کیش ڈراور (گلہ)' : 'Cash Drawer (Galla)'}
                                            </div>
                                        </div>

                                        {/* Kis bank account mein - Dynamically populated from added Bank Accounts */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                                {isUrdu ? 'کس بینک اکاؤنٹ میں' : 'Kis bank account mein'}
                                            </label>
                                            <select
                                                value={selectedBank}
                                                onChange={(e) => setSelectedBank(e.target.value)}
                                                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all cursor-pointer font-medium"
                                            >
                                                {accounts.length === 0 ? (
                                                    <option value="" disabled>
                                                        {isUrdu ? '-- کوئی اکاؤنٹ دستیاب نہیں --' : '-- No accounts available --'}
                                                    </option>
                                                ) : (
                                                    accounts.map((acc) => (
                                                        <option key={acc.id} value={acc.name}>
                                                            {acc.name} ({acc.type} · {formatCurrency(acc.current_balance)})
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'withdraw' && (
                                    <>
                                        {/* Kis bank account se */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                                {isUrdu ? 'کس بینک اکاؤنٹ سے' : 'Kis bank account se'}
                                            </label>
                                            <select
                                                value={selectedBank}
                                                onChange={(e) => setSelectedBank(e.target.value)}
                                                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all cursor-pointer font-medium"
                                            >
                                                {accounts.length === 0 ? (
                                                    <option value="" disabled>
                                                        {isUrdu ? '-- کوئی اکاؤنٹ دستیاب نہیں --' : '-- No accounts available --'}
                                                    </option>
                                                ) : (
                                                    accounts.map((acc) => (
                                                        <option key={acc.id} value={acc.name}>
                                                            {acc.name} ({acc.type} · {formatCurrency(acc.current_balance)})
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                        </div>

                                        {/* Kahan jama hoga */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                                {isUrdu ? 'کہاں جمع ہوگا' : 'Kahan jama hoga'}
                                            </label>
                                            <div className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-muted/40 border border-gray-200 dark:border-border rounded-lg text-gray-800 dark:text-gray-200 font-medium">
                                                {isUrdu ? 'کیش ڈراور (گلہ)' : 'Cash Drawer (Galla)'}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'transfer' && (
                                    <>
                                        {/* From bank */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                                {isUrdu ? 'کس بینک اکاؤنٹ سے (From)' : 'Kis bank account se (From)'}
                                            </label>
                                            <select
                                                value={fromBank}
                                                onChange={(e) => setFromBank(e.target.value)}
                                                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all cursor-pointer font-medium"
                                            >
                                                {accounts.length === 0 ? (
                                                    <option value="" disabled>
                                                        {isUrdu ? '-- کوئی اکاؤنٹ دستیاب نہیں --' : '-- No accounts available --'}
                                                    </option>
                                                ) : (
                                                    accounts.map((acc) => (
                                                        <option key={acc.id} value={acc.name}>
                                                            {acc.name} ({acc.type} · {formatCurrency(acc.current_balance)})
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                        </div>

                                        {/* To bank */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                                {isUrdu ? 'کس بینک اکاؤنٹ میں (To)' : 'Kis bank account mein (To)'}
                                            </label>
                                            <select
                                                value={toBank}
                                                onChange={(e) => setToBank(e.target.value)}
                                                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all cursor-pointer font-medium"
                                            >
                                                {accounts.length === 0 ? (
                                                    <option value="" disabled>
                                                        {isUrdu ? '-- کوئی اکاؤنٹ دستیاب نہیں --' : '-- No accounts available --'}
                                                    </option>
                                                ) : (
                                                    accounts.map((acc) => (
                                                        <option key={acc.id} value={acc.name}>
                                                            {acc.name} ({acc.type} · {formatCurrency(acc.current_balance)})
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Amount (Rs.) - Empty by default as requested */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    {isUrdu ? 'رقم (روپے)' : 'Amount (Rs.)'}
                                </label>
                                <input
                                    type="text"
                                    value={amountStr}
                                    onChange={(e) => setAmountStr(e.target.value)}
                                    placeholder="0"
                                    className="w-full px-4 py-3 text-end text-xl sm:text-2xl font-bold border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all"
                                />
                            </div>

                            {/* Date Picker (Proper Date Sheet Popover) and Reference No */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                {/* Tareekh with Interactive Calendar Popover */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        {isUrdu ? 'تاریخ' : 'Tareekh'}
                                    </label>
                                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                        <PopoverTrigger asChild>
                                            <button
                                                type="button"
                                                className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white hover:border-[#166534] focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all cursor-pointer"
                                            >
                                                <span className="font-medium text-gray-800 dark:text-gray-200">
                                                    {format(selectedDate, 'dd MMM yyyy')}
                                                </span>
                                                <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                    <line x1="16" y1="2" x2="16" y2="6" />
                                                    <line x1="8" y1="2" x2="8" y2="6" />
                                                    <line x1="3" y1="10" x2="21" y2="10" />
                                                </svg>
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-xl shadow-xl z-50" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={selectedDate}
                                                onSelect={(date) => {
                                                    if (date) {
                                                        setSelectedDate(date);
                                                    }
                                                    setIsCalendarOpen(false);
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Deposit slip / Reference no */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        {isUrdu ? 'ڈپازٹ سلپ / ریفرنس نمبر' : 'Deposit slip / Reference no.'}
                                    </label>
                                    <input
                                        type="text"
                                        value={referenceNo}
                                        onChange={(e) => setReferenceNo(e.target.value)}
                                        placeholder="e.g. SLP-20451"
                                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all"
                                    />
                                </div>
                            </div>

                            {/* Remark (optional) */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    {isUrdu ? 'ریمارک (اختیاری)' : 'Remark (optional)'}
                                </label>
                                <input
                                    type="text"
                                    value={remark}
                                    onChange={(e) => setRemark(e.target.value)}
                                    placeholder="e.g. Din ka cash galla se jama"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all"
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center gap-3 pt-3">
                                <button
                                    type="submit"
                                    className="py-2.5 px-6 bg-[#166534] hover:bg-[#14532d] text-white text-sm font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                                >
                                    {isUrdu
                                        ? (activeTab === 'deposit' ? 'ڈپازٹ محفوظ کریں' : activeTab === 'withdraw' ? 'کیش نکالنا محفوظ کریں' : 'ٹرانسفر محفوظ کریں')
                                        : (activeTab === 'deposit' ? 'Deposit Save karein' : activeTab === 'withdraw' ? 'Withdrawal Save karein' : 'Transfer Save karein')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAmountStr('');
                                        setReferenceNo('');
                                        setRemark('');
                                    }}
                                    className="py-2.5 px-5 border border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                                >
                                    {isUrdu ? 'منسوخ' : 'Cancel'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Right Column: Ledger par asar & Pichli entries */}
                    <div className="lg:col-span-5 xl:col-span-4 space-y-4">
                        {/* Card 1: Ledger par asar */}
                        <div className="bg-[#f0f9f3] dark:bg-[#13281c] border border-[#d2ead8] dark:border-[#1e422c] rounded-xl p-5 shadow-xs">
                            <h3 className="text-sm font-semibold text-[#166534] dark:text-[#4ade80] mb-4">
                                {isUrdu ? 'لیجر پر اثر' : 'Ledger par asar'}
                            </h3>

                            <div className="space-y-4">
                                {/* Source line */}
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            {sourceTitle}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            {numericAmount > 0 ? (
                                                <>{formatCurrency(sourceBefore)} → {formatCurrency(sourceAfter)}</>
                                            ) : (
                                                <>{isUrdu ? 'موجودہ بیلنس:' : 'Mawjooda balance:'} {formatCurrency(sourceBefore)}</>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-sm font-bold text-[#b91c1c] dark:text-red-400">
                                        {numericAmount > 0 ? `- ${formatCurrency(numericAmount)}` : 'Rs. 0'}
                                    </div>
                                </div>

                                {/* Destination line */}
                                <div className="flex items-start justify-between gap-2 pt-2 border-t border-[#d2ead8]/60 dark:border-[#1e422c]/60">
                                    <div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            {destTitle}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            {numericAmount > 0 ? (
                                                <>{formatCurrency(destBefore)} → {formatCurrency(destAfter)}</>
                                            ) : (
                                                <>{isUrdu ? 'موجودہ بیلنس:' : 'Mawjooda balance:'} {formatCurrency(destBefore)}</>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-sm font-bold text-[#166534] dark:text-[#4ade80]">
                                        {numericAmount > 0 ? `+ ${formatCurrency(numericAmount)}` : 'Rs. 0'}
                                    </div>
                                </div>
                            </div>

                            {/* Informational Note */}
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-5 leading-relaxed">
                                {isUrdu
                                    ? 'اس انٹری سے سیل یا ماشاخور کھاتہ پر کوئی فرق نہیں پڑتا۔ صرف کیش اور بینک کا بیلنس بدلتا ہے۔'
                                    : 'Is entry se sale ya merchant khata par koi farq nahi parta. Sirf cash aur bank ka balance badalta hai.'}
                            </p>
                        </div>

                        {/* Card 2: Pichli entries */}
                        <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-5 shadow-xs">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
                                {isUrdu ? 'پچھلی انٹریز' : 'Pichli entries'}
                            </h3>

                            <div className="divide-y divide-gray-100 dark:divide-border">
                                {entries.length === 0 ? (
                                    <div className="py-4 text-center text-xs text-gray-400">
                                        {isUrdu ? 'کوئی پچھلی انٹری نہیں' : 'No previous entries'}
                                    </div>
                                ) : (
                                    entries.slice(0, 5).map((item) => (
                                        <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {item.title}
                                                </span>
                                                <span className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                                    {formatCurrency(item.amount)}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                                {item.subtext}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
