import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import MandiPageHeader from '@/components/app/mandi-page-header';
import { type BreadcrumbItem } from '@/types';
import { toast } from 'sonner';
import { XIcon } from '@phosphor-icons/react';
import {
    type ChequeItem,
    getStoredCheques,
    saveStoredCheques,
    updateAccountBalance,
    EVENT_BANKING_UPDATED,
} from '@/lib/banking-store';

type ChequeStatus = 'Pending' | 'Cleared' | 'Bounced';
type FilterStatus = 'all' | 'Pending' | 'Cleared' | 'Bounced';

export default function ChequesPage() {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    // Cheques state loaded from shared store
    const [cheques, setCheques] = useState<ChequeItem[]>(() => getStoredCheques());

    useEffect(() => {
        const handleUpdate = () => {
            setCheques(getStoredCheques());
        };
        window.addEventListener(EVENT_BANKING_UPDATED, handleUpdate);
        window.addEventListener('storage', handleUpdate);
        return () => {
            window.removeEventListener(EVENT_BANKING_UPDATED, handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, []);

    // Active status filter
    const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');

    // Cheque Bounce panel state
    const [selectedChequeForBounce, setSelectedChequeForBounce] = useState<ChequeItem | null>(null);
    const [bounceChargeStr, setBounceChargeStr] = useState('500');
    const [bounceRemark, setBounceRemark] = useState('Insufficient funds');

    // Counts for filter pills
    const totalCount = cheques.length;
    const pendingCount = cheques.filter((c) => c.status === 'Pending').length;
    const clearedCount = cheques.filter((c) => c.status === 'Cleared').length;
    const bouncedCount = cheques.filter((c) => c.status === 'Bounced').length;

    // Filtered cheques list
    const filteredCheques = cheques.filter((c) => {
        if (activeFilter === 'all') return true;
        return c.status === activeFilter;
    });

    const formatCurrency = (val: number) => {
        return 'Rs. ' + Number(val).toLocaleString('en-US');
    };

    // Mark cheque as cleared and update bank balance
    const handleClearCheque = (cheque: ChequeItem) => {
        const updated = cheques.map((c) => (c.id === cheque.id ? { ...c, status: 'Cleared' as const } : c));
        setCheques(updated);
        saveStoredCheques(updated);

        // Update corresponding bank account balance if recognized
        if (cheque.bank) {
            updateAccountBalance(cheque.bank, cheque.amount);
        }

        if (selectedChequeForBounce?.id === cheque.id) {
            setSelectedChequeForBounce(null);
        }
        toast.success(isUrdu ? 'چیک کلیئر مارک کر دیا گیا ہے اور بینک بیلنس اپ ڈیٹ ہو گیا ہے' : 'Cheque marked as Cleared & bank balance updated');
    };

    // Open bounce panel for cheque
    const handleOpenBouncePanel = (cheque: ChequeItem) => {
        setSelectedChequeForBounce(cheque);
        setBounceChargeStr('500');
        setBounceRemark('Insufficient funds');
    };

    // Confirm bounce action
    const handleConfirmBounce = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedChequeForBounce) return;

        const updated = cheques.map((c) =>
            c.id === selectedChequeForBounce.id ? { ...c, status: 'Bounced' as const } : c
        );
        setCheques(updated);
        saveStoredCheques(updated);

        toast.error(isUrdu ? 'چیک باؤنس مارک ہو گیا اور کھاتہ ریورس کر دیا گیا' : 'Cheque marked as Bounced & ledger reversed');
        setSelectedChequeForBounce(null);
    };

    const bounceChargeNum = parseFloat(bounceChargeStr.replace(/,/g, '').trim()) || 0;

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
            title: isUrdu ? 'چیکس' : 'Cheques',
            href: '/banking/cheques',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'چیکس - ویجیٹیبل پی او ایس' : 'Cheques - Vegetable POS'} />

            <div className="-mt-4 -mx-4 -mb-4 pb-28 bg-[#eef2ee] min-h-full space-y-4">
                {/* Green Header Section */}
                <MandiPageHeader
                    title={isUrdu ? t('banking.cheques_title') : 'Cheques'}
                    subtitle={isUrdu ? t('banking.cheques_subtitle') : 'Track status of cheques received from customers and issued to farmers'}
                    isUrdu={isUrdu}
                />

                {/* Main Content Area */}
                <div className="w-full px-4 md:px-6 -mt-6 md:-mt-8 space-y-6">
                    <div className={`grid grid-cols-1 ${selectedChequeForBounce ? 'lg:grid-cols-12' : ''} gap-6 items-start`}>
                    {/* Left Column (Table card) */}
                    <div className={`${selectedChequeForBounce ? 'lg:col-span-7 xl:col-span-8' : 'w-full'} bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl shadow-xs overflow-hidden`}>
                        {/* Top Filters Bar */}
                        <div className="p-4 sm:p-5 pb-3 flex items-center gap-2 flex-wrap">
                            {/* Sab */}
                            <button
                                type="button"
                                onClick={() => setActiveFilter('all')}
                                className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                                    activeFilter === 'all'
                                        ? 'bg-[#166534] text-white shadow-xs'
                                        : 'bg-white dark:bg-card border border-gray-200 dark:border-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted'
                                }`}
                            >
                                {isUrdu ? `سب (${totalCount})` : `All (${totalCount})`}
                            </button>

                            {/* Pending */}
                            <button
                                type="button"
                                onClick={() => setActiveFilter('Pending')}
                                className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                                    activeFilter === 'Pending'
                                        ? 'bg-[#166534] text-white shadow-xs'
                                        : 'bg-white dark:bg-card border border-gray-200 dark:border-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted'
                                }`}
                            >
                                {isUrdu ? `زیر التواء (${pendingCount})` : `Pending (${pendingCount})`}
                            </button>

                            {/* Cleared */}
                            <button
                                type="button"
                                onClick={() => setActiveFilter('Cleared')}
                                className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                                    activeFilter === 'Cleared'
                                        ? 'bg-[#166534] text-white shadow-xs'
                                        : 'bg-white dark:bg-card border border-gray-200 dark:border-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted'
                                }`}
                            >
                                {isUrdu ? `کلیئرڈ (${clearedCount})` : `Cleared (${clearedCount})`}
                            </button>

                            {/* Bounced */}
                            <button
                                type="button"
                                onClick={() => setActiveFilter('Bounced')}
                                className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                                    activeFilter === 'Bounced'
                                        ? 'bg-[#166534] text-white shadow-xs'
                                        : 'bg-white dark:bg-card border border-gray-200 dark:border-border text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-muted'
                                }`}
                            >
                                {isUrdu ? `باؤنسڈ (${bouncedCount})` : `Bounced (${bouncedCount})`}
                            </button>
                        </div>

                        {/* Cheques Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-start border-collapse">
                                <thead>
                                    <tr className="border-y border-gray-100 dark:border-border bg-gray-50/60 dark:bg-muted/30">
                                        <th className="py-3 px-4 text-start text-xs font-semibold text-gray-600 dark:text-gray-400">
                                            {isUrdu ? 'تاریخ' : 'Date'}
                                        </th>
                                        <th className="py-3 px-4 text-start text-xs font-semibold text-gray-600 dark:text-gray-400">
                                            {isUrdu ? 'پارٹی' : 'Party'}
                                        </th>
                                        <th className="py-3 px-4 text-start text-xs font-semibold text-gray-600 dark:text-gray-400">
                                            {isUrdu ? 'چیک نمبر / بینک' : 'Cheque no. / Bank'}
                                        </th>
                                        <th className="py-3 px-4 text-end text-xs font-semibold text-gray-600 dark:text-gray-400">
                                            {isUrdu ? 'رقم' : 'Amount'}
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
                                    {filteredCheques.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 px-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                                {isUrdu ? 'کوئی چیک دستیاب نہیں ہے' : 'No cheques found for this filter.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredCheques.map((item) => (
                                            <tr
                                                key={item.id}
                                                className={`hover:bg-gray-50/50 dark:hover:bg-muted/20 transition-colors ${
                                                    selectedChequeForBounce?.id === item.id ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                                                }`}
                                            >
                                                {/* Tareekh */}
                                                <td className="py-3.5 px-4 align-middle text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    {item.date}
                                                </td>

                                                {/* Party */}
                                                <td className="py-3.5 px-4 align-middle">
                                                    <div className="font-semibold text-sm text-gray-900 dark:text-white">
                                                        {item.party}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                        {item.party_sub}
                                                    </div>
                                                </td>

                                                {/* Cheque no / Bank */}
                                                <td className="py-3.5 px-4 align-middle">
                                                    <div className="font-mono text-sm font-medium text-gray-800 dark:text-gray-200">
                                                        {item.cheque_no}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                        {item.bank}
                                                    </div>
                                                </td>

                                                {/* Amount */}
                                                <td className="py-3.5 px-4 align-middle text-end text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                                    {formatCurrency(item.amount)}
                                                </td>

                                                {/* Status Badge */}
                                                <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                                                    {item.status === 'Pending' && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#fef3c7] text-[#b45309] dark:bg-amber-950/40 dark:text-amber-300">
                                                            {isUrdu ? 'زیر التواء' : 'Pending'}
                                                        </span>
                                                    )}
                                                    {item.status === 'Cleared' && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#dcfce7] text-[#15803d] dark:bg-emerald-950/40 dark:text-emerald-300">
                                                            {isUrdu ? 'کلیئرڈ' : 'Cleared'}
                                                        </span>
                                                    )}
                                                    {item.status === 'Bounced' && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#ffe4e6] text-[#e11d48] dark:bg-rose-950/40 dark:text-rose-300">
                                                            {isUrdu ? 'باؤنسڈ' : 'Bounced'}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3.5 px-4 align-middle text-end whitespace-nowrap">
                                                    {item.status === 'Pending' ? (
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleClearCheque(item)}
                                                                className="px-2.5 py-1 text-xs font-medium border border-gray-300 dark:border-border hover:border-[#166534] hover:text-[#166534] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-gray-700 dark:text-gray-300 rounded-md transition-colors cursor-pointer"
                                                            >
                                                                {isUrdu ? 'کلیئر' : 'Clear'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenBouncePanel(item)}
                                                                className="px-2.5 py-1 text-xs font-medium border border-red-200 dark:border-red-900/50 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 rounded-md transition-colors cursor-pointer"
                                                            >
                                                                {isUrdu ? 'باؤنس' : 'Bounce'}
                                                            </button>
                                                        </div>
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

                    {/* Right Column: Cheque Bounce Action Panel */}
                    {selectedChequeForBounce && (
                        <div className="lg:col-span-5 xl:col-span-4 bg-white dark:bg-card border border-red-200 dark:border-red-900/50 rounded-xl shadow-sm p-5 space-y-4 animate-in fade-in slide-in-from-right-4 duration-150">
                            {/* Panel Header */}
                            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-border">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                    <h3 className="font-bold text-base text-gray-900 dark:text-white">
                                        {isUrdu ? 'چیک باؤنس' : 'Cheque Bounce'}
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedChequeForBounce(null)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-md transition-colors cursor-pointer"
                                >
                                    <XIcon size={18} />
                                </button>
                            </div>

                            {/* Cheque Summary Card */}
                            <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-lg p-3.5 space-y-1.5">
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {isUrdu ? 'چیک نمبر:' : 'Cheque no:'} <span className="font-mono font-bold text-gray-900 dark:text-white">{selectedChequeForBounce.cheque_no}</span> ({selectedChequeForBounce.bank})
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {isUrdu ? 'پارٹی:' : 'Party:'} <span className="font-semibold text-gray-900 dark:text-white">{selectedChequeForBounce.party}</span>
                                </div>
                                <div className="text-sm font-bold text-red-600 dark:text-red-400 pt-1">
                                    {formatCurrency(selectedChequeForBounce.amount)}
                                </div>
                            </div>

                            {/* Bounce Form */}
                            <form onSubmit={handleConfirmBounce} className="space-y-4">
                                {/* Bounce charges */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        {isUrdu ? 'باؤنس چارجز (روپے)' : 'Bounce charges (Rs.)'}
                                    </label>
                                    <input
                                        type="text"
                                        value={bounceChargeStr}
                                        onChange={(e) => setBounceChargeStr(e.target.value)}
                                        placeholder="500"
                                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 transition-all"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        {isUrdu ? 'بینک جو کٹوتی کرتا ہے' : 'Deduction charged by the bank'}
                                    </p>
                                </div>

                                {/* Bounce ki wajah */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        {isUrdu ? 'باؤنس کی وجہ / ریمارک' : 'Bounce reason / Remark'}
                                    </label>
                                    <input
                                        type="text"
                                        value={bounceRemark}
                                        onChange={(e) => setBounceRemark(e.target.value)}
                                        placeholder="e.g. Insufficient funds"
                                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 transition-all"
                                    />
                                </div>

                                {/* Asar summary */}
                                <div className="p-3 bg-gray-50 dark:bg-muted/40 rounded-lg text-xs space-y-1.5 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-border">
                                    <div className="font-semibold text-gray-800 dark:text-gray-200">
                                        {isUrdu ? 'کھاتہ پر اثر:' : 'Khata par asar:'}
                                    </div>
                                    <p className="leading-relaxed">
                                        {isUrdu
                                            ? `پارٹی کے کھاتے میں واپس Rs. ${selectedChequeForBounce.amount.toLocaleString('en-US')} نام (debit) ہوں گے، اور بینک چارجز Rs. ${bounceChargeNum.toLocaleString('en-US')} ریکارڈ ہوں گے۔`
                                            : `Party ke khata mein wapas Rs. ${selectedChequeForBounce.amount.toLocaleString('en-US')} add honge, aur charges Rs. ${bounceChargeNum.toLocaleString('en-US')} record honge.`}
                                    </p>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        type="submit"
                                        className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                                    >
                                        {isUrdu ? 'باؤنس کنفرم کریں' : 'Confirm Bounce'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedChequeForBounce(null)}
                                        className="py-2 px-3 border border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                                    >
                                        {isUrdu ? 'منسوخ' : 'Cancel'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
                </div>
            </div>
        </AppLayout>
    );
}
