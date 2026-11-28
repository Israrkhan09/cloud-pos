import React, { useState, useMemo, useEffect } from 'react';
import { router } from '@inertiajs/react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PartnerOption {
    id: number;
    name: string;
    name_ur?: string;
    role: string;
    profit_percentage?: number;
    net_equity: number;
}

interface LoanOption {
    id: number;
    lender_name: string;
    direction?: 'payable' | 'receivable';
    balance_due: number;
}

interface SurplusOption {
    id: number;
    fund_name: string;
    principal_amount: number;
    total_return: number;
}

interface EntryDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    category?: 'partners' | 'loans' | 'surplus';
    partners: PartnerOption[];
    loans: LoanOption[];
    surplusFunds: SurplusOption[];
    bankAccounts: string[];
    isUrdu?: boolean;
}

type EntryType =
    | 'capital_in'
    | 'capital_out'
    | 'loan_in'
    | 'loan_give'
    | 'loan_out'
    | 'surplus_out'
    | 'surplus_in';

export default function EntryDrawer({
    isOpen,
    onClose,
    category = 'partners',
    partners,
    loans,
    surplusFunds,
    bankAccounts,
    isUrdu = false,
}: EntryDrawerProps) {
    // Transaction Type
    const [selectedType, setSelectedType] = useState<EntryType>(() => {
        if (category === 'loans') return 'loan_in';
        if (category === 'surplus') return 'surplus_out';
        return 'capital_in';
    });

    // Reset default type when category or drawer opens
    useEffect(() => {
        if (category === 'loans') {
            setSelectedType('loan_in');
        } else if (category === 'surplus') {
            setSelectedType('surplus_out');
        } else {
            setSelectedType('capital_in');
        }
    }, [category, isOpen]);

    // Partner Selection & New Partner Toggle (Point 4)
    const [isNewPartner, setIsNewPartner] = useState(false);
    const [selectedPartnerId, setSelectedPartnerId] = useState<number | ''>('');
    const [newPartnerName, setNewPartnerName] = useState<string>('');
    const [newPartnerProfitPct, setNewPartnerProfitPct] = useState<string>('10');

    // Loan Selection & Input (Point 7)
    const [selectedLoanId, setSelectedLoanId] = useState<number | ''>('');
    const [loanPartyName, setLoanPartyName] = useState<string>('');

    // Surplus Selection & Input
    const [selectedSurplusId, setSelectedSurplusId] = useState<number | ''>('');
    const [surplusPartyName, setSurplusPartyName] = useState<string>('');

    // Amount & Payment Method
    const [amount, setAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
    const [bankName, setBankName] = useState<string>(bankAccounts[0] || 'Meezan Bank Ltd');

    // Guardrail state
    const [isAdvanceConfirmed, setIsAdvanceConfirmed] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Filter receivable loans (people who owe us money - Point 7)
    const receivableLoans = useMemo(() => {
        return loans.filter(l => l.direction === 'receivable');
    }, [loans]);

    // Auto-select first partner if not chosen
    useEffect(() => {
        if (partners.length > 0 && selectedPartnerId === '') {
            setSelectedPartnerId(partners[0].id);
        }
    }, [partners, selectedPartnerId]);

    // Auto-select first receivable loan when in loan_out mode
    useEffect(() => {
        if (selectedType === 'loan_out') {
            if (receivableLoans.length > 0 && (selectedLoanId === '' || !receivableLoans.some(r => r.id === selectedLoanId))) {
                setSelectedLoanId(receivableLoans[0].id);
            }
        }
    }, [selectedType, receivableLoans, selectedLoanId]);

    // Auto-select first surplus fund if not chosen
    useEffect(() => {
        if (surplusFunds.length > 0 && selectedSurplusId === '') {
            setSelectedSurplusId(surplusFunds[0].id);
        }
    }, [surplusFunds, selectedSurplusId]);

    // Reset advance confirmation whenever type, partner, or amount changes
    useEffect(() => {
        setIsAdvanceConfirmed(false);
    }, [selectedType, selectedPartnerId, amount]);

    // When switching to capital_out, force existing partner
    useEffect(() => {
        if (selectedType === 'capital_out') {
            setIsNewPartner(false);
        }
    }, [selectedType]);

    // Parse amount to number
    const numericAmount = useMemo(() => {
        const cleaned = amount.replace(/,/g, '').trim();
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
    }, [amount]);

    // Active partner object
    const activePartner = useMemo(() => {
        return partners.find((p) => p.id === Number(selectedPartnerId)) || null;
    }, [partners, selectedPartnerId]);

    // Guardrail evaluation
    const isExceedingCapital = useMemo(() => {
        if (selectedType === 'capital_out' && activePartner && !isNewPartner) {
            return numericAmount > activePartner.net_equity;
        }
        return false;
    }, [selectedType, activePartner, isNewPartner, numericAmount]);

    const excessAmount = useMemo(() => {
        if (!activePartner || !isExceedingCapital) return 0;
        return numericAmount - activePartner.net_equity;
    }, [activePartner, isExceedingCapital, numericAmount]);

    // Live Preview Calculation
    const livePreview = useMemo(() => {
        if (numericAmount <= 0) return null;

        const formattedAmt = 'Rs. ' + numericAmount.toLocaleString('en-US');
        const methodStr = paymentMethod === 'cash' ? 'Cash (Galla)' : `Bank (${bankName})`;

        switch (selectedType) {
            case 'capital_in': {
                const partnerName = isNewPartner ? (newPartnerName.trim() || 'Naya Partner') : (activePartner?.name || 'Partner');
                const currentEq = isNewPartner ? 0 : (activePartner?.net_equity || 0);
                const newEq = currentEq + numericAmount;
                return `${methodStr} mein ${formattedAmt} jama honge. ${partnerName} ka sarmaya Rs. ${currentEq.toLocaleString('en-US')} se barh kar Rs. ${newEq.toLocaleString('en-US')} ho jayega.`;
            }
            case 'capital_out': {
                const partnerName = activePartner?.name || 'Partner';
                const currentEq = activePartner?.net_equity || 0;
                if (numericAmount <= currentEq) {
                    const newEq = currentEq - numericAmount;
                    return `${methodStr} se ${formattedAmt} nikaale jayenge. ${partnerName} ka sarmaya Rs. ${currentEq.toLocaleString('en-US')} se kam ho kar Rs. ${newEq.toLocaleString('en-US')} reh jayega.`;
                } else {
                    return `${methodStr} se ${formattedAmt} kam honge. ${partnerName} ka sarmaya 0 ho jayega aur Rs. ${excessAmount.toLocaleString('en-US')} unke zimme Advance baaqi rahega.`;
                }
            }
            case 'loan_in': {
                const party = loanPartyName.trim() || 'Lender';
                return `${methodStr} mein ${formattedAmt} qarza aayega. ${party} ka qarza hum ko wapas dena hai.`;
            }
            case 'loan_give': {
                const party = loanPartyName.trim() || 'Borrower';
                return `${methodStr} se ${formattedAmt} qarza diya jayega. ${party} se wapas lena record hoga.`;
            }
            case 'loan_out': {
                const chosenLoan = loans.find(l => l.id === Number(selectedLoanId));
                const party = chosenLoan?.lender_name || loanPartyName.trim() || 'Account';
                return `${methodStr} mein ${party} se ${formattedAmt} qarza wapas wasool hoga.`;
            }
            case 'surplus_out': {
                const party = surplusPartyName.trim() || 'Investment Scheme';
                return `${methodStr} se ${formattedAmt} sarmayakari ${party} mein invest ki jayegi.`;
            }
            case 'surplus_in': {
                const party = surplusFunds.find(s => s.id === Number(selectedSurplusId))?.fund_name || 'Investment Scheme';
                return `${party} se ${formattedAmt} sarmaya wapas ${methodStr} mein jama kiya jayega.`;
            }
            default:
                return null;
        }
    }, [selectedType, numericAmount, paymentMethod, bankName, activePartner, excessAmount, isNewPartner, newPartnerName, loanPartyName, surplusPartyName, loans, selectedLoanId, surplusFunds, selectedSurplusId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (numericAmount <= 0) {
            toast.error(isUrdu ? 'براہ کرم درست رقم درج کریں' : 'Barahe karam durust rakam enter karein.');
            return;
        }

        // Validate Partner
        if (category === 'partners') {
            if (selectedType === 'capital_in' && isNewPartner) {
                if (!newPartnerName.trim()) {
                    toast.error('Naye partner ka naam likhna lazmi hai.');
                    return;
                }
            } else if (!selectedPartnerId) {
                toast.error('Partner muntakhib karein.');
                return;
            }
        }

        // Validate Loan Party
        if (category === 'loans') {
            if (selectedType === 'loan_in' && !loanPartyName.trim()) {
                toast.error('Please enter lender name.');
                return;
            }
            if (selectedType === 'loan_give' && !loanPartyName.trim()) {
                toast.error('Please enter borrower name.');
                return;
            }
            if (selectedType === 'loan_out' && !selectedLoanId && !loanPartyName.trim()) {
                toast.error('Wapas karne wale ka khata chunein.');
                return;
            }
        }

        // Guardrail block check
        if (isExceedingCapital && !isAdvanceConfirmed) {
            toast.error('Capital se zyada nikaal rahe hain! Advance manzoor karein ya rakam kam karein.');
            return;
        }

        setIsSubmitting(true);

        const payload: Record<string, any> = {
            amount: numericAmount,
            payment_method: paymentMethod,
            bank_name: paymentMethod === 'bank' ? bankName : null,
            is_advance: isAdvanceConfirmed,
        };

        if (selectedType === 'capital_in') {
            payload.type = 'capital_in';
            if (isNewPartner) {
                payload.party_name = newPartnerName.trim();
                payload.profit_percentage = parseFloat(newPartnerProfitPct) || 10;
            } else {
                payload.partner_id = selectedPartnerId;
                payload.party_name = activePartner?.name || 'Partner';
            }
        } else if (selectedType === 'capital_out') {
            payload.type = 'capital_out';
            payload.partner_id = selectedPartnerId;
            payload.party_name = activePartner?.name || 'Partner';
        } else if (selectedType === 'loan_in') {
            payload.type = 'loan_in';
            payload.party_name = loanPartyName.trim();
        } else if (selectedType === 'loan_give') {
            payload.type = 'loan_give';
            payload.party_name = loanPartyName.trim();
        } else if (selectedType === 'loan_out') {
            payload.type = 'loan_recover';
            if (selectedLoanId) {
                payload.loan_id = selectedLoanId;
                const chosenLoan = loans.find(l => l.id === Number(selectedLoanId));
                payload.party_name = chosenLoan?.lender_name || 'Borrower';
            } else {
                payload.party_name = loanPartyName.trim();
            }
        } else if (selectedType === 'surplus_out') {
            payload.type = 'surplus_out';
            payload.party_name = surplusPartyName.trim() || 'Investment Fund';
        } else if (selectedType === 'surplus_in') {
            payload.type = 'surplus_in';
            payload.surplus_id = selectedSurplusId || (surplusFunds[0]?.id ?? null);
            payload.party_name = surplusFunds.find(s => s.id === Number(selectedSurplusId))?.fund_name || 'Investment Fund';
        }

        router.post('/investment/entry', payload, {
            preserveScroll: true,
            onSuccess: (page: any) => {
                const flash = page?.props?.flash;
                const lastEntry = flash?.last_entry;
                const toastMsg = flash?.success || (lastEntry
                    ? `Entry ${lastEntry.ref_no} save ho gayi. ${lastEntry.party} ka record update ho gaya.`
                    : 'Entry save ho gayi.');

                toast.success(toastMsg, {
                    duration: 10000,
                    action: lastEntry?.id ? {
                        label: 'Wapas karein (Undo)',
                        onClick: () => {
                            router.post(`/investment/undo/${lastEntry.id}`, {}, {
                                preserveScroll: true,
                                onSuccess: () => {
                                    toast.success(`Entry ${lastEntry.ref_no} mansookh kardi gayi.`);
                                },
                            });
                        },
                    } : undefined,
                });

                setIsSubmitting(false);
                setAmount('');
                setLoanPartyName('');
                setSurplusPartyName('');
                setNewPartnerName('');
                setIsNewPartner(false);
                setIsAdvanceConfirmed(false);
                onClose();
            },
            onError: (errs) => {
                setIsSubmitting(false);
                const firstMsg = Object.values(errs)[0];
                toast.error(firstMsg || 'Entry save nahi ho saki. Details check karein.');
            },
        });
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-xl overflow-y-auto p-0 bg-white font-sans text-[#1F2937] shadow-2xl [&>button]:text-white [&>button]:hover:text-emerald-100 [&>button]:hover:bg-emerald-800/60 [&>button]:p-1.5 [&>button]:rounded-lg [&>button]:top-4 [&>button]:right-4"
            >
                {/* Greenish Header (Point 12) */}
                <div className="sticky top-0 bg-[#14532d] text-white border-b border-emerald-800 px-6 py-4.5 z-10 shadow-sm">
                    <SheetHeader>
                        <SheetTitle className="text-xl font-bold text-white flex items-center gap-2.5">
                            <span className="p-1.5 rounded-lg bg-emerald-800/80 text-emerald-200">
                                <Icon name="Plus" className="size-4 stroke-[3]" />
                            </span>
                            <span>
                                {category === 'loans'
                                    ? 'New Loan Entry'
                                    : category === 'surplus'
                                        ? 'New Investment Entry'
                                        : 'Nayi Partner Entry'}
                            </span>
                        </SheetTitle>
                        <SheetDescription className="text-xs text-emerald-100/90 mt-0.5">
                            Sirf zaroori maloomat darj karein, khata khud ba khud update ho jayega.
                        </SheetDescription>
                    </SheetHeader>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Section 1: Transaction Qisam (Point 4: Clean label without number) */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-[#1F2937]">
                                Transaction Qisam
                            </label>
                            <span className="text-xs text-[#4B5563]">Ek option chunein</span>
                        </div>

                        {/* Partners Category: 2 simple options (Point 4) */}
                        {category === 'partners' && (
                            <div className="grid grid-cols-2 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setSelectedType('capital_in')}
                                    className={cn(
                                        "p-3.5 text-start rounded-xl border transition-all cursor-pointer flex flex-col justify-center",
                                        selectedType === 'capital_in'
                                            ? "border-[#14532d] bg-emerald-50 ring-1 ring-[#14532d]"
                                            : "border-gray-200 bg-white hover:bg-gray-50"
                                    )}
                                >
                                    <span className="text-xs font-bold text-[#1F2937] block">
                                        Capital Introduced (In)
                                    </span>
                                    <span className="text-[11px] text-[#4B5563] mt-0.5 leading-tight">
                                        Karobar mein cash dala
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSelectedType('capital_out')}
                                    className={cn(
                                        "p-3.5 text-start rounded-xl border transition-all cursor-pointer flex flex-col justify-center",
                                        selectedType === 'capital_out'
                                            ? "border-[#14532d] bg-emerald-50 ring-1 ring-[#14532d]"
                                            : "border-gray-200 bg-white hover:bg-gray-50"
                                    )}
                                >
                                    <span className="text-xs font-bold text-[#1F2937] block">
                                        Drawings (Capital Out)
                                    </span>
                                    <span className="text-[11px] text-[#4B5563] mt-0.5 leading-tight">
                                        Ghar ya zaati kharch ke liye
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* Loans Category: 3 simple options (Points 6 & 7) */}
                        {category === 'loans' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedType('loan_in')}
                                    className={cn(
                                        "p-3 text-start rounded-xl border transition-all cursor-pointer flex flex-col justify-center",
                                        selectedType === 'loan_in'
                                            ? "border-[#14532d] bg-emerald-50 ring-1 ring-[#14532d]"
                                            : "border-gray-200 bg-white hover:bg-gray-50"
                                    )}
                                >
                                    <span className="text-xs font-bold text-[#1F2937] block">
                                        Payable (Borrowed)
                                    </span>
                                    <span className="text-[11px] text-[#4B5563] mt-0.5 leading-tight">
                                        Borrowed from external source
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSelectedType('loan_give')}
                                    className={cn(
                                        "p-3 text-start rounded-xl border transition-all cursor-pointer flex flex-col justify-center",
                                        selectedType === 'loan_give'
                                            ? "border-[#14532d] bg-emerald-50 ring-1 ring-[#14532d]"
                                            : "border-gray-200 bg-white hover:bg-gray-50"
                                    )}
                                >
                                    <span className="text-xs font-bold text-[#1F2937] block">
                                        Receivable (Lent)
                                    </span>
                                    <span className="text-[11px] text-[#4B5563] mt-0.5 leading-tight">
                                        Lent to external party
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSelectedType('loan_out')}
                                    className={cn(
                                        "p-3 text-start rounded-xl border transition-all cursor-pointer flex flex-col justify-center",
                                        selectedType === 'loan_out'
                                            ? "border-[#14532d] bg-emerald-50 ring-1 ring-[#14532d]"
                                            : "border-gray-200 bg-white hover:bg-gray-50"
                                    )}
                                >
                                    <span className="text-xs font-bold text-[#1F2937] block">
                                        Loan Repayment
                                    </span>
                                    <span className="text-[11px] text-[#4B5563] mt-0.5 leading-tight">
                                        Repayment received
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* Surplus Category: 2 simple options */}
                        {category === 'surplus' && (
                            <div className="grid grid-cols-2 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setSelectedType('surplus_out')}
                                    className={cn(
                                        "p-3.5 text-start rounded-xl border transition-all cursor-pointer flex flex-col justify-center",
                                        selectedType === 'surplus_out'
                                            ? "border-[#14532d] bg-emerald-50 ring-1 ring-[#14532d]"
                                            : "border-gray-200 bg-white hover:bg-gray-50"
                                    )}
                                >
                                    <span className="text-xs font-bold text-[#1F2937] block">
                                        Investment Made
                                    </span>
                                    <span className="text-[11px] text-[#4B5563] mt-0.5 leading-tight">
                                        Invested in bank deposit / fund
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSelectedType('surplus_in')}
                                    className={cn(
                                        "p-3.5 text-start rounded-xl border transition-all cursor-pointer flex flex-col justify-center",
                                        selectedType === 'surplus_in'
                                            ? "border-[#14532d] bg-emerald-50 ring-1 ring-[#14532d]"
                                            : "border-gray-200 bg-white hover:bg-gray-50"
                                    )}
                                >
                                    <span className="text-xs font-bold text-[#1F2937] block">
                                        Investment Divestment / Return
                                    </span>
                                    <span className="text-[11px] text-[#4B5563] mt-0.5 leading-tight">
                                        Principal capital + profit returned
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Section 2: Partner / Party Selection (Clean labels without numbers - Point 4 & 7) */}
                    <div className="space-y-2.5">
                        {/* Partners Category */}
                        {category === 'partners' && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-[#1F2937]">
                                        {selectedType === 'capital_in' ? 'New Partner Add' : 'Select Partner (For Drawings)'}
                                    </label>
                                </div>

                                {selectedType === 'capital_out' ? (
                                    <div className="space-y-1.5">
                                        <select
                                            value={selectedPartnerId}
                                            onChange={(e) => setSelectedPartnerId(Number(e.target.value))}
                                            className="w-full h-11 px-3.5 text-sm font-medium text-[#1F2937] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all cursor-pointer"
                                        >
                                            {partners.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} ({p.role === 'owner' ? 'Owner' : 'Partner'}) — Net Equity: Rs. {p.net_equity.toLocaleString('en-US')}
                                                </option>
                                            ))}
                                        </select>
                                        {activePartner && (
                                            <p className="text-xs text-[#4B5563]">
                                                Current Approved Equity: <span className="font-bold text-[#14532d]">Rs. {activePartner.net_equity.toLocaleString('en-US')}</span>
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        <div className="sm:col-span-2">
                                            <input
                                                type="text"
                                                value={newPartnerName}
                                                onChange={(e) => setNewPartnerName(e.target.value)}
                                                placeholder="Partner name (e.g. Kamran Sb)"
                                                className="w-full h-11 px-3.5 text-sm font-medium text-[#1F2937] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all"
                                            />
                                        </div>
                                        <div>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={newPartnerProfitPct}
                                                    onChange={(e) => setNewPartnerProfitPct(e.target.value)}
                                                    placeholder="Share %"
                                                    min="0"
                                                    max="100"
                                                    className="w-full h-11 px-3.5 pe-8 text-sm font-bold text-[#1F2937] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all"
                                                />
                                                <span className="absolute end-3 top-3 text-xs font-bold text-gray-500">%</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Loans Category (Point 7) */}
                        {category === 'loans' && (
                            <div className="space-y-2">
                                {selectedType === 'loan_in' && (
                                    <div>
                                        <label className="text-sm font-bold text-[#1F2937] block mb-1.5">
                                            Lender Name (Borrowed From)
                                        </label>
                                        <input
                                            type="text"
                                            value={loanPartyName}
                                            onChange={(e) => setLoanPartyName(e.target.value)}
                                            placeholder="e.g. Tariq Sb, Haji Aslam, Bank Alfalah..."
                                            className="w-full h-11 px-3.5 text-sm font-medium text-[#1F2937] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all"
                                        />
                                        <p className="text-xs text-[#4B5563] mt-1">
                                            This loan will be recorded as a liability (Payable).
                                        </p>
                                    </div>
                                )}

                                {selectedType === 'loan_give' && (
                                    <div>
                                        <label className="text-sm font-bold text-[#1F2937] block mb-1.5">
                                            Borrower Name (Lent To)
                                        </label>
                                        <input
                                            type="text"
                                            value={loanPartyName}
                                            onChange={(e) => setLoanPartyName(e.target.value)}
                                            placeholder="e.g. Rashid Merchant, Farooq Farmer..."
                                            className="w-full h-11 px-3.5 text-sm font-medium text-[#1F2937] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all"
                                        />
                                        <p className="text-xs text-[#4B5563] mt-1">
                                            This loan will be recorded as an asset (Receivable).
                                        </p>
                                    </div>
                                )}

                                {selectedType === 'loan_out' && (
                                    <div>
                                        <label className="text-sm font-bold text-[#1F2937] block mb-1.5">
                                            Returned By (Select Account)
                                        </label>
                                        {receivableLoans.length > 0 ? (
                                            <select
                                                value={selectedLoanId}
                                                onChange={(e) => setSelectedLoanId(Number(e.target.value))}
                                                className="w-full h-11 px-3.5 text-sm font-medium text-[#1F2937] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all cursor-pointer"
                                            >
                                                {receivableLoans.map((l) => (
                                                    <option key={l.id} value={l.id}>
                                                        {l.lender_name} — Balance: Rs. {l.balance_due.toLocaleString('en-US')}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className="space-y-1.5">
                                                <input
                                                    type="text"
                                                    value={loanPartyName}
                                                    onChange={(e) => setLoanPartyName(e.target.value)}
                                                    placeholder="Party name returning payment (e.g. Rashid Merchant)"
                                                    className="w-full h-11 px-3.5 text-sm font-medium text-[#1F2937] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all"
                                                />
                                                <p className="text-xs text-[#4B5563]">
                                                    No existing receivable loan found. You can enter the party name directly.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Surplus Category */}
                        {category === 'surplus' && (
                            <div className="space-y-2">
                                {selectedType === 'surplus_out' ? (
                                    <div>
                                        <label className="text-sm font-bold text-[#1F2937] block mb-1.5">
                                            Destination (Bank / Fund Name)
                                        </label>
                                        <input
                                            type="text"
                                            value={surplusPartyName}
                                            onChange={(e) => setSurplusPartyName(e.target.value)}
                                            placeholder="e.g. Meezan Bank Ltd (15-Day Term Deposit)"
                                            className="w-full h-11 px-3.5 text-sm font-medium text-[#1F2937] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="text-sm font-bold text-[#1F2937] block mb-1.5">
                                            Select Fund
                                        </label>
                                        <select
                                            value={selectedSurplusId}
                                            onChange={(e) => setSelectedSurplusId(Number(e.target.value))}
                                            className="w-full h-11 px-3.5 text-sm font-medium text-[#1F2937] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all cursor-pointer"
                                        >
                                            {surplusFunds.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.fund_name} — Principal: Rs. {s.principal_amount.toLocaleString('en-US')}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Section 3: Rakam aur Adayegi (Point 4: Clean label without numbers) */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-[#1F2937] block">
                            Amount & Payment
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                            {/* Amount input */}
                            <div>
                                <label className="text-xs font-semibold text-[#374151] block mb-1">
                                    Amount (Rs.)
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="e.g. 350,000"
                                    className={cn(
                                        "w-full h-11 px-3.5 text-base font-bold text-[#1F2937] bg-white border rounded-lg focus:outline-none focus:ring-2 transition-all",
                                        isExceedingCapital && !isAdvanceConfirmed
                                            ? "border-red-500 focus:ring-red-500 text-red-900"
                                            : "border-gray-300 focus:ring-[#14532d] focus:border-[#14532d]"
                                    )}
                                />
                                {numericAmount > 0 && (
                                    <p className="text-xs font-bold text-[#14532d] mt-1">
                                        Rs. {numericAmount.toLocaleString('en-US')}
                                    </p>
                                )}
                            </div>

                            {/* Cash / Bank Toggle */}
                            <div>
                                <label className="text-xs font-semibold text-[#374151] block mb-1">
                                    Payment Channel
                                </label>
                                <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 rounded-lg border border-gray-300">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('cash')}
                                        className={cn(
                                            "min-h-[36px] text-xs font-bold rounded-md transition-all cursor-pointer",
                                            paymentMethod === 'cash'
                                                ? "bg-[#14532d] text-white shadow-xs"
                                                : "text-[#374151] hover:text-[#1F2937]"
                                        )}
                                    >
                                        Cash (Register)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('bank')}
                                        className={cn(
                                            "min-h-[36px] text-xs font-bold rounded-md transition-all cursor-pointer",
                                            paymentMethod === 'bank'
                                                ? "bg-[#14532d] text-white shadow-xs"
                                                : "text-[#374151] hover:text-[#1F2937]"
                                        )}
                                    >
                                        Bank Account
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Bank selector when bank is chosen */}
                        {paymentMethod === 'bank' && (
                            <div className="pt-1">
                                <label className="text-xs font-semibold text-[#374151] block mb-1">
                                    Select Bank Account
                                </label>
                                <select
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                    className="w-full h-11 px-3.5 text-xs font-medium text-[#1F2937] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all cursor-pointer"
                                >
                                    {bankAccounts.map((b) => (
                                        <option key={b} value={b}>
                                            {b}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Guardrail Alert: Capital se zyada drawing */}
                    {isExceedingCapital && (
                        <div className={cn(
                            "p-4 rounded-xl border space-y-3 transition-all",
                            isAdvanceConfirmed
                                ? "bg-emerald-50 border-emerald-300"
                                : "bg-amber-50 border-amber-300 text-amber-950"
                        )}>
                            <div className="flex items-start gap-2.5">
                                <Icon
                                    name={isAdvanceConfirmed ? "CheckCircle" : "WarningCircle"}
                                    className={cn(
                                        "size-5 shrink-0 mt-0.5",
                                        isAdvanceConfirmed ? "text-emerald-700" : "text-amber-700"
                                    )}
                                />
                                <div className="space-y-1">
                                    <h4 className="text-xs font-bold text-[#1F2937]">
                                        {isAdvanceConfirmed
                                            ? 'Advance Payment Approved'
                                            : 'Withdrawal exceeds available capital!'}
                                    </h4>
                                    <p className="text-xs text-[#374151] leading-relaxed">
                                        {activePartner?.name}'s capital is <span className="font-bold text-[#1F2937]">Rs. {activePartner?.net_equity.toLocaleString('en-US')}</span>. You are withdrawing <span className="font-bold text-[#1F2937]">Rs. {numericAmount.toLocaleString('en-US')}</span>, which exceeds equity by <span className="font-black text-red-700">Rs. {excessAmount.toLocaleString('en-US')}</span>.
                                        {!isAdvanceConfirmed && ` Record this excess Rs. ${excessAmount.toLocaleString('en-US')} as an Advance loan to ${activePartner?.name}?`}
                                    </p>
                                </div>
                            </div>

                            {!isAdvanceConfirmed ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setIsAdvanceConfirmed(true)}
                                        className="min-h-[40px] px-3.5 py-2 text-xs font-bold rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-[#1F2937] shadow-2xs cursor-pointer text-center"
                                    >
                                        Yes, approve as Advance
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (activePartner) {
                                                setAmount(activePartner.net_equity.toString());
                                            }
                                        }}
                                        className="min-h-[40px] px-3.5 py-2 text-xs font-medium rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-[#374151] shadow-2xs cursor-pointer text-center"
                                    >
                                        No, reduce amount
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between text-xs text-emerald-900 pt-1 font-semibold">
                                    <span>Rs. {excessAmount.toLocaleString('en-US')} will be recorded as Advance.</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsAdvanceConfirmed(false)}
                                        className="underline text-[#4B5563] hover:text-[#1F2937] cursor-pointer text-[11px]"
                                    >
                                        Cancel Advance
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Live Preview Box */}
                    {livePreview && (
                        <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-[#374151] space-y-1">
                            <span className="font-bold text-[#1F2937] block text-[11px] uppercase tracking-wide">
                                Account Impact (Live Preview):
                            </span>
                            <p className="leading-relaxed font-medium">
                                {livePreview}
                            </p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 min-h-[44px] px-4 py-2 text-sm font-semibold text-[#374151] bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || (isExceedingCapital && !isAdvanceConfirmed)}
                            className={cn(
                                "flex-1 min-h-[44px] px-4 py-2 text-sm font-bold text-white rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer",
                                isSubmitting || (isExceedingCapital && !isAdvanceConfirmed)
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    : "bg-[#14532d] hover:bg-[#166534] active:bg-[#0f3d21]"
                            )}
                        >
                            {isSubmitting ? (
                                <span>Saving...</span>
                            ) : (
                                <span>Save Entry</span>
                            )}
                        </button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
