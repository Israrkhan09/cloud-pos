import React, { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import MandiPageHeader from '@/components/app/mandi-page-header';
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
import { cn } from '@/lib/utils';

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

    // Form inputs: initially empty strings (no account pre-selected)
    const [selectedBank, setSelectedBank] = useState<string>('');
    const [fromBank, setFromBank] = useState<string>('');
    const [toBank, setToBank] = useState<string>('');

    // Tab switcher handler - resets selected accounts and amount
    const handleTabChange = (tab: TransferTab) => {
        setActiveTab(tab);
        setSelectedBank('');
        setFromBank('');
        setToBank('');
        setAmountStr('');
    };

    // Amount - empty by default
    const [amountStr, setAmountStr] = useState('');

    // Date picker state
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    // Deposit slip / reference & remarks
    const [referenceNo, setReferenceNo] = useState('');
    const [remark, setRemark] = useState('');

    // Previous entries list from store
    const [entries, setEntries] = useState<TransferEntry[]>(() => getStoredTransfers());

    // Parse amount for calculations
    const numericAmount = parseFloat(amountStr.replace(/,/g, '').trim()) || 0;

    const formatCurrency = (val: number) => {
        return 'Rs. ' + Math.abs(Number(val) || 0).toLocaleString('en-US');
    };

    // Disabled state calculation
    const isSaveDisabled =
        accounts.length === 0 ||
        numericAmount <= 0 ||
        (activeTab === 'deposit' && !selectedBank) ||
        (activeTab === 'withdraw' && !selectedBank) ||
        (activeTab === 'transfer' && (!fromBank || !toBank || fromBank === toBank));

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

        if (activeTab === 'deposit' && !selectedBank) {
            toast.error(isUrdu ? 'برائے مہربانی بینک اکاؤنٹ منتخب کریں' : 'Barahe karam bank account select karein');
            return;
        }

        if (activeTab === 'withdraw' && !selectedBank) {
            toast.error(isUrdu ? 'برائے مہربانی بینک اکاؤنٹ منتخب کریں' : 'Barahe karam bank account select karein');
            return;
        }

        if (activeTab === 'transfer') {
            if (!fromBank || !toBank) {
                toast.error(isUrdu ? 'دونوں بینک اکاؤنٹس منتخب کریں' : 'Dono bank accounts select karein');
                return;
            }
            if (fromBank === toBank) {
                toast.error(
                    isUrdu
                        ? 'دونوں بینک اکاؤنٹس ایک جیسے نہیں ہو سکتے'
                        : 'Source and destination bank accounts cannot be the same'
                );
                return;
            }
        }

        if (numericAmount <= 0) {
            toast.error(isUrdu ? 'برائے مہربانی درست رقم درج کریں' : 'Please enter a valid amount');
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
            bankName: selectedBank || fromBank,
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
        setSelectedBank('');
        setFromBank('');
        setToBank('');
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

            <div className="-mt-4 -mx-4 -mb-4 pb-28 bg-[#eef2ee] min-h-full space-y-4">
                {/* Green Header Section */}
                <MandiPageHeader
                    title={isUrdu ? t('banking.transfers_title') : 'Deposit / Transfer'}
                    subtitle={isUrdu ? t('banking.transfers_subtitle') : 'Din ke aakhir mein galla se bank mein paise jama karwayein, ya bank se cash nikalein'}
                    isUrdu={isUrdu}
                />

                <div className="w-full px-4 md:px-6 -mt-6 md:-mt-8 space-y-6">
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

                {/* Full-width Form Card */}
                <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl shadow-xs p-6 w-full">
                    {/* Full-width Tabs Switcher with 3 equally wide buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 p-1.5 bg-gray-100 dark:bg-muted rounded-xl mb-6 gap-1 w-full">
                        <button
                            type="button"
                            onClick={() => handleTabChange('deposit')}
                            className={cn(
                                "w-full py-2.5 px-4 text-xs sm:text-sm rounded-lg font-medium transition-all cursor-pointer text-center",
                                activeTab === 'deposit'
                                    ? 'bg-white dark:bg-card text-gray-900 dark:text-white shadow-xs font-bold'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            )}
                        >
                            {isUrdu ? 'کیش ڈپازٹ (گلہ ← بینک)' : 'Cash Deposit (Galla → Bank)'}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTabChange('withdraw')}
                            className={cn(
                                "w-full py-2.5 px-4 text-xs sm:text-sm rounded-lg font-medium transition-all cursor-pointer text-center",
                                activeTab === 'withdraw'
                                    ? 'bg-white dark:bg-card text-gray-900 dark:text-white shadow-xs font-bold'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            )}
                        >
                            {isUrdu ? 'بینک ← کیش' : 'Bank → Cash'}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTabChange('transfer')}
                            className={cn(
                                "w-full py-2.5 px-4 text-xs sm:text-sm rounded-lg font-medium transition-all cursor-pointer text-center",
                                activeTab === 'transfer'
                                    ? 'bg-white dark:bg-card text-gray-900 dark:text-white shadow-xs font-bold'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            )}
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
                                        <div className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-muted/40 border border-gray-200 dark:border-border rounded-lg text-gray-800 dark:text-gray-200 font-medium">
                                            {isUrdu ? 'کیش ڈراور (گلہ)' : 'Cash Drawer (Galla)'}
                                        </div>
                                    </div>

                                    {/* Kis bank account mein */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                            {isUrdu ? 'کس بینک اکاؤنٹ میں' : 'Kis bank account mein'}
                                        </label>
                                        <select
                                            value={selectedBank}
                                            onChange={(e) => setSelectedBank(e.target.value)}
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all cursor-pointer font-medium"
                                        >
                                            <option value="" disabled>
                                                {isUrdu ? 'اکاؤنٹ منتخب کریں' : 'Account select karein'}
                                            </option>
                                            {accounts.map((acc) => (
                                                <option key={acc.id} value={acc.name}>
                                                    {acc.name} ({acc.type} · {formatCurrency(acc.current_balance)})
                                                </option>
                                            ))}
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
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all cursor-pointer font-medium"
                                        >
                                            <option value="" disabled>
                                                {isUrdu ? 'اکاؤنٹ منتخب کریں' : 'Account select karein'}
                                            </option>
                                            {accounts.map((acc) => (
                                                <option key={acc.id} value={acc.name}>
                                                    {acc.name} ({acc.type} · {formatCurrency(acc.current_balance)})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Kahan jama hoga */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                            {isUrdu ? 'کہاں جمع ہوگا' : 'Kahan jama hoga'}
                                        </label>
                                        <div className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-muted/40 border border-gray-200 dark:border-border rounded-lg text-gray-800 dark:text-gray-200 font-medium">
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
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFromBank(val);
                                                if (toBank === val) {
                                                    setToBank('');
                                                }
                                            }}
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all cursor-pointer font-medium"
                                        >
                                            <option value="" disabled>
                                                {isUrdu ? 'اکاؤنٹ منتخب کریں' : 'Account select karein'}
                                            </option>
                                            {accounts.map((acc) => (
                                                <option key={acc.id} value={acc.name}>
                                                    {acc.name} ({acc.type} · {formatCurrency(acc.current_balance)})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* To bank: exclude selected fromBank */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                            {isUrdu ? 'کس بینک اکاؤنٹ میں (To)' : 'Kis bank account mein (To)'}
                                        </label>
                                        <select
                                            value={toBank}
                                            onChange={(e) => setToBank(e.target.value)}
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all cursor-pointer font-medium"
                                        >
                                            <option value="" disabled>
                                                {isUrdu ? 'اکاؤنٹ منتخب کریں' : 'Account select karein'}
                                            </option>
                                            {accounts
                                                .filter((acc) => acc.name !== fromBank)
                                                .map((acc) => (
                                                    <option key={acc.id} value={acc.name}>
                                                        {acc.name} ({acc.type} · {formatCurrency(acc.current_balance)})
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Amount (Rs.) */}
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

                        {/* Date Picker and Reference No */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                            {/* Tareekh with Popover */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    {isUrdu ? 'تاریخ' : 'Tareekh'}
                                </label>
                                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            className="w-full flex items-center justify-between px-3.5 py-2.5 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white hover:border-[#166534] focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all cursor-pointer"
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
                                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all"
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
                                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all"
                            />
                        </div>

                        {/* Action Buttons: Disabled when account is not selected or amount is invalid */}
                        <div className="flex items-center gap-3 pt-3">
                            <button
                                type="submit"
                                disabled={isSaveDisabled}
                                className={cn(
                                    "py-2.5 px-6 text-sm font-semibold rounded-lg shadow-xs transition-colors",
                                    isSaveDisabled
                                        ? "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-gray-700"
                                        : "bg-[#166534] hover:bg-[#14532d] text-white cursor-pointer"
                                )}
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
                                    setSelectedBank('');
                                    setFromBank('');
                                    setToBank('');
                                }}
                                className="py-2.5 px-5 border border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                            >
                                {isUrdu ? 'منسوخ' : 'Cancel'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Pichli entries: Now below the form and FULL WIDTH */}
                <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-6 shadow-xs w-full">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">
                            {isUrdu ? 'پچھلی انٹریز' : 'Pichli entries'}
                        </h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            {entries.length} {isUrdu ? 'کل انٹریز' : 'kul entries'}
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-start text-sm border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-muted/50 border-b border-gray-200 dark:border-border text-[#4B5563] dark:text-gray-300 uppercase tracking-wider text-[11px] font-bold">
                                    <th className="py-3 px-4 text-start">QISAM / DETAIL</th>
                                    <th className="py-3 px-4 text-start">BANK ACCOUNT</th>
                                    <th className="py-3 px-4 text-start">TAREEKH / SLIP</th>
                                    <th className="py-3 px-4 text-end">RAQAM (RS.)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-border text-[#111827] dark:text-gray-100 font-medium">
                                {entries.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-6 text-center text-sm text-gray-400">
                                            {isUrdu ? 'کوئی پچھلی انٹری نہیں' : 'No previous entries'}
                                        </td>
                                    </tr>
                                ) : (
                                    entries.slice(0, 10).map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50/60 dark:hover:bg-muted/30 transition-colors">
                                            <td className="py-3 px-4 font-bold text-[#111827] dark:text-white">
                                                {item.title}
                                            </td>
                                            <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                                                {item.bankName || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">
                                                {item.subtext}
                                            </td>
                                            <td className="py-3 px-4 text-end font-bold text-sm text-[#111827] dark:text-white">
                                                {formatCurrency(item.amount)}
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
        </AppLayout>
    );
}
