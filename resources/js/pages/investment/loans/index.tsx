import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import InvestmentHeader from '@/components/investment/investment-header';
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
    currentRole: 'munshi' | 'owner';
    pendingApprovalsCount?: number;
    lastUpdated?: string;
    partnersList: any[];
    loansList: any[];
    surplusList: any[];
    bankAccounts: string[];
    summary: {
        total_principal: number;
        total_balance_due: number;
        total_fees: number;
        active_count: number;
    };
    loans: LoanRow[];
    search?: string;
    breakdowns: Record<string, BreakdownData>;
}

export default function InvestmentLoansPage({
    userName,
    pendingApprovalsCount = 0,
    lastUpdated,
    partnersList,
    loansList,
    surplusList,
    bankAccounts,
    summary,
    loans,
    search = '',
    breakdowns,
}: Props) {
    const { i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [selectedLoanId, setSelectedLoanId] = useState<number | null>(loans[0]?.id ?? null);
    const [isEntryDrawerOpen, setIsEntryDrawerOpen] = useState(false);
    const [activeBreakdown, setActiveBreakdown] = useState<BreakdownData | null>(null);

    // Dialog state for settlement
    const [settleModalLoan, setSettleModalLoan] = useState<LoanRow | null>(null);
    const [settleAmount, setSettleAmount] = useState('');
    const [settlePaymentMethod, setSettlePaymentMethod] = useState<'cash' | 'bank'>('cash');
    const [settleBankName, setSettleBankName] = useState(bankAccounts[0] || 'Meezan Bank Ltd');

    // Voucher Modal state
    const [activeVoucher, setActiveVoucher] = useState<VoucherData | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'انویسٹمنٹ' : 'Investment', href: '/investment/partners' },
        { title: isUrdu ? 'قرضے (Loans)' : 'Loans', href: '/investment/loans' },
    ];

    const activeSelectedLoan = loans.find(l => l.id === selectedLoanId) || loans[0] || null;

    const formatRs = (val: number) => 'Rs. ' + Number(val || 0).toLocaleString('en-US');
    const formatNum = (val: number) => Number(val || 0).toLocaleString('en-US');

    // Open settle dialog
    const handleOpenSettle = (loan: LoanRow) => {
        setSettleModalLoan(loan);
        setSettleAmount(loan.balance_due.toString());
    };

    // Submit settlement
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
                toast.success(isUrdu ? 'قرضے کی ادائیگی محفوظ ہو گئی' : `Qarza payment Rs. ${formatNum(amt)} kamyabi se darj ho gayi.`);
                setSettleModalLoan(null);
            },
            onError: (errs) => {
                const msg = Object.values(errs)[0];
                toast.error(msg || 'Error recording loan settlement.');
            },
        });
    };

    // WhatsApp Reminder with Roman Urdu Template (Section E.3)
    const handleSendReminder = (loan: LoanRow) => {
        const isOverdue = loan.due_badge.type === 'danger';
        const msg = isOverdue
            ? `Mohtaram ${loan.lender_name} sb, Mandi short-term loan baqaya Rs. ${formatNum(loan.balance_due)} ki wapsi tareekh (${loan.due_date_label}) guzar chuki hai. Baraye meherbani jald az jald tasdeeq ya adaigi farmaiyein. Shukriya - Vegetable POS.`
            : `Mohtaram ${loan.lender_name} sb, Mandi short-term loan baqaya Rs. ${formatNum(loan.balance_due)} ki wapsi tareekh (${loan.due_date_label}) qareeb hai. Shukriya - Vegetable POS.`;

        const encoded = encodeURIComponent(msg);
        const phone = loan.phone ? loan.phone.replace(/\D/g, '') : '';
        const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
        window.open(url, '_blank');
        toast.success(isUrdu ? 'واٹس ایپ یاد دہانی کھول دی گئی' : 'WhatsApp reminder khol diya gaya.');
    };

    // Print voucher for loan
    const handlePrintLoanVoucher = (loan: LoanRow) => {
        setActiveVoucher({
            ref_no: `LN-00${loan.id}`,
            date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            party: loan.lender_name,
            type: 'loan_out',
            type_label: 'Short-Term Loan Payable',
            amount: loan.balance_due,
            payment_method: 'cash',
            approval_status: 'posted',
            reason: loan.notes || `Balance due payment voucher`,
        });
    };

    // Export CSV
    const handleExportCSV = () => {
        const headers = ['Lender Name', 'Principal Amount', 'Fee', 'Paid Amount', 'Balance Due', 'Due Date', 'Status'];
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
        link.setAttribute('download', `Loans_Register_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'قرضے - انویسٹمنٹ' : 'Loans - Investment'} />

            <div className="-mt-4 -mx-4 -mb-8 pb-28 bg-[#f4f6f4] min-h-screen font-sans text-[#1a211c]">
                {/* Header */}
                <InvestmentHeader
                    currentTab="loans"
                    userName={userName}
                    pendingApprovalsCount={pendingApprovalsCount}
                    lastUpdated={lastUpdated}
                    onOpenEntry={() => setIsEntryDrawerOpen(true)}
                    isUrdu={isUrdu}
                />

                <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
                    {/* Summary Cards with Clickable Breakdown Modals */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.total_principal)}
                            className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs hover:border-gray-400 transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                    {isUrdu ? 'کل پرنسپل قرضہ' : 'Kul Asal Qarza (Principal)'}
                                </span>
                                <Icon name="Info" className="size-3.5 text-gray-400 group-hover:text-gray-700" />
                            </div>
                            <span className="text-xl md:text-2xl font-black text-gray-900 block mt-2">
                                {formatRs(summary.total_principal)}
                            </span>
                            <span className="text-[10px] text-gray-500 block mt-0.5">3 Mandi Lenders</span>
                        </div>

                        {/* Reconciled naming Section B.9 */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.total_balance_due)}
                            className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs hover:border-red-400 transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                    {isUrdu ? 'کل بقایا رقم (فیس سمیت)' : 'Kul Baqaya Qarza (Fee Samet)'}
                                </span>
                                <Icon name="Info" className="size-3.5 text-gray-400 group-hover:text-red-600" />
                            </div>
                            <span className="text-xl md:text-2xl font-black text-red-600 block mt-2">
                                {formatRs(summary.total_balance_due)}
                            </span>
                            <span className="text-[10px] text-gray-500 block mt-0.5">
                                Asal Rs. {formatNum(summary.total_principal)} + Fee Rs. {formatNum(summary.total_fees)}
                            </span>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                {isUrdu ? 'مقررہ فیس / منافع' : 'Kul Muqarrar Fee'}
                            </span>
                            <span className="text-xl md:text-2xl font-black text-amber-700 block mt-2">
                                {formatRs(summary.total_fees)}
                            </span>
                            <span className="text-[10px] text-gray-500 block mt-0.5">Aslam Traders</span>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                {isUrdu ? 'ایکٹیو قرضے' : 'Chalte Qarze (Active)'}
                            </span>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-xl md:text-2xl font-black text-gray-900">
                                    {summary.active_count}
                                </span>
                                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    1 Overdue
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Short-Term Loans Table Card */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Icon name="HandCoins" className="size-5 text-[#14532d]" />
                                <h3 className="text-sm font-bold text-gray-900">
                                    {isUrdu ? 'مختصر مدت کے قرضے' : 'Mandi Short-Term Qarze Register'}
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
                                    {loans.length} {isUrdu ? 'ریکارڈز' : 'Qarze'}
                                </span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-start text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[11px] font-bold">
                                        <th className="py-3 px-4 text-start font-bold">Dene Wala (Lender)</th>
                                        <th className="py-3 px-4 text-end font-bold">Asal Rakam (Principal)</th>
                                        <th className="py-3 px-4 text-end font-bold">Fee / Munafa</th>
                                        <th className="py-3 px-4 text-end font-bold">Paid (Wapas Hua)</th>
                                        <th className="py-3 px-4 text-end font-bold text-gray-900">Baqaya Rakam (Due)</th>
                                        <th className="py-3 px-4 text-center font-bold">Wapsi Tareekh / Status</th>
                                        <th className="py-3 px-4 text-center font-bold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
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
                                                <td className="py-3.5 px-4 font-semibold text-gray-900">
                                                    <div>
                                                        <span>{loan.lender_name}</span>
                                                        {loan.phone && (
                                                            <span className="text-[11px] text-gray-500 block font-normal">
                                                                {loan.phone}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Principal */}
                                                <td className="py-3.5 px-4 text-end text-gray-700 font-medium">
                                                    {formatNum(loan.principal_amount)}
                                                </td>

                                                {/* Fee */}
                                                <td className="py-3.5 px-4 text-end text-gray-700 font-medium">
                                                    {loan.fee_or_interest > 0 ? formatNum(loan.fee_or_interest) : '0'}
                                                </td>

                                                {/* Paid Amount */}
                                                <td className="py-3.5 px-4 text-end text-emerald-800 font-medium">
                                                    {loan.paid_amount > 0 ? formatNum(loan.paid_amount) : '0'}
                                                </td>

                                                {/* Balance Due */}
                                                <td className="py-3.5 px-4 text-end font-black text-sm text-gray-900">
                                                    {formatNum(loan.balance_due)}
                                                </td>

                                                {/* Due Badge */}
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className={cn(
                                                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
                                                        loan.due_badge.type === 'danger' && "bg-red-100 text-red-800 border border-red-300",
                                                        loan.due_badge.type === 'warning' && "bg-amber-100 text-amber-800 border border-amber-300",
                                                        loan.due_badge.type === 'neutral' && "bg-gray-100 text-gray-800 border border-gray-300"
                                                    )}>
                                                        {loan.due_badge.text}
                                                    </span>
                                                </td>

                                                {/* Section A.6 & F.4: Single set of clean row actions without duplication */}
                                                <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenSettle(loan)}
                                                            className="px-2.5 py-1 text-xs font-semibold text-white bg-[#14532d] hover:bg-[#166534] rounded shadow-2xs transition-colors cursor-pointer"
                                                        >
                                                            Qarza Wapsi
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSendReminder(loan)}
                                                            title="WhatsApp Yaad Dehani Bhejein"
                                                            className="p-1 text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                                        >
                                                            <Icon name="WhatsappLogo" className="size-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePrintLoanVoucher(loan)}
                                                            title="Parchi Print Karein"
                                                            className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                                                        >
                                                            <Icon name="Printer" className="size-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Section A.3: Clean bottom summary bar with ONLY ONE main action button */}
                        {activeSelectedLoan && (
                            <div className="p-4 bg-gray-50/80 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="text-xs text-gray-700">
                                    Chuna hua: <span className="font-bold text-gray-900">{activeSelectedLoan.lender_name}</span>, baqaya <span className="font-bold text-red-600">{formatRs(activeSelectedLoan.balance_due)}</span>
                                </div>
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenSettle(activeSelectedLoan)}
                                        className="min-h-[38px] px-4 py-2 text-xs font-bold text-white bg-[#14532d] hover:bg-[#166534] rounded-lg shadow-xs transition-colors cursor-pointer"
                                    >
                                        Qarza Wapsi
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Settle Loan Dialog (Supports both full return and partial return) */}
                {settleModalLoan && (
                    <Dialog open={!!settleModalLoan} onOpenChange={(open) => !open && setSettleModalLoan(null)}>
                        <DialogContent className="max-w-md w-full p-6 bg-white font-sans text-[#1a211c]">
                            <DialogHeader>
                                <DialogTitle className="text-base font-bold text-gray-900">
                                    Qarza Wapsi Ada Karein
                                </DialogTitle>
                                <DialogDescription className="text-xs text-gray-500">
                                    Dene Wala: {settleModalLoan.lender_name} — Kul Baqaya: Rs. {formatNum(settleModalLoan.balance_due)}
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleConfirmSettle} className="space-y-4 pt-2">
                                <div>
                                    <label className="text-xs font-bold text-gray-800 block mb-1">
                                        Adaigi Rakam (Rs.)
                                    </label>
                                    <input
                                        type="text"
                                        value={settleAmount}
                                        onChange={(e) => setSettleAmount(e.target.value)}
                                        placeholder="Rakam darj karein"
                                        className="w-full h-11 px-3.5 text-base font-bold text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#14532d] focus:outline-none"
                                    />
                                    <div className="flex gap-2 mt-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setSettleAmount(settleModalLoan.balance_due.toString())}
                                            className="text-[11px] text-[#14532d] font-semibold underline cursor-pointer"
                                        >
                                            Poora Baqaya (Rs. {formatNum(settleModalLoan.balance_due)})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSettleAmount(Math.round(settleModalLoan.balance_due / 2).toString())}
                                            className="text-[11px] text-gray-500 underline cursor-pointer"
                                        >
                                            Nisf (50%)
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-800 block mb-1">
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
                                                    : "text-gray-700"
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
                                                    : "text-gray-700"
                                            )}
                                        >
                                            Bank Khata
                                        </button>
                                    </div>
                                </div>

                                {settlePaymentMethod === 'bank' && (
                                    <div>
                                        <label className="text-xs font-bold text-gray-800 block mb-1">
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
                                        className="flex-1 min-h-[40px] px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
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
