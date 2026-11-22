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
        const methodStr = paymentMethod === 'cash' ? 'Cash' : `Bank (${bankName})`;

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
                return `${methodStr} mein ${formattedAmt} qarza aayega. Mandi account par ${party} ka qarza wajib-ul-ada (Payable) record hoga.`;
            }
            case 'loan_out': {
                const party = loans.find(l => l.id === Number(selectedLoanId))?.lender_name || partyNameInput || 'Lender';
                return `${methodStr} se ${formattedAmt} ada kiye jayenge. ${party} ka qarza balance kam ho jayega.`;
            }
            case 'surplus_out': {
                const party = partyNameInput || surplusFunds.find(s => s.id === Number(selectedSurplusId))?.fund_name || 'Surplus Fund';
                return `${methodStr} se ${formattedAmt} faltu rakam ${party} mein invest ki jayegi.`;
            }
            case 'surplus_in': {
                const party = surplusFunds.find(s => s.id === Number(selectedSurplusId))?.fund_name || 'Surplus Fund';
                return `${party} se ${formattedAmt} wapas ${methodStr} mein jama kiye jayenge.`;
            }
            default:
                return null;
        }
    }, [selectedType, numericAmount, paymentMethod, bankName, activePartner, excessAmount, partyNameInput, loans, selectedLoanId, surplusFunds, selectedSurplusId]);

    const entryTypeOptions: { type: EntryType; title: string; subtitle: string; icon: string }[] = [
        {
            type: 'capital_in',
            title: isUrdu ? 'پیسہ لگایا' : 'Paisa Lagaya (Capital In)',
            subtitle: isUrdu ? 'پارٹنر نے کیش دیا' : 'Partner ne karobar mein cash lagaya',
            icon: 'ArrowDownLeft',
        },
        {
            type: 'capital_out',
            title: isUrdu ? 'پیسہ نکالا' : 'Paisa Nikala (Drawings)',
            subtitle: isUrdu ? 'گھر یا ذاتی خرچ' : 'Ghar ya zaati kharch ke liye liya',
            icon: 'ArrowUpRight',
        },
        {
            type: 'loan_in',
            title: isUrdu ? 'قرضہ لیا' : 'Qarza Liya (Short-Term Loan)',
            subtitle: isUrdu ? 'منڈی کے لیے ادھار' : 'Mandi ke liye bahar se qarza liya',
            icon: 'HandCoins',
        },
        {
            type: 'loan_out',
            title: isUrdu ? 'قرضہ واپس کیا' : 'Qarza Wapas Kiya (Loan Return)',
            subtitle: isUrdu ? 'لیا ہوا پیسہ لوٹایا' : 'Lender ko qarza wapas lauta diya',
            icon: 'Handshake',
        },
        {
            type: 'surplus_out',
            title: isUrdu ? 'فالتو پیسہ لگایا' : 'Faltu Paisa Lagaya (Surplus In)',
            subtitle: isUrdu ? 'فنڈ یا بچت میں' : 'Faltu paisa kisi fund ya bachath mein lagaya',
            icon: 'TrendUp',
        },
        {
            type: 'surplus_in',
            title: isUrdu ? 'انویسٹمنٹ واپس آیا' : 'Investment Wapas Aaya (Return)',
            subtitle: isUrdu ? 'اصل رقم + منافع' : 'Asal sarmaya aur munafa wapas mila',
            icon: 'Vault',
        },
    ];

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
            type: selectedType,
            amount: numericAmount,
            payment_method: paymentMethod,
            bank_name: paymentMethod === 'bank' ? bankName : null,
            reason: reason.trim() || null,
            is_advance: isAdvanceConfirmed,
        };

        if (selectedType === 'capital_in' || selectedType === 'capital_out') {
            payload.partner_id = selectedPartnerId;
            payload.party_name = activePartner?.name || 'Partner';
        } else if (selectedType === 'loan_in') {
            payload.party_name = partyNameInput || 'Ahmed Lender';
        } else if (selectedType === 'loan_out') {
            payload.loan_id = selectedLoanId || (loans[0]?.id ?? null);
            payload.party_name = loans.find(l => l.id === Number(selectedLoanId))?.lender_name || partyNameInput || 'Lender';
        } else if (selectedType === 'surplus_out') {
            payload.party_name = partyNameInput || 'General Fund';
        } else if (selectedType === 'surplus_in') {
            payload.surplus_id = selectedSurplusId || (surplusFunds[0]?.id ?? null);
            payload.party_name = surplusFunds.find(s => s.id === Number(selectedSurplusId))?.fund_name || 'Surplus Fund';
        }

        router.post('/investment/entry', payload, {
            preserveScroll: true,
            onSuccess: (page: any) => {
                const flash = page?.props?.flash;
                const lastEntry = flash?.last_entry;
                const toastMsg = lastEntry
                    ? `Entry ${lastEntry.ref_no} save ho gayi. Baqaya update ho gaya.`
                    : 'Entry save ho gayi. Baqaya update ho gaya.';

                toast.success(toastMsg, {
                    duration: 10000,
                    action: lastEntry?.id ? {
                        label: 'Undo (10s)',
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
                className="w-full sm:max-w-lg overflow-y-auto p-0 bg-white font-sans text-[#1a211c]"
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4.5 z-10">
                    <SheetHeader>
                        <SheetTitle className="text-xl font-bold text-gray-900">
                            {isUrdu ? 'نئی اینٹری' : '+ Nayi Entry'}
                        </SheetTitle>
                        <SheetDescription className="text-xs text-gray-500">
                            {isUrdu ? 'صرف 4 چیزیں بھریں، بس۔' : 'Sirf 4 asaan marhale mukammal karein.'}
                        </SheetDescription>
                    </SheetHeader>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Step 1: Kya hua? (6 options) */}
                    <div className="space-y-2.5">
                        <label className="text-sm font-bold text-gray-900 block">
                            {isUrdu ? '1. کیا ہوا؟' : '1. Kya hua?'}
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                            {entryTypeOptions.map((opt) => {
                                const isSelected = selectedType === opt.type;
                                return (
                                    <button
                                        key={opt.type}
                                        type="button"
                                        onClick={() => setSelectedType(opt.type)}
                                        className={cn(
                                            "min-h-[56px] p-3 text-start rounded-xl border transition-all cursor-pointer flex flex-col justify-center",
                                            isSelected
                                                ? "border-[#14532d] bg-[#ecf5ee] ring-1 ring-[#14532d]"
                                                : "border-gray-200 bg-white hover:bg-gray-50"
                                        )}
                                    >
                                        <span className={cn(
                                            "text-xs font-bold leading-tight",
                                            isSelected ? "text-[#14532d]" : "text-gray-900"
                                        )}>
                                            {opt.title}
                                        </span>
                                        <span className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                                            {opt.subtitle}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Step 2: Kis ke saath? */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-900 block">
                            {isUrdu ? '2. کس کے ساتھ؟' : '2. Kis ke saath?'}
                        </label>

                        {/* If capital in / out: choose partner */}
                        {(selectedType === 'capital_in' || selectedType === 'capital_out') && (
                            <div>
                                <select
                                    value={selectedPartnerId}
                                    onChange={(e) => setSelectedPartnerId(Number(e.target.value))}
                                    className="w-full h-11 px-3.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] focus:bg-white transition-all cursor-pointer"
                                >
                                    {partners.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.role === 'owner' ? 'Owner / Malik' : 'Partner / Shareek'}) — Net Equity: Rs. {p.net_equity.toLocaleString('en-US')}
                                        </option>
                                    ))}
                                </select>
                                {activePartner && (
                                    <p className="text-[11px] text-gray-500 mt-1">
                                        Mawjooda Capital (Net Equity): <span className="font-semibold text-gray-800">Rs. {activePartner.net_equity.toLocaleString('en-US')}</span>
                                    </p>
                                )}
                            </div>
                        )}

                        {/* If loan in: enter lender name */}
                        {selectedType === 'loan_in' && (
                            <input
                                type="text"
                                value={partyNameInput}
                                onChange={(e) => setPartyNameInput(e.target.value)}
                                placeholder="Qarza dene wale ka naam (e.g. Haji sb, Lender, Bank)"
                                className="w-full h-11 px-3.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] focus:bg-white transition-all"
                            />
                        )}

                        {/* If loan out: choose from existing active loans */}
                        {selectedType === 'loan_out' && (
                            <div>
                                <select
                                    value={selectedLoanId}
                                    onChange={(e) => setSelectedLoanId(Number(e.target.value))}
                                    className="w-full h-11 px-3.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] focus:bg-white transition-all cursor-pointer"
                                >
                                    <option value="">Wapas karne wala qarza chunein...</option>
                                    {loans.map((l) => (
                                        <option key={l.id} value={l.id}>
                                            {l.lender_name} — Baqaya Due: Rs. {l.balance_due.toLocaleString('en-US')}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* If surplus out: enter or pick fund name */}
                        {selectedType === 'surplus_out' && (
                            <input
                                type="text"
                                value={partyNameInput}
                                onChange={(e) => setPartyNameInput(e.target.value)}
                                placeholder="Fund / Scheme ka naam (e.g. Meezan 15-day, Gold Savings)"
                                className="w-full h-11 px-3.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] focus:bg-white transition-all"
                            />
                        )}

                        {/* If surplus in: choose from active funds */}
                        {selectedType === 'surplus_in' && (
                            <div>
                                <select
                                    value={selectedSurplusId}
                                    onChange={(e) => setSelectedSurplusId(Number(e.target.value))}
                                    className="w-full h-11 px-3.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] focus:bg-white transition-all cursor-pointer"
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
                        <label className="text-sm font-bold text-gray-900 block">
                            {isUrdu ? '3. کتنا اور کیسے؟' : '3. Kitna aur kaise?'}
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                            {/* Amount input */}
                            <div>
                                <label className="text-xs text-gray-600 block mb-1">
                                    {isUrdu ? 'رقم (روپے)' : 'Rakam (Rs.)'}
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="Maslan: 350,000"
                                    className={cn(
                                        "w-full h-11 px-3.5 text-base font-bold text-gray-900 bg-white border rounded-lg focus:outline-none focus:ring-2 transition-all",
                                        isExceedingCapital && !isAdvanceConfirmed
                                            ? "border-red-500 focus:ring-red-500 text-red-900"
                                            : "border-gray-200 focus:ring-[#14532d]"
                                    )}
                                />
                                {numericAmount > 0 && (
                                    <p className="text-[11px] text-gray-500 mt-1">
                                        Rs. {numericAmount.toLocaleString('en-US')}
                                    </p>
                                )}
                            </div>

                            {/* Cash / Bank Toggle */}
                            <div>
                                <label className="text-xs text-gray-600 block mb-1">
                                    {isUrdu ? 'کہاں سے / کہاں' : 'Kahan se / kahan'}
                                </label>
                                <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 rounded-lg border border-gray-200">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('cash')}
                                        className={cn(
                                            "min-h-[36px] text-xs font-bold rounded-md transition-all cursor-pointer",
                                            paymentMethod === 'cash'
                                                ? "bg-[#14532d] text-white shadow-xs"
                                                : "text-gray-700 hover:text-black"
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
                                                : "text-gray-700 hover:text-black"
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
                                <label className="text-xs text-gray-600 block mb-1">
                                    {isUrdu ? 'بینک اکاؤنٹ منتخب کریں' : 'Bank Account chunein'}
                                </label>
                                <select
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                    className="w-full h-11 px-3.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] focus:bg-white transition-all cursor-pointer"
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
                        <label className="text-sm font-bold text-gray-900 block">
                            {isUrdu ? '4. نوٹ (اختیاری)' : '4. Note / Wajah (Ikhtiyari)'}
                        </label>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Maslan: Ghar ka kharch, Season ka stock, Mandi loan..."
                            className="w-full h-11 px-3.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] focus:bg-white transition-all"
                        />
                    </div>

                    {/* GUARDRAIL ALERT BANNER: Capital se zyada nikaala ja raha hai */}
                    {isExceedingCapital && (
                        <div className={cn(
                            "p-4 rounded-xl border space-y-3 transition-all",
                            isAdvanceConfirmed
                                ? "bg-emerald-50/70 border-emerald-300"
                                : "bg-amber-50/80 border-amber-300 text-amber-950"
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
                                    <h4 className="text-xs font-bold text-gray-900">
                                        {isAdvanceConfirmed
                                            ? 'Advance Payment Manzoor Kar Li Gai Hai'
                                            : 'Capital se zyada nikaala ja raha hai!'}
                                    </h4>
                                    <p className="text-xs text-gray-700 leading-relaxed">
                                        {activePartner?.name} ka capital <span className="font-semibold">Rs. {activePartner?.net_equity.toLocaleString('en-US')}</span> hai. Aap <span className="font-semibold">Rs. {numericAmount.toLocaleString('en-US')}</span> nikaal rahe hain, yani <span className="font-bold text-red-700">Rs. {excessAmount.toLocaleString('en-US')}</span> zyada.
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
                                        className="min-h-[44px] px-3.5 py-2 text-xs font-bold rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 shadow-xs cursor-pointer text-center"
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
                                        className="min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 shadow-xs cursor-pointer text-center"
                                    >
                                        Nahi, rakam kam karein
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between text-xs text-emerald-800 pt-1">
                                    <span>Rs. {excessAmount.toLocaleString('en-US')} Advance record kiya jayega.</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsAdvanceConfirmed(false)}
                                        className="underline text-gray-600 hover:text-black cursor-pointer text-[11px]"
                                    >
                                        Advance cancel karein
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* LIVE PREVIEW BOX */}
                    {livePreview && (
                        <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-700 space-y-1">
                            <span className="font-bold text-gray-900 block text-[11px] uppercase tracking-wide">
                                {isUrdu ? 'کھاتہ پر اثر (Live Preview)' : 'Khata Par Asar (Live Preview):'}
                            </span>
                            <p className="leading-relaxed">
                                {livePreview}
                            </p>
                        </div>
                    )}

                    {/* Submit and Cancel Buttons */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 min-h-[44px] px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
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
