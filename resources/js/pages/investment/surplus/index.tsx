import React, { useState, useEffect } from 'react';
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
    kaha_lagaya?: string;
    agreement_type?: 'market_linked' | 'fixed_term';
    principal_amount: number;
    market_value?: number;
    profit_or_loss: number;
    diff_formatted?: string;
    roi_rate?: string;
    is_realised: boolean;
    maturity_date?: string;
    muddat_label?: string;
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
        { title: isUrdu ? 'سرمایہ کاری (Investments)' : 'Sarmayakari (Investments)', href: '/investment/surplus' },
    ];

    const formatRs = (val: number) => 'Rs. ' + Number(val || 0).toLocaleString('en-US');
    const formatNum = (val: number) => Number(val || 0).toLocaleString('en-US');

    // 30-second live background update (Section D)
    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({ only: ['aajKaHaal', 'singleAlert', 'summary', 'funds', 'pendingApprovalsCount'] });
        }, 30000);
        return () => clearInterval(interval);
    }, []);

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
                toast.success(`Sarmayakari wapsi Rs. ${formatNum(returnModalFund.total_return)} kamyabi se record ho gayi.`);
                setReturnModalFund(null);
            },
            onError: (errs) => {
                toast.error(Object.values(errs)[0] || 'Error recording investment return.');
            },
        });
    };

    // Export CSV
    const handleExportCSV = () => {
        const headers = ['Fund Name', 'Kaha Lagaya Hai', 'Lagaya Hua Sarmaya', 'Abhi Ki Qeemat', 'Munafa', 'Wapsi Tareekh', 'Status'];
        const rows = funds.map(f => [
            `"${f.fund_name}"`,
            `"${f.kaha_lagaya || 'Meezan Bank Ltd'}"`,
            f.principal_amount,
            f.total_return,
            f.profit_or_loss,
            `"${f.muddat_label || '—'}"`,
            `"${f.status_label}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Sarmayakari_Register_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'سرمایہ کاری - انویسٹمنٹ' : 'Sarmayakari (Investments) - Investment'} />

            <div className="-mt-4 -mx-4 -mb-4 pb-12 bg-[#eef2ee] min-h-full font-sans text-[#1F2937]">
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
                    {/* Section B.1: Har Page Par Sirf 3 Numbers (Sarmayakari Page - No Click Details Pop up) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        {/* Number 1: Kul Sarmayakari */}
                        <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-2xs">
                            <span className="text-xs font-bold text-[#374151] uppercase tracking-wider block">
                                {isUrdu ? 'کل سرمایہ کاری' : 'Kul Sarmayakari'}
                            </span>
                            <span className="text-2xl font-black text-[#1F2937] block mt-2">
                                {formatRs(summary.lagaya_paisa)}
                            </span>
                            <span className="text-xs font-medium text-[#4B5563] block mt-1">
                                {funds.length} chalu sarmayakari fund
                            </span>
                        </div>

                        {/* Number 2: Mila hua munafa */}
                        <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-2xs">
                            <span className="text-xs font-bold text-[#374151] uppercase tracking-wider block">
                                {isUrdu ? 'منافع' : 'Munafa'}
                            </span>
                            <span className="text-2xl font-black text-emerald-700 block mt-2">
                                + {formatRs(summary.mila_munafa)}
                            </span>
                            <span className="text-xs font-medium text-[#4B5563] block mt-1">
                                Sarmayakari se haasil shuda munafa
                            </span>
                        </div>

                        {/* Number 3: Kul Market Value (Wapsi) */}
                        <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-2xs">
                            <span className="text-xs font-bold text-[#374151] uppercase tracking-wider block">
                                {isUrdu ? 'کل واپسی' : 'Kul Wapsi (Asal + Munafa)'}
                            </span>
                            <span className="text-2xl font-black text-[#14532d] block mt-2">
                                {formatRs(summary.wapsi_total)}
                            </span>
                            <span className="text-xs font-medium text-[#4B5563] block mt-1">
                                Asal Rs. {formatNum(summary.lagaya_paisa)} + Munafa Rs. {formatNum(summary.mila_munafa)}
                            </span>
                        </div>
                    </div>

                    {/* Surplus Table (Full Width, Clean, Single Action per Row) */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon name="TrendUp" className="size-5 text-[#14532d]" />
                                <h3 className="text-sm font-bold text-[#1F2937]">
                                    {isUrdu ? 'سرمایہ کاری کھاتہ' : 'Sarmayakari Register (Investment Funds)'}
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
                            <table className="w-full text-start text-sm border-collapse min-w-[760px]">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[#374151] uppercase tracking-wider text-xs font-bold">
                                        <th className="py-3 px-4 text-start">Fund Ka Naam</th>
                                        <th className="py-3 px-4 text-start">Kaha Lagaya Hai</th>
                                        <th className="py-3 px-4 text-end">Lagaya</th>
                                        <th className="py-3 px-4 text-end">Abhi Ki Qeemat</th>
                                        <th className="py-3 px-4 text-center">Munafa</th>
                                        <th className="py-3 px-4 text-center">Wapsi Tareekh</th>
                                        <th className="py-3 px-4 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-[#1F2937]">
                                    {funds.map((fund) => {
                                        return (
                                            <tr
                                                key={fund.id}
                                                className="hover:bg-gray-50/70 transition-colors"
                                            >
                                                {/* Fund Name (Clean without Fixed-Term / Market badges) */}
                                                <td className="py-3.5 px-4 font-bold">
                                                    <span className="text-sm font-bold text-[#1F2937]">{fund.fund_name}</span>
                                                </td>

                                                {/* Kaha Lagaya Hai */}
                                                <td className="py-3.5 px-4 font-medium text-xs text-[#374151]">
                                                    {fund.kaha_lagaya || 'Meezan Bank Ltd (15-Day Term Deposit)'}
                                                </td>

                                                {/* Lagaya (Principal) */}
                                                <td className="py-3.5 px-4 text-end font-bold text-[#1F2937] text-sm">
                                                    {formatRs(fund.principal_amount)}
                                                </td>

                                                {/* Abhi Ki Qeemat */}
                                                <td className="py-3.5 px-4 text-end font-black text-sm text-[#1F2937]">
                                                    {formatRs(fund.market_value || fund.total_return)}
                                                </td>

                                                {/* Munafa (Sirf Munafa, clean) */}
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className="text-emerald-700 font-bold text-sm block">
                                                        {fund.diff_formatted || `+ ${formatRs(fund.profit_or_loss)}`}
                                                    </span>
                                                </td>

                                                {/* Wapsi Tareekh (Sirf date likho) */}
                                                <td className="py-3.5 px-4 text-center font-semibold text-xs text-[#374151]">
                                                    {fund.muddat_label || '—'}
                                                </td>

                                                {/* Action: Wapas lein */}
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

                {/* Return Surplus Dialog (Section 10: Spacious, Open, Clear & Understanding-friendly) */}
                {returnModalFund && (
                    <Dialog open={!!returnModalFund} onOpenChange={(open) => !open && setReturnModalFund(null)}>
                        <DialogContent className="max-w-lg w-full p-6 sm:p-7 bg-white font-sans text-[#1F2937] rounded-2xl shadow-2xl border border-gray-200">
                            <DialogHeader className="space-y-1.5 pb-3 border-b border-gray-100">
                                <DialogTitle className="text-lg font-bold text-[#1F2937] flex items-center gap-2">
                                    <span className="p-1.5 rounded-lg bg-emerald-100 text-[#14532d]">
                                        <Icon name="ArrowDownLeft" className="size-5" />
                                    </span>
                                    <span>{isUrdu ? 'سرمایہ کاری واپس حاصل کریں' : 'Sarmayakari Wapas Hasil Karein'}</span>
                                </DialogTitle>
                                <DialogDescription className="text-xs text-[#4B5563]">
                                    Fund: <span className="font-bold text-[#1F2937]">{returnModalFund.fund_name}</span> · {returnModalFund.kaha_lagaya || 'Meezan Bank Ltd'}
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleConfirmReturn} className="space-y-5 pt-3">
                                {/* Clear breakdown card */}
                                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2.5">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-[#4B5563]">Asal Lagayi Gayi Rakam:</span>
                                        <span className="font-bold text-[#1F2937]">Rs. {formatNum(returnModalFund.principal_amount)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-[#4B5563]">Haasil Shuda Munafa:</span>
                                        <span className="font-bold text-emerald-700">+ Rs. {formatNum(returnModalFund.profit_or_loss)}</span>
                                    </div>
                                    <div className="pt-2.5 border-t border-gray-200 flex justify-between items-center bg-emerald-50/60 -mx-4 -mb-4 p-4 rounded-b-xl">
                                        <span className="text-sm font-bold text-[#14532d]">Kul Wapsi Rakam:</span>
                                        <span className="text-xl font-black text-[#14532d]">Rs. {formatNum(returnModalFund.total_return)}</span>
                                    </div>
                                </div>

                                {/* Destination */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-[#1F2937] block">
                                        Wapsi Kahan Jama Karein? (Payment Zariya)
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setReturnMethod('cash')}
                                            className={cn(
                                                "min-h-[44px] px-4 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-2",
                                                returnMethod === 'cash'
                                                    ? "bg-[#14532d] text-white border-[#14532d] shadow-xs"
                                                    : "bg-white text-[#374151] border-gray-200 hover:bg-gray-50"
                                            )}
                                        >
                                            <Icon name="Money" className="size-4" />
                                            <span>Cash (Galla Khata)</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setReturnMethod('bank')}
                                            className={cn(
                                                "min-h-[44px] px-4 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-2",
                                                returnMethod === 'bank'
                                                    ? "bg-[#14532d] text-white border-[#14532d] shadow-xs"
                                                    : "bg-white text-[#374151] border-gray-200 hover:bg-gray-50"
                                            )}
                                        >
                                            <Icon name="Bank" className="size-4" />
                                            <span>Bank Account</span>
                                        </button>
                                    </div>
                                </div>

                                {returnMethod === 'bank' && (
                                    <div className="space-y-1.5 animate-in fade-in">
                                        <label className="text-xs font-bold text-[#374151] block">
                                            Bank Account Muntakhib Karein:
                                        </label>
                                        <select
                                            value={returnBankName}
                                            onChange={(e) => setReturnBankName(e.target.value)}
                                            className="w-full h-11 px-3.5 text-xs font-medium text-[#1F2937] bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#14532d] focus:outline-none"
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
                                        className="flex-1 min-h-[44px] px-4 py-2.5 text-xs font-semibold text-[#374151] bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                                    >
                                        Wapas (Cancel)
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 min-h-[44px] px-4 py-2.5 text-xs font-bold text-white bg-[#14532d] hover:bg-[#166534] rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <Icon name="Check" className="size-4 stroke-[3]" />
                                        <span>Wapsi Wasool Karein</span>
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
                    category="surplus"
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
