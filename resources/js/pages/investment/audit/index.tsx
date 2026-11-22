import React, { useState, useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import InvestmentHeader from '@/components/investment/investment-header';
import EntryDrawer from '@/components/investment/entry-drawer';
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

interface TransactionRow {
    id: number;
    ref_no: string;
    date: string;
    created_time?: string;
    raw_date: string;
    created_at_label: string;
    created_by: string;
    party: string;
    type: string;
    type_label: string;
    amount: number;
    formatted_amount: string;
    reason?: string | null;
    payment_method: string;
    bank_name?: string | null;
    approval_status: 'approved' | 'pending_owner' | 'reversed' | 'posted';
    status_standard: string;
    approved_by?: string | null;
    is_reversed: boolean;
    reversal_reason?: string | null;
    reversal_ref_no?: string | null;
    is_advance?: boolean;
    advance_amount?: number;
}

interface Props {
    userName?: string;
    isOwner?: boolean;
    pendingApprovalsCount?: number;
    partnersList: any[];
    loansList: any[];
    surplusList: any[];
    bankAccounts: string[];
    transactions: TransactionRow[];
    singleAlert?: {
        text: string;
        action_label: string;
        action_url: string;
    } | null;
    search?: string;
    activeFilter?: string;
}

export default function InvestmentAuditPage({
    userName,
    isOwner = true,
    pendingApprovalsCount = 0,
    partnersList,
    loansList,
    surplusList,
    bankAccounts,
    transactions,
    singleAlert,
    activeFilter = '',
}: Props) {
    const { i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [selectedTabFilter, setSelectedTabFilter] = useState<'all' | 'pending' | 'reversed'>(
        activeFilter === 'pending' ? 'pending' : 'all'
    );
    const [selectedTxId, setSelectedTxId] = useState<number | null>(transactions[0]?.id ?? null);
    const [isEntryDrawerOpen, setIsEntryDrawerOpen] = useState(false);
    const [isLegendOpen, setIsLegendOpen] = useState(false);

    // Void Modal state
    const [voidModalTx, setVoidModalTx] = useState<TransactionRow | null>(null);
    const [voidReason, setVoidReason] = useState('');
    const [isVoiding, setIsVoiding] = useState(false);

    // Voucher Modal state
    const [activeVoucher, setActiveVoucher] = useState<VoucherData | null>(null);

    // 30-second live background update (Section D)
    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({ only: ['aajKaHaal', 'singleAlert', 'transactions', 'pendingApprovalsCount'] });
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'انویسٹمنٹ' : 'Investment', href: '/investment/partners' },
        { title: isUrdu ? 'ریکارڈ (Audit)' : 'Record', href: '/investment/audit' },
    ];

    // Filter transactions
    const filteredTx = transactions.filter((tx) => {
        if (selectedTabFilter === 'pending') {
            return tx.approval_status === 'pending_owner';
        }
        if (selectedTabFilter === 'reversed') {
            return tx.is_reversed;
        }
        return true;
    });

    // Handle Owner Approval (Section A.1: No "Role" label)
    const handleApprove = (tx: TransactionRow) => {
        router.post(`/investment/approve/${tx.id}`, {}, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(`Entry ${tx.ref_no} kamyabi se approve ho gayi.`);
            },
            onError: (errs) => {
                toast.error(Object.values(errs)[0] || 'Approval failed.');
            },
        });
    };

    // Open Void Confirmation
    const handleOpenVoid = (tx: TransactionRow) => {
        setVoidModalTx(tx);
        setVoidReason('');
    };

    // Confirm Void (Creates Reversal Entry)
    const handleConfirmVoid = (e: React.FormEvent) => {
        e.preventDefault();
        if (!voidModalTx) return;

        if (!voidReason.trim()) {
            toast.error('Mansookh karne ki wajah (Reason) likhna lazmi hai.');
            return;
        }

        setIsVoiding(true);

        router.post(`/investment/void/${voidModalTx.id}`, {
            reason: voidReason.trim(),
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(`Entry ${voidModalTx.ref_no} cancel karke reversal entry banayi gayi.`);
                setIsVoiding(false);
                setVoidModalTx(null);
            },
            onError: (errs) => {
                setIsVoiding(false);
                toast.error(Object.values(errs)[0] || 'Void reversal failed.');
            },
        });
    };

    // Open Voucher for printing
    const handleOpenVoucher = (tx: TransactionRow) => {
        setActiveVoucher({
            ref_no: tx.ref_no,
            date: tx.date,
            party: tx.party,
            type: tx.type,
            type_label: tx.type_label,
            amount: tx.amount,
            payment_method: tx.payment_method,
            bank_name: tx.bank_name,
            reason: tx.reason,
            approval_status: tx.approval_status,
            approved_by: tx.approved_by,
            is_advance: tx.is_advance,
            advance_amount: tx.advance_amount,
        });
    };

    // Export CSV
    const handleExportCSV = () => {
        const headers = ['Parchi No', 'Kab', 'Party', 'Qisam', 'Rakam', 'Banaya Kisne', 'Approve Kisne Kiya', 'Status', 'Wajah'];
        const rows = filteredTx.map(tx => [
            `"${tx.ref_no}"`,
            `"${tx.created_at_label}"`,
            `"${tx.party}"`,
            `"${tx.type_label}"`,
            tx.amount,
            `"${tx.created_by}"`,
            `"${tx.approved_by}"`,
            `"${tx.status_standard}"`,
            `"${tx.reason || ''}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Record_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'ریکارڈ - انویسٹمنٹ' : 'Record (Audit) - Investment'} />

            <div className="-mt-4 -mx-4 -mb-4 pb-12 bg-[#f4f6f4] min-h-full font-sans text-[#1F2937]">
                {/* Header (Section B.5 short tabs & single alert line) */}
                <InvestmentHeader
                    currentTab="audit"
                    userName={userName}
                    pendingApprovalsCount={pendingApprovalsCount}
                    singleAlert={singleAlert}
                    onOpenEntry={() => setIsEntryDrawerOpen(true)}
                    isUrdu={isUrdu}
                />

                <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
                    {/* Top Bar: Clean Filter Tabs & Info Icon (Section B.4) */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setSelectedTabFilter('all')}
                                className={cn(
                                    "px-4 py-2 text-sm font-bold rounded-lg border transition-colors cursor-pointer",
                                    selectedTabFilter === 'all'
                                        ? "bg-[#14532d] text-white border-[#14532d]"
                                        : "bg-white text-[#374151] border-gray-200 hover:bg-gray-50"
                                )}
                            >
                                Tamam Record ({transactions.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedTabFilter('pending')}
                                className={cn(
                                    "px-4 py-2 text-sm font-bold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer",
                                    selectedTabFilter === 'pending'
                                        ? "bg-amber-700 text-white border-amber-700"
                                        : "bg-white text-amber-900 border-amber-300 hover:bg-amber-50"
                                )}
                            >
                                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                                <span>Malik Ki Manzoori Baaki ({transactions.filter(t => t.approval_status === 'pending_owner').length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedTabFilter('reversed')}
                                className={cn(
                                    "px-4 py-2 text-sm font-bold rounded-lg border transition-colors cursor-pointer",
                                    selectedTabFilter === 'reversed'
                                        ? "bg-rose-700 text-white border-rose-700"
                                        : "bg-white text-[#374151] border-gray-200 hover:bg-gray-50"
                                )}
                            >
                                Mansookh ({transactions.filter(t => t.is_reversed).length})
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Section B.4: Small "i" icon button for codes information instead of 8 big boxes */}
                            <button
                                type="button"
                                onClick={() => setIsLegendOpen(true)}
                                className="px-3 py-2 text-xs font-bold text-[#374151] bg-white border border-gray-200 hover:bg-gray-50 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                title="Parchi codes ki maloomat"
                            >
                                <Icon name="Info" className="size-4 text-[#14532d]" />
                                <span>Codes Ki Maloomat</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleExportCSV}
                                className="px-3.5 py-2 text-xs font-semibold text-[#374151] bg-white border border-gray-200 hover:bg-gray-50 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <Icon name="DownloadSimple" className="size-4" />
                                <span>Excel / CSV</span>
                            </button>
                        </div>
                    </div>

                    {/* Append-only Record Ledger Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon name="Receipt" className="size-5 text-[#14532d]" />
                                <h3 className="text-sm font-bold text-[#1F2937]">
                                    {isUrdu ? 'مکمل ریکارڈ رجسٹر' : 'Parchi & Transaction Record (Mukammal Khata)'}
                                </h3>
                            </div>
                            <span className="text-xs text-[#4B5563]">
                                {filteredTx.length} Andrajaat
                            </span>
                        </div>

                        <div className="overflow-x-auto scrollbar-thin">
                            <table className="w-full text-start text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[#374151] uppercase tracking-wider text-[11px] font-bold">
                                        <th className="py-2.5 px-2.5 text-start whitespace-nowrap">Parchi No.</th>
                                        <th className="py-2.5 px-2 text-start whitespace-nowrap">Tareekh / Waqt</th>
                                        <th className="py-2.5 px-2 text-start whitespace-nowrap">Party / Khata</th>
                                        <th className="py-2.5 px-2 text-center whitespace-nowrap">Qisam</th>
                                        <th className="py-2.5 px-2 text-end whitespace-nowrap">Rakam</th>
                                        <th className="py-2.5 px-2 text-center whitespace-nowrap">Payment Zariya</th>
                                        <th className="py-2.5 px-2 text-center whitespace-nowrap">Status</th>
                                        <th className="py-2.5 px-2 text-center whitespace-nowrap">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-[#1F2937]">
                                    {filteredTx.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-8 text-center text-[#4B5563] text-sm">
                                                Koi transaction record nahi mila.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTx.map((tx) => {
                                            const isSelected = selectedTxId === tx.id;
                                            const isReversed = tx.is_reversed;
                                            const isIncome = tx.formatted_amount.startsWith('+');
                                            const displayBank = tx.bank_name ? tx.bank_name.split('(')[0].trim() : 'Bank';

                                            return (
                                                <tr
                                                    key={tx.id}
                                                    onClick={() => setSelectedTxId(tx.id)}
                                                    className={cn(
                                                        "transition-colors cursor-pointer",
                                                        isSelected ? "bg-emerald-50/50" : "hover:bg-gray-50/70",
                                                        isReversed && "opacity-60 bg-gray-50/40"
                                                    )}
                                                >
                                                    {/* Parchi No. */}
                                                    <td className={cn(
                                                        "py-2.5 px-2.5 font-bold whitespace-nowrap text-xs",
                                                        isReversed && "line-through text-[#6B7280]"
                                                    )}>
                                                        {tx.ref_no}
                                                    </td>

                                                    {/* Tareekh / Waqt */}
                                                    <td className={cn(
                                                        "py-2.5 px-2 text-[#374151] font-medium whitespace-nowrap text-xs",
                                                        isReversed && "line-through text-[#6B7280]"
                                                    )}>
                                                        <div>{tx.date}</div>
                                                        {tx.created_time && (
                                                            <span className="text-[10px] text-[#6B7280] block font-normal leading-tight">
                                                                {tx.created_time}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Party / Khata */}
                                                    <td className={cn(
                                                        "py-2.5 px-2 font-bold text-xs",
                                                        isReversed && "line-through text-[#6B7280]"
                                                    )}>
                                                        <span className="text-xs font-bold text-[#1F2937] block max-w-[140px] truncate" title={tx.party}>
                                                            {tx.party}
                                                        </span>
                                                    </td>

                                                    {/* Qisam */}
                                                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                                                        <span className={cn(
                                                            "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border",
                                                            isIncome
                                                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                                : "bg-amber-50 text-amber-900 border-amber-200"
                                                        )}>
                                                            {tx.type_label}
                                                        </span>
                                                    </td>

                                                    {/* Rakam */}
                                                    <td className="py-2.5 px-2 text-end whitespace-nowrap">
                                                        <span className={cn(
                                                            "font-black text-xs",
                                                            isReversed
                                                                ? "line-through text-[#6B7280]"
                                                                : isIncome ? "text-[#14532d]" : "text-red-700"
                                                        )}>
                                                            {tx.formatted_amount}
                                                        </span>
                                                        {tx.is_advance && (
                                                            <span className="text-[10px] text-amber-800 font-bold block">
                                                                (Advance)
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Payment Zariya */}
                                                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                                                        <span
                                                            title={tx.payment_method === 'bank' ? (tx.bank_name || 'Bank') : 'Cash (Galla)'}
                                                            className="text-[11px] text-[#374151] font-medium px-2 py-0.5 rounded bg-gray-100 border border-gray-200 inline-block max-w-[130px] truncate align-middle"
                                                        >
                                                            {tx.payment_method === 'bank' ? displayBank : 'Cash'}
                                                        </span>
                                                    </td>

                                                    {/* Status */}
                                                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                                                        {tx.is_reversed ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                                                Mansookh
                                                            </span>
                                                        ) : tx.approval_status === 'pending_owner' ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                                Manzoori Baaki
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-[#14532d] border border-emerald-200">
                                                                Approved
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Actions: Sirf Print aur Mansookh (+ Approve if pending owner) */}
                                                    <td className="py-2.5 px-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-center gap-1">
                                                            {/* Approve button (Only for pending) */}
                                                            {tx.approval_status === 'pending_owner' && isOwner && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleApprove(tx)}
                                                                    title="Manzoor karein"
                                                                    className="px-2 py-1 text-[11px] font-bold text-white bg-[#14532d] hover:bg-[#166534] rounded shadow-2xs transition-colors cursor-pointer"
                                                                >
                                                                    Manzoor
                                                                </button>
                                                            )}

                                                            {/* Print Button */}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenVoucher(tx)}
                                                                title="Parchi Print"
                                                                className="p-1 text-[#374151] hover:text-black hover:bg-gray-100 rounded transition-colors cursor-pointer"
                                                            >
                                                                <Icon name="Printer" className="size-4" />
                                                            </button>

                                                            {/* Mansookh Button */}
                                                            {!tx.is_reversed && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenVoid(tx)}
                                                                    title="Mansookh (Cancel)"
                                                                    className="p-1 text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                                                >
                                                                    <Icon name="Prohibit" className="size-4" />
                                                                </button>
                                                            )}
                                                        </div>
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

                {/* Section B.4: Small Info Dialog for Codes Information */}
                {isLegendOpen && (
                    <Dialog open={isLegendOpen} onOpenChange={setIsLegendOpen}>
                        <DialogContent className="max-w-md w-full p-6 bg-white font-sans text-[#1F2937]">
                            <DialogHeader>
                                <DialogTitle className="text-base font-bold text-[#1F2937] flex items-center gap-2">
                                    <Icon name="Info" className="size-5 text-[#14532d]" />
                                    <span>Parchi Codes Ki Maloomat</span>
                                </DialogTitle>
                                <DialogDescription className="text-xs text-[#4B5563]">
                                    Har code ka asaan matlab neeche diya gaya hai:
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-2 py-3 text-sm">
                                <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between">
                                    <span className="font-bold text-[#14532d]">CI</span>
                                    <span className="font-semibold text-[#1F2937]">Paisa dala (Capital In)</span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between">
                                    <span className="font-bold text-red-700">CO</span>
                                    <span className="font-semibold text-[#1F2937]">Paisa nikala (Drawings)</span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between">
                                    <span className="font-bold text-blue-700">LN / LI</span>
                                    <span className="font-semibold text-[#1F2937]">Qarza liya (Loan In)</span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between">
                                    <span className="font-bold text-purple-700">LR</span>
                                    <span className="font-semibold text-[#1F2937]">Qarza wapas (Loan Return)</span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between">
                                    <span className="font-bold text-amber-700">SO</span>
                                    <span className="font-semibold text-[#1F2937]">Sarmayakari mein lagaya (Investment)</span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between">
                                    <span className="font-bold text-emerald-700">SI</span>
                                    <span className="font-semibold text-[#1F2937]">Sarmayakari se wapsi (Return)</span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between">
                                    <span className="font-bold text-rose-700">REV</span>
                                    <span className="font-semibold text-[#1F2937]">Mansookh (Cancel entry)</span>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsLegendOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-[#374151] bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer"
                                >
                                    Band karein
                                </button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}

                {/* Void Modal */}
                {voidModalTx && (
                    <Dialog open={!!voidModalTx} onOpenChange={(open) => !open && setVoidModalTx(null)}>
                        <DialogContent className="max-w-md w-full p-6 bg-white font-sans text-[#1F2937]">
                            <DialogHeader>
                                <DialogTitle className="text-base font-bold text-[#1F2937]">
                                    Parchi Mansookh (Cancel) Karein
                                </DialogTitle>
                                <DialogDescription className="text-xs text-[#4B5563]">
                                    Parchi: {voidModalTx.ref_no} — Party: {voidModalTx.party} — Rakam: Rs. {Number(voidModalTx.amount).toLocaleString('en-US')}
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleConfirmVoid} className="space-y-4 pt-2">
                                <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-950">
                                    <p className="leading-relaxed">
                                        Yeh entry ledger se delete nahi hogi. Is ke bar-aks ek nayi reversal entry ledger mein record hogi taake audit trail mehfooz rahe.
                                    </p>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-[#374151] block mb-1">
                                        Mansookhi Ki Wajah (Reason) *
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={voidReason}
                                        onChange={(e) => setVoidReason(e.target.value)}
                                        placeholder="Wajah darj karein..."
                                        className="w-full p-3 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-rose-600 focus:outline-none"
                                        required
                                    />
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setVoidModalTx(null)}
                                        className="flex-1 min-h-[40px] px-4 py-2 text-xs font-semibold text-[#374151] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isVoiding}
                                        className="flex-1 min-h-[40px] px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-xs transition-colors cursor-pointer"
                                    >
                                        {isVoiding ? 'Mansookh Ho Raha Hai...' : 'Mansookh Karein'}
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
            </div>
        </AppLayout>
    );
}
