import React, { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { toast } from 'sonner';
import {
    type BankAccount,
    getStoredBankAccounts,
    getStoredTransfers,
    EVENT_BANKING_UPDATED,
} from '@/lib/banking-store';

interface ReconEntry {
    id: number | string;
    date: string;
    title: string;
    subtext: string;
    amount: number;
    status: 'Matched' | 'Unmatched';
    canMatch?: boolean;
}

interface BankAccountRecon {
    name: string;
    pos_balance: number;
    default_statement_balance: number;
    statement_period: string;
    entries: ReconEntry[];
}

export default function BankReconciliationPage() {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    // Stored bank accounts
    const [storedAccounts, setStoredAccounts] = useState<BankAccount[]>(() => getStoredBankAccounts());

    // Listen for storage updates
    useEffect(() => {
        const handleUpdate = () => {
            setStoredAccounts(getStoredBankAccounts());
        };
        window.addEventListener(EVENT_BANKING_UPDATED, handleUpdate);
        window.addEventListener('storage', handleUpdate);
        return () => {
            window.removeEventListener(EVENT_BANKING_UPDATED, handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, []);

    // Bank accounts data
    const [bankData, setBankData] = useState<Record<string, BankAccountRecon>>({
        'HBL Mandi A/C': {
            name: 'HBL Mandi A/C',
            pos_balance: 175000,
            default_statement_balance: 185000,
            statement_period: '1 Nov – 20 Nov 2026',
            entries: [
                {
                    id: 1,
                    date: '20 Nov',
                    title: 'Cash deposit (Galla → Bank)',
                    subtext: 'Slip SLP-20451',
                    amount: 50000,
                    status: 'Matched',
                    canMatch: false,
                },
                {
                    id: 2,
                    date: '19 Nov',
                    title: 'Wasooli: Haji Aslam Traders',
                    subtext: 'Raast / IBFT TID 88231',
                    amount: 25000,
                    status: 'Unmatched',
                    canMatch: true,
                },
                {
                    id: 3,
                    date: '18 Nov',
                    title: 'Wasooli: Bilal Brothers',
                    subtext: 'Cheque 00774410 cleared',
                    amount: 45000,
                    status: 'Matched',
                    canMatch: false,
                },
                {
                    id: 4,
                    date: '17 Nov',
                    title: 'Farmer payout: Ch. Imran',
                    subtext: 'Cheque 00093340',
                    amount: -35000,
                    status: 'Unmatched',
                    canMatch: true,
                },
                {
                    id: 5,
                    date: '15 Nov',
                    title: 'Cash deposit (Galla → Bank)',
                    subtext: 'Slip SLP-20312',
                    amount: 35000,
                    status: 'Matched',
                    canMatch: false,
                },
            ],
        },
        'Meezan Business': {
            name: 'Meezan Business',
            pos_balance: 130000,
            default_statement_balance: 130000,
            statement_period: '1 Nov – 20 Nov 2026',
            entries: [
                {
                    id: 101,
                    date: '17 Nov',
                    title: 'Bank → Cash (Meezan)',
                    subtext: 'Cheque withdrawal',
                    amount: -20000,
                    status: 'Matched',
                    canMatch: false,
                },
                {
                    id: 102,
                    date: '15 Nov',
                    title: 'Cash Deposit → Meezan Business',
                    subtext: 'Slip SLP-20312',
                    amount: 35000,
                    status: 'Matched',
                    canMatch: false,
                },
            ],
        },
        'JazzCash Business (Raast)': {
            name: 'JazzCash Business (Raast)',
            pos_balance: 18500,
            default_statement_balance: 18500,
            statement_period: '1 Nov – 20 Nov 2026',
            entries: [
                {
                    id: 201,
                    date: '19 Nov',
                    title: 'Online Wasooli (Raast)',
                    subtext: 'TID 99214',
                    amount: 18500,
                    status: 'Matched',
                    canMatch: false,
                },
            ],
        },
    });

    // Merge user added accounts from store into bankData
    useEffect(() => {
        const transfers = getStoredTransfers();
        setBankData((prev) => {
            const updated = { ...prev };
            storedAccounts.forEach((acc) => {
                const bal = Number(acc.current_balance) || 0;
                if (!updated[acc.name]) {
                    // Filter transfers for this account
                    const accountTransfers = transfers
                        .filter((t) => t.bankName === acc.name || t.title.includes(acc.name))
                        .map((t, idx) => ({
                            id: Number(t.id) || 1000 + idx,
                            date: t.date ? t.date.slice(0, 6) : '20 Nov',
                            title: t.title,
                            subtext: t.subtext,
                            amount: t.type === 'withdraw' ? -t.amount : t.amount,
                            status: 'Matched' as const,
                            canMatch: false,
                        }));

                    updated[acc.name] = {
                        name: acc.name,
                        pos_balance: bal,
                        default_statement_balance: bal,
                        statement_period: '1 Nov – 20 Nov 2026',
                        entries: accountTransfers.length > 0 ? accountTransfers : [
                            {
                                id: Date.now(),
                                date: '20 Nov',
                                title: `${acc.name} Opening / Balance`,
                                subtext: `Initial deposit ${acc.account_number}`,
                                amount: bal,
                                status: 'Matched',
                                canMatch: false,
                            },
                        ],
                    };
                } else {
                    // Update balance if changed
                    updated[acc.name] = {
                        ...updated[acc.name],
                        pos_balance: bal,
                    };
                }
            });
            return updated;
        });
    }, [storedAccounts]);

    // Active bank names list: user-added accounts first, then fallback
    const accountNames = storedAccounts.length > 0
        ? Array.from(new Set([...storedAccounts.map((a) => a.name), ...Object.keys(bankData)]))
        : Object.keys(bankData);

    // Selected bank account
    const [selectedBank, setSelectedBank] = useState<string>(() => {
        const stored = getStoredBankAccounts();
        return stored.length > 0 ? stored[0].name : 'HBL Mandi A/C';
    });

    const [statementPeriod, setStatementPeriod] = useState('1 Nov – 20 Nov 2026');
    const [statementClosingStr, setStatementClosingStr] = useState('185,000');

    // Completion modal state
    const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
    const [isReconFinalized, setIsReconFinalized] = useState(false);

    // Set initial closing balance when bank changes
    useEffect(() => {
        const acct = bankData[selectedBank];
        if (acct) {
            setStatementPeriod(acct.statement_period);
            setStatementClosingStr(acct.default_statement_balance.toLocaleString('en-US'));
        }
    }, [selectedBank, bankData]);

    // Current bank account object
    const currentAccount = bankData[selectedBank] || {
        name: selectedBank,
        pos_balance: 0,
        default_statement_balance: 0,
        statement_period: '1 Nov – 20 Nov 2026',
        entries: [],
    };

    // Handle account change
    const handleBankChange = (newBank: string) => {
        setSelectedBank(newBank);
        setIsReconFinalized(false);
        const acct = bankData[newBank];
        if (acct) {
            setStatementPeriod(acct.statement_period);
            setStatementClosingStr(acct.default_statement_balance.toLocaleString('en-US'));
        }
    };

    // Parse statement closing balance
    const statementClosingNum = parseFloat(statementClosingStr.replace(/,/g, '').trim()) || 0;

    // Unmatched entries net calculation
    const unmatchedEntries = currentAccount.entries.filter((e) => e.status === 'Unmatched');
    const unmatchedNet = unmatchedEntries.reduce((acc, curr) => acc + curr.amount, 0);

    // Reconciliation difference calculation formula:
    // Raw difference between POS and statement, minus net unmatched entries
    const rawDiff = currentAccount.pos_balance - statementClosingNum;
    const remainingDiff = Math.abs(rawDiff - unmatchedNet);

    const formatCurrency = (val: number) => {
        return 'Rs. ' + Math.abs(val).toLocaleString('en-US');
    };

    // Handle Match button click on an entry
    const handleMatchEntry = (entryId: number | string) => {
        setBankData((prev) => {
            const current = prev[selectedBank];
            if (!current) return prev;
            return {
                ...prev,
                [selectedBank]: {
                    ...current,
                    entries: current.entries.map((e) =>
                        e.id === entryId ? { ...e, status: 'Matched' } : e
                    ),
                },
            };
        });

        toast.success(isUrdu ? 'انٹری میچ ہو گئی ہے' : 'Entry matched successfully');
    };

    // Handle Undo button click on an entry
    const handleUndoEntry = (entryId: number | string) => {
        setBankData((prev) => {
            const current = prev[selectedBank];
            if (!current) return prev;
            return {
                ...prev,
                [selectedBank]: {
                    ...current,
                    entries: current.entries.map((e) =>
                        e.id === entryId ? { ...e, status: 'Unmatched' } : e
                    ),
                },
            };
        });

        toast.info(isUrdu ? 'انٹری غیر مماثل (Unmatched) پر واپس کر دی گئی ہے' : 'Entry reverted to Unmatched');
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
            title: isUrdu ? 'بینک مفاہمت' : 'Bank Reconciliation',
            href: '/banking/reconciliation',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'بینک مفاہمت - ویجیٹیبل پی او ایس' : 'Bank Reconciliation - Vegetable POS'} />

            <div className="max-w-7xl mx-auto w-full space-y-6 pb-12">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                            {isUrdu ? 'بینک مفاہمت (Bank Reconciliation)' : 'Bank Reconciliation'}
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {isUrdu
                                ? 'اپنے ریکارڈ کو بینک سٹیٹمنٹ سے ملائیں'
                                : 'Apne record ko bank statement se milayein'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={() => setIsCompleteModalOpen(true)}
                            className="px-4 py-2 bg-[#166534] hover:bg-[#14532d] text-white text-sm font-semibold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                        >
                            {isReconFinalized && (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                            {isUrdu ? 'مفاہمت مکمل کریں' : 'Reconciliation mukammal karein'}
                        </button>
                    </div>
                </div>

                {/* Finalized Banner */}
                {isReconFinalized && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <svg className="w-5 h-5 text-[#166534] dark:text-[#4ade80] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>
                                {isUrdu
                                    ? `مفاہمت برائے ${selectedBank} مکمل اور لاگ کر دی گئی ہے`
                                    : `Reconciliation baraye ${selectedBank} mukammal aur log ho chuki hai`}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsReconFinalized(false)}
                            className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                            {isUrdu ? 'دوبارہ ایڈٹ کریں' : 'Edit karein'}
                        </button>
                    </div>
                )}

                {/* Configuration Card (Bank account, Statement period, Statement closing balance) */}
                <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-5 shadow-xs">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Bank account dropdown - Dynamic from Bank Accounts */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                {isUrdu ? 'بینک اکاؤنٹ' : 'Bank account'}
                            </label>
                            <select
                                value={selectedBank}
                                onChange={(e) => handleBankChange(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all cursor-pointer font-medium"
                            >
                                {accountNames.map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Statement period */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                {isUrdu ? 'سٹیٹمنٹ مدت' : 'Statement period'}
                            </label>
                            <input
                                type="text"
                                value={statementPeriod}
                                onChange={(e) => setStatementPeriod(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all"
                            />
                        </div>

                        {/* Statement ka closing balance (Rs.) */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                {isUrdu ? 'سٹیٹمنٹ کا کلوزنگ بیلنس (روپے)' : 'Statement ka closing balance (Rs.)'}
                            </label>
                            <input
                                type="text"
                                value={statementClosingStr}
                                onChange={(e) => setStatementClosingStr(e.target.value)}
                                placeholder="185,000"
                                className="w-full px-3 py-2 text-sm text-end font-bold border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#166534] focus:border-[#166534] transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* 3 Summary Stat / Balance Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Card 1: POS record ka balance */}
                    <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-5 shadow-xs">
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            {isUrdu ? 'پی او ایس ریکارڈ کا بیلنس' : 'POS record ka balance'}
                        </div>
                        <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-2 tracking-tight">
                            {formatCurrency(currentAccount.pos_balance)}
                        </div>
                    </div>

                    {/* Card 2: Statement ka balance */}
                    <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-5 shadow-xs">
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            {isUrdu ? 'سٹیٹمنٹ کا بیلنس' : 'Statement ka balance'}
                        </div>
                        <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-2 tracking-tight">
                            {formatCurrency(statementClosingNum)}
                        </div>
                    </div>

                    {/* Card 3: Baqi farq (unmatched ke baad) */}
                    <div
                        className={`border rounded-xl p-5 shadow-xs transition-colors ${
                            remainingDiff === 0
                                ? 'bg-[#f0f9f3] dark:bg-[#13281c] border-[#d2ead8] dark:border-[#1e422c]'
                                : 'bg-[#fffbeb] dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
                        }`}
                    >
                        <div className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                            {isUrdu ? 'باقی فرق (غیر مماثل انٹریز کے بعد)' : 'Baqi farq (unmatched ke baad)'}
                        </div>
                        <div
                            className={`text-2xl sm:text-3xl font-bold mt-2 tracking-tight ${
                                remainingDiff === 0
                                    ? 'text-[#166534] dark:text-[#4ade80]'
                                    : 'text-amber-800 dark:text-amber-400'
                            }`}
                        >
                            Rs. {remainingDiff.toLocaleString('en-US')}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                            {remainingDiff === 0 ? (
                                isUrdu ? (
                                    `فرق Rs. ${Math.abs(rawDiff).toLocaleString('en-US')} غیر مماثل انٹریز سے حل ہو گیا`
                                ) : (
                                    `Farq Rs. ${Math.abs(rawDiff).toLocaleString('en-US')} do unmatched entries se explain ho gaya`
                                )
                            ) : isUrdu ? (
                                `باقی فرق Rs. ${remainingDiff.toLocaleString('en-US')} (${unmatchedEntries.length} غیر مماثل باقی)`
                            ) : (
                                `Baqi farq Rs. ${remainingDiff.toLocaleString('en-US')} (${unmatchedEntries.length} unmatched ${unmatchedEntries.length === 1 ? 'entry' : 'entries'} baqi)`
                            )}
                        </div>
                    </div>
                </div>

                {/* Reconciliation Entries Table */}
                <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-start border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-border bg-gray-50/60 dark:bg-muted/30">
                                    <th className="py-3 px-4 text-start text-xs font-semibold text-gray-600 dark:text-gray-400">
                                        {isUrdu ? 'تاریخ' : 'Tareekh'}
                                    </th>
                                    <th className="py-3 px-4 text-start text-xs font-semibold text-gray-600 dark:text-gray-400">
                                        {isUrdu ? 'انٹری' : 'Entry'}
                                    </th>
                                    <th className="py-3 px-4 text-end text-xs font-semibold text-gray-600 dark:text-gray-400">
                                        {isUrdu ? 'رقم' : 'Amount'}
                                    </th>
                                    <th className="py-3 px-4 text-start text-xs font-semibold text-gray-600 dark:text-gray-400">
                                        {isUrdu ? 'سٹیٹمنٹ سے' : 'Statement se'}
                                    </th>
                                    <th className="py-3 px-4 text-end text-xs font-semibold text-gray-600 dark:text-gray-400">
                                        {isUrdu ? 'ایکشن' : 'Action'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-border">
                                {currentAccount.entries.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-10 px-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                            {isUrdu ? 'اس بینک اکاؤنٹ کے لیے فی الحال کوئی انٹری موجود نہیں ہے' : 'No entries found for this bank account.'}
                                        </td>
                                    </tr>
                                ) : (
                                    currentAccount.entries.map((item) => (
                                        <tr
                                            key={item.id}
                                            className={`transition-colors ${
                                                item.status === 'Unmatched'
                                                    ? 'bg-[#fffdf7] dark:bg-amber-950/20 hover:bg-amber-50/60'
                                                    : 'hover:bg-gray-50/50 dark:hover:bg-muted/20'
                                            }`}
                                        >
                                            {/* Tareekh */}
                                            <td className="py-3.5 px-4 align-middle text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                {item.date}
                                            </td>

                                            {/* Entry title & subtext */}
                                            <td className="py-3.5 px-4 align-middle">
                                                <div className="font-semibold text-sm text-gray-900 dark:text-white">
                                                    {item.title}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                    {item.subtext}
                                                </div>
                                            </td>

                                            {/* Amount */}
                                            <td className="py-3.5 px-4 align-middle text-end text-sm font-bold whitespace-nowrap">
                                                <span className={item.amount > 0 ? 'text-[#166534] dark:text-[#4ade80]' : 'text-[#b91c1c] dark:text-rose-400'}>
                                                    {item.amount > 0 ? '+ ' : '- '}
                                                    {formatCurrency(item.amount)}
                                                </span>
                                            </td>

                                            {/* Statement se (Badge) */}
                                            <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                                                {item.status === 'Matched' ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#dcfce7] text-[#15803d] dark:bg-emerald-950/40 dark:text-emerald-300">
                                                        {isUrdu ? 'میچڈ' : 'Matched'}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#fef3c7] text-[#b45309] dark:bg-amber-950/40 dark:text-amber-300">
                                                        {isUrdu ? 'غیر مماثل' : 'Unmatched'}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Action */}
                                            <td className="py-3.5 px-4 align-middle text-end whitespace-nowrap">
                                                {item.canMatch ? (
                                                    item.status === 'Unmatched' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleMatchEntry(item.id)}
                                                            className="px-3 py-1 text-xs font-medium border border-gray-300 dark:border-border hover:border-[#166534] hover:text-[#166534] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-gray-700 dark:text-gray-300 rounded-md transition-all cursor-pointer shadow-2xs"
                                                        >
                                                            {isUrdu ? 'میچ کریں' : 'Match karein'}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUndoEntry(item.id)}
                                                            className="px-2.5 py-1 text-xs font-medium border border-amber-300 dark:border-amber-700 bg-amber-50/80 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded-md transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                                            title={isUrdu ? 'واپس غیر مماثل کریں' : 'Revert to Unmatched'}
                                                        >
                                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="1 4 1 10 7 10" />
                                                                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                                            </svg>
                                                            {isUrdu ? 'انڈو' : 'Undo'}
                                                        </button>
                                                    )
                                                ) : (
                                                    <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Completion Modal */}
                {isCompleteModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
                        <div className="bg-white dark:bg-card border border-gray-200 dark:border-border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
                            {/* Modal Header */}
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                            remainingDiff === 0
                                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-[#166534] dark:text-[#4ade80]'
                                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                                        }`}
                                    >
                                        {remainingDiff === 0 ? (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                            {isUrdu ? 'بینک مفاہمت مکمل کریں' : 'Reconciliation Mukammal Karein'}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            {selectedBank} ({statementPeriod})
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsCompleteModalOpen(false)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg transition-colors cursor-pointer"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Summary breakdown inside modal */}
                            <div className="bg-gray-50 dark:bg-muted/40 rounded-xl p-4 border border-gray-100 dark:border-border space-y-2.5">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">
                                        {isUrdu ? 'پی او ایس ریکارڈ بیلنس:' : 'POS record balance:'}
                                    </span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {formatCurrency(currentAccount.pos_balance)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">
                                        {isUrdu ? 'سٹیٹمنٹ کلوزنگ بیلنس:' : 'Statement closing balance:'}
                                    </span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {formatCurrency(statementClosingNum)}
                                    </span>
                                </div>
                                <div className="border-t border-gray-200 dark:border-border pt-2.5 flex justify-between items-center text-sm">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                        {isUrdu ? 'باقی فرق (Remaining Difference):' : 'Baqi farq (Difference):'}
                                    </span>
                                    <span
                                        className={`font-bold ${
                                            remainingDiff === 0
                                                ? 'text-[#166534] dark:text-[#4ade80]'
                                                : 'text-amber-800 dark:text-amber-400'
                                        }`}
                                    >
                                        Rs. {remainingDiff.toLocaleString('en-US')}
                                    </span>
                                </div>
                            </div>

                            {/* Status Info Box */}
                            {remainingDiff === 0 ? (
                                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-sm font-semibold">
                                        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span>{isUrdu ? 'مفاہمت 100% متوازن ہے' : 'Reconciliation 100% Balanced Hai'}</span>
                                    </div>
                                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 leading-relaxed">
                                        {isUrdu
                                            ? 'تمام ریکارڈز اور سٹیٹمنٹ کی انٹریز مکمل طور پر میچ ہو چکی ہیں۔ آپ اس پیریڈ کو محفوظ کر سکتے ہیں۔'
                                            : 'Tamam records aur statement entries mukammal match hain. Aap is period ko finalize kar sakte hain.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-sm font-semibold">
                                        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <span>{isUrdu ? 'فرق موجود ہے' : 'Difference Maujood Hai'}</span>
                                    </div>
                                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                                        {isUrdu
                                            ? `ابھی بھی Rs. ${remainingDiff.toLocaleString('en-US')} کا فرق باقی ہے۔ کیا آپ اس فرق کے ساتھ مفاہمت مکمل کرنا چاہتے ہیں؟`
                                            : `Abhi Rs. ${remainingDiff.toLocaleString('en-US')} ka farq baqi hai. Kya aap is farq ke sath mukammal karna chahte hain?`}
                                    </p>
                                </div>
                            )}

                            {/* Modal Action Buttons */}
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCompleteModalOpen(false)}
                                    className="px-4 py-2 border border-gray-300 dark:border-border hover:bg-gray-100 dark:hover:bg-muted text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                                >
                                    {isUrdu ? 'منسوخ کریں' : 'Cancel'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsReconFinalized(true);
                                        setIsCompleteModalOpen(false);
                                        toast.success(
                                            isUrdu
                                                ? 'بینک مفاہمت کامیابی سے مکمل اور ریکارڈ کر دی گئی ہے!'
                                                : 'Bank reconciliation kamyabi se mukammal aur record ho gayi hai!'
                                        );
                                    }}
                                    className={`px-4 py-2 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors cursor-pointer ${
                                        remainingDiff === 0
                                            ? 'bg-[#166534] hover:bg-[#14532d]'
                                            : 'bg-amber-700 hover:bg-amber-800'
                                    }`}
                                >
                                    {isUrdu ? 'مفاہمت فائنل کریں' : 'Finalize karein'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
