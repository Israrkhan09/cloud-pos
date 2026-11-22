import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import MandiPageHeader from '@/components/app/mandi-page-header';
import { toast } from 'sonner';
import {
    type BankAccount,
    getStoredBankAccounts,
    updateAccountBalance,
    addStoredTransfer,
    EVENT_BANKING_UPDATED,
} from '@/lib/banking-store';

interface WasooliRow {
    merchant_id: number;
    code: number;
    name: string;
    name_ur: string;
    name_en: string;
    phone?: string;
    sabiqa: number;
    amroza: number;
    wasooli: number;
    receipt_id?: number | null;
    total_baqaya: number;
}

interface Totals {
    total_sabiqa: number;
    total_amroza: number;
    total_wasooli: number;
    total_baqaya: number;
}

interface Props {
    rows: WasooliRow[];
    totals: Totals;
    filters: {
        date: string;
        search?: string;
    };
}

export default function WasooliIndex({ rows, totals, filters }: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [selectedDate, setSelectedDate] = useState(filters.date || new Date().toISOString().split('T')[0]);
    const [searchQuery, setSearchQuery] = useState(filters.search || '');

    // Bank accounts from reactive banking store
    const [accounts, setAccounts] = useState<BankAccount[]>([]);

    useEffect(() => {
        function loadAccounts() {
            const accs = getStoredBankAccounts().filter(a => a.status === 'Active');
            setAccounts(accs);
        }
        loadAccounts();

        window.addEventListener(EVENT_BANKING_UPDATED, loadAccounts);
        window.addEventListener('storage', loadAccounts);
        return () => {
            window.removeEventListener(EVENT_BANKING_UPDATED, loadAccounts);
            window.removeEventListener('storage', loadAccounts);
        };
    }, []);

    // 30-second background polling for real-time updates
    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({ preserveScroll: true, preserveState: true });
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    // Filtered merchants for left side list
    const filteredRows = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return rows;
        return rows.filter(r => {
            const nameEn = (r.name_en || '').toLowerCase();
            const nameUr = (r.name_ur || '').toLowerCase();
            const nameRaw = (r.name || '').toLowerCase();
            const code = String(r.code);
            return nameEn.includes(q) || nameUr.includes(q) || nameRaw.includes(q) || code.includes(q);
        });
    }, [rows, searchQuery]);

    // Selected merchant (default: first merchant or previously selected)
    const [selectedMerchantId, setSelectedMerchantId] = useState<number | null>(() => {
        return rows.length > 0 ? rows[0].merchant_id : null;
    });

    const selectedMerchant = useMemo(() => {
        if (!selectedMerchantId && filteredRows.length > 0) {
            return filteredRows[0];
        }
        const found = rows.find(r => r.merchant_id === selectedMerchantId);
        return found || (filteredRows.length > 0 ? filteredRows[0] : null);
    }, [rows, filteredRows, selectedMerchantId]);

    // Form inputs: Payment method (Cash or Bank/Wallet only), bank account, amount
    const [paymentMethod, setPaymentMethod] = useState<'' | 'cash' | 'bank'>('');
    const [selectedBankAccount, setSelectedBankAccount] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const amountInputRef = useRef<HTMLInputElement>(null);

    // Dynamic step number: if Bank, amount is step 3; if Cash, amount is step 2
    const amountStepNumber = paymentMethod === 'bank' ? 3 : 2;

    // Rule 17: Dukaan badalne par payment, account aur amount reset ho jayein
    function handleSelectMerchant(m: WasooliRow) {
        setSelectedMerchantId(m.merchant_id);
        setPaymentMethod('');
        setSelectedBankAccount('');
        setAmount('');
    }

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'روزانہ کام' : 'Daily Kaam', href: '#' },
        { title: isUrdu ? 'وصولی' : 'Wasooli', href: '/wasooli' },
    ];

    function handleDateChange(newDate: string) {
        setSelectedDate(newDate);
        router.get('/wasooli', { date: newDate }, { preserveState: false, replace: true });
    }

    function setQuickDate(offsetDays: number) {
        const target = new Date();
        target.setDate(target.getDate() + offsetDays);
        const yyyy = target.getFullYear();
        const mm = String(target.getMonth() + 1).padStart(2, '0');
        const dd = String(target.getDate()).padStart(2, '0');
        const str = `${yyyy}-${mm}-${dd}`;
        handleDateChange(str);
    }

    // Calculations for selected merchant
    const sabiqa = selectedMerchant ? Number(selectedMerchant.sabiqa) : 0;
    const amroza = selectedMerchant ? Number(selectedMerchant.amroza) : 0;
    const wasooliMili = selectedMerchant ? Number(selectedMerchant.wasooli) : 0;
    const totalOutstanding = Math.max(0, sabiqa + amroza - wasooliMili);

    const numAmount = parseFloat(amount) || 0;
    const liveNetBaqaya = Math.max(0, totalOutstanding - numAmount);
    const isOverLimit = numAmount > totalOutstanding;

    // Reset current form fields
    function handleReset() {
        setPaymentMethod('');
        setSelectedBankAccount('');
        setAmount('');
    }

    // Save wasooli receipt
    function handleSave() {
        if (!selectedMerchant) {
            toast.error(isUrdu ? 'براہ کرم پہلے دکان منتخب کریں۔' : 'Baraye meherbani pehle dukaan chunein.');
            return;
        }

        if (!paymentMethod) {
            toast.error(
                isUrdu
                    ? 'براہ کرم ادائیگی کا طریقہ (Cash یا Bank / Wallet) منتخب کریں۔'
                    : 'Baraye meherbani payment ka zariya (Cash ya Bank / Wallet) muntakhib karein.'
            );
            return;
        }

        if (paymentMethod === 'bank' && !selectedBankAccount) {
            toast.error(
                isUrdu
                    ? 'براہ کرم بینک یا والٹ اکاؤنٹ منتخب کریں۔'
                    : 'Baraye meherbani bank ya wallet account muntakhib karein.'
            );
            return;
        }

        if (numAmount <= 0) {
            toast.error(
                isUrdu
                    ? 'براہ کرم وصولی کی درست رقم درج کریں۔'
                    : 'Baraye meherbani wasooli ki raqam darj karein.'
            );
            amountInputRef.current?.focus();
            return;
        }

        if (numAmount > totalOutstanding) {
            toast.error(
                isUrdu
                    ? `وصولی کی رقم کل بقایا (Rs. ${Number(totalOutstanding).toLocaleString()}) سے زیادہ نہیں ہو سکتی۔`
                    : `Wasooli ki raqam baqaya (Rs. ${Number(totalOutstanding).toLocaleString()}) se zyada nahi ho sakti.`
            );
            return;
        }

        setSaving(true);

        router.post('/wasooli', {
            merchant_id: selectedMerchant.merchant_id,
            date: selectedDate,
            amount: numAmount,
            payment_type: paymentMethod,
            bank_account: selectedBankAccount,
            note: `Wasooli via ${paymentMethod === 'bank' ? `Bank (${selectedBankAccount})` : 'Cash'}`,
        }, {
            preserveScroll: true,
            preserveState: false,
            onSuccess: () => {
                setSaving(false);

                // Real-time synchronization with Banking System
                if (paymentMethod === 'bank' && selectedBankAccount) {
                    updateAccountBalance(selectedBankAccount, numAmount);
                    addStoredTransfer({
                        id: Date.now(),
                        title: `Merchant Wasooli → ${selectedBankAccount}`,
                        subtext: `${selectedDate} · Dukaan: ${selectedMerchant.name_en || selectedMerchant.name_ur || selectedMerchant.name} · Wasooli`,
                        amount: numAmount,
                        date: selectedDate,
                        bankName: selectedBankAccount,
                        type: 'deposit',
                    });
                }

                toast.success(
                    isUrdu
                        ? `Rs. ${numAmount.toLocaleString()} کی وصولی کامیابی سے محفوظ ہو گئی!`
                        : `Rs. ${numAmount.toLocaleString()} ki wasooli kamyabi se save ho gayi!`
                );

                // Reset form fields
                handleReset();
            },
            onError: () => {
                setSaving(false);
                toast.error(
                    isUrdu
                        ? 'محفوظ کرنے میں خرابی پیش آئی۔'
                        : 'Wasooli save karne mein masla pesh aaya.'
                );
            },
        });
    }

    const selectedMerchantDisplayName = selectedMerchant
        ? (Number(selectedMerchant.code) === 1
            ? (isUrdu ? 'نقدی (عام خریدار)' : 'Naqdi (Cash Customer)')
            : isUrdu
            ? (selectedMerchant.name_ur || selectedMerchant.name_en || selectedMerchant.name)
            : (selectedMerchant.name_en || selectedMerchant.name_ur || selectedMerchant.name))
        : '—';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'وصولی اینٹری - جے کے سی' : 'Wasooli Entry - Vegetable POS'} />

            {/* Main Outer Container */}
            <div className="-mt-4 -mx-4 -mb-8 pb-28 bg-[#f4f6f4] min-h-screen font-sans text-gray-900" dir={isUrdu ? 'rtl' : 'ltr'}>
                
                {/* Green Header Banner matching screenshot and existing style */}
                <MandiPageHeader
                    title={isUrdu ? 'وصولی اینٹری' : 'Wasooli Entry'}
                    subtitle={isUrdu ? 'لیفٹ سے دکان چنیں، رائٹ پر 3 سٹیپس پورے کریں' : 'Left se dukaan chunein, right par 3 steps poore karein'}
                    isUrdu={isUrdu}
                />

                {/* Main Two-Column Desk */}
                <div className="max-w-7xl mx-auto px-3 md:px-6 -mt-6 md:-mt-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        
                        {/* LEFT COLUMN: DUKAAN LIST */}
                        <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-200/90 shadow-xs p-4 flex flex-col justify-between min-h-[580px]">
                            <div>
                                {/* Search Box */}
                                <div className="mb-4">
                                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                                        {isUrdu ? 'دکان تلاش کریں' : 'Dukaan search'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            placeholder={isUrdu ? 'نام یا کوڈ لکھیں' : 'Naam ya code likhein'}
                                            className="w-full min-h-[44px] h-11 px-3.5 rounded-xl border border-gray-200 text-xs md:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] transition-all bg-white"
                                        />
                                    </div>
                                </div>

                                {/* Count Heading */}
                                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2.5 px-0.5">
                                    {filteredRows.length} {isUrdu ? 'دکانیں (بقایا کے حساب سے)' : 'DUKAANEIN (BAQAYA KE HISAAB SE)'}
                                </div>

                                {/* Rows List */}
                                <div className="space-y-2 max-h-[480px] overflow-y-auto pe-1">
                                    {filteredRows.length === 0 ? (
                                        <div className="p-6 text-center text-gray-400 text-xs">
                                            {isUrdu ? 'کوئی دکان نہیں ملی' : 'Koi dukaan nahi mili'}
                                        </div>
                                    ) : (
                                        filteredRows.map(m => {
                                            const isSelected = selectedMerchant?.merchant_id === m.merchant_id;
                                            const mBaqaya = Math.round((Number(m.sabiqa) + Number(m.amroza) - Number(m.wasooli)) * 100) / 100;
                                            const displayName = Number(m.code) === 1
                                                ? (isUrdu ? 'نقدی (عام خریدار)' : 'Naqdi (Cash)')
                                                : isUrdu
                                                ? (m.name_ur || m.name_en || m.name)
                                                : (m.name_en || m.name_ur || m.name);

                                            return (
                                                <button
                                                    key={m.merchant_id}
                                                    type="button"
                                                    onClick={() => handleSelectMerchant(m)}
                                                    className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-3 rounded-xl transition-all cursor-pointer text-start ${
                                                        isSelected
                                                            ? 'border-2 border-[#1e713e] bg-[#eef7f0] shadow-xs'
                                                            : 'border border-gray-150 bg-white hover:bg-gray-50/80 text-gray-800'
                                                    }`}
                                                >
                                                    <span className={`text-xs md:text-sm font-semibold truncate ${isSelected ? 'text-[#14532d] font-bold' : 'text-gray-900'}`}>
                                                        {displayName}
                                                    </span>
                                                    <span className={`text-xs md:text-sm font-bold tabular-nums ms-2 shrink-0 ${isSelected ? 'text-[#14532d]' : 'text-gray-800'}`}>
                                                        {Number(mBaqaya).toLocaleString()}
                                                    </span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Left Column Bottom Note */}
                            <p className="text-[11px] text-gray-400 mt-6 pt-3 border-t border-gray-100 leading-relaxed">
                                {isUrdu
                                    ? 'سابقہ، آج کی سیل اور وصولی کا حساب ہر دکان کے لیے الگ رہتا ہے۔'
                                    : 'Sabiqa, Aaj ki sale aur Wasooli ka hisaab har dukaan ke liye alag rehta hai.'}
                            </p>
                        </div>

                        {/* RIGHT COLUMN: WASOOLI FORM */}
                        <div className="lg:col-span-8 space-y-3">
                            {/* 1. Dukaan Header Card */}
                            <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs p-4 md:p-5 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight">
                                        {selectedMerchantDisplayName}
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {selectedMerchant?.phone || '0300-0000000'}
                                    </p>
                                </div>
                                <div>
                                    {selectedMerchant ? (
                                        liveNetBaqaya > 0 ? (
                                            <span className="inline-block bg-[#fef3c7] text-[#92400e] border border-[#fde68a] text-xs font-semibold px-3 py-1 rounded-md">
                                                {isUrdu ? 'ادائیگی باقی ہے' : 'Payment Pending'}
                                            </span>
                                        ) : (
                                            <span className="inline-block bg-emerald-100/90 text-emerald-800 border border-emerald-200 text-xs font-semibold px-3 py-1 rounded-md">
                                                {isUrdu ? 'مکمل کلیئر' : 'Payment Cleared'}
                                            </span>
                                        )
                                    ) : (
                                        <span className="text-gray-400 text-sm">—</span>
                                    )}
                                </div>
                            </div>

                            {/* 2. Three Balance Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-2xs">
                                    <span className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                                        {isUrdu ? 'سابقہ بقایا' : 'SABIQA BAQAYA'}
                                    </span>
                                    <span className="text-base md:text-lg font-bold text-gray-900 mt-1 block">
                                        {selectedMerchant ? `Rs. ${Number(sabiqa).toLocaleString()}` : '—'}
                                    </span>
                                </div>

                                <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-2xs">
                                    <span className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                                        {isUrdu ? 'آج کی سیل' : 'AAJ KI SALE'}
                                    </span>
                                    <span className="text-base md:text-lg font-bold text-gray-900 mt-1 block">
                                        {selectedMerchant ? `Rs. ${Number(amroza).toLocaleString()}` : '—'}
                                    </span>
                                </div>

                                <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-2xs">
                                    <span className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                                        {isUrdu ? 'وصولی ملی' : 'WASOOLI MILI'}
                                    </span>
                                    <span className="text-base md:text-lg font-bold text-gray-900 mt-1 block">
                                        {selectedMerchant ? `Rs. ${Number(wasooliMili).toLocaleString()}` : '—'}
                                    </span>
                                </div>
                            </div>

                            {/* 3. Net Baqaya Strip Card */}
                            <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs p-4 md:p-5 flex items-center justify-between gap-4">
                                <div>
                                    <span className="text-xs md:text-sm font-bold text-gray-900 block">
                                        {isUrdu ? 'نیٹ بقایا (ابھی دینا ہے)' : 'Net baqaya (abhi dena hai)'}
                                    </span>
                                    <span className="text-[11px] text-gray-400 mt-0.5 block">
                                        {isUrdu ? 'سابقہ + آج کی سیل − وصولی' : 'Sabiqa + Aaj ki sale − Wasooli'}
                                    </span>
                                </div>
                                <div className="text-2xl md:text-3xl font-black tabular-nums text-[#1e713e]" dir="ltr">
                                    {selectedMerchant ? `Rs. ${Number(liveNetBaqaya).toLocaleString()}` : '—'}
                                </div>
                            </div>

                            {/* 4. Step 1: Paise kaise mile? */}
                            <div className="bg-white rounded-2xl border border-gray-200/90 border-l-4 border-l-[#1e713e] shadow-xs p-4 md:p-5 space-y-3">
                                <h3 className="text-sm md:text-base font-bold text-gray-900">
                                    {isUrdu ? '1 پیسے کیسے ملے؟' : '1 Paise kaise mile?'}
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('cash')}
                                        className={`min-h-[44px] h-11 rounded-xl text-xs md:text-sm font-semibold flex items-center justify-center transition-all cursor-pointer ${
                                            paymentMethod === 'cash'
                                                ? 'border-2 border-[#1e713e] bg-[#eef7f0] text-gray-900 font-bold'
                                                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        Cash
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('bank')}
                                        className={`min-h-[44px] h-11 rounded-xl text-xs md:text-sm font-semibold flex items-center justify-center transition-all cursor-pointer ${
                                            paymentMethod === 'bank'
                                                ? 'border-2 border-[#1e713e] bg-[#eef7f0] text-gray-900 font-bold'
                                                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        Bank / Wallet
                                    </button>
                                </div>
                            </div>

                            {/* 5. Step 2: Kis account mein paise aaye? (Visible only when Bank / Wallet is selected) */}
                            {paymentMethod === 'bank' && (
                                <div className="bg-white rounded-2xl border border-gray-200/90 border-l-4 border-l-[#1e713e] shadow-xs p-4 md:p-5 space-y-2 animate-in fade-in duration-150">
                                    <h3 className="text-sm md:text-base font-bold text-gray-900">
                                        {isUrdu ? '2 کس اکاؤنٹ میں پیسے آئے؟' : '2 Kis account mein paise aaye?'}
                                    </h3>
                                    <p className="text-xs text-gray-400 mb-2">
                                        {isUrdu ? 'یہ صرف Bank / Wallet چننے پر دکھتا ہے' : 'Ye sirf Bank / Wallet chunne par dikhta hai'}
                                    </p>
                                    <select
                                        value={selectedBankAccount}
                                        onChange={e => setSelectedBankAccount(e.target.value)}
                                        className="w-full min-h-[44px] h-11 rounded-xl border border-gray-200 px-3 text-xs md:text-sm font-semibold bg-white text-gray-900 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] transition-all cursor-pointer"
                                    >
                                        <option value="" disabled>
                                            {isUrdu ? 'اکاؤنٹ منتخب کریں' : 'Account select karein'}
                                        </option>
                                        {accounts.length === 0 ? (
                                            <option value="" disabled>
                                                {isUrdu ? 'کوئی بینک اکاؤنٹ دستیاب نہیں' : 'No active bank account available'}
                                            </option>
                                        ) : (
                                            accounts.map(acc => (
                                                <option key={acc.id} value={acc.name}>
                                                    {acc.name} (Rs. {Number(acc.current_balance).toLocaleString('en-US')})
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>
                            )}

                            {/* 6. Step: Kitni wasooli hui? (Step 2 if Cash, Step 3 if Bank) */}
                            <div className="bg-white rounded-2xl border border-gray-200/90 border-l-4 border-l-[#1e713e] shadow-xs p-4 md:p-5 space-y-3">
                                <h3 className="text-sm md:text-base font-bold text-gray-900">
                                    {isUrdu ? `${amountStepNumber} کتنی وصولی ہوئی؟` : `${amountStepNumber} Kitni wasooli hui?`}
                                </h3>

                                <div className="relative">
                                    <input
                                        ref={amountInputRef}
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        placeholder="Rs. 0.00"
                                        className={`w-full min-h-[44px] h-12 rounded-xl border px-4 text-base md:text-lg font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none transition-all bg-white ${
                                            isOverLimit
                                                ? 'border-red-400 focus:border-red-600 focus:ring-1 focus:ring-red-600 text-red-900'
                                                : 'border-gray-200 focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e]'
                                        }`}
                                    />
                                </div>

                                {/* Maximum Note */}
                                <div className="flex items-center justify-between text-xs">
                                    <span className={isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                                        {isOverLimit
                                            ? (isUrdu
                                                ? `وصولی کی رقم بقایا (Rs. ${Number(totalOutstanding).toLocaleString()}) سے زیادہ نہیں ہو سکتی!`
                                                : `Wasooli ki raqam baqaya (Rs. ${Number(totalOutstanding).toLocaleString()}) se zyada nahi ho sakti!`)
                                            : (isUrdu
                                                ? `زیادہ سے زیادہ Rs. ${Number(totalOutstanding).toLocaleString()} (نیٹ بقایا سے زیادہ نہیں ہو سکتی)`
                                                : `Maximum Rs. ${Number(totalOutstanding).toLocaleString()} (net baqaya se zyada nahi ho sakti)`)}
                                    </span>
                                </div>

                                {/* Quick Buttons */}
                                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setAmount(String(totalOutstanding))}
                                        className="min-h-[36px] h-9 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
                                    >
                                        {isUrdu ? 'پورا' : 'Poora'} ({Number(totalOutstanding).toLocaleString()})
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setAmount(String(Math.round(totalOutstanding / 2)))}
                                        className="min-h-[36px] h-9 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
                                    >
                                        {isUrdu ? 'آدھا' : 'Aadha'} ({Number(Math.round(totalOutstanding / 2)).toLocaleString()})
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAmount('');
                                            amountInputRef.current?.focus();
                                        }}
                                        className="min-h-[36px] h-9 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
                                    >
                                        Custom
                                    </button>
                                </div>
                            </div>

                            {/* 7. Bottom Action Row */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                                <p className="text-xs text-gray-500 leading-relaxed text-center sm:text-start">
                                    {isUrdu
                                        ? 'سیو کے بعد انٹری لیجر میں جائے گی اور اکاؤنٹ کا بیلنس اپ ڈیٹ ہو گا۔'
                                        : 'Save ke baad entry ledger mein jayegi aur account ka balance update hoga.'}
                                </p>
                                <div className="flex items-center gap-3 shrink-0">
                                    <button
                                        type="button"
                                        onClick={handleReset}
                                        className="min-h-[44px] h-11 px-5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs md:text-sm cursor-pointer transition-colors"
                                    >
                                        Reset
                                    </button>

                                    <button
                                        type="button"
                                        disabled={saving || isOverLimit || !selectedMerchant || !paymentMethod || numAmount <= 0 || (paymentMethod === 'bank' && !selectedBankAccount)}
                                        onClick={handleSave}
                                        className="min-h-[44px] h-11 px-6 rounded-xl bg-[#1e713e] hover:bg-[#165a31] text-white font-bold text-xs md:text-sm shadow-xs cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {saving ? (isUrdu ? 'محفوظ ہو رہا ہے...' : 'Saving...') : 'Save Karein'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
