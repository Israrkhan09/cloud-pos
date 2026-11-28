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

interface ReceiptItem {
    id: number;
    date: string;
    merchant_id: number;
    amount: string | number;
    type: string;
    note?: string | null;
    created_at?: string;
    merchant?: {
        id: number;
        code: number;
        name_en?: string;
        name_ur?: string;
        name?: string;
        phone?: string;
    } | null;
    creator?: {
        id: number;
        name: string;
    } | null;
}

interface ActiveMerchant {
    id: number;
    code: number;
    name_en?: string;
    name_ur?: string;
    name?: string;
    current_balance?: number;
}

interface Props {
    rows: WasooliRow[];
    totals: Totals;
    merchants?: ActiveMerchant[];
    receipts?: ReceiptItem[];
    filters: {
        date: string;
        search?: string;
    };
}

export default function WasooliIndex({ rows, totals, merchants = [], receipts = [], filters }: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [selectedDate, setSelectedDate] = useState(filters.date || new Date().toISOString().split('T')[0]);

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

    // Form states
    const [selectedMerchantId, setSelectedMerchantId] = useState<number | ''>('');
    const [amount, setAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
    const [selectedCashAccount, setSelectedCashAccount] = useState<string>('Main Cash Register');
    const [selectedBankAccount, setSelectedBankAccount] = useState<string>('');
    const [reference, setReference] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const amountInputRef = useRef<HTMLInputElement>(null);

    // Right table filters
    const [tableSearch, setTableSearch] = useState<string>('');
    const [tableMerchantFilter, setTableMerchantFilter] = useState<string>('all');

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'روزانہ کام' : 'Daily Kaam', href: '#' },
        { title: isUrdu ? 'وصولی' : 'Payment Recovery', href: '/wasooli' },
    ];

    // Dropdown list for selecting any active customer to record a payment/wasooli
    const dropdownMerchants = useMemo(() => {
        if (merchants && merchants.length > 0) {
            return merchants;
        }
        return rows.map(r => ({
            id: r.merchant_id,
            code: r.code,
            name: r.name,
            name_ur: r.name_ur,
            name_en: r.name_en,
            current_balance: r.total_baqaya,
        }));
    }, [merchants, rows]);

    // Selected merchant calculations
    const selectedMerchant = useMemo(() => {
        if (!selectedMerchantId) return null;
        const inRow = rows.find(r => r.merchant_id === Number(selectedMerchantId));
        if (inRow) {
            return {
                merchant_id: inRow.merchant_id,
                code: inRow.code,
                name: inRow.name,
                name_ur: inRow.name_ur,
                name_en: inRow.name_en,
                sabiqa: inRow.sabiqa,
                amroza: inRow.amroza,
                wasooli: inRow.wasooli,
                total_baqaya: inRow.total_baqaya,
            };
        }
        const m = dropdownMerchants.find(m => m.id === Number(selectedMerchantId));
        if (m) {
            const bal = Number(m.current_balance) || 0;
            return {
                merchant_id: m.id,
                code: m.code,
                name: m.name || m.name_ur || m.name_en || '',
                name_ur: m.name_ur || '',
                name_en: m.name_en || '',
                sabiqa: bal,
                amroza: 0,
                wasooli: 0,
                total_baqaya: bal,
            };
        }
        return null;
    }, [rows, dropdownMerchants, selectedMerchantId]);

    const sabiqa = selectedMerchant ? Number(selectedMerchant.sabiqa) : 0;
    const amroza = selectedMerchant ? Number(selectedMerchant.amroza) : 0;
    const wasooliMili = selectedMerchant ? Number(selectedMerchant.wasooli) : 0;
    const totalOutstanding = Math.max(0, sabiqa + amroza - wasooliMili);

    const numAmount = parseFloat(amount) || 0;
    // Over-limit check only warns/restricts when there is positive outstanding debt to prevent overpayment
    const isOverLimit = selectedMerchant && totalOutstanding > 0 ? numAmount > totalOutstanding : false;

    // Reset current form fields
    function handleReset() {
        setSelectedMerchantId('');
        setPaymentMethod('cash');
        setSelectedCashAccount('Main Cash Register');
        setSelectedBankAccount('');
        setAmount('');
        setReference('');
        setNotes('');
    }

    // Save wasooli receipt
    function handleSave(e?: React.FormEvent) {
        if (e) e.preventDefault();

        if (!selectedMerchant) {
            toast.error(isUrdu ? 'براہ کرم پہلے گاہک منتخب کریں۔' : 'Please select a customer first.');
            return;
        }

        if (paymentMethod === 'bank' && !selectedBankAccount) {
            toast.error(
                isUrdu
                    ? 'براہ کرم بینک یا والٹ اکاؤنٹ منتخب کریں۔'
                    : 'Please select a bank or wallet account.'
            );
            return;
        }

        if (numAmount <= 0) {
            toast.error(
                isUrdu
                    ? 'براہ کرم وصولی کی درست رقم درج کریں۔'
                    : 'Please enter a valid recovery amount.'
            );
            amountInputRef.current?.focus();
            return;
        }

        if (totalOutstanding > 0 && numAmount > totalOutstanding) {
            toast.error(
                isUrdu
                    ? `وصولی کی رقم کل بقایا (Rs. ${Number(totalOutstanding).toLocaleString()}) سے زیادہ نہیں ہو سکتی۔`
                    : `Recovery amount cannot exceed outstanding balance (Rs. ${Number(totalOutstanding).toLocaleString()}).`
            );
            return;
        }

        setSaving(true);

        const accountName = paymentMethod === 'bank' ? selectedBankAccount : selectedCashAccount;
        const noteText = notes.trim()
            ? notes.trim()
            : `Recovery via ${paymentMethod === 'bank' ? `Bank (${selectedBankAccount})` : 'Cash'}`;

        router.post('/wasooli', {
            merchant_id: selectedMerchant.merchant_id,
            date: selectedDate,
            amount: numAmount,
            payment_type: paymentMethod,
            bank_account: accountName,
            reference: reference.trim() || null,
            note: noteText,
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
                        title: `Merchant Recovery -> ${selectedBankAccount}`,
                        subtext: `${selectedDate} - Shop: ${selectedMerchant.name_en || selectedMerchant.name_ur || selectedMerchant.name} - Recovery`,
                        amount: numAmount,
                        date: selectedDate,
                        bankName: selectedBankAccount,
                        type: 'deposit',
                    });
                }

                toast.success(
                    isUrdu
                        ? `Rs. ${numAmount.toLocaleString()} کی وصولی کامیابی سے محفوظ ہو گئی!`
                        : `Payment recovery of Rs. ${numAmount.toLocaleString()} saved successfully!`
                );

                handleReset();
            },
            onError: () => {
                setSaving(false);
                toast.error(
                    isUrdu
                        ? 'محفوظ کرنے میں خرابی پیش آئی۔'
                        : 'Failed to save payment recovery.'
                );
            },
        });
    }

    // Filtered receipts for right table
    const filteredReceipts = useMemo(() => {
        let list = receipts;

        if (tableMerchantFilter !== 'all') {
            const mId = Number(tableMerchantFilter);
            list = list.filter(r => r.merchant_id === mId);
        }

        if (tableSearch.trim()) {
            const q = tableSearch.toLowerCase().trim();
            list = list.filter(r => {
                const recNum = `rec-${r.id}`.toLowerCase();
                const recNum5k = `rec-${5000 + r.id}`.toLowerCase();
                const mNameEn = (r.merchant?.name_en || '').toLowerCase();
                const mNameUr = (r.merchant?.name_ur || '').toLowerCase();
                const mName = (r.merchant?.name || '').toLowerCase();
                const note = (r.note || '').toLowerCase();
                const amt = String(r.amount);
                return recNum.includes(q) || recNum5k.includes(q) || mNameEn.includes(q) || mNameUr.includes(q) || mName.includes(q) || note.includes(q) || amt.includes(q);
            });
        }

        return list;
    }, [receipts, tableSearch, tableMerchantFilter]);

    // Parse tariqa and khaata from note
    function parseReceiptMeta(note?: string | null) {
        const text = (note || '').toLowerCase();
        let tariqa = 'Cash';
        let khaata = 'Main Cash Register';

        if (text.includes('bank')) {
            tariqa = 'Bank';
            const match = (note || '').match(/\((.*?)\)/);
            if (match && match[1]) {
                khaata = match[1];
            } else {
                khaata = 'Bank Account';
            }
        } else if (text.includes('cash') || text.includes('naqad')) {
            tariqa = 'Cash';
            khaata = 'Main Cash Register';
        }

        return { tariqa, khaata };
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'وصولی - جے کے سی' : 'Payment Recovery - Vegetable POS'} />

            {/* Main Outer Container */}
            <div className="-mt-4 -mx-4 -mb-4 pb-28 bg-[#eef2ee] min-h-full font-sans text-gray-900" dir={isUrdu ? 'rtl' : 'ltr'}>
                {/* Green Header Banner */}
                <MandiPageHeader
                    title={isUrdu ? 'وصولی (گاہک ادھار ریکوری اور جزوی ادائیگی)' : 'Payment Recovery (Customer Credit & Partial Collections)'}
                    subtitle={isUrdu ? 'دکاندار اور گاہکوں سے ادھار کی وصولی، جزوی ادائیگی اور کھاتہ اپ ڈیٹ' : 'Customer credit recovery, partial payments and ledger updates'}
                    isUrdu={isUrdu}
                />

                {/* Main Two-Column Layout */}
                <div className="w-full px-2 md:px-3 -mt-6 md:-mt-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">

                        {/* LEFT CARD: NAYI WASOOLI ENTRY */}
                        <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-200/90 shadow-xs p-4 md:p-5 space-y-3.5">
                            <h2 className="text-base font-bold text-gray-900 tracking-tight pb-1 border-b border-gray-100">
                                {isUrdu ? 'نئی وصولی اینٹری' : 'New Recovery Entry'}
                            </h2>

                            <form onSubmit={handleSave} className="space-y-3">
                                {/* 1. Gahak Muntakhib Karein */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        {isUrdu ? 'گاہک منتخب کریں:' : 'Select Customer:'}
                                    </label>
                                    <select
                                        value={selectedMerchantId}
                                        onChange={e => {
                                            const val = e.target.value ? Number(e.target.value) : '';
                                            setSelectedMerchantId(val);
                                            setAmount('');
                                        }}
                                        className="w-full min-h-[40px] h-10 rounded-xl border border-gray-200 px-2.5 text-xs font-medium bg-white text-gray-900 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] transition-all cursor-pointer"
                                    >
                                        <option value="">
                                            {isUrdu ? 'گاہک چنیں...' : 'Choose customer...'}
                                        </option>
                                        {dropdownMerchants.map(m => {
                                            const inRow = rows.find(r => r.merchant_id === m.id);
                                            const mBaqaya = inRow
                                                ? Math.round((Number(inRow.sabiqa) + Number(inRow.amroza) - Number(inRow.wasooli)) * 100) / 100
                                                : (Number(m.current_balance) || 0);
                                            const displayName = isUrdu
                                                ? (m.name_ur || m.name_en || m.name)
                                                : (m.name_en || m.name_ur || m.name);
                                            return (
                                                <option key={m.id} value={m.id}>
                                                    {displayName} (Rs. {Number(mBaqaya).toLocaleString()})
                                                </option>
                                            );
                                        })}
                                    </select>

                                    {/* Selected Merchant Outstanding Badge */}
                                    {selectedMerchant && (
                                        <div className="mt-1.5 p-2 rounded-lg bg-[#eef7f0] border border-[#1e713e]/20 flex items-center justify-between text-xs">
                                            <span className="text-gray-600 font-medium">
                                                {isUrdu ? 'بقایا (ادھار):' : 'Outstanding Balance:'}
                                            </span>
                                            <span className="font-bold text-[#14532d] tabular-nums text-xs">
                                                Rs. {Number(totalOutstanding).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* 2. Amount Received (Rs) */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        {isUrdu ? 'وصول شدہ رقم (Rs):' : 'Amount Received (Rs):'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            ref={amountInputRef}
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value)}
                                            placeholder="0"
                                            className={`w-full min-h-[40px] h-10 px-3 rounded-xl border text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none transition-all bg-white ${
                                                isOverLimit
                                                    ? 'border-red-400 focus:border-red-600 focus:ring-1 focus:ring-red-600 text-red-900'
                                                    : 'border-gray-200 focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e]'
                                            }`}
                                        />
                                    </div>

                                    {/* Quick Fill Chips & Over-limit warning */}
                                    {selectedMerchant && (
                                        <div className="mt-1 space-y-1">
                                            <div className="flex flex-wrap items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setAmount(String(totalOutstanding))}
                                                    className="px-2 py-0.5 rounded border border-gray-200 bg-white hover:bg-gray-50 text-[10px] font-semibold text-gray-700 transition-colors cursor-pointer"
                                                >
                                                    {isUrdu ? 'پورا' : 'Full'} ({Number(totalOutstanding).toLocaleString()})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setAmount(String(Math.round(totalOutstanding / 2)))}
                                                    className="px-2 py-0.5 rounded border border-gray-200 bg-white hover:bg-gray-50 text-[10px] font-semibold text-gray-700 transition-colors cursor-pointer"
                                                >
                                                    {isUrdu ? 'آدھا' : 'Half'} ({Number(Math.round(totalOutstanding / 2)).toLocaleString()})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAmount('');
                                                        amountInputRef.current?.focus();
                                                    }}
                                                    className="px-2 py-0.5 rounded border border-gray-200 bg-white hover:bg-gray-50 text-[10px] font-semibold text-gray-700 transition-colors cursor-pointer"
                                                >
                                                    Custom
                                                </button>
                                            </div>

                                            {isOverLimit && (
                                                <p className="text-[10px] text-red-600 font-semibold">
                                                    {isUrdu
                                                        ? `وصولی بقایا سے زیادہ نہیں ہو سکتی!`
                                                        : `Recovery cannot exceed balance due!`}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* 3. Payment Method */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        {isUrdu ? 'طریقہ ادائیگی:' : 'Payment Method:'}
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('cash')}
                                            className={`min-h-[38px] h-9 rounded-xl text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                                                paymentMethod === 'cash'
                                                    ? 'bg-[#1e713e] text-white border-2 border-[#1e713e] font-bold shadow-xs'
                                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            {isUrdu ? 'نقد (Cash)' : 'Cash'}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('bank')}
                                            className={`min-h-[38px] h-9 rounded-xl text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                                                paymentMethod === 'bank'
                                                    ? 'bg-[#1e713e] text-white border-2 border-[#1e713e] font-bold shadow-xs'
                                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            Bank
                                        </button>
                                    </div>
                                </div>

                                {/* 4. Account */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        {isUrdu ? 'کھاتہ (Account):' : 'Account:'}
                                    </label>
                                    {paymentMethod === 'cash' ? (
                                        <select
                                            value={selectedCashAccount}
                                            onChange={e => setSelectedCashAccount(e.target.value)}
                                            className="w-full min-h-[40px] h-10 rounded-xl border border-gray-200 px-2.5 text-xs font-medium bg-white text-gray-900 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] cursor-pointer"
                                        >
                                            <option value="Mandi Naqad Galla (Cash Counter)">
                                                Cash Counter
                                            </option>
                                        </select>
                                    ) : (
                                        <select
                                            value={selectedBankAccount}
                                            onChange={e => setSelectedBankAccount(e.target.value)}
                                            className="w-full min-h-[40px] h-10 rounded-xl border border-gray-200 px-2.5 text-xs font-semibold bg-white text-gray-900 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] cursor-pointer"
                                        >
                                            <option value="">
                                                {isUrdu ? 'اکاؤنٹ منتخب کریں' : 'Select Bank Account'}
                                            </option>
                                            {accounts.length === 0 ? (
                                                <option value="" disabled>
                                                    {isUrdu ? 'کوئی بینک اکاؤنٹ نہیں' : 'No bank account'}
                                                </option>
                                            ) : (
                                                accounts.map(acc => (
                                                    <option key={acc.id} value={acc.name}>
                                                        {acc.name} (Rs. {Number(acc.current_balance).toLocaleString('en-US')})
                                                    </option>
                                                ))
                                            )}
                                        </select>
                                    )}
                                </div>

                                {/* Tareekh & Reference */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            {isUrdu ? 'تاریخ:' : 'Date:'}
                                        </label>
                                        <input
                                            type="date"
                                            value={selectedDate}
                                            onChange={e => setSelectedDate(e.target.value)}
                                            className="w-full min-h-[38px] h-9 rounded-xl border border-gray-200 px-2 text-xs font-medium bg-white text-gray-900 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] cursor-pointer"
                                        />
                                    </div>

                                    {/* 5. Reference / TID (optional) */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            {isUrdu ? 'ریفرنس / TID:' : 'Reference / TID:'}
                                        </label>
                                        <input
                                            type="text"
                                            value={reference}
                                            onChange={e => setReference(e.target.value)}
                                            placeholder={isUrdu ? 'رسید / TID...' : 'Raseed / TID...'}
                                            className="w-full min-h-[38px] h-9 px-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] transition-all bg-white"
                                        />
                                    </div>
                                </div>

                                {/* 6. Notes */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        {isUrdu ? 'تفصیل (نوٹس):' : 'Notes / Remarks:'}
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        placeholder={isUrdu ? 'وصولی کی کوئی خاص وجہ یا تفصیل...' : 'Notes or remarks about this collection...'}
                                        className="w-full p-2 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] transition-all bg-white resize-none"
                                    />
                                </div>

                                {/* 7. Submit Button */}
                                <div className="pt-1">
                                    <button
                                        type="submit"
                                        disabled={saving || isOverLimit || !selectedMerchant || numAmount <= 0 || (paymentMethod === 'bank' && !selectedBankAccount)}
                                        className="w-full min-h-[42px] h-10 px-5 rounded-xl bg-[#1e713e] hover:bg-[#165a31] text-white font-bold text-xs md:text-sm shadow-xs cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {saving ? (isUrdu ? 'محفوظ ہو رہا ہے...' : 'Saving...') : (isUrdu ? 'وصولی محفوظ کریں' : 'Save Payment Recovery')}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* RIGHT CARD: WASOOLI RECORD & TAREEKH */}
                        <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-200/90 shadow-xs p-4 md:p-5 space-y-3.5">
                            {/* Card Top: Title, Search & Filter */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2.5 border-b border-gray-100">
                                <h2 className="text-base font-bold text-gray-900 tracking-tight shrink-0">
                                    {isUrdu ? 'وصولی ریکارڈ اور تاریخ' : 'Recovery History & Records'}
                                </h2>

                                <div className="flex flex-wrap items-center gap-2">
                                    {/* Search Box */}
                                    <div className="relative min-w-[130px] flex-1 sm:flex-initial">
                                        <input
                                            type="text"
                                            value={tableSearch}
                                            onChange={e => setTableSearch(e.target.value)}
                                            placeholder={isUrdu ? 'تلاش کریں...' : 'Search recoveries...'}
                                            className="w-full h-8 px-2.5 rounded-lg border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] transition-all bg-white"
                                        />
                                    </div>

                                    {/* Gahak Filter Dropdown */}
                                    <select
                                        value={tableMerchantFilter}
                                        onChange={e => setTableMerchantFilter(e.target.value)}
                                        className="h-8 rounded-lg border border-gray-200 px-2 text-xs font-medium bg-white text-gray-900 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] cursor-pointer"
                                    >
                                        <option value="all">
                                            {isUrdu ? 'تمام گاہک' : 'All Customers'}
                                        </option>
                                        {rows.map(m => (
                                            <option key={m.merchant_id} value={m.merchant_id}>
                                                {isUrdu ? (m.name_ur || m.name_en || m.name) : (m.name_en || m.name_ur || m.name)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                                <table className="w-full text-start text-[11px] leading-tight border-collapse">
                                    <thead>
                                        <tr className="bg-[#f8faf8] border-b border-gray-200 text-gray-700 font-bold">
                                            <th className="py-2 px-1.5 text-start whitespace-nowrap">
                                                {isUrdu ? 'وصولی #' : 'Recovery #'}
                                            </th>
                                            <th className="py-2 px-1.5 text-start whitespace-nowrap">
                                                {isUrdu ? 'گاہک کا نام' : 'Customer Name'}
                                            </th>
                                            <th className="py-2 px-1.5 text-start whitespace-nowrap">
                                                {isUrdu ? 'تاریخ' : 'Date'}
                                            </th>
                                            <th className="py-2 px-1.5 text-end whitespace-nowrap">
                                                {isUrdu ? 'وصول شدہ' : 'Amount Received'}
                                            </th>
                                            <th className="py-2 px-1.5 text-center whitespace-nowrap">
                                                {isUrdu ? 'طریقہ' : 'Method'}
                                            </th>
                                            <th className="py-2 px-1.5 text-start whitespace-nowrap">
                                                {isUrdu ? 'کھاتہ' : 'Account'}
                                            </th>
                                            <th className="py-2 px-1.5 text-start whitespace-nowrap">
                                                {isUrdu ? 'وصول کنندہ' : 'Received By'}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {filteredReceipts.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-8 text-center text-gray-400">
                                                    {isUrdu ? 'کوئی وصولی ریکارڈ نہیں ملا' : 'No recovery records found'}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredReceipts.map(rec => {
                                                const meta = parseReceiptMeta(rec.note);
                                                const merchantName = isUrdu
                                                    ? (rec.merchant?.name_ur || rec.merchant?.name_en || rec.merchant?.name || '—')
                                                    : (rec.merchant?.name_en || rec.merchant?.name_ur || rec.merchant?.name || '—');
                                                const wasoolKarta = rec.creator?.name || (isUrdu ? 'ایڈمن' : 'Malik Sahab (Admin)');

                                                return (
                                                    <tr key={rec.id} className="hover:bg-gray-50/70 transition-colors">
                                                        <td className="py-2 px-1.5 font-semibold text-gray-900 whitespace-nowrap">
                                                            REC-{5000 + rec.id}
                                                        </td>
                                                        <td className="py-2 px-1.5 font-medium text-gray-900 max-w-[105px] truncate" title={merchantName}>
                                                            {merchantName}
                                                        </td>
                                                        <td className="py-2 px-1.5 text-gray-600 whitespace-nowrap">
                                                            {rec.date}
                                                        </td>
                                                        <td className="py-2 px-1.5 text-end font-bold text-[#1e713e] tabular-nums whitespace-nowrap">
                                                            Rs {Number(rec.amount).toLocaleString()}
                                                        </td>
                                                        <td className="py-2 px-1.5 text-center whitespace-nowrap">
                                                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                                                meta.tariqa === 'Bank'
                                                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                            }`}>
                                                                {meta.tariqa}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-1.5 text-gray-700 max-w-[105px] truncate" title={meta.khaata}>
                                                            {meta.khaata}
                                                        </td>
                                                        <td className="py-2 px-1.5 text-gray-600 max-w-[75px] truncate" title={wasoolKarta}>
                                                            {wasoolKarta}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
