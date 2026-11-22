import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import InvestmentHeader from '@/components/investment/investment-header';
import EntryDrawer from '@/components/investment/entry-drawer';
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

interface Props {
    currentRole: 'munshi' | 'owner';
    partnersList: any[];
    loansList: any[];
    surplusList: any[];
    bankAccounts: string[];
    funds: SurplusFundRow[];
    search?: string;
    wapsiSplit: WapsiSplitData;
}

export default function InvestmentSurplusPage({
    currentRole,
    partnersList,
    loansList,
    surplusList,
    bankAccounts,
    funds,
    search = '',
    wapsiSplit,
}: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [searchTerm, setSearchTerm] = useState(search);
    const [selectedFundId, setSelectedFundId] = useState<number | null>(funds[0]?.id ?? null);
    const [isEntryDrawerOpen, setIsEntryDrawerOpen] = useState(false);

    // Return dialog state
    const [returnModalFund, setReturnModalFund] = useState<SurplusFundRow | null>(null);
    const [returnMethod, setReturnMethod] = useState<'cash' | 'bank'>('cash');
    const [returnBankName, setReturnBankName] = useState(bankAccounts[0] || 'Meezan Bank Ltd');

    // Void dialog state
    const [voidModalFund, setVoidModalFund] = useState<SurplusFundRow | null>(null);
    const [voidReason, setVoidReason] = useState('');

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'انویسٹمنٹ' : 'Investment', href: '/investment/partners' },
        { title: isUrdu ? 'سرپلس (Surplus)' : 'Surplus', href: '/investment/surplus' },
    ];

    // Filter funds
    const filteredFunds = funds.filter((f) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
            f.fund_name.toLowerCase().includes(q) ||
            (f.fund_name_ur && f.fund_name_ur.includes(q))
        );
    });

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
                toast.success(isUrdu ? 'سرپلس رقم اور منافع کی واپسی محفوظ ہو گئی' : 'Surplus return & profit recorded successfully!');
                setReturnModalFund(null);
            },
            onError: (errs) => {
                toast.error(Object.values(errs)[0] || 'Error recording surplus return.');
            },
        });
    };

    // Handle mark matured
    const handleMarkMatured = (fund: SurplusFundRow) => {
        router.post(`/investment/surplus/${fund.id}/mature`, {}, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(isUrdu ? 'فنڈ مکمل / میچور مارک کر دیا گیا' : 'Fund marked as matured successfully!');
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'سرپلس انویسٹمنٹ' : 'Surplus Investments - Investment'} />

            <div className="-mt-4 -mx-4 -mb-8 pb-28 bg-[#f4f6f4] min-h-screen font-sans text-[#1a211c]">
                {/* Header */}
                <InvestmentHeader
                    currentTab="surplus"
                    currentRole={currentRole}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onOpenEntry={() => setIsEntryDrawerOpen(true)}
                    isUrdu={isUrdu}
                />

                <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                        <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                {isUrdu ? 'ایکٹیو سرپلس کیپیٹل' : 'Lagaya Gaya Faltu Paisa (Active)'}
                            </span>
                            <span className="text-xl md:text-2xl font-black text-gray-900 block mt-2">
                                {formatRs(funds.filter(f => f.status === 'active').reduce((acc, f) => acc + f.principal_amount, 0))}
                            </span>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                {isUrdu ? 'وصول شدہ نفع (Realised)' : 'Mila Hua Nafa (Realised)'}
                            </span>
                            <span className="text-xl md:text-2xl font-black text-emerald-700 block mt-2">
                                + {formatRs(funds.filter(f => f.is_realised).reduce((acc, f) => acc + f.profit_or_loss, 0))}
                            </span>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                {isUrdu ? 'تخمینی نفع (Unrealised)' : 'Aane Wala Nafa (Unrealised)'}
                            </span>
                            <span className="text-xl md:text-2xl font-black text-emerald-800 block mt-2">
                                + {formatRs(funds.filter(f => !f.is_realised).reduce((acc, f) => acc + f.profit_or_loss, 0))}
                            </span>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                {isUrdu ? 'کل متوقع کیش' : 'Kul Wapsi (Asal + Nafa)'}
                            </span>
                            <span className="text-xl md:text-2xl font-black text-[#14532d] block mt-2">
                                {formatRs(funds.reduce((acc, f) => acc + f.total_return, 0))}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Surplus Investments Table Card (takes 2 cols) */}
                        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon name="TrendUp" className="size-5 text-[#14532d]" />
                                    <h3 className="text-sm font-bold text-gray-900">
                                        {isUrdu ? 'سرپلس انویسٹمنٹس' : 'Surplus Faltu Paisa Khata'}
                                    </h3>
                                </div>
                                <span className="text-xs text-gray-500">
                                    {filteredFunds.length} {isUrdu ? 'فنڈز' : 'Funds'}
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-start text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[11px] font-bold">
                                            <th className="py-3 px-4 text-start font-bold">Fund / Kahan Lagaya</th>
                                            <th className="py-3 px-4 text-end font-bold">Asal Rakam (Principal)</th>
                                            <th className="py-3 px-4 text-center font-bold">Nafa / Nuqsan (P/L)</th>
                                            <th className="py-3 px-4 text-center font-bold">Munafa Rate / Muddat</th>
                                            <th className="py-3 px-4 text-center font-bold">Status</th>
                                            <th className="py-3 px-4 text-center font-bold">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredFunds.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-gray-500 text-xs">
                                                    {isUrdu ? 'کوئی سرپلس فنڈ نہیں ملا' : 'Koi surplus fund nahi mila.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredFunds.map((fund) => {
                                                const isSelected = selectedFundId === fund.id;
                                                return (
                                                    <tr
                                                        key={fund.id}
                                                        onClick={() => setSelectedFundId(fund.id)}
                                                        className={cn(
                                                            "transition-colors cursor-pointer",
                                                            isSelected ? "bg-emerald-50/50" : "hover:bg-gray-50/70"
                                                        )}
                                                    >
                                                        {/* Fund Name */}
                                                        <td className="py-3.5 px-4 font-semibold text-gray-900">
                                                            {fund.fund_name}
                                                        </td>

                                                        {/* Principal */}
                                                        <td className="py-3.5 px-4 text-end text-gray-800 font-medium">
                                                            {formatNum(fund.principal_amount)}
                                                        </td>

                                                        {/* P / L */}
                                                        <td className="py-3.5 px-4 text-center">
                                                            <div className="text-emerald-700 font-bold">
                                                                + {formatNum(fund.profit_or_loss)}
                                                            </div>
                                                            <div className="text-[10px] text-gray-500">
                                                                ({fund.is_realised ? 'realised' : 'unrealised'})
                                                            </div>
                                                        </td>

                                                        {/* ROI / Maturity */}
                                                        <td className="py-3.5 px-4 text-center text-gray-700 font-medium">
                                                            {fund.roi_maturity}
                                                        </td>

                                                        {/* Status */}
                                                        <td className="py-3.5 px-4 text-center">
                                                            <span className={cn(
                                                                "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
                                                                fund.status === 'active'
                                                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                                                    : "bg-gray-100 text-gray-700 border border-gray-200"
                                                            )}>
                                                                {fund.status === 'active' ? 'Active (Chalu)' : 'Matured (Mukammal)'}
                                                            </span>
                                                        </td>

                                                        {/* Action */}
                                                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                            {fund.status === 'active' ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setReturnModalFund(fund)}
                                                                    className="px-2.5 py-1 text-xs font-semibold text-white bg-[#14532d] hover:bg-[#166534] rounded shadow-2xs transition-colors cursor-pointer"
                                                                >
                                                                    Paisa Wapsi
                                                                </button>
                                                            ) : (
                                                                <span className="text-[11px] text-gray-400">Chukta (Settled)</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Wapsi Split Box (as shown in user screenshot 8) */}
                        <div className="space-y-4">
                            <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-5 space-y-4">
                                <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                                        Wapsi hisab ({wapsiSplit.fund_name})
                                    </h4>
                                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                                </div>

                                <div className="space-y-2.5 text-xs text-gray-700">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Asal Rakam:</span>
                                        <span className="font-semibold text-gray-900">{formatNum(wapsiSplit.principal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Munafa (Profit):</span>
                                        <span className="font-semibold text-emerald-700">+ {formatNum(wapsiSplit.munafa)}</span>
                                    </div>
                                    <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-sm">
                                        <span className="font-bold text-gray-900">Kul Wapsi Rakam:</span>
                                        <span className="font-black text-[#14532d] text-base">{formatNum(wapsiSplit.total)}</span>
                                    </div>
                                </div>

                                <div className="pt-2 flex flex-col gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const target = funds.find(f => f.fund_name === wapsiSplit.fund_name) || activeSelectedFund;
                                            if (target) setReturnModalFund(target);
                                        }}
                                        className="min-h-[42px] w-full px-4 py-2 text-xs font-bold text-white bg-[#14532d] hover:bg-[#166534] rounded-lg shadow-xs transition-colors cursor-pointer text-center"
                                    >
                                        Paisa Wapas Hasil Karein
                                    </button>

                                    {activeSelectedFund && activeSelectedFund.status === 'active' && (
                                        <button
                                            type="button"
                                            onClick={() => handleMarkMatured(activeSelectedFund)}
                                            className="min-h-[40px] w-full px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg shadow-xs transition-colors cursor-pointer text-center"
                                        >
                                            Mukammal (Matured) Mark Karein
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            router.get('/investment/audit', { search: wapsiSplit.fund_name });
                                        }}
                                        className="min-h-[40px] w-full px-3.5 py-2 text-xs font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg shadow-xs transition-colors cursor-pointer text-center"
                                    >
                                        Audit Mein Mansookh (Void) Karein
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
                                    Surplus Rakam Wapas Hasil Karein
                                </DialogTitle>
                                <DialogDescription className="text-xs text-gray-500">
                                    Fund: {returnModalFund.fund_name} — Kul Wapsi Rakam: Rs. {formatNum(returnModalFund.total_return)}
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleConfirmReturn} className="space-y-4 pt-2">
                                <div className="p-3.5 bg-[#ecf5ee] border border-emerald-300 rounded-lg text-xs space-y-1">
                                    <div className="flex justify-between">
                                        <span>Asal Rakam (Principal):</span>
                                        <span className="font-semibold">Rs. {formatNum(returnModalFund.principal_amount)}</span>
                                    </div>
                                    <div className="flex justify-between text-emerald-800">
                                        <span>Munafa (Profit):</span>
                                        <span className="font-semibold">+ Rs. {formatNum(returnModalFund.profit_or_loss)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold pt-1 border-t border-emerald-200 text-sm text-[#14532d]">
                                        <span>Kul Cash Wapsi:</span>
                                        <span>Rs. {formatNum(returnModalFund.total_return)}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-800 block mb-1">
                                        Kahan jama karna hai?
                                    </label>
                                    <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg border border-gray-200">
                                        <button
                                            type="button"
                                            onClick={() => setReturnMethod('cash')}
                                            className={cn(
                                                "min-h-[36px] text-xs font-bold rounded-md transition-all cursor-pointer",
                                                returnMethod === 'cash'
                                                    ? "bg-[#14532d] text-white shadow-xs"
                                                    : "text-gray-700"
                                            )}
                                        >
                                            Cash Box / Galla
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setReturnMethod('bank')}
                                            className={cn(
                                                "min-h-[36px] text-xs font-bold rounded-md transition-all cursor-pointer",
                                                returnMethod === 'bank'
                                                    ? "bg-[#14532d] text-white shadow-xs"
                                                    : "text-gray-700"
                                            )}
                                        >
                                            Bank Account
                                        </button>
                                    </div>
                                </div>

                                {returnMethod === 'bank' && (
                                    <div>
                                        <label className="text-xs text-gray-600 block mb-1">Bank Account</label>
                                        <select
                                            value={returnBankName}
                                            onChange={(e) => setReturnBankName(e.target.value)}
                                            className="w-full h-11 px-3.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#14532d]"
                                        >
                                            {bankAccounts.map((b) => (
                                                <option key={b} value={b}>
                                                    {b}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-2.5 pt-3">
                                    <button
                                        type="button"
                                        onClick={() => setReturnModalFund(null)}
                                        className="min-h-[40px] px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                                    >
                                        Mansookh (Cancel)
                                    </button>
                                    <button
                                        type="submit"
                                        className="min-h-[40px] px-4 py-2 text-xs font-bold text-white bg-[#14532d] hover:bg-[#166534] rounded-lg shadow-xs cursor-pointer"
                                    >
                                        Wapsi Jama Karein
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
            </div>
        </AppLayout>
    );
}
