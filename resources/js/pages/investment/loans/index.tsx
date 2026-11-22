import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import InvestmentHeader from '@/components/investment/investment-header';
import AajKaHaal from '@/components/investment/aaj-ka-haal';
import EntryDrawer from '@/components/investment/entry-drawer';
import BreakdownModal, { BreakdownData } from '@/components/investment/breakdown-modal';
import VoucherModal, { VoucherData } from '@/components/investment/voucher-modal';
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

interface LoanRow {
    id: number;
    lender_name: string;
    lender_name_ur?: string;
    phone?: string;
    principal_amount: number;
    fee_or_interest: number;
    paid_amount: number;
    balance_due: number;
    due_date?: string;
    due_date_label: string;
    status: string;
    due_badge: {
        text: string;
        type: 'danger' | 'warning' | 'neutral';
    };
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
    summary: {
        total_balance_due: number;
        lenders_count: number;
        overdue_count: number;
    };
    loans: LoanRow[];
    search?: string;
    breakdowns: Record<string, BreakdownData>;
}

export default function InvestmentLoansPage({
    userName,
    pendingApprovalsCount = 0,
    partnersList,
    loansList,
    surplusList,
    bankAccounts,
    aajKaHaal,
    singleAlert,
    summary,
    loans,
    breakdowns,
}: Props) {
    const { i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [selectedLoanId, setSelectedLoanId] = useState<number | null>(loans[0]?.id ?? null);
    const [isEntryDrawerOpen, setIsEntryDrawerOpen] = useState(false);
    const [activeBreakdown, setActiveBreakdown] = useState<BreakdownData | null>(null);

    // Settlement dialog
    const [settleModalLoan, setSettleModalLoan] = useState<LoanRow | null>(null);
    const [settleAmount, setSettleAmount] = useState('');
    const [settlePaymentMethod, setSettlePaymentMethod] = useState<'cash' | 'bank'>('cash');
    const [settleBankName, setSettleBankName] = useState(bankAccounts[0] || 'Meezan Bank Ltd');

    // Voucher Modal
    const [activeVoucher, setActiveVoucher] = useState<VoucherData | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'انویسٹمنٹ' : 'Investment', href: '/investment/partners' },
        { title: isUrdu ? 'قرضہ (Loans)' : 'Qarza', href: '/investment/loans' },
    ];

    const activeSelectedLoan = loans.find(l => l.id === selectedLoanId) || loans[0] || null;

    const formatRs = (val: number) => 'Rs. ' + Number(val || 0).toLocaleString('en-US');
    const formatNum = (val: number) => Number(val || 0).toLocaleString('en-US');

    // Open settle dialog
    const handleOpenSettle = (loan: LoanRow) => {
        setSettleModalLoan(loan);
        setSettleAmount(loan.balance_due.toString());
    };

    // Confirm settlement
    const handleConfirmSettle = (e: React.FormEvent) => {
        e.preventDefault();
        if (!settleModalLoan) return;

        const amt = parseFloat(settleAmount.replace(/,/g, ''));
        if (isNaN(amt) || amt <= 0) {
            toast.error(isUrdu ? 'براہ کرم درست رقم درج کریں' : 'Barahe karam durust rakam enter karein.');
            return;
        }

        router.post(`/investment/loans/${settleModalLoan.id}/return`, {
            amount: amt,
            payment_method: settlePaymentMethod,
            bank_name: settlePaymentMethod === 'bank' ? settleBankName : null,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(`Qarza payment Rs. ${formatNum(amt)} kamyabi se darj ho gayi.`);
                setSettleModalLoan(null);
            },
            onError: (errs) => {
                const msg = Object.values(errs)[0];
                toast.error(msg || 'Error recording loan settlement.');
            },
        });
    };

    // WhatsApp Reminder
    const handleSendReminder = (loan: LoanRow) => {
        const isOverdue = loan.due_badge.type === 'danger';
        const msg = isOverdue
            ? `Mohtaram ${loan.lender_name} sb, Mandi short-term loan baqaya Rs. ${formatNum(loan.balance_due)} ki wapsi tareekh (${loan.due_date_label}) guzar chuki hai. Baraye meherbani tasdeeq farmaiyein. Shukriya - Vegetable POS.`
            : `Mohtaram ${loan.lender_name} sb, Mandi short-term loan baqaya Rs. ${formatNum(loan.balance_due)} ki wapsi tareekh (${loan.due_date_label}) qareeb hai. Shukriya - Vegetable POS.`;

        const encoded = encodeURIComponent(msg);
        const phone = loan.phone ? loan.phone.replace(/\D/g, '') : '';
        const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
        window.open(url, '_blank');
        toast.success('WhatsApp reminder khol diya gaya.');
    };

    // Print voucher
    const handlePrintLoanVoucher = (loan: LoanRow) => {
        setActiveVoucher({
            ref_no: `LN-00${loan.id}`,
            date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            party: loan.lender_name,
            type: 'loan_out',
            type_label: 'Qarza wapas',
            amount: loan.balance_due,
            payment_method: 'cash',
            approval_status: 'posted',
            reason: loan.notes || `Balance due payment voucher`,
        });
    };

    // Export CSV
    const handleExportCSV = () => {
        const headers = ['Dene Wala', 'Asal Principal', 'Fee', 'Wapas Hua', 'Baqaya Due', 'Wapsi Tareekh', 'Status'];
        const rows = loans.map(l => [
            `"${l.lender_name}"`,
            l.principal_amount,
            l.fee_or_interest,
            l.paid_amount,
            l.balance_due,
            `"${l.due_date_label}"`,
            `"${l.status}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Qarza_Register_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'قرضہ - انویسٹمنٹ' : 'Qarza (Loans) - Investment'} />

            <div className="-mt-4 -mx-4 -mb-8 pb-28 bg-[#f4f6f4] min-h-screen font-sans text-[#1F2937]">
                {/* Header (Section B.5 short tabs & single alert line) */}
                <InvestmentHeader
                    currentTab="loans"
                    userName={userName}
                    pendingApprovalsCount={pendingApprovalsCount}
                    singleAlert={singleAlert}
                    onOpenEntry={() => setIsEntryDrawerOpen(true)}
                    isUrdu={isUrdu}
                />

                <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
                    {/* Section B.6: Aaj Ka Haal */}
                    <AajKaHaal data={aajKaHaal} isUrdu={isUrdu} />

                    {/* Section B.1: Har Page Par Sirf 3 Numbers (Loans Page) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        {/* Number 1: Kul Baqaya (Hum ko dena hai) */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.total_balance_due)}
                            className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-2xs hover:border-red-400 transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#374151] uppercase tracking-wider">
                                    {isUrdu ? 'ہم کو دینا ہے (کل بقایا)' : 'Hum Ko Dena Hai (Kul Baqaya)'}
                                </span>
                                <Icon name="Info" className="size-4 text-[#4B5563] group-hover:text-red-600" />
                            </div>
                            <span className="text-2xl font-black text-red-700 block mt-2">
                                {formatRs(summary.total_balance_due)}
                            </span>
                            <span className="text-xs font-medium text-[#4B5563] block mt-1">
                                Asal Rs. 200,000 + Fee Rs. 2,000
                            </span>
                        </div>

                        {/* Number 2: Kis ko dena hai */}
                        <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-2xs">
                            <span className="text-xs font-bold text-[#374151] uppercase tracking-wider block">
                                {isUrdu ? 'کتنے لوگوں کو دینا ہے' : 'Kis Ko Dena Hai'}
                            </span>
                            <span className="text-2xl font-black text-[#1F2937] block mt-2">
                                {summary.lenders_count} Log
                            </span>
                            <span className="text-xs font-medium text-[#4B5563] block mt-1">
                                Sohail, Tariq Sb, Aslam Traders
                            </span>
                        </div>

                        {/* Number 3: Overdue */}
                        <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-2xs">
                            <span className="text-xs font-bold text-[#374151] uppercase tracking-wider block">
                                {isUrdu ? 'اوور ڈیو قرضہ' : 'Overdue Qarza'}
                            </span>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-2xl font-black text-amber-800">
                                    {summary.overdue_count} Qarza
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                                    2 Din Overdue
                                </span>
                            </div>
                            <span className="text-xs font-medium text-[#4B5563] block mt-1">
                                Sohail baqaya Rs. 20,000
                            </span>
                        </div>
                    </div>

                    {/* Short-Term Loans Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon name="HandCoins" className="size-5 text-[#14532d]" />
                                <h3 className="text-sm font-bold text-[#1F2937]">
                                    {isUrdu ? 'قرضہ رجسٹر' : 'Qarza Register (Mandi Lenders)'}
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
                                    {loans.length} Qarze
                                </span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-start text-sm border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[#374151] uppercase tracking-wider text-xs font-bold">
                                        <th className="py-3 px-4 text-start">Dene Wala (Lender)</th>
                                        <th className="py-3 px-4 text-end">Asal (Principal)</th>
                                        <th className="py-3 px-4 text-end">Fee</th>
                                        <th className="py-3 px-4 text-end">Paid (Wapas Hua)</th>
                                        <th className="py-3 px-4 text-end text-[#1F2937]">Baqaya Rakam</th>
                                        <th className="py-3 px-4 text-center">Wapsi Tareekh</th>
                                        <th className="py-3 px-4 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-[#1F2937]">
                                    {loans.map((loan) => {
                                        const isSelected = selectedLoanId === loan.id;
                                        return (
                                            <tr
                                                key={loan.id}
                                                onClick={() => setSelectedLoanId(loan.id)}
                                                className={cn(
                                                    "transition-colors cursor-pointer",
                                                    isSelected ? "bg-emerald-50/50" : "hover:bg-gray-50/70"
                                                )}
                                            >
                                                {/* Lender */}
                                                <td className="py-3.5 px-4 font-bold">
                                                    <div>
                                                        <span>{loan.lender_name}</span>
                                                        {loan.phone && (
                                                            <span className="text-xs text-[#4B5563] block font-normal">
                                                                {loan.phone}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Principal */}
                                                <td className="py-3.5 px-4 text-end font-medium text-[#374151]">
                                                    {formatNum(loan.principal_amount)}
                                                </td>

                                                {/* Fee */}
                                                <td className="py-3.5 px-4 text-end font-medium text-[#374151]">
                                                    {loan.fee_or_interest > 0 ? formatNum(loan.fee_or_interest) : '0'}
                                                </td>

                                                {/* Paid Amount */}
                                                <td className="py-3.5 px-4 text-end font-bold text-[#14532d]">
                                                    {loan.paid_amount > 0 ? formatNum(loan.paid_amount) : '0'}
                                                </td>

                                                {/* Balance Due */}
                                                <td className="py-3.5 px-4 text-end font-black text-red-700">
                                                    {formatRs(loan.balance_due)}
                                                </td>

                                                {/* Due Badge */}
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className={cn(
                                                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
                                                        loan.due_badge.type === 'danger' && "bg-red-100 text-red-800 border border-red-300",
                                                        loan.due_badge.type === 'warning' && "bg-amber-100 text-amber-900 border border-amber-300",
                                                        loan.due_badge.type === 'neutral' && "bg-gray-100 text-[#374151] border border-gray-300"
                                                    )}>
                                                        {loan.due_badge.text}
                                                    </span>
                                                </td>

                                                {/* Row Actions: Section B.2 (1 Button + Grouped icons) */}
                                                <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenSettle(loan)}
                                                            className="px-3 py-1 text-xs font-bold text-white bg-[#14532d] hover:bg-[#166534] rounded shadow-2xs transition-colors cursor-pointer"
                                                        >
                                                            Wapas karein
                                                        </button>
                                                        {/* Grouped Print + WhatsApp icons */}
                                                        <div className="flex items-center gap-1 border border-gray-200 rounded p-0.5 bg-gray-50">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSendReminder(loan)}
                                                                title="WhatsApp Yaad Dehani"
                                                                className="p-1 text-[#374151] hover:text-emerald-700 rounded transition-colors cursor-pointer"
                                                            >
                                                                <Icon name="WhatsappLogo" className="size-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePrintLoanVoucher(loan)}
                                                                title="Parchi Print"
                                                                className="p-1 text-[#374151] hover:text-black rounded transition-colors cursor-pointer"
                                                            >
                                                                <Icon name="Printer" className="size-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Section A.3 & B.2: Clean bottom summary bar with ONLY ONE main action button */}
                        {activeSelectedLoan && (
                            <div className="p-4 bg-gray-50/80 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                                <div className="text-[#374151]">
                                    Chuna hua: <span className="font-bold text-[#1F2937]">{activeSelectedLoan.lender_name}</span>, baqaya <span className="font-black text-red-700">{formatRs(activeSelectedLoan.balance_due)}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleOpenSettle(activeSelectedLoan)}
                                    className="min-h-[40px] px-5 py-2 text-sm font-bold text-white bg-[#14532d] hover:bg-[#166534] rounded-lg shadow-xs transition-colors cursor-pointer"
                                >
                                    Wapas karein
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Settle Loan Dialog */}
                {settleModalLoan && (
                    <Dialog open={!!settleModalLoan} onOpenChange={(open) => !open && setSettleModalLoan(null)}>
                        <DialogContent className="max-w-md w-full p-6 bg-white font-sans text-[#1F2937]">
                            <DialogHeader>
                                <DialogTitle className="text-base font-bold text-[#1F2937]">
                                    Qarza Wapas Ada Karein
                                </DialogTitle>
                                <DialogDescription className="text-xs text-[#4B5563]">
                                    Dene Wala: {settleModalLoan.lender_name} — Kul Baqaya: Rs. {formatNum(settleModalLoan.balance_due)}
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleConfirmSettle} className="space-y-4 pt-2">
                                <div>
                                    <label className="text-xs font-bold text-[#374151] block mb-1">
                                        Adaigi Rakam (Rs.)
                                    </label>
                                    <input
                                        type="text"
                                        value={settleAmount}
                                        onChange={(e) => setSettleAmount(e.target.value)}
                                        placeholder="Rakam darj karein"
                                        className="w-full h-11 px-3.5 text-base font-bold text-[#1F2937] bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#14532d] focus:outline-none"
                                    />
                                    <div className="flex gap-3 mt-1.5 text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setSettleAmount(settleModalLoan.balance_due.toString())}
                                            className="text-[#14532d] font-bold underline cursor-pointer"
                                        >
                                            Poora Baqaya (Rs. {formatNum(settleModalLoan.balance_due)})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSettleAmount(Math.round(settleModalLoan.balance_due / 2).toString())}
                                            className="text-[#4B5563] underline cursor-pointer"
                                        >
                                            Nisf (50%)
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-[#374151] block mb-1">
                                        Kahan se ada karein?
                                    </label>
                                    <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg border border-gray-200">
                                        <button
                                            type="button"
                                            onClick={() => setSettlePaymentMethod('cash')}
                                            className={cn(
                                                "min-h-[36px] text-xs font-bold rounded-md transition-all cursor-pointer",
                                                settlePaymentMethod === 'cash'
                                                    ? "bg-[#14532d] text-white shadow-xs"
                                                    : "text-[#374151]"
                                            )}
                                        >
                                            Cash Khata
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSettlePaymentMethod('bank')}
                                            className={cn(
                                                "min-h-[36px] text-xs font-bold rounded-md transition-all cursor-pointer",
                                                settlePaymentMethod === 'bank'
                                                    ? "bg-[#14532d] text-white shadow-xs"
                                                    : "text-[#374151]"
                                            )}
                                        >
                                            Bank Khata
                                        </button>
                                    </div>
                                </div>

                                {settlePaymentMethod === 'bank' && (
                                    <div>
                                        <label className="text-xs font-bold text-[#374151] block mb-1">
                                            Bank Account Muntakhib Karein
                                        </label>
                                        <select
                                            value={settleBankName}
                                            onChange={(e) => setSettleBankName(e.target.value)}
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
                                        onClick={() => setSettleModalLoan(null)}
                                        className="flex-1 min-h-[40px] px-4 py-2 text-xs font-semibold text-[#374151] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 min-h-[40px] px-4 py-2 text-xs font-bold text-white bg-[#14532d] hover:bg-[#166534] rounded-lg shadow-xs transition-colors cursor-pointer"
                                    >
                                        Adaigi Record Karein
                                    </button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}

                {/* Voucher Modal */}
                {activeVoucher && (
                    <VoucherModal
                        isOpen={!!activeVoucher}
                        onClose={() => setActiveVoucher(null)}
                        voucher={activeVoucher}
                        isUrdu={isUrdu}
                    />
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
