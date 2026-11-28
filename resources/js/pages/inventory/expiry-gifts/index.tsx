import React, { useState, useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import MandiPageHeader from '@/components/app/mandi-page-header';
import { type BreadcrumbItem } from '@/types';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

interface ExpiryLotRow {
    id: number;
    item_id?: number;
    item_name: string;
    lot_code: string;
    lot_subtitle: string;
    arrival_date: string;
    expiry_at: string;
    expiry_countdown: {
        text: string;
        type: 'expired' | 'danger' | 'jaldi_bechein' | 'fresh' | 'neutral';
        hours_left: number | null;
    };
    quantity: number;
    unit: string;
    rate: number;
    nuqsan: number;
    status: 'expired' | 'jaldi_bechein' | 'fresh';
    discount_rate?: number | null;
    action_taken?: string | null;
}

interface GiftRow {
    id: number;
    voucher_no: string;
    date: string;
    recipient_name: string;
    item_name: string;
    quantity: number;
    unit: string;
    rate: number;
    value: number;
    reason: string;
    status: string;
}

interface FreshLotOption {
    id: number;
    item_id?: number;
    name: string;
    item_name: string;
    lot_code: string;
    rate: number;
    quantity: number;
    unit: string;
}

interface Props {
    currentTab: 'expiry' | 'gifts';
    selectedLotId?: number;
    lots: ExpiryLotRow[];
    expirySummary: {
        card_24h_amount: number;
        card_24h_sub: string;
        card_3d_amount: number;
        card_3d_sub: string;
        is_mahine_wastage: number;
        wastage_percent: string;
    };
    gifts: GiftRow[];
    giftSummary: {
        current_month_value: number;
        monthly_budget: number;
        budget_baaki: number;
        budget_progress_pct: number;
        budget_used_label: string;
        top_recipients: Array<{ name: string; value: number }>;
    };
    freshLots: FreshLotOption[];
}

type ModalActionTab = 'discount' | 'gift' | 'return_farmer' | 'wastage';

export default function ExpiryGiftsPage({
    currentTab: initialTab = 'expiry',
    lots,
    expirySummary,
    gifts,
    giftSummary,
    freshLots,
}: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [activeTab, setActiveTab] = useState<'expiry' | 'gifts'>(initialTab);

    // "Kya karein?" Modal State
    const [kyaKareinLot, setKyaKareinLot] = useState<ExpiryLotRow | null>(null);
    const [modalActionTab, setModalActionTab] = useState<ModalActionTab>('wastage');

    // Action Form States inside "Kya karein?" Modal
    const [actionDiscountRate, setActionDiscountRate] = useState<string>('');
    const [actionDiscountQty, setActionDiscountQty] = useState<string>('');

    const [actionGiftQty, setActionGiftQty] = useState<string>('');
    const [actionGiftRecipient, setActionGiftRecipient] = useState<string>('');
    const [actionGiftReason, setActionGiftReason] = useState<string>('Loyalty');

    const [actionReturnQty, setActionReturnQty] = useState<string>('');
    const [actionReturnFarmer, setActionReturnFarmer] = useState<string>('');

    const [actionWastageQty, setActionWastageQty] = useState<string>('');
    const [actionWastageReason, setActionWastageReason] = useState<string>('Expire Maal');

    const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

    // Gifts Tab Form State: Starts completely empty as requested
    const [giftLotId, setGiftLotId] = useState<string>('');
    const [giftQty, setGiftQty] = useState<string>('');
    const [giftReason, setGiftReason] = useState<string>('');
    const [giftRecipient, setGiftRecipient] = useState<string>('');
    const [isSubmittingGift, setIsSubmittingGift] = useState(false);

    // Formatters
    const formatRs = (val: number) => 'Rs. ' + Math.round(Number(val || 0)).toLocaleString('en-US');
    const formatNum = (val: number) => Number(val || 0).toLocaleString('en-US');

    // Open "Kya karein?" Modal
    const openKyaKareinModal = (lot: ExpiryLotRow) => {
        if (lot.quantity <= 0) return; // 0 quantity wastage form does not open

        setKyaKareinLot(lot);
        setActionDiscountRate(lot.discount_rate ? String(lot.discount_rate) : String(Math.round(lot.rate * 0.8)));
        setActionDiscountQty(String(lot.quantity));

        setActionGiftQty(String(lot.quantity));
        setActionGiftRecipient('');
        setActionGiftReason('Loyalty');

        setActionReturnQty(String(lot.quantity));
        setActionReturnFarmer('');

        setActionWastageQty(String(lot.quantity));
        setActionWastageReason(lot.status === 'expired' ? 'Expire Maal' : 'Gal Sad Gaya');

        // Choose default active action tab
        if (lot.status === 'expired') {
            setModalActionTab('wastage');
        } else if (lot.status === 'fresh') {
            setModalActionTab('discount');
        } else {
            setModalActionTab('discount');
        }
    };

    // Close Modal
    const closeKyaKareinModal = () => {
        setKyaKareinLot(null);
    };

    // Submit Discount from Modal
    const handleModalDiscountSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!kyaKareinLot) return;

        const rate = parseFloat(actionDiscountRate);
        const qty = parseFloat(actionDiscountQty);

        if (isNaN(rate) || rate <= 0) {
            toast.error('Please enter a valid discount rate.');
            return;
        }

        setIsSubmittingAction(true);
        router.post('/expiry-gifts/discount', {
            lot_id: kyaKareinLot.id,
            discount_rate: rate,
            quantity: !isNaN(qty) && qty > 0 ? qty : kyaKareinLot.quantity,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setIsSubmittingAction(false);
                closeKyaKareinModal();
                toast.success('Aaj sasti bechein rate update ho gaya.');
            },
            onError: (errs) => {
                setIsSubmittingAction(false);
                const first = Object.values(errs)[0];
                toast.error(first || 'Discount rate lagane mein masla aya.');
            },
        });
    };

    // Submit Gift from Modal
    const handleModalGiftSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!kyaKareinLot) return;

        if (kyaKareinLot.status !== 'fresh') {
            toast.error('Sirf fresh lot gift mein diya ja sakta hai.');
            return;
        }

        const qty = parseFloat(actionGiftQty);
        if (isNaN(qty) || qty <= 0 || qty > kyaKareinLot.quantity) {
            toast.error(`Durust quantity darj karein (1 se ${kyaKareinLot.quantity} ${kyaKareinLot.unit}).`);
            return;
        }

        setIsSubmittingAction(true);
        router.post('/expiry-gifts/gift', {
            lot_id: kyaKareinLot.id,
            quantity: qty,
            recipient_name: actionGiftRecipient.trim(),
            reason: actionGiftReason,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setIsSubmittingAction(false);
                closeKyaKareinModal();
                toast.success('Gift kamyabi se record ho gaya.');
            },
            onError: (errs) => {
                setIsSubmittingAction(false);
                const first = Object.values(errs)[0];
                toast.error(first || 'Gift save nahi ho saka.');
            },
        });
    };

    // Submit Return to Farmer from Modal
    const handleModalReturnSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!kyaKareinLot) return;

        const qty = parseFloat(actionReturnQty);
        if (isNaN(qty) || qty <= 0 || qty > kyaKareinLot.quantity) {
            toast.error(`Durust quantity darj karein (1 se ${kyaKareinLot.quantity} ${kyaKareinLot.unit}).`);
            return;
        }

        setIsSubmittingAction(true);
        router.post('/expiry-gifts/return-farmer', {
            lot_id: kyaKareinLot.id,
            quantity: qty,
            farmer_name: actionReturnFarmer.trim(),
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setIsSubmittingAction(false);
                closeKyaKareinModal();
                toast.success('Return to farmer recorded successfully.');
            },
            onError: (errs) => {
                setIsSubmittingAction(false);
                const first = Object.values(errs)[0];
                toast.error(first || 'Wapsi record karne mein masla aya.');
            },
        });
    };

    // Submit Wastage from Modal
    const handleModalWastageSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!kyaKareinLot) return;

        const qty = parseFloat(actionWastageQty);
        if (isNaN(qty) || qty <= 0) {
            toast.error('Please enter a valid quantity.');
            return;
        }
        if (qty > kyaKareinLot.quantity) {
            toast.error(`Quantity baaki maal (${kyaKareinLot.quantity} ${kyaKareinLot.unit}) se zyada nahi ho sakti.`);
            return;
        }

        setIsSubmittingAction(true);
        router.post('/expiry-gifts/wastage', {
            lot_id: kyaKareinLot.id,
            quantity: qty,
            reason: actionWastageReason,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setIsSubmittingAction(false);
                closeKyaKareinModal();
                toast.success('Wastage recorded successfully.');
            },
            onError: (errs) => {
                setIsSubmittingAction(false);
                const first = Object.values(errs)[0];
                toast.error(first || 'Failed to record wastage.');
            },
        });
    };

    // Gifts Tab Calculations
    const activeGiftLot = useMemo(() => {
        if (!giftLotId) return null;
        return freshLots.find(l => l.id === Number(giftLotId)) || null;
    }, [freshLots, giftLotId]);

    const giftNumericQty = useMemo(() => {
        const q = parseFloat(giftQty);
        return isNaN(q) ? 0 : q;
    }, [giftQty]);

    const hasValidItemAndQty = Boolean(activeGiftLot && giftNumericQty > 0);

    const calculatedGiftValue = useMemo(() => {
        if (!activeGiftLot || giftNumericQty <= 0) return 0;
        return giftNumericQty * activeGiftLot.rate;
    }, [activeGiftLot, giftNumericQty]);

    const projectedBudgetBaaki = useMemo(() => {
        if (!hasValidItemAndQty) return 0;
        return Math.max(0, giftSummary.budget_baaki - calculatedGiftValue);
    }, [giftSummary.budget_baaki, calculatedGiftValue, hasValidItemAndQty]);

    const isGiftSaveDisabled =
        !giftLotId ||
        giftNumericQty <= 0 ||
        !giftReason ||
        (activeGiftLot && giftNumericQty > activeGiftLot.quantity);

    // Save Gift from Gifts tab form
    const handleSaveGift = (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeGiftLot) {
            toast.error('Please select an item.');
            return;
        }

        if (giftNumericQty <= 0) {
            toast.error('Please enter a valid quantity.');
            return;
        }

        if (giftNumericQty > activeGiftLot.quantity) {
            toast.error(`Stock kam hai! Sirf ${activeGiftLot.quantity} ${activeGiftLot.unit} dastiyab hai.`);
            return;
        }

        if (!giftReason) {
            toast.error('Please select a reason.');
            return;
        }

        setIsSubmittingGift(true);
        router.post('/expiry-gifts/gift', {
            lot_id: activeGiftLot.id,
            quantity: giftNumericQty,
            recipient_name: giftRecipient.trim(),
            reason: giftReason,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setIsSubmittingGift(false);
                // Reset form completely empty
                setGiftLotId('');
                setGiftQty('');
                setGiftReason('');
                setGiftRecipient('');
                toast.success('Gift save ho gaya.');
            },
            onError: (errs) => {
                setIsSubmittingGift(false);
                const first = Object.values(errs)[0];
                toast.error(first || 'Gift save nahi ho saka.');
            },
        });
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'انویسٹمنٹ' : 'Inventory', href: '/expiry-gifts' },
        { title: isUrdu ? 'ایکسپائری اور تحائف' : 'Expiry & Gifts', href: '/expiry-gifts' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'ایکسپائری اور تحائف' : 'Expiry & Gifts - Vegetable POS'} />

            <div className={cn("-mt-4 -mx-4 -mb-4 pb-28 bg-[#eef2ee] min-h-full font-sans text-[#111827] space-y-4", isUrdu && "font-urdu")} dir={isUrdu ? "rtl" : "ltr"}>
                {/* Green Header */}
                <MandiPageHeader
                    title={isUrdu ? t('expiry_gifts_section.title') : 'Expiry & Gifts'}
                    subtitle={
                        activeTab === 'expiry'
                            ? (isUrdu ? t('expiry_gifts_section.subtitle_expiry') : 'Expiring stock tracking and action recommendations')
                            : (isUrdu ? t('expiry_gifts_section.subtitle_gifts') : 'Complimentary giveaways tracking and record')
                    }
                    isUrdu={isUrdu}
                >
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white text-[#14532d] border border-white shadow-xs">
                            <span className="size-2 rounded-full bg-emerald-600 animate-pulse" />
                            <span>{isUrdu ? 'لائیو · ہر منٹ اپ ڈیٹ' : 'Live · har minute update'}</span>
                        </span>
                    </div>
                </MandiPageHeader>

                <div className="p-4 md:px-6 -mt-6 md:-mt-8 space-y-5 max-w-7xl mx-auto">
                    {/* Tab Switcher */}
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => setActiveTab('expiry')}
                            className={cn(
                                "px-5 py-2 text-sm rounded-xl transition-all cursor-pointer border",
                                activeTab === 'expiry'
                                    ? "bg-[#0d3b1e] text-white border-2 border-white font-bold shadow-xs"
                                    : "bg-white text-[#14532d] border border-white hover:bg-emerald-50 font-semibold shadow-2xs"
                            )}
                        >
                            {isUrdu ? t('expiry_gifts_section.expiry_tab') : 'Expiry'}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('gifts')}
                            className={cn(
                                "px-5 py-2 text-sm rounded-xl transition-all cursor-pointer border",
                                activeTab === 'gifts'
                                    ? "bg-[#0d3b1e] text-white border-2 border-white font-bold shadow-xs"
                                    : "bg-white text-[#14532d] border border-white hover:bg-emerald-50 font-semibold shadow-2xs"
                            )}
                        >
                            {isUrdu ? t('expiry_gifts_section.gifts_tab') : 'Gifts'}
                        </button>
                    </div>
                    {/* ===================== TAB 1: EXPIRY TAB ===================== */}
                    {activeTab === 'expiry' && (
                        <>
                            {/* Top 4 Summary Cards: ALL WHITE BACKGROUND, DEEP DARK NUMBERS */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                                {/* Card 1: 24 ghante mein expire */}
                                <div className="bg-white p-4.5 rounded-xl border border-gray-200 shadow-2xs">
                                    <span className="text-xs font-bold text-[#4B5563] block">
                                        {isUrdu ? '24 گھنٹے میں ایکسپائر' : '24 ghante mein expire'}
                                    </span>
                                    <span className="text-2xl font-black text-[#111827] block mt-2 font-mono">
                                        {formatRs(expirySummary.card_24h_amount)}
                                    </span>
                                    <span className="text-xs font-medium text-[#4B5563] block mt-1">
                                        {expirySummary.card_24h_sub}
                                    </span>
                                </div>

                                {/* Card 2: 3 din mein expire */}
                                <div className="bg-white p-4.5 rounded-xl border border-gray-200 shadow-2xs">
                                    <span className="text-xs font-bold text-[#4B5563] block">
                                        {isUrdu ? '3 دن میں ایکسپائر' : '3 din mein expire'}
                                    </span>
                                    <span className="text-2xl font-black text-[#111827] block mt-2 font-mono">
                                        {formatRs(expirySummary.card_3d_amount)}
                                    </span>
                                    <span className="text-xs font-medium text-[#4B5563] block mt-1">
                                        {expirySummary.card_3d_sub}
                                    </span>
                                </div>

                                {/* Card 3: Is mahine ka wastage */}
                                <div className="bg-white p-4.5 rounded-xl border border-gray-200 shadow-2xs">
                                    <span className="text-xs font-bold text-[#4B5563] block">
                                        {isUrdu ? 'اس مہینے کا ضیاع (Wastage)' : 'Monthly Wastage Loss'}
                                    </span>
                                    <span className="text-2xl font-black text-[#111827] block mt-2 font-mono">
                                        {formatRs(expirySummary.is_mahine_wastage)}
                                    </span>
                                </div>

                                {/* Card 4: Wastage % (aamad par) */}
                                <div className="bg-white p-4.5 rounded-xl border border-gray-200 shadow-2xs">
                                    <span className="text-xs font-bold text-[#4B5563] block">
                                        {isUrdu ? 'ضیاع کا فیصد (آمد پر)' : 'Wastage % (Arrivals)'}
                                    </span>
                                    <span className="text-2xl font-black text-[#111827] block mt-2 font-mono">
                                        {expirySummary.wastage_percent}
                                    </span>
                                </div>
                            </div>

                            {/* Full-width Expiry Lots Table (Right panel removed completely) */}
                            <div className="w-full bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-start text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200 text-[#4B5563] uppercase tracking-wider text-[11px] font-bold">
                                                <th className="py-3.5 px-4 text-start">{isUrdu ? 'سبزی / لاٹ' : 'ITEM / LOT'}</th>
                                                <th className="py-3.5 px-4 text-start">{isUrdu ? 'ایکسپائری میں' : 'EXPIRY MEIN'}</th>
                                                <th className="py-3.5 px-4 text-start">{isUrdu ? 'باقی مال' : 'REMAINING'}</th>
                                                <th className="py-3.5 px-4 text-start">{isUrdu ? 'نقصان' : 'LOSS'}</th>
                                                <th className="py-3.5 px-4 text-center">{isUrdu ? 'اسٹیٹس' : 'STATUS'}</th>
                                                <th className="py-3.5 px-4 text-center">{isUrdu ? 'کارروائی' : 'ACTION'}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-[#111827]">
                                            {lots.map((lot) => {
                                                const isDepleted = lot.quantity <= 0;

                                                return (
                                                    <tr
                                                        key={lot.id}
                                                        className="hover:bg-gray-50/70 transition-colors"
                                                    >
                                                        {/* ITEM / LOT */}
                                                        <td className="py-3.5 px-4">
                                                            <span className="text-sm font-bold text-[#111827] block">
                                                                {lot.item_name}
                                                            </span>
                                                            <span className="text-xs text-[#4B5563] font-medium block mt-0.5">
                                                                {lot.lot_subtitle}
                                                            </span>
                                                        </td>

                                                        {/* EXPIRY MEIN: Pure dark readable text */}
                                                        <td className="py-3.5 px-4 font-bold text-sm text-[#111827]">
                                                            {isUrdu
                                                                ? (lot.expiry_countdown.text.includes('Expire ho chuka')
                                                                    ? 'ایکسپائر ہو چکا'
                                                                    : lot.expiry_countdown.text.includes('Wastage likha gaya')
                                                                        ? 'ضیاع لکھا گیا'
                                                                        : lot.expiry_countdown.text.replace('din', 'دن').replace('h', ' گھنٹے').replace('m', ' منٹ'))
                                                                : lot.expiry_countdown.text}
                                                        </td>

                                                        {/* BAAKI */}
                                                        <td className="py-3.5 px-4 text-sm font-medium text-[#111827] font-mono">
                                                            <span dir="ltr" className="inline-block">{formatNum(lot.quantity)} {lot.unit}</span>
                                                        </td>

                                                        {/* NUQSAN */}
                                                        <td className="py-3.5 px-4 text-sm font-bold text-[#111827] font-mono">
                                                            {formatNum(lot.nuqsan)}
                                                        </td>

                                                        {/* STATUS: Plain text, no colored badge */}
                                                        <td className="py-3.5 px-4 text-center text-xs font-semibold text-[#111827]">
                                                            {lot.status === 'expired'
                                                                ? (isUrdu ? 'ایکسپائرڈ' : 'Expired')
                                                                : lot.status === 'jaldi_bechein'
                                                                    ? (isUrdu ? 'جلدی بیچیں' : 'Discount & Sell Fast')
                                                                    : (isUrdu ? 'تازہ' : 'Fresh')}
                                                        </td>

                                                        {/* ACTION COLUMN: If remaining is 0 kg, show "—". Otherwise "Kya karein" button */}
                                                        <td className="py-3.5 px-4 text-center">
                                                            {isDepleted ? (
                                                                <span className="text-[#9CA3AF] font-bold select-none">—</span>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openKyaKareinModal(lot)}
                                                                    className="px-3.5 py-1.5 text-xs font-bold text-[#111827] hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors cursor-pointer"
                                                                >
                                                                    {isUrdu ? 'کیا کریں؟' : 'Kya karein'}
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ===================== TAB 2: GIFTS TAB ===================== */}
                    {activeTab === 'gifts' && (
                        <>
                            {/* Top 3 Summary Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                {/* Card 1: Is mahine gift ki value */}
                                <div className="bg-white p-4.5 rounded-xl border border-gray-200 shadow-2xs">
                                    <span className="text-xs font-bold text-[#4B5563] block">
                                        {isUrdu ? 'اس مہینے تحائف کی مالیت' : 'Is mahine gift ki value'}
                                    </span>
                                    <span className="text-2xl font-black text-[#111827] block mt-2 font-mono">
                                        {formatRs(giftSummary.current_month_value)}
                                    </span>
                                </div>

                                {/* Card 2: Budget baaki */}
                                <div className="bg-white p-4.5 rounded-xl border border-gray-200 shadow-2xs">
                                    <span className="text-xs font-bold text-[#4B5563] block">
                                        {isUrdu ? 'باقی بچا بجٹ' : 'Budget baaki'}
                                    </span>
                                    <span className="text-2xl font-black text-[#14532d] block mt-2 font-mono">
                                        {formatRs(giftSummary.budget_baaki)}
                                    </span>
                                    {/* Progress Bar */}
                                    <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden mt-3">
                                        <div
                                            className="h-full bg-[#14532d] rounded-full transition-all duration-300"
                                            style={{ width: `${giftSummary.budget_progress_pct}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-medium text-[#4B5563] block mt-1.5 font-mono">
                                        {giftSummary.budget_used_label}
                                    </span>
                                </div>

                                {/* Card 3: Sab se zyada gift lene wale */}
                                <div className="bg-white p-4.5 rounded-xl border border-gray-200 shadow-2xs">
                                    <span className="text-xs font-bold text-[#4B5563] block">
                                        {isUrdu ? 'سب سے زیادہ تحفہ لینے والے' : 'Sab se zyada gift lene wale'}
                                    </span>
                                    <div className="mt-2 space-y-1 text-xs font-semibold text-[#111827]">
                                        {giftSummary.top_recipients.map((r, i) => (
                                            <div key={i} className="flex items-center justify-between">
                                                <span>{i + 1}. {r.name}</span>
                                                <span className="font-bold text-[#14532d] font-mono">{formatNum(r.value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Main Content: Left Form (Naya Gift) + Right Table (Gifts History) */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                                {/* Left Side: Naya Gift Form (Starts completely empty) */}
                                <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 p-5 shadow-2xs">
                                    <h3 className="text-base font-bold text-[#111827] mb-4">
                                        {isUrdu ? 'نیا تحفہ' : 'Naya Gift'}
                                    </h3>

                                    <form onSubmit={handleSaveGift} className="space-y-4">
                                        {/* Field 1: Item (sirf fresh lot) */}
                                        <div>
                                            <label className="text-xs font-semibold text-[#374151] block mb-1">
                                                {isUrdu ? 'سبزی (صرف تازہ لاٹ)' : 'Item (sirf fresh lot)'}
                                            </label>
                                            <select
                                                value={giftLotId}
                                                onChange={(e) => setGiftLotId(e.target.value)}
                                                className="w-full h-11 px-3.5 text-xs font-medium text-[#111827] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all cursor-pointer"
                                            >
                                                <option value="" disabled>{isUrdu ? 'سبزی منتخب کریں' : 'Item select karein'}</option>
                                                {freshLots.map((lot) => (
                                                    <option key={lot.id} value={lot.id}>
                                                        {lot.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Row with 2 fields: Quantity & Wajah */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-semibold text-[#374151] block mb-1">
                                                    {isUrdu ? 'مقدار' : 'Quantity'}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={giftQty}
                                                    onChange={(e) => setGiftQty(e.target.value)}
                                                    placeholder={isUrdu ? 'مقدار درج کریں' : 'Quantity likhein'}
                                                    min="0.1"
                                                    step="any"
                                                    className="w-full h-11 px-3.5 text-sm font-medium text-[#111827] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-[#374151] block mb-1">
                                                    {isUrdu ? 'وجہ' : 'Wajah'}
                                                </label>
                                                <select
                                                    value={giftReason}
                                                    onChange={(e) => setGiftReason(e.target.value)}
                                                    className="w-full h-11 px-3.5 text-xs font-medium text-[#111827] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all cursor-pointer"
                                                >
                                                    <option value="" disabled>{isUrdu ? 'وجہ منتخب کریں' : 'Wajah select karein'}</option>
                                                    <option value="Loyalty">{isUrdu ? 'وفاداری (Loyalty)' : 'Loyalty'}</option>
                                                    <option value="Eid">{isUrdu ? 'عید تحفہ (Eid)' : 'Eid'}</option>
                                                    <option value="Muawza">{isUrdu ? 'معاوضہ (Compensation)' : 'Muawza'}</option>
                                                    <option value="Sample">{isUrdu ? 'نمونہ (Sample)' : 'Sample'}</option>
                                                    <option value="Taaluqat">{isUrdu ? 'تعلقات (PR)' : 'Taaluqat'}</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Field 3: Kis ko (optional) */}
                                        <div>
                                            <label className="text-xs font-semibold text-[#374151] block mb-1">
                                                {isUrdu ? 'کس کو (اختیاری)' : 'Kis ko (optional)'}
                                            </label>
                                            <input
                                                type="text"
                                                value={giftRecipient}
                                                onChange={(e) => setGiftRecipient(e.target.value)}
                                                placeholder={isUrdu ? 'نام درج کریں (اختیاری)' : 'Recipient name (optional)'}
                                                className="w-full h-11 px-3.5 text-sm font-medium text-[#111827] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] transition-all"
                                            />
                                        </div>

                                        {/* Auto-Calculation Box */}
                                        <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-[#374151]">
                                                    {isUrdu ? 'مالیت (نرخ کے حساب سے)' : 'Value (rate se khud)'}
                                                </span>
                                                <span className="font-bold text-sm text-[#111827] font-mono">
                                                    {hasValidItemAndQty ? formatRs(calculatedGiftValue) : '—'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-[#374151]">
                                                    {isUrdu ? 'باقی بجٹ رہے گا' : 'Budget baaki hoga'}
                                                </span>
                                                <span className="font-bold text-sm text-[#14532d] font-mono">
                                                    {hasValidItemAndQty ? formatNum(projectedBudgetBaaki) : '—'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-[#4B5563] pt-1">
                                                {isUrdu ? '2,000 روپے سے اوپر کے تحفے پر مالک کی منظوری درکار ہے۔' : 'Rs. 2,000 se upar ke gift par owner approval lagta hai.'}
                                            </p>
                                        </div>

                                        {/* Save Button: Disabled until Item, Quantity and Wajah are filled */}
                                        <button
                                            type="submit"
                                            disabled={isSubmittingGift || isGiftSaveDisabled}
                                            className={cn(
                                                "w-full py-3 rounded-xl font-bold text-sm shadow-xs transition-colors",
                                                isSubmittingGift || isGiftSaveDisabled
                                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-200"
                                                    : "bg-[#14532d] hover:bg-[#166534] text-white cursor-pointer"
                                            )}
                                        >
                                            {isSubmittingGift
                                                ? (isUrdu ? 'محفوظ ہو رہا ہے...' : 'Gift Save ho raha hai...')
                                                : (isUrdu ? 'تحفہ محفوظ کریں' : 'Gift Save karein')}
                                        </button>
                                    </form>
                                </div>

                                {/* Right Side: Gifts History Table */}
                                <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-start text-sm border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200 text-[#4B5563] uppercase tracking-wider text-[11px] font-bold">
                                                    <th className="py-3.5 px-4 text-start">{isUrdu ? 'تاریخ' : 'TAREEKH'}</th>
                                                    <th className="py-3.5 px-4 text-start">{isUrdu ? 'کس کو / سبزی' : 'KIS KO / ITEM'}</th>
                                                    <th className="py-3.5 px-4 text-end">{isUrdu ? 'مالیت (Rs)' : 'VALUE'}</th>
                                                    <th className="py-3.5 px-4 text-center">{isUrdu ? 'وجہ' : 'WAJAH'}</th>
                                                    <th className="py-3.5 px-4 text-center">{isUrdu ? 'واؤچر' : 'VOUCHER'}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 text-[#111827]">
                                                {gifts.map((gift) => (
                                                    <tr key={gift.id} className="hover:bg-gray-50/70 transition-colors">
                                                        <td className="py-3.5 px-4 text-xs font-semibold text-[#374151] font-mono">
                                                            {gift.date}
                                                        </td>
                                                        <td className="py-3.5 px-4">
                                                            <span className="text-sm font-bold text-[#111827] block">
                                                                {gift.recipient_name}
                                                            </span>
                                                            <span className="text-xs text-[#4B5563] block mt-0.5">
                                                                {gift.item_name} <span className="font-mono">{formatNum(gift.quantity)} {gift.unit}</span>
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 px-4 text-end font-bold text-sm text-[#111827] font-mono">
                                                            {formatNum(gift.value)}
                                                        </td>
                                                        <td className="py-3.5 px-4 text-center text-xs font-medium text-[#374151]">
                                                            {gift.reason}
                                                        </td>
                                                        <td className="py-3.5 px-4 text-center text-xs font-mono font-medium text-[#4B5563]">
                                                            {gift.voucher_no}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="p-3 text-xs text-[#6B7280] border-t border-gray-100 bg-gray-50/40">
                                        {isUrdu
                                            ? 'فلٹر: مہینہ · وجہ · پارٹی · سبزی۔ تحفے کی مالیت رپورٹس کے "خرچہ" میں براہ راست شامل ہوتی ہے۔'
                                            : 'Filter by Month · Reason · Party · Item. Gift values are tracked under Expenses in Reports.'}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* ===================== "KYA KAREIN?" MODAL (Points 10 & 11) ===================== */}
                <Dialog open={Boolean(kyaKareinLot)} onOpenChange={(open) => { if (!open) closeKyaKareinModal(); }}>
                    <DialogContent className={cn("max-w-2xl sm:max-w-3xl w-full p-6 bg-white rounded-2xl shadow-xl border border-gray-200", isUrdu && "font-urdu")} dir={isUrdu ? "rtl" : "ltr"}>
                        {kyaKareinLot && (
                            <>
                                <DialogHeader className="border-b border-gray-100 pb-3">
                                    <DialogTitle className="text-xl font-bold text-[#111827]">
                                        {isUrdu ? 'کیا کریں؟' : 'Action Required'}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs font-medium text-[#1F2937]">
                                        {isUrdu ? 'منتخب شدہ لاٹ پر فوری کارروائی کریں۔' : 'Take immediate action on the selected lot.'}
                                    </DialogDescription>
                                </DialogHeader>

                                {/* Lot Details Top Summary Card */}
                                <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/70 pb-2">
                                        <div>
                                            <span className="text-xs font-semibold text-[#1F2937] block">{isUrdu ? 'سبزی / لاٹ' : 'Item / Lot'}</span>
                                            <span className="text-base font-extrabold text-[#111827]">
                                                {kyaKareinLot.item_name} · <span className="font-mono">{kyaKareinLot.lot_code}</span>
                                            </span>
                                        </div>
                                        <div className="text-end">
                                            <span className="text-xs font-semibold text-[#1F2937] block">{isUrdu ? 'اسٹیٹس' : 'Status'}</span>
                                            <span className="text-sm font-extrabold text-[#111827]">
                                                {kyaKareinLot.status === 'expired'
                                                    ? (isUrdu ? 'ایکسپائرڈ' : 'Expired')
                                                    : kyaKareinLot.status === 'jaldi_bechein'
                                                        ? (isUrdu ? 'جلدی بیچیں' : 'Discount & Sell Fast')
                                                        : (isUrdu ? 'تازہ' : 'Fresh')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 pt-2.5">
                                        <div>
                                            <span className="text-xs font-semibold text-[#1F2937] block">{isUrdu ? 'ایکسپائری میں:' : 'Time to Expiry:'}</span>
                                            <span className="font-extrabold text-[#111827] text-sm">{kyaKareinLot.expiry_countdown.text}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs font-semibold text-[#1F2937] block">{isUrdu ? 'باقی مال:' : 'Remaining Stock:'}</span>
                                            <span className="font-extrabold text-[#111827] text-sm font-mono">{formatNum(kyaKareinLot.quantity)} {kyaKareinLot.unit}</span>
                                        </div>
                                        <div className="text-end">
                                            <span className="text-xs font-semibold text-[#1F2937] block">{isUrdu ? 'اصل ریٹ:' : 'Original Rate:'}</span>
                                            <span className="font-extrabold text-[#111827] text-sm font-mono">Rs. {kyaKareinLot.rate}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 4 Action Tabs inside Modal */}
                                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-gray-100 rounded-xl">
                                    {/* Action 1: Aaj sasti bechein (Disabled on expired) */}
                                    <button
                                        type="button"
                                        disabled={kyaKareinLot.status === 'expired'}
                                        onClick={() => setModalActionTab('discount')}
                                        className={cn(
                                            "py-2.5 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all text-center whitespace-nowrap",
                                            kyaKareinLot.status === 'expired'
                                                ? "text-gray-400 cursor-not-allowed line-through"
                                                : modalActionTab === 'discount'
                                                    ? "bg-white text-[#111827] shadow-xs"
                                                    : "text-[#374151] hover:text-[#111827]"
                                        )}
                                    >
                                        {isUrdu ? 'آج سستی بیچیں' : 'Discount Sale'}
                                    </button>

                                    {/* Action 2: Gift mein dein (Only for fresh) */}
                                    <button
                                        type="button"
                                        disabled={kyaKareinLot.status !== 'fresh'}
                                        title={kyaKareinLot.status !== 'fresh' ? (isUrdu ? "تحفہ صرف تازہ لاٹ کے لیے ہے۔ ایکسپائر ہونے والے مال پر تحفہ بند ہے۔" : "Gift sirf fresh lot ke liye hai. Expire hone wale maal par gift band hai.") : (isUrdu ? "تحفے میں دیں" : "Gift mein dein")}
                                        aria-label={kyaKareinLot.status !== 'fresh' ? (isUrdu ? "تحفہ صرف تازہ لاٹ کے لیے ہے۔ ایکسپائر ہونے والے مال پر تحفہ بند ہے۔" : "Gift sirf fresh lot ke liye hai. Expire hone wale maal par gift band hai.") : (isUrdu ? "تحفے میں دیں" : "Gift mein dein")}
                                        onClick={() => setModalActionTab('gift')}
                                        className={cn(
                                            "py-2.5 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all text-center whitespace-nowrap",
                                            kyaKareinLot.status !== 'fresh'
                                                ? "text-gray-400 cursor-not-allowed"
                                                : modalActionTab === 'gift'
                                                    ? "bg-white text-[#111827] shadow-xs"
                                                    : "text-[#374151] hover:text-[#111827]"
                                        )}
                                    >
                                        {isUrdu ? 'تحفے میں دیں' : 'Promotional Gift'}
                                    </button>

                                    {/* Action 3: Farmer ko wapas karein */}
                                    <button
                                        type="button"
                                        onClick={() => setModalActionTab('return_farmer')}
                                        className={cn(
                                            "py-2.5 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all text-center whitespace-nowrap",
                                            modalActionTab === 'return_farmer'
                                                ? "bg-white text-[#111827] shadow-xs"
                                                : "text-[#374151] hover:text-[#111827]"
                                        )}
                                    >
                                        {isUrdu ? 'کسان کو واپسی' : 'Return to Supplier'}
                                    </button>

                                    {/* Action 4: Wastage likhein */}
                                    <button
                                        type="button"
                                        onClick={() => setModalActionTab('wastage')}
                                        className={cn(
                                            "py-2.5 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all text-center whitespace-nowrap",
                                            modalActionTab === 'wastage'
                                                ? "bg-white text-[#111827] shadow-xs"
                                                : "text-[#374151] hover:text-[#111827]"
                                        )}
                                    >
                                        {isUrdu ? 'ضیاع لکھیں' : 'Record Wastage'}
                                    </button>
                                </div>

                                {/* Status Notice for Actions */}
                                {kyaKareinLot.status !== 'fresh' && (
                                    <div className="mt-2.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-[#1F2937]">
                                        <strong className="text-[#111827]">{isUrdu ? 'تحفہ آپشن:' : 'Gift option:'}</strong> {isUrdu ? 'صرف تازہ لاٹ کے لیے ہے۔ ایکسپائر ہونے والے مال پر تحفہ بند ہے۔' : 'Promotional gifts are only allowed for fresh lots. Gifts are disabled for expiring or expired items.'}
                                    </div>
                                )}
                                {kyaKareinLot.status === 'expired' && (
                                    <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-[#1F2937]">
                                        <strong className="text-[#111827]">{isUrdu ? 'ایکسپائرڈ مال:' : 'Expired Items:'}</strong> {isUrdu ? 'سستی سیل اور تحفہ بند ہیں۔ صرف ضیاع لکھیں یا کسان کو واپس کریں۔' : 'Discounted sale and gift promotions are disabled. Record as wastage or return to supplier.'}
                                    </div>
                                )}

                                {/* Action 1 Form: Aaj sasti bechein */}
                                {modalActionTab === 'discount' && (
                                    <form onSubmit={handleModalDiscountSubmit} className="mt-4 space-y-3.5">
                                        {kyaKareinLot.status === 'expired' ? (
                                             <div className="p-3 bg-gray-50 border border-gray-200 text-xs text-[#4B5563] rounded-lg">
                                                {isUrdu ? 'ایکسپائرڈ لاٹ پر سستی سیل لگانا منع ہے۔ برائے مہربانی ضیاع لکھیں یا کسان کو واپس کریں۔' : 'Expired lot cannot be sold. Please record as wastage or return to supplier.'}
                                            </div>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs font-bold text-[#111827] block mb-1">
                                                            {isUrdu ? `نیا سستا ریٹ (Rs./${kyaKareinLot.unit}):` : `Naya Sasta Rate (Rs./${kyaKareinLot.unit}):`}
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={actionDiscountRate}
                                                            onChange={(e) => setActionDiscountRate(e.target.value)}
                                                            placeholder={isUrdu ? 'ریٹ درج کریں' : 'Rate likhein'}
                                                            min="1"
                                                            step="any"
                                                            required
                                                            className="w-full h-11 px-3.5 text-base font-bold text-[#111827] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] font-mono"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-[#111827] block mb-1">
                                                            {isUrdu ? `کتنا (${kyaKareinLot.unit}):` : `Kitna (${kyaKareinLot.unit}):`}
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={actionDiscountQty}
                                                            onChange={(e) => setActionDiscountQty(e.target.value)}
                                                            placeholder={`Max: ${kyaKareinLot.quantity}`}
                                                            min="0.1"
                                                            max={kyaKareinLot.quantity}
                                                            step="any"
                                                            required
                                                            className="w-full h-11 px-3.5 text-base font-bold text-[#111827] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] font-mono"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={closeKyaKareinModal}
                                                        className="flex-1 py-2.5 rounded-lg border border-gray-300 text-xs font-semibold text-[#374151] hover:bg-gray-50 cursor-pointer"
                                                    >
                                                        {isUrdu ? 'منسوخ' : 'Cancel'}
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={isSubmittingAction}
                                                        className="flex-1 py-2.5 rounded-lg bg-[#14532d] hover:bg-[#166534] text-xs font-bold text-white shadow-xs cursor-pointer"
                                                    >
                                                        {isSubmittingAction ? (isUrdu ? 'لگایا جا رہا ہے...' : 'Lagaya ja raha hai...') : (isUrdu ? 'سستا ریٹ لگائیں' : 'Sasti Rate Lagayein')}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </form>
                                )}

                                {/* Action 2 Form: Gift mein dein (Sirf fresh lot) */}
                                {modalActionTab === 'gift' && (
                                    <form onSubmit={handleModalGiftSubmit} className="mt-4 space-y-3.5">
                                        {kyaKareinLot.status !== 'fresh' ? (
                                            <div className="p-3 bg-gray-50 border border-gray-200 text-xs text-[#4B5563] rounded-lg">
                                                {isUrdu ? 'تحفہ صرف تازہ لاٹ کے لیے ہے۔ ایکسپائر ہونے والے یا ایکسپائرڈ مال پر تحفہ بند ہے۔' : 'Promotional gifts are only allowed for fresh stock. Gifts are disabled for expiring or expired items.'}
                                            </div>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs font-bold text-[#111827] block mb-1">
                                                            {isUrdu ? `کتنا تحفہ (${kyaKareinLot.unit}):` : `Gift Quantity (${kyaKareinLot.unit}):`}
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={actionGiftQty}
                                                            onChange={(e) => setActionGiftQty(e.target.value)}
                                                            min="0.1"
                                                            max={kyaKareinLot.quantity}
                                                            step="any"
                                                            required
                                                            className="w-full h-11 px-3.5 text-base font-bold text-[#111827] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] font-mono"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-[#111827] block mb-1">
                                                            {isUrdu ? 'وجہ:' : 'Reason:'}
                                                        </label>
                                                        <select
                                                            value={actionGiftReason}
                                                            onChange={(e) => setActionGiftReason(e.target.value)}
                                                            className="w-full h-11 px-3.5 text-xs font-medium text-[#111827] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] cursor-pointer"
                                                        >
                                                            <option value="Loyalty">{isUrdu ? 'وفاداری (Loyalty)' : 'Loyalty'}</option>
                                                            <option value="Eid">{isUrdu ? 'عید تحفہ (Eid)' : 'Eid'}</option>
                                                            <option value="Muawza">{isUrdu ? 'معاوضہ (Compensation)' : 'Muawza'}</option>
                                                            <option value="Sample">{isUrdu ? 'نمونہ (Sample)' : 'Sample'}</option>
                                                            <option value="Taaluqat">{isUrdu ? 'تعلقات (PR)' : 'Taaluqat'}</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-xs font-bold text-[#111827] block mb-1">
                                                        {isUrdu ? 'کس کو (اختیاری):' : 'Kis ko (optional):'}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={actionGiftRecipient}
                                                        onChange={(e) => setActionGiftRecipient(e.target.value)}
                                                        placeholder={isUrdu ? 'نام درج کریں (اختیاری)' : 'Recipient name (optional)'}
                                                        className="w-full h-11 px-3.5 text-sm font-medium text-[#111827] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d]"
                                                    />
                                                </div>

                                                <div className="flex items-center gap-2 pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={closeKyaKareinModal}
                                                        className="flex-1 py-2.5 rounded-lg border border-gray-300 text-xs font-semibold text-[#374151] hover:bg-gray-50 cursor-pointer"
                                                    >
                                                        {isUrdu ? 'منسوخ' : 'Cancel'}
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={isSubmittingAction}
                                                        className="flex-1 py-2.5 rounded-lg bg-[#14532d] hover:bg-[#166534] text-xs font-bold text-white shadow-xs cursor-pointer"
                                                    >
                                                        {isSubmittingAction ? (isUrdu ? 'ریکارڈ ہو رہا ہے...' : 'Recording...') : (isUrdu ? 'تحفہ ریکارڈ کریں' : 'Gift Record Karein')}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </form>
                                )}

                                {/* Action 3 Form: Farmer ko wapas karein */}
                                {modalActionTab === 'return_farmer' && (
                                    <form onSubmit={handleModalReturnSubmit} className="mt-4 space-y-3.5">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-bold text-[#111827] block mb-1">
                                                    {isUrdu ? `کتنا (${kyaKareinLot.unit}):` : `Kitna (${kyaKareinLot.unit}):`}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={actionReturnQty}
                                                    onChange={(e) => setActionReturnQty(e.target.value)}
                                                    placeholder={`Max: ${kyaKareinLot.quantity}`}
                                                    min="0.1"
                                                    max={kyaKareinLot.quantity}
                                                    step="any"
                                                    required
                                                    className="w-full h-11 px-3.5 text-base font-bold text-[#111827] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-[#111827] block mb-1">
                                                    {isUrdu ? 'کس کسان کو:' : 'Kis Kisan Ko:'}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={actionReturnFarmer}
                                                    onChange={(e) => setActionReturnFarmer(e.target.value)}
                                                    placeholder={isUrdu ? 'کسان کا نام' : 'Kisan ka naam'}
                                                    required
                                                    className="w-full h-11 px-3.5 text-sm font-medium text-[#111827] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d]"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 pt-2">
                                            <button
                                                type="button"
                                                onClick={closeKyaKareinModal}
                                                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-xs font-semibold text-[#374151] hover:bg-gray-50 cursor-pointer"
                                            >
                                                {isUrdu ? 'منسوخ' : 'Cancel'}
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSubmittingAction}
                                                className="flex-1 py-2.5 rounded-lg bg-[#14532d] hover:bg-[#166534] text-xs font-bold text-white shadow-xs cursor-pointer"
                                            >
                                                {isSubmittingAction ? (isUrdu ? 'تصدیق ہو رہی ہے...' : 'Submitting...') : (isUrdu ? 'کسان کو واپسی کی تصدیق کریں' : 'Confirm Return to Farmer')}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {/* Action 4 Form: Wastage likhein */}
                                {modalActionTab === 'wastage' && (
                                    <form onSubmit={handleModalWastageSubmit} className="mt-4 space-y-3.5">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-bold text-[#111827] block mb-1">
                                                    {isUrdu ? `مقدار (${kyaKareinLot.unit}):` : `Quantity (${kyaKareinLot.unit}):`}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={actionWastageQty}
                                                    onChange={(e) => setActionWastageQty(e.target.value)}
                                                    placeholder={`Max: ${kyaKareinLot.quantity}`}
                                                    min="0.1"
                                                    max={kyaKareinLot.quantity}
                                                    step="any"
                                                    required
                                                    className="w-full h-11 px-3.5 text-base font-bold text-[#111827] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-[#111827] block mb-1">
                                                    {isUrdu ? 'وجہ (Reason):' : 'Reason:'}
                                                </label>
                                                <select
                                                    value={actionWastageReason}
                                                    onChange={(e) => setActionWastageReason(e.target.value)}
                                                    className="w-full h-11 px-3.5 text-xs font-medium text-[#111827] bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] cursor-pointer"
                                                >
                                                    <option value="Expire Maal">{isUrdu ? 'ایکسپائرڈ مال (شیلف لائف ختم)' : 'Expired Stock (Shelf life over)'}</option>
                                                    <option value="Gal Sad Gaya">{isUrdu ? 'گل سڑ گیا (نمی کی خرابی)' : 'Spoiled / Rotten (Moisture damage)'}</option>
                                                    <option value="Sukh Gaya">{isUrdu ? 'سوکھ گیا (گرمی کی خرابی)' : 'Dried Up (Heat damage)'}</option>
                                                    <option value="Raste ka Nuqsan">{isUrdu ? 'راستے کا نقصان (ٹرانسپورٹ)' : 'Transit Damage'}</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs flex justify-between items-center">
                                            <span className="text-[#4B5563]">{isUrdu ? 'نقصان کی رقم:' : 'Loss Amount:'}</span>
                                            <span className="font-bold text-sm text-[#111827] font-mono">
                                                {formatRs((parseFloat(actionWastageQty) || 0) * kyaKareinLot.rate)}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 pt-2">
                                            <button
                                                type="button"
                                                onClick={closeKyaKareinModal}
                                                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-xs font-semibold text-[#374151] hover:bg-gray-50 cursor-pointer"
                                            >
                                                {isUrdu ? 'منسوخ' : 'Cancel'}
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSubmittingAction}
                                                className="flex-1 py-2.5 rounded-lg bg-[#14532d] hover:bg-[#166534] text-xs font-bold text-white shadow-xs cursor-pointer"
                                            >
                                                {isSubmittingAction ? (isUrdu ? 'ریکارڈ ہو رہا ہے...' : 'Recording...') : (isUrdu ? 'ضیاع ریکارڈ کریں' : 'Record Wastage')}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
