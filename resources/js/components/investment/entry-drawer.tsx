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
    partners,
    loans,
    surplusFunds,
    bankAccounts,
    isUrdu = false,
}: EntryDrawerProps) {
    // Step 1: Type
    const [selectedType, setSelectedType] = useState<EntryType>('capital_in');

    // Step 2: Party
    const [selectedPartnerId, setSelectedPartnerId] = useState<number | ''>('');
    const [selectedLoanId, setSelectedLoanId] = useState<number | ''>('');
    const [selectedSurplusId, setSelectedSurplusId] = useState<number | ''>('');
    const [partyNameInput, setPartyNameInput] = useState<string>('');

    // Step 3: Amount & Payment Method
    const [amount, setAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
    const [bankName, setBankName] = useState<string>(bankAccounts[0] || 'Meezan Bank Ltd');

    // Step 4: Note
    const [reason, setReason] = useState<string>('');

    // Guardrail state
    const [isAdvanceConfirmed, setIsAdvanceConfirmed] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Auto-select first partner if not chosen
    useEffect(() => {
        if (partners.length > 0 && selectedPartnerId === '') {
            setSelectedPartnerId(partners[0].id);
        }
    }, [partners, selectedPartnerId]);

    // Auto-select first loan if not chosen
    useEffect(() => {
        if (loans.length > 0 && selectedLoanId === '') {
            setSelectedLoanId(loans[0].id);
        }
    }, [loans, selectedLoanId]);

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
        if (selectedType === 'capital_out' && activePartner) {
            return numericAmount > activePartner.net_equity;
        }
        return false;
    }, [selectedType, activePartner, numericAmount]);

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
                const partnerName = activePartner?.name || 'Partner';
                const currentEq = activePartner?.net_equity || 0;
                const newEq = currentEq + numericAmount;
                return `${methodStr} mein ${formattedAmt} jama honge. ${partnerName} ka capital Rs. ${currentEq.toLocaleString('en-US')} se barh kar Rs. ${newEq.toLocaleString('en-US')} ho jayega.`;
            }
            case 'capital_out': {
                const partnerName = activePartner?.name || 'Partner';
                const currentEq = activePartner?.net_equity || 0;
                if (numericAmount <= currentEq) {
                    const newEq = currentEq - numericAmount;
                    return `${methodStr} se ${formattedAmt} nikaale jayenge. ${partnerName} ka capital Rs. ${currentEq.toLocaleString('en-US')} se kam ho kar Rs. ${newEq.toLocaleString('en-US')} reh jayega.`;
                } else {
                    return `${methodStr} se ${formattedAmt} kam honge. ${partnerName} ka capital Rs. ${currentEq.toLocaleString('en-US')} se 0 ho jayega, aur Rs. ${excessAmount.toLocaleString('en-US')} unke zimme (Advance) baaqi rahenge.`;
                }
            }
            case 'loan_in': {
                const party = partyNameInput || 'Lender';
                return `${methodStr} mein ${formattedAmt} qarza aayega. Mandi account par ${party} ka qarza واجب الادا (Hum ko wapas dena hai) record hoga.`;
            }
            case 'loan_give': {
                const party = partyNameInput || 'Borrower';
                return `${methodStr} se ${formattedAmt} qarza diya jayega. ${party} ke zimme واجب الوصول (Hum ko wapas lena hai) record hoga.`;
            }
            case 'loan_out': {
                const chosenLoan = loans.find(l => l.id === Number(selectedLoanId));
                const party = chosenLoan?.lender_name || partyNameInput || 'Loan Account';
                const isReceivable = chosenLoan?.direction === 'receivable';
                if (isReceivable) {
                    return `${methodStr} mein ${formattedAmt} qarza wapas wasool hoga. ${party} ka baqaya qarza kam ho jayega.`;
                } else {
                    return `${methodStr} se ${formattedAmt} qarza wapas ada kiya jayega. ${party} ka baqaya qarza kam ho jayega.`;
                }
            }
            case 'surplus_out': {
                const party = partyNameInput || 'Investment Scheme';
                return `${methodStr} se ${formattedAmt} sarmayakari ${party} mein invest ki jayegi.`;
            }
            case 'surplus_in': {
                const party = surplusFunds.find(s => s.id === Number(selectedSurplusId))?.fund_name || 'Investment Scheme';
                return `${party} se ${formattedAmt} sarmaya wapas ${methodStr} mein jama kiya jayega.`;
            }
            default:
                return null;
        }
    }, [selectedType, numericAmount, paymentMethod, bankName, activePartner, excessAmount, partyNameInput, loans, selectedLoanId, surplusFunds, selectedSurplusId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (numericAmount <= 0) {
            toast.error(isUrdu ? 'براہ کرم درست رقم درج کریں' : 'Barahe karam durust rakam enter karein.');
            return;
        }

        // Guardrail block check
        if (isExceedingCapital && !isAdvanceConfirmed) {
            toast.error(
                isUrdu
                    ? 'کیپیٹل سے زیادہ رقم نکالنے کے لیے ایڈوانس کنفرم کریں یا رقم کم کریں'
                    : 'Capital se zyada nikaal rahe hain! Haan, Advance banayein par click karein ya rakam kam karein.'
            );
            return;
        }

        setIsSubmitting(true);

        const payload: Record<string, any> = {
            amount: numericAmount,
            payment_method: paymentMethod,
            bank_name: paymentMethod === 'bank' ? bankName : null,
            reason: reason.trim() || null,
            is_advance: isAdvanceConfirmed,
        };

        if (selectedType === 'capital_in' || selectedType === 'capital_out') {
            payload.type = selectedType;
            payload.partner_id = selectedPartnerId;
            payload.party_name = activePartner?.name || 'Partner';
        } else if (selectedType === 'loan_in') {
            payload.type = 'loan_in';
            payload.party_name = partyNameInput.trim() || 'Mandi Lender';
        } else if (selectedType === 'loan_give') {
            payload.type = 'loan_give';
            payload.party_name = partyNameInput.trim() || 'Borrower';
        } else if (selectedType === 'loan_out') {
            const chosenLoan = loans.find(l => l.id === Number(selectedLoanId));
            payload.type = chosenLoan?.direction === 'receivable' ? 'loan_recover' : 'loan_out';
            payload.loan_id = selectedLoanId || (loans[0]?.id ?? null);
            payload.party_name = chosenLoan?.lender_name || partyNameInput || 'Lender';
        } else if (selectedType === 'surplus_out') {
            payload.type = 'surplus_out';
            payload.party_name = partyNameInput.trim() || 'Investment Fund';
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
                    ? `Entry ${lastEntry.ref_no} save ho gayi. ${lastEntry.party} ka baaki update ho gaya.`
                    : 'Entry save ho gayi.');

                toast.success(toastMsg, {
                    duration: 10000,
                    action: lastEntry?.id ? {
                        label: 'Wapas karein (Undo)',
                        onClick: () => {
                            router.post(`/investment/undo/${lastEntry.id}`, {}, {
                                preserveScroll: true,
                                onSuccess: () => {
                                    toast.success(`Entry ${lastEntry.ref_no} undo (mansookh) kardi gayi.`);
                                },
                            });
                        },
                    } : undefined,
                });

                setIsSubmitting(false);
                setAmount('');
                setReason('');
                setPartyNameInput('');
                setIsAdvanceConfirmed(false);
                onClose();
            },
            onError: (errs) => {
                setIsSubmitting(false);
                const firstMsg = Object.values(errs)[0];
                toast.error(firstMsg || (isUrdu ? 'اینٹری محفوظ نہیں ہو سکی' : 'Entry save nahi ho saki. Check details.'));
            },
        });
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-xl overflow-y-auto p-0 bg-white font-sans text-[#1F2937] shadow-2xl"
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
                    <SheetHeader>
                        <SheetTitle className="text-xl font-bold text-[#1F2937] flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-emerald-100 text-[#14532d]">
                                <Icon name="Plus" className="size-4 stroke-[3]" />
                            </span>
                            <span>{isUrdu ? 'نئی اینٹری' : 'Nayi Entry'}</span>
                        </SheetTitle>
                        <SheetDescription className="text-xs text-[#4B5563]">
                            {isUrdu ? 'صرف ضروری معلومات درج کریں، کھاتہ خود بخود اپ ڈیٹ ہو جائے گا۔' : 'Sirf zaroori maloomat darj karein, khata khud ba khud update ho jayega.'}
                        </SheetDescription>
                    </SheetHeader>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Step 1: Kya hua? (Clean Categorized Sections) */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-[#1F2937]">
                                {isUrdu ? '1. کیا ہوا؟ (اینٹری کی قسم)' : '1. Kya hua? (Transaction Qisam)'}
                            </label>
                            <span className="text-xs text-[#4B5563]">Ek option chunein</span>
                        </div>

                        {/* Category A: Partners / Sarmaya */}
                        <div className="space-y-1.5">
                            <span className="text-[11px] font-bold text-[#374151] tracking-wider uppercase block">
                                Partners / Hissedar (Sarmaya)
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedType('capital_in')}
                                    className={cn(
                                        "p-3 text-start rounded-xl border transition-all cursor-pointer flex flex-col justify-center",
                                        selectedType === 'capital_in'
                                            ? "border-[#14532d] bg-emerald-50 ring-1 ring-[#14532d]"
                                            : "border-gray-200 bg-white hover:bg-gray-50"
                                    )}
                                >
                                    <span className="text-xs font-bold text-[#1F2937] block">
                                        Paisa Lagaya (Capital In)
                                    </span>
                                    <span className="text-[11px] text-[#4B5563] mt-0.5 leading-tight">
                                        Partner ne karobar mein cash dala
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSelectedType('capital_out')}
                                    className={cn(
                                        "p-3 text-start rounded-xl border transition-all cursor-pointer flex flex-col justify-center",
                                        selectedType === 'capital_out'
                                            ? "border-[#14532d] bg-emerald-50 ring-1 ring-[#14532d]"
                                            : "border-gray-200 bg-white hover:bg-gray-50"
                                    )}
                                >
                                    <span className="text-xs font-bold text-[#1F2937] block">
                                        Paisa Nikala (Drawings)
                                    </span>
                                    <span className="text-[11px] text-[#4B5563] mt-0.5 leading-tight">
                                        Ghar ya zaati kharch ke liye liya
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Category B: Qarza (Loans) */}
                        <div className="space-y-1.5 pt-1">
                            <span className="text-[11px] font-bold text-[#374151] tracking-wider uppercase block">
                                Qarza (Loans)
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedType('loan_in')}
                                    className={cn(
                                        "p-2.5 text-start rounded-xl border transition-all cursor-pointer flex flex-col justify-center",
                                        selectedType === 'loan_in'
                                            ? "border-[#14532d] bg-emerald-50 ring-1 ring-[#14532d]"
                                            : "border-gray-200 bg-white hover:bg-gray-50"
                                    )}
                                >
                                    <span className="text-xs font-bold text-[#1F2937] block">
                                        Qarza Liya (Dena Hai)
                                    </span>
                                    <span className="text-[11px] text-[#4B5563] mt-0.5 leading-tight">
                                        Bahar se udhaar liya
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSelectedType('loan_give')}
                                    className={cn(
                                        "p-2.5 text-start rounded-xl border transition-all cursor-pointer flex flex-col justify-center",
                                        selectedType === 'loan_give'
                                            ? "border-[#14532d] bg-emerald-50 ring-1 ring-[#14532d]"
                                            : "border-gray-200 bg-white hover:bg-gray-50"
                                    )}
                                >
                                    <span className="text-xs font-bold text-[#1F2937] block">
                                        Qarza Diya (Lena Hai)
                                    </span>
                                    <span className="text-[11px] text-[#4B5563] mt-0.5 leading-tight">
                                        Kisi ko udhaar diya
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSelectedType('loan_out')}
                                    className={cn(
                                        "p-2.5 text-start rounded-xl border transition-all cursor-pointer flex flex-col justify-center",
                                        selectedType === 'loan_out'
                                            ? "border-[#14532d] bg-emerald-50 ring-1 ring-[#14532d]"
                                            : "border-gray-200 bg-white hover:bg-gray-50"
                                    )}
                                >
                                    <span className="text-xs font-bold text-[#1F2937] block">
                                        Qarza Wapas (Return)
                                    </span>
                                    <span className="text-[11px] text-[#4B5563] mt-0.5 leading-tight">
                                        Liya hua diya / Wasool kiya
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Category C: Sarmayakari (Investments) */}
                        <div className="space-y-1.5 pt-1">
                            <span className="text-[11px] font-bold text-[#374151] tracking-wider uppercase block">
                                Sarmayakari (Investments & Funds)
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedType('surplus_out')}
                                    className={cn(
                                        "p-3 text-start rounded-xl border transition-all cursor-pointer flex flex-col justify-center",
                                        selectedType === 'surplus_out'
                                            ? "border-[#14532d] bg-emerald-50 ring-1 ring-[#14532d]"
                                            : "border-gray-200 bg-white hover:bg-gray-50"
                                    )}
                                >
                                    <span className="text-xs font-bold text-[#1F2937] block">
                                        Sarmayakari Mein Lagaya
                                    </span>
                                    <span className="text-[11px] text-[#4B5563] mt-0.5 leading-tight">
                                        Fund ya bachat mein lagaya
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSelectedType('surplus_in')}
                                    className={cn(
                                        "p-3 text-start rounded-xl border transition-all cursor-pointer flex flex-col justify-center",
                                        selectedType === 'surplus_in'
                                            ? "border-[#14532d] bg-emerald-50 ring-1 ring-[#14532d]"
                                            : "border-gray-200 bg-white hover:bg-gray-50"
                                    )}
                                >
                                    <span className="text-xs font-bold text-[#1F2937] block">
                                        Sarmayakari Se Wapsi
                                    </span>
                                    <span className="text-[11px] text-[#4B5563] mt-0.5 leading-tight">
                                        Asal sarmaya + munafa mila
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Kis ke saath? */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[#1F2937] block">
                            {isUrdu ? '2. کس کے ساتھ؟ (پارٹی / کھاتہ)' : '2. Kis ke saath? (Party / Khata)'}
                        </label>

                        {/* Capital In / Out: Select Partner */}
                        {(selectedType === 'capital_in' || selectedType === 'capital_out') && (
                            <div className="space-y-1.5">
                                <select
                                    value={selectedPartnerId}
                                    onChange={(e) => setSelectedPartnerId(Number(e.target.value))}
                                    className="w-full h-11 px-3.5 text-sm font-medium text-[#1F2937] bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] focus:bg-white transition-all cursor-pointer"
                                >
                                    {partners.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.role === 'owner' ? 'Owner / Malik' : 'Partner / Shareek'}) — Net Equity: Rs. {p.net_equity.toLocaleString('en-US')}
                                        </option>
                                    ))}
                                </select>
                                {activePartner && (
                                    <p className="text-xs text-[#374151]">
                                        Mawjooda Capital (Net Equity): <span className="font-bold text-[#1F2937]">Rs. {activePartner.net_equity.toLocaleString('en-US')}</span>
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Loan In (Qarza Liya - Dena hai): Enter lender name */}
                        {selectedType === 'loan_in' && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-[#374151] block">
                                    Qarza dene wale ka naam (Mandi Lender):
                                </label>
                                <input
                                    type="text"
                                    value={partyNameInput}
                                    onChange={(e) => setPartyNameInput(e.target.value)}
                                    placeholder="Maslan: Tariq Sb, Haji Aslam, Bank Alfalah..."
                                    className="w-full h-11 px-3.5 text-sm font-medium text-[#1F2937] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all"
                                />
                                <p className="text-xs text-[#4B5563]">
                                    Yeh qarza aap par wajib-ul-ada (Hum ko wapas dena hai) record hoga.
                                </p>
                            </div>
                        )}

                        {/* Loan Give (Qarza Diya - Lena hai): Enter borrower name */}
                        {selectedType === 'loan_give' && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-[#374151] block">
                                    Qarza lene wale ka naam (Borrower):
                                </label>
                                <input
                                    type="text"
                                    value={partyNameInput}
                                    onChange={(e) => setPartyNameInput(e.target.value)}
                                    placeholder="Maslan: Rashid Bhai (Merchant), Farooq Farmer..."
                                    className="w-full h-11 px-3.5 text-sm font-medium text-[#1F2937] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all"
                                />
                                <p className="text-xs text-[#4B5563]">
                                    Yeh qarza party ke zimme واجب الوصول (Hum ko wapas lena hai) record hoga.
                                </p>
                            </div>
                        )}

                        {/* Loan Out / Repayment: Choose from active loans */}
                        {selectedType === 'loan_out' && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-[#374151] block">
                                    Wapas karne ya wasool karne wala qarza chunein:
                                </label>
                                <select
                                    value={selectedLoanId}
                                    onChange={(e) => setSelectedLoanId(Number(e.target.value))}
                                    className="w-full h-11 px-3.5 text-sm font-medium text-[#1F2937] bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] focus:bg-white transition-all cursor-pointer"
                                >
                                    <option value="">Qarza account muntakhib karein...</option>
                                    {loans.map((l) => (
                                        <option key={l.id} value={l.id}>
                                            {l.lender_name} — {l.direction === 'receivable' ? '[Hum ko Lena Hai]' : '[Hum ko Dena Hai]'} — Baqaya Due: Rs. {l.balance_due.toLocaleString('en-US')}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Surplus Out: Enter fund name */}
                        {selectedType === 'surplus_out' && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-[#374151] block">
                                    Fund / Scheme ka naam:
                                </label>
                                <input
                                    type="text"
                                    value={partyNameInput}
                                    onChange={(e) => setPartyNameInput(e.target.value)}
                                    placeholder="Maslan: Meezan 15-day Term, Gold Savings, National Savings..."
                                    className="w-full h-11 px-3.5 text-sm font-medium text-[#1F2937] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all"
                                />
                            </div>
                        )}

                        {/* Surplus In: Choose from active funds */}
                        {selectedType === 'surplus_in' && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-[#374151] block">
                                    Active Fund muntakhib karein:
                                </label>
                                <select
                                    value={selectedSurplusId}
                                    onChange={(e) => setSelectedSurplusId(Number(e.target.value))}
                                    className="w-full h-11 px-3.5 text-sm font-medium text-[#1F2937] bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] focus:bg-white transition-all cursor-pointer"
                                >
                                    <option value="">Active Fund chunein...</option>
                                    {surplusFunds.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.fund_name} — Asal: Rs. {s.principal_amount.toLocaleString('en-US')} (Kul Wapsi: Rs. {s.total_return.toLocaleString('en-US')})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Step 3: Kitna aur kaise? */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-[#1F2937] block">
                            {isUrdu ? '3. کتنا اور کیسے؟ (رقم اور ادائیگی)' : '3. Kitna aur kaise? (Rakam & Payment)'}
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                            {/* Amount input */}
                            <div>
                                <label className="text-xs font-semibold text-[#374151] block mb-1">
                                    {isUrdu ? 'رقم (روپے)' : 'Rakam (Rs.)'}
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="Maslan: 350,000"
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
                                    {isUrdu ? 'کہاں سے / کہاں' : 'Kahan se / kahan'}
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
                                        Cash (Galla)
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
                                    {isUrdu ? 'بینک اکاؤنٹ منتخب کریں' : 'Bank Account chunein'}
                                </label>
                                <select
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                    className="w-full h-11 px-3.5 text-xs font-medium text-[#1F2937] bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] focus:bg-white transition-all cursor-pointer"
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

                    {/* Step 4: Note (optional) */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-[#1F2937] block">
                            {isUrdu ? '4. نوٹ / وجہ (اختیاری)' : '4. Note / Wajah (Ikhtiyari)'}
                        </label>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Maslan: Ghar ka kharch, Season ka stock, Mandi loan, etc."
                            className="w-full h-11 px-3.5 text-sm font-medium text-[#1F2937] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all"
                        />
                    </div>

                    {/* GUARDRAIL ALERT BANNER: Capital se zyada nikaala ja raha hai */}
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
                                            ? 'Advance Payment Manzoor Kar Li Gai Hai'
                                            : 'Capital se zyada nikaala ja raha hai!'}
                                    </h4>
                                    <p className="text-xs text-[#374151] leading-relaxed">
                                        {activePartner?.name} ka capital <span className="font-bold text-[#1F2937]">Rs. {activePartner?.net_equity.toLocaleString('en-US')}</span> hai. Aap <span className="font-bold text-[#1F2937]">Rs. {numericAmount.toLocaleString('en-US')}</span> nikaal rahe hain, yani <span className="font-black text-red-700">Rs. {excessAmount.toLocaleString('en-US')}</span> zyada.
                                        {!isAdvanceConfirmed && ` Ye Rs. ${excessAmount.toLocaleString('en-US')} ${activePartner?.name} par udhaar (Advance) likhein?`}
                                    </p>
                                </div>
                            </div>

                            {/* Guardrail Choice Buttons */}
                            {!isAdvanceConfirmed ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setIsAdvanceConfirmed(true)}
                                        className="min-h-[44px] px-3.5 py-2 text-xs font-bold rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-[#1F2937] shadow-xs cursor-pointer text-center"
                                    >
                                        Haan, Advance banayein
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (activePartner) {
                                                setAmount(activePartner.net_equity.toString());
                                            }
                                        }}
                                        className="min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-[#374151] shadow-xs cursor-pointer text-center"
                                    >
                                        Nahi, rakam kam karein
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between text-xs text-emerald-900 pt-1 font-semibold">
                                    <span>Rs. {excessAmount.toLocaleString('en-US')} Advance record kiya jayega.</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsAdvanceConfirmed(false)}
                                        className="underline text-[#4B5563] hover:text-[#1F2937] cursor-pointer text-[11px]"
                                    >
                                        Advance cancel karein
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* LIVE PREVIEW BOX */}
                    {livePreview && (
                        <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-[#374151] space-y-1">
                            <span className="font-bold text-[#1F2937] block text-[11px] uppercase tracking-wide">
                                {isUrdu ? 'کھاتہ پر اثر (Live Preview)' : 'Khata Par Asar (Live Preview):'}
                            </span>
                            <p className="leading-relaxed font-medium">
                                {livePreview}
                            </p>
                        </div>
                    )}

                    {/* Submit and Cancel Buttons */}
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 min-h-[44px] px-4 py-2 text-sm font-semibold text-[#374151] bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                        >
                            {isUrdu ? 'منسوخ' : 'Mansookh (Cancel)'}
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || (isExceedingCapital && !isAdvanceConfirmed)}
                            className={cn(
                                "flex-1 min-h-[44px] px-4 py-2 text-sm font-bold text-white rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer",
                                isSubmitting || (isExceedingCapital && !isAdvanceConfirmed)
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    : "bg-[#14532d] hover:bg-[#166534] active:bg-[#0f3d21]"
                            )}
                        >
                            {isSubmitting ? (
                                <span>{isUrdu ? 'محفوظ ہو رہا ہے...' : 'Save ho raha hai...'}</span>
                            ) : (
                                <span>{isUrdu ? 'اینٹری محفوظ کریں' : 'Entry Save Karein'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
