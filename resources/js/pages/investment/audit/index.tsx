import React, { useState } from 'react';
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
    currentRole: 'munshi' | 'owner';
    pendingApprovalsCount?: number;
    lastUpdated?: string;
    partnersList: any[];
    loansList: any[];
    surplusList: any[];
    bankAccounts: string[];
    transactions: TransactionRow[];
    search?: string;
    activeFilter?: string;
}

export default function InvestmentAuditPage({
    userName,
    isOwner = true,
    pendingApprovalsCount = 0,
    lastUpdated,
    partnersList,
    loansList,
    surplusList,
    bankAccounts,
    transactions,
    search = '',
    activeFilter = '',
}: Props) {
    const { i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [selectedTabFilter, setSelectedTabFilter] = useState<'all' | 'pending' | 'reversed'>(
        activeFilter === 'pending' ? 'pending' : 'all'
    );
    const [selectedTxId, setSelectedTxId] = useState<number | null>(transactions[0]?.id ?? null);
    const [isEntryDrawerOpen, setIsEntryDrawerOpen] = useState(false);

    // Void Modal state
    const [voidModalTx, setVoidModalTx] = useState<TransactionRow | null>(null);
    const [voidReason, setVoidReason] = useState('');
    const [isVoiding, setIsVoiding] = useState(false);

    // Voucher Modal state
    const [activeVoucher, setActiveVoucher] = useState<VoucherData | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'انویسٹمنٹ' : 'Investment', href: '/investment/partners' },
        { title: isUrdu ? 'آڈٹ اور واؤچرز' : 'Audit & Vouchers', href: '/investment/audit' },
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

    // Handle Owner Approval (No "Role" label - Section A.1)
    const handleApprove = (tx: TransactionRow) => {
        router.post(`/investment/approve/${tx.id}`, {}, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(isUrdu ? 'اینٹری کامیابی سے منظور ہو گئی' : `Entry ${tx.ref_no} kamyabi se approve ho gayi!`);
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
            toast.error(isUrdu ? 'منسوخی کی وجہ درج کرنا لازمی ہے' : 'Void karne ki waja (Reason) likhna lazmi hai.');
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

    // Open Voucher for printing / WhatsApp
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
        const headers = ['Ref No', 'Kab (Date & Time)', 'Party', 'Qisam', 'Rakam', 'Banaya Kisne', 'Approve Kisne Kiya', 'Status', 'Reason'];
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
        link.setAttribute('download', `Audit_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'آڈٹ اور واؤچرز - انویسٹمنٹ' : 'Audit & Vouchers - Investment'} />

            <div className="-mt-4 -mx-4 -mb-8 pb-28 bg-[#f4f6f4] min-h-screen font-sans text-[#1a211c]">
                {/* Header */}
                <InvestmentHeader
                    currentTab="audit"
                    userName={userName}
                    pendingApprovalsCount={pendingApprovalsCount}
                    lastUpdated={lastUpdated}
                    onOpenEntry={() => setIsEntryDrawerOpen(true)}
                    isUrdu={isUrdu}
                />

                <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
                    {/* Section C.4: Reference Codes Legend Card */}
                    <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-2xs space-y-2.5">
                        <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                            <Icon name="Tag" className="size-4 text-[#14532d]" />
                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                                Reference Codes Legend (Parchi Codes Ki Pehchan)
                            </h4>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2 text-xs">
                            <div className="p-2 rounded bg-gray-50 border border-gray-200">
                                <span className="font-bold text-[#14532d] block text-xs">CI</span>
                                <span className="text-[11px] text-gray-600">Capital In (Sarmaya Jama)</span>
                            </div>
                            <div className="p-2 rounded bg-gray-50 border border-gray-200">
                                <span className="font-bold text-red-600 block text-xs">CO</span>
                                <span className="text-[11px] text-gray-600">Capital Out (Drawings)</span>
                            </div>
                            <div className="p-2 rounded bg-gray-50 border border-gray-200">
                                <span className="font-bold text-blue-700 block text-xs">LN / LI</span>
                                <span className="text-[11px] text-gray-600">Loan In (Qarza Liya)</span>
                            </div>
                            <div className="p-2 rounded bg-gray-50 border border-gray-200">
                                <span className="font-bold text-purple-700 block text-xs">LR</span>
                                <span className="text-[11px] text-gray-600">Loan Return (Qarza Wapas)</span>
                            </div>
                            <div className="p-2 rounded bg-gray-50 border border-gray-200">
                                <span className="font-bold text-amber-700 block text-xs">SO</span>
                                <span className="text-[11px] text-gray-600">Surplus Out (Lagaya)</span>
                            </div>
                            <div className="p-2 rounded bg-gray-50 border border-gray-200">
                                <span className="font-bold text-emerald-700 block text-xs">SI</span>
                                <span className="text-[11px] text-gray-600">Surplus In (Wapas Aaya)</span>
                            </div>
                            <div className="p-2 rounded bg-gray-50 border border-gray-200">
                                <span className="font-bold text-rose-700 block text-xs">REV</span>
                                <span className="text-[11px] text-gray-600">Reversal (Mansookh Entry)</span>
                            </div>
                        </div>
                    </div>

                    {/* Filter Tabs & Export */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedTabFilter('all')}
                                className={cn(
                                    "px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer",
                                    selectedTabFilter === 'all'
                                        ? "bg-[#14532d] text-white border-[#14532d]"
                                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                )}
                            >
                                Tamam Andrajaat ({transactions.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedTabFilter('pending')}
                                className={cn(
                                    "px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer",
                                    selectedTabFilter === 'pending'
                                        ? "bg-amber-600 text-white border-amber-600"
                                        : "bg-white text-amber-900 border-amber-200 hover:bg-amber-50"
                                )}
                            >
                                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                                <span>Pending Owner ({transactions.filter(t => t.approval_status === 'pending_owner').length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedTabFilter('reversed')}
                                className={cn(
                                    "px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer",
                                    selectedTabFilter === 'reversed'
                                        ? "bg-rose-700 text-white border-rose-700"
                                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                )}
                            >
                                Reversed ({transactions.filter(t => t.is_reversed).length})
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleExportCSV}
                                className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <Icon name="DownloadSimple" className="size-3.5" />
                                <span>Excel / CSV</span>
                            </button>
                        </div>
                    </div>

                    {/* Section C.6: Append-only Audit Ledger Table with Banaya Kisne, Kab, Kisne Approve Kiya */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon name="Receipt" className="size-5 text-[#14532d]" />
                                <h3 className="text-sm font-bold text-gray-900">
                                    {isUrdu ? 'آڈٹ رجسٹر (Append-Only Transaction Ledger)' : 'Audit & Vouchers Register (Mukammal Audit Trail)'}
                                </h3>
                            </div>
                            <span className="text-xs text-gray-500">
                                {filteredTx.length} Andrajaat
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-start text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[11px] font-bold">
                                        <th className="py-3 px-4 text-start font-bold">Parchi No (Ref)</th>
                                        <th className="py-3 px-4 text-start font-bold">Kab (Date & Time)</th>
                                        <th className="py-3 px-4 text-start font-bold">Party (Kis Ke Sath)</th>
                                        <th className="py-3 px-4 text-start font-bold">Qisam (Type)</th>
                                        <th className="py-3 px-4 text-end font-bold">Rakam (Amount)</th>
                                        <th className="py-3 px-4 text-start font-bold">Banaya Kisne</th>
                                        <th className="py-3 px-4 text-start font-bold">Approve Kisne Kiya</th>
                                        <th className="py-3 px-4 text-center font-bold">Status</th>
                                        <th className="py-3 px-4 text-center font-bold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredTx.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-8 text-center text-gray-500 text-xs">
                                                {isUrdu ? 'کوئی ٹرانزیکشن نہیں ملی' : 'Koi transaction record nahi mila.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTx.map((tx) => {
                                            const isSelected = selectedTxId === tx.id;
                                            const isReversed = tx.is_reversed;
                                            const isIncome = tx.formatted_amount.startsWith('+');

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
                                                    {/* Ref No */}
                                                    <td className={cn(
                                                        "py-3.5 px-4 font-semibold text-gray-900 whitespace-nowrap",
                                                        isReversed && "line-through text-gray-400"
                                                    )}>
                                                        {tx.ref_no}
                                                    </td>

                                                    {/* Kab (Date & Time) Section C.6 */}
                                                    <td className={cn(
                                                        "py-3.5 px-4 text-gray-600 font-medium whitespace-nowrap",
                                                        isReversed && "line-through text-gray-400"
                                                    )}>
                                                        {tx.created_at_label}
                                                    </td>

                                                    {/* Party */}
                                                    <td className={cn(
                                                        "py-3.5 px-4 font-bold text-gray-900",
                                                        isReversed && "line-through text-gray-400"
                                                    )}>
                                                        {tx.party}
                                                    </td>

                                                    {/* Type */}
                                                    <td className={cn(
                                                        "py-3.5 px-4 font-medium text-gray-700",
                                                        isReversed && "line-through text-gray-400"
                                                    )}>
                                                        {tx.type_label}
                                                    </td>

                                                    {/* Amount */}
                                                    <td className="py-3.5 px-4 text-end whitespace-nowrap">
                                                        <span className={cn(
                                                            "font-bold text-sm",
                                                            isReversed
                                                                ? "line-through text-gray-400"
                                                                : isIncome ? "text-emerald-700" : "text-red-600"
                                                        )}>
                                                            {tx.formatted_amount}
                                                        </span>
                                                        {tx.is_advance && (
                                                            <span className="text-[10px] text-amber-700 font-semibold block">
                                                                (Advance)
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Banaya Kisne Section C.6 */}
                                                    <td className="py-3.5 px-4 text-gray-700 font-medium">
                                                        {tx.created_by}
                                                    </td>

                                                    {/* Approve Kisne Kiya Section C.6 */}
                                                    <td className="py-3.5 px-4 text-gray-700 font-medium">
                                                        {tx.approved_by}
                                                    </td>

                                                    {/* Section C.1 Standardized Status */}
                                                    <td className="py-3.5 px-4 text-center">
                                                        {tx.is_reversed ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                                                                Reversed
                                                            </span>
                                                        ) : tx.approval_status === 'pending_owner' ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                                                                Pending Owner
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                Approved
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Actions (Approve, Void, Print) */}
                                                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            {/* Approve button (Only for pending, label is Manzoor Karein, NO 'Role' text) */}
                                                            {tx.approval_status === 'pending_owner' && isOwner && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleApprove(tx)}
                                                                    className="px-2.5 py-1 text-xs font-bold text-white bg-[#14532d] hover:bg-[#166534] rounded shadow-2xs transition-colors cursor-pointer"
                                                                >
                                                                    Manzoor Karein
                                                                </button>
                                                            )}

                                                            {/* Void Action */}
                                                            {!tx.is_reversed && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenVoid(tx)}
                                                                    title="Mansookh (Void) Karein"
                                                                    className="p-1 text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                                                >
                                                                    <Icon name="Prohibit" className="size-4" />
                                                                </button>
                                                            )}

                                                            {/* Parchi Print */}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenVoucher(tx)}
                                                                title="Parchi / Voucher Dekhein"
                                                                className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                                                            >
                                                                <Icon name="Printer" className="size-4" />
                                                            </button>
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

                {/* Void Modal */}
                {voidModalTx && (
                    <Dialog open={!!voidModalTx} onOpenChange={(open) => !open && setVoidModalTx(null)}>
                        <DialogContent className="max-w-md w-full p-6 bg-white font-sans text-[#1a211c]">
                            <DialogHeader>
                                <DialogTitle className="text-base font-bold text-gray-900">
                                    Parchi Mansookh (Void) Karein
                                </DialogTitle>
                                <DialogDescription className="text-xs text-gray-500">
                                    Ref: {voidModalTx.ref_no} — Party: {voidModalTx.party} — Rakam: Rs. {Number(voidModalTx.amount).toLocaleString('en-US')}
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleConfirmVoid} className="space-y-4 pt-2">
                                <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-300 text-xs text-amber-950">
                                    <p className="leading-relaxed">
                                        Yeh entry database se delete nahi hogi. Is ke muqabil ek nayi <span className="font-bold">REV-{(voidModalTx.ref_no).replace(/^[A-Z]+-/, '')}</span> reversal entry ledger mein record hogi taake audit trail mehfooz rahe.
                                    </p>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-800 block mb-1">
                                        Mansookhi Ki Wajah (Reason) *
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={voidReason}
                                        onChange={(e) => setVoidReason(e.target.value)}
                                        placeholder="Maslan: Ghalat account select hua, Party ne cancel karwaya..."
                                        className="w-full p-3 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-rose-600 focus:outline-none"
                                        required
                                    />
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setVoidModalTx(null)}
                                        className="flex-1 min-h-[40px] px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isVoiding}
                                        className="flex-1 min-h-[40px] px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-xs transition-colors cursor-pointer"
                                    >
                                        {isVoiding ? 'Mansookh Ho Raha Hai...' : 'Reversal Entry Banayein'}
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
            </div>
        </AppLayout>
    );
}
