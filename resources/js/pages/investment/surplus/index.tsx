import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import InvestmentHeader from '@/components/investment/investment-header';
import EntryDrawer from '@/components/investment/entry-drawer';
import BreakdownModal, { BreakdownData } from '@/components/investment/breakdown-modal';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SurplusFundRow {
    id: number;
    fund_name: string;
    fund_name_ur?: string;
    principal_amount: number;
    profit_or_loss: number;
    roi_rate: string;
    is_realised: boolean;
    maturity_date?: string;
    roi_maturity: string;
    status: string;
    total_return: number;
    notes?: string;
}

interface WapsiSplitData {
    fund_name: string;
    principal: number;
    munafa: number;
    total: number;
}

interface GoldSavingsAlertData {
    show: boolean;
    fund_name: string;
    days_overdue: number;
    maturity_date: string;
    amount: number;
    message: string;
}

interface Props {
    userName?: string;
    isOwner?: boolean;
    currentRole: 'munshi' | 'owner';
    pendingApprovalsCount?: number;
    lastUpdated?: string;
    partnersList: any[];
    loansList: any[];
    surplusList: any[];
    bankAccounts: string[];
    funds: SurplusFundRow[];
    search?: string;
    wapsiSplit: WapsiSplitData;
    goldSavingsAlert: GoldSavingsAlertData;
    breakdowns: Record<string, BreakdownData>;
    summary: {
        active_principal: number;
        active_return: number;
        unrealised_profit: number;
        realised_profit: number;
        closed_return: number;
        total_return: number;
    };
}

export default function InvestmentSurplusPage({
    userName,
    pendingApprovalsCount = 0,
    lastUpdated,
    partnersList,
    loansList,
    surplusList,
    bankAccounts,
    funds,
    search = '',
    wapsiSplit,
    goldSavingsAlert,
    breakdowns,
    summary,
}: Props) {
    const { i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [selectedFundId, setSelectedFundId] = useState<number | null>(funds[0]?.id ?? null);
    const [isEntryDrawerOpen, setIsEntryDrawerOpen] = useState(false);
    const [activeBreakdown, setActiveBreakdown] = useState<BreakdownData | null>(null);

    // Return dialog state
    const [returnModalFund, setReturnModalFund] = useState<SurplusFundRow | null>(null);
    const [returnMethod, setReturnMethod] = useState<'cash' | 'bank'>('cash');
    const [returnBankName, setReturnBankName] = useState(bankAccounts[0] || 'Meezan Bank Ltd');

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'انویسٹمنٹ' : 'Investment', href: '/investment/partners' },
        { title: isUrdu ? 'سرپلس: فالتو پیسہ' : 'Surplus (Faltu Paisa)', href: '/investment/surplus' },
    ];

    const activeSelectedFund = funds.find(f => f.id === selectedFundId) || funds[0] || null;

    const formatRs = (val: number) => 'Rs. ' + Number(val || 0).toLocaleString('en-US');
    const formatNum = (val: number) => Number(val || 0).toLocaleString('en-US');

    // Handle return
    const handleConfirmReturn = (e: React.FormEvent) => {
        e.preventDefault();
        if (!returnModalFund) return;

        router.post(`/investment/surplus/${returnModalFund.id}/return`, {
            payment_method: returnMethod,
            bank_name: returnMethod === 'bank' ? returnBankName : null,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(isUrdu ? 'سرپلس رقم اور منافع کی واپسی محفوظ ہو گئی' : `Surplus wapsi Rs. ${formatNum(returnModalFund.total_return)} kamyabi se record ho gayi.`);
                setReturnModalFund(null);
            },
            onError: (errs) => {
                toast.error(Object.values(errs)[0] || 'Error recording surplus return.');
            },
        });
    };

    // Export CSV
    const handleExportCSV = () => {
        const headers = ['Fund Name', 'Principal Amount', 'Profit/Loss', 'Type', 'ROI / Maturity', 'Status', 'Total Return'];
        const rows = funds.map(f => [
            `"${f.fund_name}"`,
            f.principal_amount,
            f.profit_or_loss,
            f.is_realised ? 'Realised' : 'Unrealised',
            `"${f.roi_maturity}"`,
            `"${f.status}"`,
            f.total_return
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Surplus_Investments_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'سرپلس انویسٹمنٹ' : 'Surplus: Faltu Paisa (Bank FD jaisa)'} />

            <div className="-mt-4 -mx-4 -mb-8 pb-28 bg-[#f4f6f4] min-h-screen font-sans text-[#1a211c]">
                {/* Header */}
                <InvestmentHeader
                    currentTab="surplus"
                    userName={userName}
                    pendingApprovalsCount={pendingApprovalsCount}
                    lastUpdated={lastUpdated}
                    onOpenEntry={() => setIsEntryDrawerOpen(true)}
                    isUrdu={isUrdu}
                />

                <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
                    {/* Section B.4: Prominent Red Alert Banner for Matured Gold Savings Overdue 38 days */}
                    {goldSavingsAlert.show && (
                        <div className="p-4 rounded-xl bg-red-50/90 border border-red-300 text-red-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                            <div className="flex items-start gap-3">
                                <Icon name="WarningOctagon" className="size-6 text-red-700 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-xs font-bold text-red-900 uppercase tracking-wide">
                                        Khatre Ka Alert: {goldSavingsAlert.fund_name} 15 Oct se matured hai lekin abhi tak wapas nahi aya!
                                    </h4>
                                    <p className="text-xs text-red-800 leading-relaxed mt-0.5">
                                        <span className="font-bold underline">{goldSavingsAlert.message}</span> (Muddat: {goldSavingsAlert.maturity_date} — Baqaya Wapsi Rakam: <span className="font-bold">{formatRs(goldSavingsAlert.amount)}</span>). Baraye meherbani foran wapsi darj karein.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const goldFund = funds.find(f => f.fund_name.includes('Gold'));
                                    if (goldFund) setReturnModalFund(goldFund);
                                }}
                                className="px-4 py-2 text-xs font-bold bg-red-700 hover:bg-red-800 text-white rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
                            >
                                Abhi Wapas Hasil Karein
                            </button>
                        </div>
                    )}

                    {/* Section B.7 & B.8: Separated and Clearly Labeled Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                        {/* 1. Active Surplus Principal */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.active_surplus)}
                            className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs hover:border-gray-400 transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                    {isUrdu ? 'ایکٹیو سرپلس کیپیٹل' : 'Active Faltu Paisa (Lagaya)'}
                                </span>
                                <Icon name="Info" className="size-3.5 text-gray-400 group-hover:text-gray-700" />
                            </div>
                            <span className="text-xl font-black text-gray-900 block mt-2">
                                {formatRs(summary.active_principal)}
                            </span>
                            <span className="text-[10px] text-gray-500 block mt-0.5">2 Chalu Investments</span>
                        </div>

                        {/* 2. Mila Hua Nafa (Realised) */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.realised_profit)}
                            className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs hover:border-emerald-500 transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                    {isUrdu ? 'وصول شدہ نفع (Realised)' : 'Mila Hua Nafa (Realised)'}
                                </span>
                                <Icon name="Info" className="size-3.5 text-gray-400 group-hover:text-emerald-700" />
                            </div>
                            <span className="text-xl font-black text-emerald-700 block mt-2">
                                + {formatRs(summary.realised_profit)}
                            </span>
                            <span className="text-[10px] text-emerald-800 block mt-0.5">Gold Savings (Cash wapsi baqi)</span>
                        </div>

                        {/* 3. Aane Wala Nafa (Unrealised / Kaghzi) */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.unrealised_profit)}
                            className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs hover:border-emerald-500 transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                    {isUrdu ? 'تخمینی نفع (Unrealised)' : 'Kaghzi Nafa (Unrealised)'}
                                </span>
                                <Icon name="Info" className="size-3.5 text-gray-400 group-hover:text-emerald-700" />
                            </div>
                            <span className="text-xl font-black text-emerald-800 block mt-2">
                                + {formatRs(summary.unrealised_profit)}
                            </span>
                            <span className="text-[10px] text-gray-500 block mt-0.5">Maturity par cash hoga</span>
                        </div>

                        {/* 4. Active Kul Wapsi (Separated from closed) */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.active_wapsi)}
                            className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs hover:border-[#14532d] transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                    {isUrdu ? 'ایکٹیو کل واپسی' : 'Active Wapsi (Asal + Kaghzi)'}
                                </span>
                                <Icon name="Info" className="size-3.5 text-gray-400 group-hover:text-[#14532d]" />
                            </div>
                            <span className="text-xl font-black text-[#14532d] block mt-2">
                                {formatRs(summary.active_return)}
                            </span>
                            <span className="text-[10px] text-gray-500 block mt-0.5">Asal 250k + Kaghzi 8k</span>
                        </div>

                        {/* 5. Closed Matured Wapsi */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs col-span-2 md:col-span-1">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                {isUrdu ? 'میچور فنڈ رقم' : 'Matured Fund Wapsi'}
                            </span>
                            <span className="text-xl font-black text-red-600 block mt-2">
                                {formatRs(summary.closed_return)}
                            </span>
                            <span className="text-[10px] text-red-700 block mt-0.5">Gold Savings 38 din se baqi</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Surplus Investments Table Card (takes 2 cols) */}
                        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon name="TrendUp" className="size-5 text-[#14532d]" />
                                    <h3 className="text-sm font-bold text-gray-900">
                                        {isUrdu ? 'سرپلس انویسٹمنٹس رجسٹر' : 'Surplus Faltu Paisa Register'}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleExportCSV}
                                        className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Icon name="DownloadSimple" className="size-3.5" />
                                        <span>Excel / CSV</span>
                                    </button>
                                    <span className="text-xs text-gray-500">
                                        {funds.length} {isUrdu ? 'فنڈز' : 'Funds'}
                                    </span>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-start text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[11px] font-bold">
                                            <th className="py-3 px-4 text-start font-bold">Fund / Kahan Lagaya</th>
                                            <th className="py-3 px-4 text-end font-bold">Asal Rakam (Principal)</th>
                                            <th className="py-3 px-4 text-center font-bold">Nafa / Munafa (P/L)</th>
                                            <th className="py-3 px-4 text-center font-bold">Munafa Rate / Muddat</th>
                                            <th className="py-3 px-4 text-center font-bold">Status</th>
                                            <th className="py-3 px-4 text-center font-bold">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {funds.map((fund) => {
                                            const isSelected = selectedFundId === fund.id;
                                            const isOverdue = fund.status === 'matured' && fund.fund_name.includes('Gold');

                                            return (
                                                <tr
                                                    key={fund.id}
                                                    onClick={() => setSelectedFundId(fund.id)}
                                                    className={cn(
                                                        "transition-colors cursor-pointer",
                                                        isSelected ? "bg-emerald-50/50" : "hover:bg-gray-50/70",
                                                        isOverdue && "bg-red-50/30"
                                                    )}
                                                >
                                                    {/* Fund Name */}
                                                    <td className="py-3.5 px-4 font-semibold text-gray-900">
                                                        <span>{fund.fund_name}</span>
                                                        {isOverdue && (
                                                            <span className="text-[10px] text-red-600 block font-bold">
                                                                Matured 38 din se wapas nahi aya
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Principal */}
                                                    <td className="py-3.5 px-4 text-end text-gray-800 font-medium">
                                                        {formatNum(fund.principal_amount)}
                                                    </td>

                                                    {/* P / L (Realised vs Unrealised clearly labeled Section B.8) */}
                                                    <td className="py-3.5 px-4 text-center">
                                                        <div className="text-emerald-700 font-bold">
                                                            + {formatNum(fund.profit_or_loss)}
                                                        </div>
                                                        <div className={cn(
                                                            "text-[10px] font-semibold",
                                                            fund.is_realised ? "text-emerald-800" : "text-gray-500"
                                                        )}>
                                                            ({fund.is_realised ? 'Realised (Mila Hua)' : 'Kaghzi (Unrealised)'})
                                                        </div>
                                                    </td>

                                                    {/* ROI / Maturity */}
                                                    <td className="py-3.5 px-4 text-center text-gray-700 font-medium">
                                                        {fund.roi_maturity}
                                                    </td>

                                                    {/* Status Badge */}
                                                    <td className="py-3.5 px-4 text-center">
                                                        <span className={cn(
                                                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
                                                            fund.status === 'active'
                                                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                                                : "bg-red-100 text-red-800 border border-red-300"
                                                        )}>
                                                            {fund.status === 'active' ? 'Active (Chalu)' : 'Matured (Mukammal)'}
                                                        </span>
                                                    </td>

                                                    {/* Section A.4: Single Action per row without button duplication */}
                                                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setReturnModalFund(fund)}
                                                            className="px-2.5 py-1 text-xs font-semibold text-white bg-[#14532d] hover:bg-[#166534] rounded shadow-2xs transition-colors cursor-pointer"
                                                        >
                                                            Paisa Wapsi
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Wapsi Split Box (Right Column) */}
                        <div className="space-y-4">
                            <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-5 space-y-4">
                                <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                                        Wapsi hisab ({activeSelectedFund ? activeSelectedFund.fund_name : wapsiSplit.fund_name})
                                    </h4>
                                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                                </div>

                                <div className="space-y-2.5 text-xs text-gray-700">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Asal Rakam (Principal):</span>
                                        <span className="font-semibold text-gray-900">
                                            {formatNum(activeSelectedFund ? activeSelectedFund.principal_amount : wapsiSplit.principal)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">
                                            Munafa ({activeSelectedFund?.is_realised ? 'Realised' : 'Kaghzi'}):
                                        </span>
                                        <span className="font-semibold text-emerald-700">
                                            + {formatNum(activeSelectedFund ? activeSelectedFund.profit_or_loss : wapsiSplit.munafa)}
                                        </span>
                                    </div>
                                    <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-sm">
                                        <span className="font-bold text-gray-900">Kul Wapsi Rakam:</span>
                                        <span className="font-black text-[#14532d] text-base">
                                            {formatRs(activeSelectedFund ? activeSelectedFund.total_return : wapsiSplit.total)}
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (activeSelectedFund) setReturnModalFund(activeSelectedFund);
                                        }}
                                        className="min-h-[42px] w-full px-4 py-2 text-xs font-bold text-white bg-[#14532d] hover:bg-[#166534] rounded-lg shadow-xs transition-colors cursor-pointer text-center"
                                    >
                                        Paisa Wapas Hasil Karein
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Return Surplus Dialog */}
                {returnModalFund && (
                    <Dialog open={!!returnModalFund} onOpenChange={(open) => !open && setReturnModalFund(null)}>
                        <DialogContent className="max-w-md w-full p-6 bg-white font-sans text-[#1a211c]">
                            <DialogHeader>
                                <DialogTitle className="text-base font-bold text-gray-900">
                                    Surplus Paisa Wapas Hasil Karein
                                </DialogTitle>
                                <DialogDescription className="text-xs text-gray-500">
                                    Fund: {returnModalFund.fund_name} — Kul Wapsi (Asal + Nafa): Rs. {formatNum(returnModalFund.total_return)}
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleConfirmReturn} className="space-y-4 pt-2">
                                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Asal Principal:</span>
                                        <span className="font-bold">Rs. {formatNum(returnModalFund.principal_amount)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Munafa ({returnModalFund.is_realised ? 'Realised' : 'Unrealised'}):</span>
                                        <span className="font-bold text-emerald-700">+ Rs. {formatNum(returnModalFund.profit_or_loss)}</span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-gray-200 font-black text-sm text-[#14532d]">
                                        <span>Kul Wapsi:</span>
                                        <span>Rs. {formatNum(returnModalFund.total_return)}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-800 block mb-1">
                                        Wapsi Kahan Jama Karein?
                                    </label>
                                    <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg border border-gray-200">
                                        <button
                                            type="button"
                                            onClick={() => setReturnMethod('cash')}
                                            className={cn(
                                                "min-h-[36px] text-xs font-bold rounded-md transition-all cursor-pointer",
                                                returnMethod === 'cash' ? "bg-[#14532d] text-white shadow-xs" : "text-gray-700"
                                            )}
                                        >
                                            Cash Khata
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setReturnMethod('bank')}
                                            className={cn(
                                                "min-h-[36px] text-xs font-bold rounded-md transition-all cursor-pointer",
                                                returnMethod === 'bank' ? "bg-[#14532d] text-white shadow-xs" : "text-gray-700"
                                            )}
                                        >
                                            Bank Khata
                                        </button>
                                    </div>
                                </div>

                                {returnMethod === 'bank' && (
                                    <div>
                                        <label className="text-xs font-bold text-gray-800 block mb-1">
                                            Bank Account Muntakhib Karein
                                        </label>
                                        <select
                                            value={returnBankName}
                                            onChange={(e) => setReturnBankName(e.target.value)}
                                            className="w-full h-11 px-3.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#14532d] focus:outline-none"
                                        >
                                            {bankAccounts.map((acc, i) => (
                                                <option key={i} value={acc}>{acc}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setReturnModalFund(null)}
                                        className="flex-1 min-h-[40px] px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 min-h-[40px] px-4 py-2 text-xs font-bold text-white bg-[#14532d] hover:bg-[#166534] rounded-lg shadow-xs transition-colors cursor-pointer"
                                    >
                                        Wapsi Record Karein
                                    </button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}

                {/* Entry Drawer */}
                <EntryDrawer
                    isOpen={isEntryDrawerOpen}
                    onClose={() => setIsEntryDrawerOpen(false)}
                    partners={partnersList}
                    loans={loansList}
                    surplusFunds={surplusList}
                    bankAccounts={bankAccounts}
                    isUrdu={isUrdu}
                />

                {/* Clickable Breakdown Modal */}
                <BreakdownModal
                    isOpen={!!activeBreakdown}
                    onClose={() => setActiveBreakdown(null)}
                    data={activeBreakdown}
                />
            </div>
        </AppLayout>
    );
}
