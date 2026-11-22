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
    party: string;
    type: string;
    type_label: string;
    amount: number;
    formatted_amount: string;
    reason?: string | null;
    payment_method: string;
    bank_name?: string | null;
    approval_status: 'approved' | 'pending_owner' | 'reversed' | 'posted';
    approved_by?: string | null;
    is_reversed: boolean;
    reversal_reason?: string | null;
    reversal_ref_no?: string | null;
    is_advance?: boolean;
    advance_amount?: number;
}

interface Props {
    currentRole: 'munshi' | 'owner';
    partnersList: any[];
    loansList: any[];
    surplusList: any[];
    bankAccounts: string[];
    transactions: TransactionRow[];
    search?: string;
}

export default function InvestmentAuditPage({
    currentRole,
    partnersList,
    loansList,
    surplusList,
    bankAccounts,
    transactions,
    search = '',
}: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [searchTerm, setSearchTerm] = useState(search);
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

    // Filter transactions based on search
    const filteredTx = transactions.filter((tx) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
            tx.ref_no.toLowerCase().includes(q) ||
            tx.party.toLowerCase().includes(q) ||
            tx.type_label.toLowerCase().includes(q) ||
            (tx.reason && tx.reason.toLowerCase().includes(q)) ||
            tx.amount.toString().includes(q)
        );
    });

    const activeSelectedTx = transactions.find(t => t.id === selectedTxId) || transactions[0] || null;

    // Handle Owner Approval
    const handleApprove = (tx: TransactionRow) => {
        if (currentRole !== 'owner') {
            toast.error(
                isUrdu
                    ? 'صرف اونر منظور کر سکتا ہے۔ اوپر سے رول سوئچ کریں'
                    : 'Sirf Owner approve kar sakta hai. Upar se Role: Owner activate karein.'
            );
            return;
        }

        router.post(`/investment/approve/${tx.id}`, {}, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(isUrdu ? 'اینٹری کامیابی سے منظور ہو گئی' : `Entry ${tx.ref_no} approved by Owner!`);
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
            toast.error(
                isUrdu
                    ? 'منسوخی کی وجہ درج کرنا لازمی ہے'
                    : 'Void karne ki waja (Reason) likhna lazmi hai.'
            );
            return;
        }

        setIsVoiding(true);

        router.post(`/investment/void/${voidModalTx.id}`, {
            reason: voidReason.trim(),
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(
                    isUrdu
                        ? 'اینٹری منسوخ کر کے ریورسل ریکارڈ کر دیا گیا'
                        : `Entry ${voidModalTx.ref_no} reversed successfully! Reversal entry created.`
                );
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'آڈٹ اور واؤچرز - انویسٹمنٹ' : 'Audit & Vouchers - Investment'} />

            <div className="-mt-4 -mx-4 -mb-8 pb-28 bg-[#f4f6f4] min-h-screen font-sans text-[#1a211c]">
                {/* Header */}
                <InvestmentHeader
                    currentTab="audit"
                    currentRole={currentRole}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onOpenEntry={() => setIsEntryDrawerOpen(true)}
                    isUrdu={isUrdu}
                />

                <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
                    {/* Append-only Audit Ledger Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon name="Receipt" className="size-5 text-[#14532d]" />
                                <h3 className="text-sm font-bold text-gray-900">
                                    {isUrdu ? 'آڈٹ رجسٹر (Append-Only Transaction Ledger)' : 'Audit & Vouchers Register (Mukammal Record)'}
                                </h3>
                            </div>
                            <span className="text-xs text-gray-500">
                                {filteredTx.length} {isUrdu ? 'اندراجات' : 'Andrajaat'}
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-start text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[11px] font-bold">
                                        <th className="py-3 px-4 text-start font-bold">Parchi No (Ref)</th>
                                        <th className="py-3 px-4 text-start font-bold">Tareekh (Date)</th>
                                        <th className="py-3 px-4 text-start font-bold">Party (Kis Ke Sath)</th>
                                        <th className="py-3 px-4 text-start font-bold">Qisam (Type)</th>
                                        <th className="py-3 px-4 text-start font-bold">Rakam / Wajah / Note</th>
                                        <th className="py-3 px-4 text-center font-bold">Manzoori (Approval)</th>
                                        <th className="py-3 px-4 text-center font-bold">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredTx.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-8 text-center text-gray-500 text-xs">
                                                {isUrdu ? 'کوئی ٹرانزیکشن نہیں ملی' : 'Koi transaction nahi mili.'}
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
                                                        "py-3.5 px-4 font-semibold text-gray-900",
                                                        isReversed && "line-through text-gray-400"
                                                    )}>
                                                        {tx.ref_no}
                                                    </td>

                                                    {/* Date */}
                                                    <td className={cn(
                                                        "py-3.5 px-4 text-gray-600 font-medium whitespace-nowrap",
                                                        isReversed && "line-through text-gray-400"
                                                    )}>
                                                        {tx.date}
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

                                                    {/* Amount / Reason / Note */}
                                                    <td className="py-3.5 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn(
                                                                "font-bold text-sm",
                                                                isReversed
                                                                    ? "line-through text-gray-400"
                                                                    : isIncome ? "text-emerald-700" : "text-red-600"
                                                            )}>
                                                                {tx.formatted_amount}
                                                            </span>
                                                            {tx.reason && (
                                                                <span className={cn(
                                                                    "text-xs text-gray-600 truncate max-w-xs",
                                                                    isReversed && "line-through text-gray-400"
                                                                )}>
                                                                    {tx.reason}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {tx.is_advance && (
                                                            <span className="text-[10px] text-amber-700 font-semibold block">
                                                                (Advance darj: Rs. {Number(tx.advance_amount || 0).toLocaleString('en-US')})
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Approval Status */}
                                                    <td className="py-3.5 px-4 text-center">
                                                        {tx.approval_status === 'approved' && (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                Manzoor Shuda (Owner)
                                                            </span>
                                                        )}
                                                        {tx.approval_status === 'pending_owner' && (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                                                                Owner Manzoori Baqi
                                                            </span>
                                                        )}
                                                        {tx.approval_status === 'reversed' && (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500 border border-gray-300">
                                                                Mansookh Shuda (Reversed)
                                                            </span>
                                                        )}
                                                        {tx.approval_status === 'posted' && (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                                                Darj Shuda (Posted)
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Action Buttons */}
                                                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                        {tx.approval_status === 'pending_owner' ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleApprove(tx)}
                                                                className={cn(
                                                                    "px-3 py-1 text-xs font-bold rounded shadow-2xs transition-colors cursor-pointer border",
                                                                    currentRole === 'owner'
                                                                        ? "bg-white text-gray-900 border-gray-300 hover:bg-gray-100"
                                                                        : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                                                )}
                                                                title={currentRole !== 'owner' ? "Owner ki manzoori darkar hai" : "Entry manzoor karein"}
                                                            >
                                                                Manzoor Karein
                                                            </button>
                                                        ) : tx.approval_status === 'reversed' ? (
                                                            <span className="text-[11px] text-gray-400">
                                                                {tx.reversal_reason ? `(${tx.reversal_reason})` : 'Mansookh'}
                                                            </span>
                                                        ) : tx.approval_status === 'approved' ? (
                                                            <span className="text-[11px] text-gray-400">Locked (Mehfooz)</span>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenVoid(tx)}
                                                                className="px-3 py-1 text-xs font-bold text-red-600 bg-white border border-red-300 hover:bg-red-50 rounded shadow-2xs transition-colors cursor-pointer"
                                                            >
                                                                Mansookh (Void)
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Audit Bottom Bar (Policy Note + Print / WhatsApp) */}
                        <div className="p-4 bg-gray-50/80 border-t border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <p className="text-xs text-gray-500 italic leading-relaxed">
                                Void sirf reason ke saath hoga. Purani entry delete nahi hoti, reversal entry banti hai.
                            </p>

                            <div className="flex items-center gap-2 justify-end">
                                <button
                                    type="button"
                                    disabled={!activeSelectedTx}
                                    onClick={() => activeSelectedTx && handleOpenVoucher(activeSelectedTx)}
                                    className="min-h-[40px] px-4 py-2 text-xs font-bold text-gray-800 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <Icon name="Printer" className="size-4" />
                                    <span>Parchi Print Karein</span>
                                </button>

                                <button
                                    type="button"
                                    disabled={!activeSelectedTx}
                                    onClick={() => activeSelectedTx && handleOpenVoucher(activeSelectedTx)}
                                    className="min-h-[40px] px-4 py-2 text-xs font-bold text-[#14532d] bg-white border border-[#14532d] hover:bg-emerald-50 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <Icon name="WhatsappLogo" className="size-4" />
                                    <span>WhatsApp Par Bhejein</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mandatory Void Confirmation Dialog */}
                {voidModalTx && (
                    <Dialog open={!!voidModalTx} onOpenChange={(open) => !open && setVoidModalTx(null)}>
                        <DialogContent className="max-w-md w-full p-6 bg-white font-sans text-[#1a211c]">
                            <DialogHeader>
                                <DialogTitle className="text-base font-bold text-red-700 flex items-center gap-2">
                                    <Icon name="Warning" className="size-5" />
                                    <span>Entry Void / Reverse Karein</span>
                                </DialogTitle>
                                <DialogDescription className="text-xs text-gray-500">
                                    Ref: {voidModalTx.ref_no} — Party: {voidModalTx.party} ({voidModalTx.formatted_amount})
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleConfirmVoid} className="space-y-4 pt-2">
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 leading-relaxed">
                                    <strong>Append-Only Rule:</strong> Purani entry delete nahi hogi. Aik nayi Reversal Entry generate ki jayegi jo is transaction ke balance ko offset kar degi.
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-900 block mb-1">
                                        Void karne ki waja (Reason likhna lazmi hai) *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={voidReason}
                                        onChange={(e) => setVoidReason(e.target.value)}
                                        placeholder="e.g. Typo mistake, Wrong party selected, Cancelled deal"
                                        className="w-full h-11 px-3.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-2.5 pt-3">
                                    <button
                                        type="button"
                                        onClick={() => setVoidModalTx(null)}
                                        className="min-h-[40px] px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                                    >
                                        Mansookh (Cancel)
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isVoiding || !voidReason.trim()}
                                        className="min-h-[40px] px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        {isVoiding ? 'Mansookh ho raha hai...' : 'Haan, Reversal Entry Banayein'}
                                    </button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}

                {/* Voucher Modal */}
                <VoucherModal
                    isOpen={!!activeVoucher}
                    onClose={() => setActiveVoucher(null)}
                    voucher={activeVoucher}
                    isUrdu={isUrdu}
                />

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
