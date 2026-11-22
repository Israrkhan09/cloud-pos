import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import InvestmentHeader from '@/components/investment/investment-header';
import AajKaHaal from '@/components/investment/aaj-ka-haal';
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
    maturity_label: string;
    status: string;
    status_label: string;
    total_return: number;
    notes?: string;
}

interface Props {
    userName?: string;
    isOwner?: boolean;
    pendingApprovalsCount?: number;
    partnersList: any[];
    loansList: any[];
    surplusList: any[];
    bankAccounts: string[];
    funds: SurplusFundRow[];
    search?: string;
    aajKaHaal: {
        dena_hai: number;
        dena_hai_sub?: string;
        lena_hai: number;
        lena_hai_sub?: string;
        kaam_count?: number;
        kaam_text?: string;
        kaam_sub?: string;
    };
    singleAlert?: {
        text: string;
        action_label: string;
        action_url: string;
    } | null;
    breakdowns: Record<string, BreakdownData>;
    summary: {
        lagaya_paisa: number;
        mila_munafa: number;
        wapsi_total: number;
        unrealised_profit: number;
    };
}

export default function InvestmentSurplusPage({
    userName,
    pendingApprovalsCount = 0,
    partnersList,
    loansList,
    surplusList,
    bankAccounts,
    funds,
    aajKaHaal,
    singleAlert,
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
        { title: isUrdu ? 'فالتو پیسہ (Surplus)' : 'Faltu Paisa', href: '/investment/surplus' },
    ];

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
                toast.success(`Faltu paisa wapsi Rs. ${formatNum(returnModalFund.total_return)} kamyabi se record ho gayi.`);
                setReturnModalFund(null);
            },
            onError: (errs) => {
                toast.error(Object.values(errs)[0] || 'Error recording surplus return.');
            },
        });
    };

    // Export CSV
    const handleExportCSV = () => {
        const headers = ['Fund Name', 'Lagaya Hua Paisa', 'Munafa', 'Qisam', 'Muddat', 'Status', 'Kul Wapsi'];
        const rows = funds.map(f => [
            `"${f.fund_name}"`,
            f.principal_amount,
            f.profit_or_loss,
            f.is_realised ? 'Mila hua' : 'Abhi tak ka munafa (pakka nahi)',
            `"${f.maturity_label}"`,
            `"${f.status_label}"`,
            f.total_return
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Faltu_Paisa_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'فالتو پیسہ - انویسٹمنٹ' : 'Faltu Paisa (Surplus) - Investment'} />

            <div className="-mt-4 -mx-4 -mb-8 pb-28 bg-[#f4f6f4] min-h-screen font-sans text-[#1F2937]">
                {/* Header (Section B.5 short tabs & single alert line) */}
                <InvestmentHeader
                    currentTab="surplus"
                    userName={userName}
                    pendingApprovalsCount={pendingApprovalsCount}
                    singleAlert={singleAlert}
                    onOpenEntry={() => setIsEntryDrawerOpen(true)}
                    isUrdu={isUrdu}
                />

                <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
                    {/* Section B.6: Aaj Ka Haal */}
                    <AajKaHaal data={aajKaHaal} isUrdu={isUrdu} />

                    {/* Section B.1: Har Page Par Sirf 3 Numbers (Surplus Page) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        {/* Number 1: Lagaya hua paisa */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.lagaya_paisa)}
                            className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-2xs hover:border-gray-400 transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#374151] uppercase tracking-wider">
                                    {isUrdu ? 'لگایا ہوا پیسہ' : 'Lagaya Hua Paisa'}
                                </span>
                                <Icon name="Info" className="size-4 text-[#4B5563] group-hover:text-gray-700" />
                            </div>
                            <span className="text-2xl font-black text-[#1F2937] block mt-2">
                                {formatRs(summary.lagaya_paisa)}
                            </span>
                            <span className="text-xs font-medium text-[#4B5563] block mt-1">
                                2 chalu investments · Tafseel dekhne ke liye click karein
                            </span>
                        </div>

                        {/* Number 2: Mila hua munafa */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.mila_munafa)}
                            className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-2xs hover:border-emerald-500 transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#374151] uppercase tracking-wider">
                                    {isUrdu ? 'ملا ہوا منافع' : 'Mila Hua Munafa'}
                                </span>
                                <Icon name="Info" className="size-4 text-[#4B5563] group-hover:text-emerald-700" />
                            </div>
                            <span className="text-2xl font-black text-emerald-700 block mt-2">
                                + {formatRs(summary.mila_munafa)}
                            </span>
                            <span className="text-xs font-medium text-[#4B5563] block mt-1">
                                Gold Savings muddat poori (Cash wapas lene ke qabil)
                            </span>
                        </div>

                        {/* Number 3: Faltu paisa wapas total */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.wapsi_total)}
                            className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-2xs hover:border-[#14532d] transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#374151] uppercase tracking-wider">
                                    {isUrdu ? 'فالتو پیسہ واپس (کل)' : 'Faltu Paisa Wapas (Kul)'}
                                </span>
                                <Icon name="Info" className="size-4 text-[#4B5563] group-hover:text-[#14532d]" />
                            </div>
                            <span className="text-2xl font-black text-[#14532d] block mt-2">
                                {formatRs(summary.wapsi_total)}
                            </span>
                            <span className="text-xs font-medium text-[#4B5563] block mt-1">
                                Asal Rs. 250k + Abhi tak ka munafa Rs. 8k
                            </span>
                        </div>
                    </div>

                    {/* Surplus Table (Full Width, Clean, Single Action per Row) */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon name="TrendUp" className="size-5 text-[#14532d]" />
                                <h3 className="text-sm font-bold text-[#1F2937]">
                                    {isUrdu ? 'فالتو پیسہ کھاتہ' : 'Faltu Paisa Khata (Surplus Register)'}
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleExportCSV}
                                    className="px-3 py-1.5 text-xs font-semibold text-[#374151] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Icon name="DownloadSimple" className="size-3.5" />
                                    <span>Excel / CSV</span>
                                </button>
                                <span className="text-xs text-[#4B5563]">
                                    {funds.length} Funds
                                </span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-start text-sm border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[#374151] uppercase tracking-wider text-xs font-bold">
                                        <th className="py-3 px-4 text-start">Fund (Kahan Lagaya)</th>
                                        <th className="py-3 px-4 text-end">Lagaya Hua Paisa</th>
                                        <th className="py-3 px-4 text-center">Munafa</th>
                                        <th className="py-3 px-4 text-center">Muddat / Tareekh</th>
                                        <th className="py-3 px-4 text-center">Status</th>
                                        <th className="py-3 px-4 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-[#1F2937]">
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
                                                    isOverdue && "bg-rose-50/40"
                                                )}
                                            >
                                                {/* Fund Name */}
                                                <td className="py-3.5 px-4 font-bold">
                                                    <span>{fund.fund_name}</span>
                                                    {isOverdue && (
                                                        <span className="text-xs text-rose-700 block font-semibold">
                                                            Muddat poori (38 din se baqi)
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Principal */}
                                                <td className="py-3.5 px-4 text-end font-bold text-[#1F2937]">
                                                    {formatRs(fund.principal_amount)}
                                                </td>

                                                {/* Munafa (Section D: Simple Urdu labels) */}
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className="text-emerald-700 font-bold block">
                                                        + {formatRs(fund.profit_or_loss)}
                                                    </span>
                                                    <span className="text-xs text-[#4B5563] block">
                                                        {fund.is_realised ? 'Mila hua' : 'Abhi tak ka munafa (pakka nahi)'}
                                                    </span>
                                                </td>

                                                {/* Muddat */}
                                                <td className="py-3.5 px-4 text-center font-medium text-[#374151]">
                                                    {fund.maturity_label}
                                                </td>

                                                {/* Status (Section D: Muddat poori / Chalu) */}
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className={cn(
                                                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
                                                        fund.status === 'active'
                                                            ? "bg-emerald-100 text-[#14532d] border border-emerald-200"
                                                            : "bg-rose-100 text-rose-900 border border-rose-300"
                                                    )}>
                                                        {fund.status_label}
                                                    </span>
                                                </td>

                                                {/* Single Action per row (Section B.2): Wapas lein */}
                                                <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setReturnModalFund(fund)}
                                                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#14532d] hover:bg-[#166534] rounded shadow-2xs transition-colors cursor-pointer"
                                                    >
                                                        Wapas lein
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Return Surplus Dialog */}
                {returnModalFund && (
                    <Dialog open={!!returnModalFund} onOpenChange={(open) => !open && setReturnModalFund(null)}>
                        <DialogContent className="max-w-md w-full p-6 bg-white font-sans text-[#1F2937]">
                            <DialogHeader>
                                <DialogTitle className="text-base font-bold text-[#1F2937]">
                                    Faltu Paisa Wapas Hasil Karein
                                </DialogTitle>
                                <DialogDescription className="text-xs text-[#4B5563]">
                                    Fund: {returnModalFund.fund_name} — Kul Wapsi (Asal + Munafa): Rs. {formatNum(returnModalFund.total_return)}
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleConfirmReturn} className="space-y-4 pt-2">
                                <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 text-xs space-y-1.5 text-[#374151]">
                                    <div className="flex justify-between">
                                        <span>Asal Rakam:</span>
                                        <span className="font-bold text-[#1F2937]">Rs. {formatNum(returnModalFund.principal_amount)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Munafa ({returnModalFund.is_realised ? 'Mila hua' : 'Abhi tak ka'}):</span>
                                        <span className="font-bold text-emerald-700">+ Rs. {formatNum(returnModalFund.profit_or_loss)}</span>
                                    </div>
                                    <div className="flex justify-between pt-1.5 border-t border-gray-200 font-black text-sm text-[#14532d]">
                                        <span>Kul Wapsi:</span>
                                        <span>Rs. {formatNum(returnModalFund.total_return)}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-[#374151] block mb-1">
                                        Wapsi Kahan Jama Karein?
                                    </label>
                                    <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg border border-gray-200">
                                        <button
                                            type="button"
                                            onClick={() => setReturnMethod('cash')}
                                            className={cn(
                                                "min-h-[36px] text-xs font-bold rounded-md transition-all cursor-pointer",
                                                returnMethod === 'cash' ? "bg-[#14532d] text-white shadow-xs" : "text-[#374151]"
                                            )}
                                        >
                                            Cash Khata
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setReturnMethod('bank')}
                                            className={cn(
                                                "min-h-[36px] text-xs font-bold rounded-md transition-all cursor-pointer",
                                                returnMethod === 'bank' ? "bg-[#14532d] text-white shadow-xs" : "text-[#374151]"
                                            )}
                                        >
                                            Bank Khata
                                        </button>
                                    </div>
                                </div>

                                {returnMethod === 'bank' && (
                                    <div>
                                        <label className="text-xs font-bold text-[#374151] block mb-1">
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
                                        className="flex-1 min-h-[40px] px-4 py-2 text-xs font-semibold text-[#374151] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
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

                {/* Breakdown Modal */}
                <BreakdownModal
                    isOpen={!!activeBreakdown}
                    onClose={() => setActiveBreakdown(null)}
                    data={activeBreakdown}
                />
            </div>
        </AppLayout>
    );
}
