import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import ListPicker, { type PickerItem } from '@/components/app/list-picker';
import MandiPageHeader from '@/components/app/mandi-page-header';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
    type BankAccount,
    getStoredBankAccounts,
    updateAccountBalance,
    addStoredTransfer,
    EVENT_BANKING_UPDATED,
} from '@/lib/banking-store';

interface MerchantOption {
    id: number;
    code: number;
    name_en: string;
    name_ur: string;
    current_balance: number;
}

interface ItemOption {
    id: number;
    code: number;
    name_en: string;
    name_ur: string;
    unit: string;
    default_rate: number;
    default_bardana: number;
    current_stock?: number;
    opening_stock?: number;
    kg_per_unit?: number;
    status?: string;
    computed_status?: string;
}

interface Sale {
    id: number;
    date: string;
    merchant_id: number;
    item_id: number;
    nag: number;
    weight: number;
    rate: number;
    bardana: number;
    gross_amount: number;
    payment_type?: 'naqdi' | 'udhaar' | 'bank' | 'split';
    cash_received?: number;
    udhaar_amount?: number;
    merchant?: {
        id: number;
        code: number;
        name_en: string;
        name_ur: string;
        name: string;
    };
    item?: {
        id: number;
        code: number;
        name_en: string;
        name_ur: string;
        name: string;
        unit: string;
    };
}

interface Summary {
    total_records: number;
    total_gross: number;
    total_nag: number;
    cash_nag: number;
    cash_amount: number;
    credit_nag: number;
    credit_amount: number;
    bank_nag?: number;
    bank_amount?: number;
}

interface Props {
    sales: Sale[];
    summary: Summary;
    merchants: MerchantOption[];
    items: ItemOption[];
    topItems?: ItemOption[];
    recentRates?: Record<number, number>;
    filters: {
        date: string;
        search?: string;
    };
}

export default function AmrozaIndex({
    sales,
    summary,
    merchants,
    items,
    topItems = [],
    recentRates = {},
    filters,
}: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [selectedDate, setSelectedDate] = useState(filters.date || new Date().toISOString().split('T')[0]);
    const [searchFilter, setSearchFilter] = useState(filters.search || '');
    const [editingSale, setEditingSale] = useState<Sale | null>(null);
    const [packingType, setPackingType] = useState<string>('Bori');
    const [lastAddedId, setLastAddedId] = useState<number | null>(null);

    // Active tooltip per step (ID IDE-style black tooltip)
    const [activeTooltipStep, setActiveTooltipStep] = useState<string | null>(null);
    const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Flashing step trigger (red border + shake)
    const [flashingStep, setFlashingStep] = useState<string | null>(null);

    // Delete confirmation dialog & undo state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
    const [undoSale, setUndoSale] = useState<Sale | null>(null);
    const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Slip Modal for receipt view / print
    const [slipModalOpen, setSlipModalOpen] = useState(false);
    const [slipSale, setSlipSale] = useState<Sale | null>(null);

    // Banking accounts for Bank / Online payment
    const [accounts, setAccounts] = useState<BankAccount[]>(() => getStoredBankAccounts());
    const [selectedBankAccount, setSelectedBankAccount] = useState<string>(() => {
        const accs = getStoredBankAccounts();
        return accs.length > 0 ? accs[0].name : '';
    });
    const [bankRefNo, setBankRefNo] = useState<string>('');

    // Synchronize accounts from banking store
    useEffect(() => {
        const handleUpdate = () => {
            const accs = getStoredBankAccounts();
            setAccounts(accs);
            if (accs.length > 0 && !accs.some((a) => a.name === selectedBankAccount)) {
                setSelectedBankAccount(accs[0].name);
            }
        };
        window.addEventListener(EVENT_BANKING_UPDATED, handleUpdate);
        window.addEventListener('storage', handleUpdate);
        return () => {
            window.removeEventListener(EVENT_BANKING_UPDATED, handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, [selectedBankAccount]);

    // Section Refs for scroll / focus
    const stepPaymentRef = useRef<HTMLDivElement>(null);
    const stepBuyerRef = useRef<HTMLDivElement>(null);
    const stepItemRef = useRef<HTMLDivElement>(null);
    const stepUnitsRef = useRef<HTMLDivElement>(null);
    const stepWeightRef = useRef<HTMLDivElement>(null);
    const stepRateRef = useRef<HTMLDivElement>(null);

    // Input refs
    const nagRef = useRef<HTMLInputElement>(null);
    const weightRef = useRef<HTMLInputElement>(null);
    const rateRef = useRef<HTMLInputElement>(null);
    const bardanaRef = useRef<HTMLInputElement>(null);
    const submitBtnRef = useRef<HTMLButtonElement>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'خریدار کھاتہ' : 'Buyer Ledger', href: '#' },
        { title: isUrdu ? 'آج کی بکری (امروزہ)' : "Today's Sales", href: '/amroza' },
    ];

    // INITIAL STATE: No payment type selected, no item pre-selected
    const { data, setData, post, put, processing } = useForm({
        date: selectedDate,
        merchant_id: '',
        merchant_code: '',
        item_id: '',
        nag: '',
        weight: '',
        rate: '',
        bardana: '0',
        payment_type: '' as '' | 'naqdi' | 'udhaar' | 'bank' | 'split',
        cash_received: '',
        udhaar_amount: '',
    });

    // ALL INPUTS UNLOCKED & ACTIVE FROM THE START (Requirement 1):
    const isBuyerUnlocked = true;
    const isItemUnlocked = true;
    const isUnitsUnlocked = true;
    const isWeightUnlocked = true;
    const isRateUnlocked = true;

    const numNag = parseFloat(data.nag) || 0;
    const numWeight = parseFloat(data.weight) || 0;
    const numRate = parseFloat(data.rate) || 0;
    const numBardana = parseFloat(data.bardana) || 0;

    const isBankValid = data.payment_type !== 'bank' || Boolean(selectedBankAccount);
    const isSplitValid = data.payment_type !== 'split' || (data.cash_received !== '' || data.udhaar_amount !== '');
    const isAddEnabled = Boolean(
        data.payment_type &&
        data.merchant_id &&
        data.item_id &&
        numNag > 0 &&
        numRate > 0 &&
        isBankValid &&
        isSplitValid
    );

    const currentMerchant = useMemo(() => {
        return merchants.find(m => String(m.id) === String(data.merchant_id));
    }, [merchants, data.merchant_id]);

    const currentItem = useMemo(() => {
        return items.find(i => String(i.id) === String(data.item_id));
    }, [items, data.item_id]);

    const lineAmount = numNag * numRate;
    const grossAmount = Math.round((lineAmount + numBardana) * 100) / 100;

    const recentItemRate = currentItem ? recentRates[currentItem.id] : null;
    const isRateUnusual = useMemo(() => {
        if (!recentItemRate || !numRate || recentItemRate <= 0) return false;
        const diffPercent = Math.abs(numRate - recentItemRate) / recentItemRate;
        return diffPercent >= 0.4;
    }, [recentItemRate, numRate]);

    const quickItems = useMemo(() => {
        // Order: Aloo (#1), Piyaz (#2), Lehsan (#6), Band Gobhi (#5), Mirchi (#7), Tamatar (#3), Harri Mirch (#4)
        const orderMap: Record<number, number> = { 1: 1, 2: 2, 6: 3, 5: 4, 7: 5, 3: 6, 4: 7 };
        const source = (topItems && topItems.length > 0) ? topItems : items;
        return source.slice().sort((a, b) => (orderMap[a.id] ?? (a.id + 10)) - (orderMap[b.id] ?? (b.id + 10)));
    }, [topItems, items]);

    // Buyer searchable input state
    const [buyerSearchQuery, setBuyerSearchQuery] = useState('');
    const [buyerDropdownOpen, setBuyerDropdownOpen] = useState(false);
    const buyerContainerRef = useRef<HTMLDivElement>(null);
    const buyerInputRef = useRef<HTMLInputElement>(null);

    // Sync search query when currentMerchant changes externally (e.g. edit mode)
    useEffect(() => {
        if (currentMerchant) {
            setBuyerSearchQuery(String(currentMerchant.code));
        } else if (!data.merchant_id) {
            setBuyerSearchQuery('');
        }
    }, [data.merchant_id, currentMerchant]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (buyerContainerRef.current && !buyerContainerRef.current.contains(e.target as Node)) {
                setBuyerDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredMerchants = useMemo(() => {
        if (!buyerSearchQuery.trim()) return merchants.slice(0, 30);
        const q = buyerSearchQuery.toLowerCase().trim();
        return merchants.filter(m =>
            String(m.code).includes(q) ||
            (m.name_en && m.name_en.toLowerCase().includes(q)) ||
            (m.name_ur && m.name_ur.includes(q))
        ).slice(0, 30);
    }, [merchants, buyerSearchQuery]);

    function handleSelectBuyer(m: MerchantOption) {
        setData(d => ({
            ...d,
            merchant_id: String(m.id),
            merchant_code: String(m.code),
        }));
        setBuyerSearchQuery(String(m.code));
        setBuyerDropdownOpen(false);
        nagRef.current?.focus();
    }

    const missingFields = useMemo(() => {
        const list: string[] = [];
        if (!data.payment_type) list.push(isUrdu ? 'ادائیگی' : 'Payment');
        if (data.payment_type === 'bank' && !selectedBankAccount) list.push(isUrdu ? 'بینک اکاؤنٹ' : 'Bank Account');
        if (!data.merchant_id) list.push(isUrdu ? 'خریدار' : 'Buyer');
        if (!data.item_id) list.push(isUrdu ? 'مال' : 'Item');
        if (numNag <= 0) list.push(packingType);
        if (numRate <= 0) list.push(isUrdu ? 'ریٹ' : 'Rate');
        return list;
    }, [data.payment_type, selectedBankAccount, data.merchant_id, data.item_id, numNag, numRate, packingType, isUrdu]);

    // Keyboard shortcuts: F1 = Cash, F2 = Udhaar, F3 = Bank/Online
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F1') {
                e.preventDefault();
                handleSelectPayment('naqdi');
            } else if (e.key === 'F2') {
                e.preventDefault();
                handleSelectPayment('udhaar');
            } else if (e.key === 'F3') {
                e.preventDefault();
                handleSelectPayment('bank');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isUrdu]);

    // 30-second background polling for real-time updates
    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({ preserveScroll: true, preserveState: true });
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    // Show tooltip popup
    function showTooltip(step: string) {
        if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
        setActiveTooltipStep(step);
        tooltipTimeoutRef.current = setTimeout(() => {
            setActiveTooltipStep(null);
        }, 3000);
    }

    // Trigger feedback on locked step click
    function triggerLockedFeedback(requiredStep: string, targetRef?: React.RefObject<HTMLDivElement | null>) {
        showTooltip(requiredStep);

        setFlashingStep(requiredStep);
        setTimeout(() => {
            setFlashingStep(null);
        }, 1100);

        if (targetRef && targetRef.current) {
            targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function handleSelectPayment(type: 'naqdi' | 'udhaar' | 'bank' | 'split') {
        let cash = '';
        let udhaar = '';
        if (type === 'split') {
            const half = grossAmount > 0 ? Math.round(grossAmount / 2) : 0;
            cash = String(half);
            udhaar = String(grossAmount - half);
        }
        setData(prev => ({
            ...prev,
            payment_type: type,
            cash_received: cash,
            udhaar_amount: udhaar,
        }));
        setActiveTooltipStep(null);
        setBuyerDropdownOpen(false);
    }

    function handleCashReceivedChange(val: string) {
        const cash = parseFloat(val) || 0;
        const remaining = Math.max(0, Math.round((grossAmount - cash) * 100) / 100);
        setData(prev => ({
            ...prev,
            cash_received: val,
            udhaar_amount: grossAmount > 0 ? String(remaining) : prev.udhaar_amount,
        }));
    }

    function handleUdhaarAmountChange(val: string) {
        const udhaar = parseFloat(val) || 0;
        const cash = Math.max(0, Math.round((grossAmount - udhaar) * 100) / 100);
        setData(prev => ({
            ...prev,
            udhaar_amount: val,
            cash_received: grossAmount > 0 ? String(cash) : prev.cash_received,
        }));
    }

    function handleDateChange(newDate: string) {
        setSelectedDate(newDate);
        setData('date', newDate);
        router.get('/amroza', { date: newDate, search: searchFilter }, { preserveState: true, replace: true });
    }

    function setQuickDate(offsetDays: number) {
        const target = new Date();
        target.setDate(target.getDate() + offsetDays);
        const yyyy = target.getFullYear();
        const mm = String(target.getMonth() + 1).padStart(2, '0');
        const dd = String(target.getDate()).padStart(2, '0');
        const str = `${yyyy}-${mm}-${dd}`;
        handleDateChange(str);
    }

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        router.get('/amroza', { date: selectedDate, search: searchFilter }, { preserveState: true, replace: true });
    }

    function handleItemSelect(item: ItemOption) {
        const liveStock = item.current_stock ?? item.opening_stock ?? 0;
        const isKhatam = item.status === 'khatam' || item.computed_status === 'khatam' || liveStock <= 0;
        const isExpired = !isKhatam && (item.status === 'expired' || item.computed_status === 'expired' || item.id === 4);

        if (isExpired) {
            toast.error(isUrdu ? 'یہ مال ایکسپائر ہو چکا ہے، فروخت نہیں ہو سکتا' : 'Expired maal sale nahi ho sakta');
            return;
        }

        const itemUnit = (item.unit || '').toLowerCase();
        if (itemUnit.includes('peti')) setPackingType('Peti');
        else setPackingType('Bori');

        setData(d => ({
            ...d,
            item_id: String(item.id),
            rate: item.default_rate && (!d.rate || d.rate === '0') ? String(item.default_rate) : d.rate,
            bardana: item.default_bardana && (!d.bardana || d.bardana === '0') ? String(item.default_bardana) : d.bardana,
        }));
        nagRef.current?.focus();
    }

    function attemptSubmit(e?: React.FormEvent) {
        if (e) e.preventDefault();

        if (!isAddEnabled) {
            if (!data.payment_type) {
                toast.error(isUrdu ? 'ادائیگی کا طریقہ منتخب کریں' : 'Please select Payment Type');
            } else if (data.payment_type === 'bank' && !selectedBankAccount) {
                toast.error(isUrdu ? 'بینک سیل کے لیے بینک اکاؤنٹ منتخب کرنا ضروری ہے' : 'Selecting a bank account is mandatory for Bank sale');
            } else if (!data.merchant_id) {
                toast.error(isUrdu ? 'خریدار منتخب کریں' : 'Please select Buyer');
            } else if (!data.item_id) {
                toast.error(isUrdu ? 'مال / آئٹم منتخب کریں' : 'Please select Item');
            } else if (numNag <= 0) {
                toast.error(isUrdu ? 'تعداد درج کریں' : 'Please enter Units');
            } else if (numRate <= 0) {
                toast.error(isUrdu ? 'ریٹ درج کریں' : 'Please enter Rate');
            }
            return;
        }

        executeSave();
    }

    function executeSave() {
        const currentDate = data.date;

        if (editingSale) {
            put(`/merchants/amroza/${editingSale.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(isUrdu ? 'ریکارڈ کامیابی سے تبدیل ہو گیا!' : 'Saved successfully!');
                    setEditingSale(null);
                    resetForm('', currentDate);
                },
            });
        } else {
            post('/merchants/amroza', {
                preserveScroll: true,
                onSuccess: () => {
                    // Real-time synchronization with Banking System
                    if (data.payment_type === 'bank' && selectedBankAccount) {
                        updateAccountBalance(selectedBankAccount, grossAmount);
                        addStoredTransfer({
                            id: Date.now(),
                            title: `Online Sale Wasooli → ${selectedBankAccount}`,
                            subtext: `${currentDate} · Buyer: ${currentMerchant?.name_ur || currentMerchant?.name_en || 'Customer'} · ${currentItem?.name_ur || currentItem?.name_en || 'Item'}${bankRefNo.trim() ? ` (Ref: ${bankRefNo.trim()})` : ''}`,
                            amount: grossAmount,
                            date: currentDate,
                            bankName: selectedBankAccount,
                            type: 'deposit',
                        });
                        toast.success(
                            isUrdu
                                ? `نیا اندراج شامل ہو گیا اور ${selectedBankAccount} کا بیلنس اپ ڈیٹ ہو گیا!`
                                : `Added successfully and ${selectedBankAccount} balance updated!`
                        );
                    } else {
                        toast.success(isUrdu ? 'نیا اندراج شامل ہو گیا!' : 'Added successfully!');
                    }

                    resetForm('', currentDate);
                    setBankRefNo('');
                },
            });
        }
    }

    function resetForm(keepPaymentType: '' | 'naqdi' | 'udhaar' | 'bank' | 'split' = '', keepDate = selectedDate) {
        setData({
            date: keepDate,
            merchant_id: '',
            merchant_code: '',
            item_id: '',
            nag: '',
            weight: '',
            rate: '',
            bardana: '0',
            payment_type: keepPaymentType,
            cash_received: '',
            udhaar_amount: '',
        });
        setBuyerSearchQuery('');
        setBuyerDropdownOpen(false);
        setEditingSale(null);
        setBankRefNo('');

        if (keepPaymentType) {
            setBuyerDropdownOpen(false);
        } else {
            stepPaymentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    function startEdit(sale: Sale) {
        setEditingSale(sale);
        const itemUnit = (sale.item?.unit || '').toLowerCase();
        if (itemUnit.includes('peti')) setPackingType('Peti');
        else setPackingType('Bori');

        const pType = (sale.payment_type as any) || 'udhaar';
        setData({
            date: sale.date,
            merchant_id: String(sale.merchant_id),
            merchant_code: String(sale.merchant?.code || ''),
            item_id: String(sale.item_id),
            nag: String(sale.nag),
            weight: String(sale.weight || ''),
            rate: String(sale.rate),
            bardana: String(sale.bardana || '0'),
            payment_type: pType,
            cash_received: String((sale as any).cash_received || ''),
            udhaar_amount: String((sale as any).udhaar_amount || ''),
        });
        if (sale.merchant) {
            setBuyerSearchQuery(String(sale.merchant.code));
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function confirmDelete(sale: Sale) {
        setSaleToDelete(sale);
        setDeleteModalOpen(true);
    }

    function executeDelete() {
        if (!saleToDelete) return;
        const target = saleToDelete;
        setDeleteModalOpen(false);

        router.delete(`/merchants/amroza/${target.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setUndoSale(target);
                toast.success(isUrdu ? 'انٹری حذف کر دی گئی' : 'Entry deleted', {
                    action: {
                        label: isUrdu ? 'واپس لائیں (Undo 5s)' : 'Undo (5s)',
                        onClick: () => handleUndo(target),
                    },
                    duration: 5000,
                });

                if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
                undoTimerRef.current = setTimeout(() => {
                    setUndoSale(null);
                }, 5000);
            },
        });
    }

    function handleUndo(sale: Sale) {
        router.post('/merchants/amroza', {
            date: sale.date,
            merchant_id: sale.merchant_id,
            item_id: sale.item_id,
            nag: sale.nag,
            weight: sale.weight,
            rate: sale.rate,
            bardana: sale.bardana,
            payment_type: sale.payment_type || 'udhaar',
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(isUrdu ? 'انٹری بحال ہو گئی!' : 'Entry restored!');
                setUndoSale(null);
            },
        });
    }

    function openSlip(sale: Sale) {
        setSlipSale(sale);
        setSlipModalOpen(true);
    }

    function getWhatsAppUrl(sale: Sale): string {
        const pType = sale.payment_type === 'naqdi' ? (isUrdu ? 'نقد' : 'Cash') : sale.payment_type === 'bank' ? (isUrdu ? 'بینک' : 'Bank') : (isUrdu ? 'ادھار' : 'Udhaar');
        const mName = isUrdu ? (sale.merchant?.name_ur || sale.merchant?.name_en) : (sale.merchant?.name_en || sale.merchant?.name_ur);
        const iName = isUrdu ? (sale.item?.name_ur || sale.item?.name_en) : (sale.item?.name_en || sale.item?.name_ur);
        const phone = (sale.merchant as any)?.phone || '';

        const text = `*Vegetable POS - Sales Slip*
-------------------------
Date: ${sale.date}
Buyer: ${sale.merchant?.code} - ${mName}
Payment: ${pType}
Item: ${iName} (${sale.item?.unit || 'Bag'})
Units: ${sale.nag}
Weight: ${sale.weight > 0 ? sale.weight : '-'}
Rate: Rs. ${Number(sale.rate).toLocaleString()}
Packing Charges: Rs. ${Number(sale.bardana).toLocaleString()}
*Total Amount: Rs. ${Number(sale.gross_amount).toLocaleString()}*
-------------------------
Thank you!`;

        const encoded = encodeURIComponent(text);
        if (phone && phone.replace(/\D/g, '').length >= 10) {
            const cleanPhone = phone.replace(/\D/g, '');
            const finalPhone = cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone;
            return `https://wa.me/${finalPhone}?text=${encoded}`;
        }
        return `https://wa.me/?text=${encoded}`;
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'آج کی بکری (امروزہ)' : "Today's Sales"} />

            <style>{`
                @keyframes gentle-pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
                    50% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
                }
                @keyframes flash-shake {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-4px); }
                    40%, 80% { transform: translateX(4px); }
                }
                .pulse-attention {
                    animation: gentle-pulse 2s infinite ease-in-out;
                }
                .shake-error {
                    animation: flash-shake 0.4s ease-in-out;
                    border-color: #ef4444 !important;
                    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.25) !important;
                }
                /* NO BLUR: Clean sharp inputs with subtle disabled opacity */
                .step-locked-clean {
                    opacity: 0.65;
                    user-select: none;
                }
                /* IDE-style dark popover tooltip */
                .ide-tooltip-popup {
                    background-color: #18181b;
                    color: #fafafa;
                    border: 1px solid #3f3f46;
                    border-radius: 6px;
                    padding: 4px 10px;
                    font-size: 11px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3);
                    white-space: nowrap;
                    z-index: 50;
                    pointer-events: none;
                }
            `}</style>

            <div className="-mt-4 -mx-4 pb-24 bg-[#eef2ee] min-h-screen font-sans text-[#1a211c] dark:text-[#e7ece8]" dir={isUrdu ? 'rtl' : 'ltr'}>
                {/* 1. Dark Green Top Header Banner */}
                <MandiPageHeader
                    title={isUrdu ? 'آج کی بکری (امروزہ)' : "Today's Sales"}
                    subtitle={isUrdu ? "آج کی سیل اینٹری (امروزہ)" : "Aaj ki sale entry (Amroza)"}
                    isUrdu={isUrdu}
                >
                    <button
                        type="button"
                        onClick={() => setQuickDate(0)}
                        className={`h-9 px-4 rounded-xl text-xs md:text-sm font-semibold bg-[#20693e] hover:bg-[#287d4a] text-white border border-emerald-600/50 shadow-xs transition-colors cursor-pointer ${isUrdu ? 'font-nastaliq' : ''}`}
                    >
                        {isUrdu ? 'آج' : 'Today'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setQuickDate(-1)}
                        className={`h-9 px-4 rounded-xl text-xs md:text-sm font-semibold bg-[#20693e] hover:bg-[#287d4a] text-white border border-emerald-600/50 shadow-xs transition-colors cursor-pointer ${isUrdu ? 'font-nastaliq' : ''}`}
                    >
                        {isUrdu ? 'گزشتہ کل' : 'Yesterday'}
                    </button>
                    <div className="relative flex items-center">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => handleDateChange(e.target.value)}
                            className="h-9 w-32 rounded-xl bg-white text-gray-900 font-bold text-xs md:text-sm cursor-pointer shadow-xs px-2.5 text-center border-0 outline-none"
                        />
                    </div>
                </MandiPageHeader>

                {/* Form & Records Container */}
                <div className="max-w-7xl mx-auto px-3 md:px-6 -mt-6 md:-mt-8 space-y-3.5">
                    {/* 2. Main Entry Form & Bill Preview Grid */}
                    <form onSubmit={attemptSubmit}>
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                            
                            {/* LEFT CARD: Form Entry */}
                            <div className="lg:col-span-7 bg-white rounded-xl p-4 md:p-5 border border-gray-200/80 shadow-xs space-y-3.5">
                                
                                {/* 1. PAYMENT TYPE */}
                                <div ref={stepPaymentRef} className={`transition-all ${flashingStep === 'payment' ? 'shake-error rounded-2xl p-2 bg-red-50/80' : ''}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-5 h-5 rounded-full bg-[#1e713e] text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                                        <label className={`text-xs font-bold text-gray-700 uppercase tracking-wider ${isUrdu ? 'font-nastaliq text-sm' : ''}`}>
                                            {isUrdu ? 'ادائیگی کا طریقہ (PAYMENT TYPE)' : 'PAYMENT TYPE'}
                                        </label>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => handleSelectPayment('naqdi')}
                                            className={`h-10 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer ${
                                                data.payment_type === 'naqdi'
                                                    ? 'bg-[#1e713e] text-white shadow-xs'
                                                    : 'bg-white text-gray-800 border border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                                            }`}
                                        >
                                            <span>Cash</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleSelectPayment('udhaar')}
                                            className={`h-10 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer ${
                                                data.payment_type === 'udhaar'
                                                    ? 'bg-[#1e713e] text-white shadow-xs'
                                                    : 'bg-white text-gray-800 border border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                                            }`}
                                        >
                                            <span>Udhaar</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleSelectPayment('bank')}
                                            className={`h-10 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer ${
                                                data.payment_type === 'bank'
                                                    ? 'bg-[#1e713e] text-white shadow-xs'
                                                    : 'bg-white text-gray-800 border border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                                            }`}
                                        >
                                            <span>Bank</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleSelectPayment('split')}
                                            className={`h-10 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer text-center px-1 leading-tight ${
                                                data.payment_type === 'split'
                                                    ? 'bg-[#1e713e] text-white shadow-xs'
                                                    : 'bg-white text-gray-800 border border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                                            }`}
                                        >
                                            <span>Adha Cash + Adha udhaar</span>
                                        </button>
                                    </div>

                                    {/* Sub-row when Adha Cash + Adha Udhaar (Split) is selected */}
                                    {data.payment_type === 'split' && (
                                        <div className="mt-2.5 p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2.5 animate-in fade-in duration-150">
                                            <div className="flex items-center justify-between text-xs text-amber-950 font-bold">
                                                <span>{isUrdu ? 'تقسیم ادائیگی (کیش + ادھار)' : 'Adha Cash + Adha Udhaar (Split Payment)'}</span>
                                                <span className="text-gray-600 font-semibold">
                                                    {isUrdu ? 'کل بل: ' : 'Kul Bill: '}
                                                    <strong className="text-green-900 font-bold">Rs. {grossAmount.toLocaleString()}</strong>
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                        {isUrdu ? 'ابھی ملے (نقد رقم / Cash)' : 'Abhi Mile (Cash Raqam) *'}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        value={data.cash_received}
                                                        onChange={e => handleCashReceivedChange(e.target.value)}
                                                        placeholder="0"
                                                        className="w-full h-9 px-3 text-xs font-bold border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1e713e] transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                        {isUrdu ? 'ادھار باقی (کھاتے میں)' : 'Udhaar Baaqi (Remaining Credit) *'}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        value={data.udhaar_amount}
                                                        onChange={e => handleUdhaarAmountChange(e.target.value)}
                                                        placeholder="0"
                                                        className="w-full h-9 px-3 text-xs font-bold border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1e713e] transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sub-row when Bank / Online is selected */}
                                    {data.payment_type === 'bank' && (
                                        <div className="mt-2.5 p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2 animate-in fade-in duration-150">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                        {isUrdu ? 'کس اکاؤنٹ میں وصولی ہوگی' : 'Kis Account Mein Wasooli Hogi'}
                                                    </label>
                                                    <select
                                                        value={selectedBankAccount}
                                                        onChange={(e) => setSelectedBankAccount(e.target.value)}
                                                        className="w-full px-2.5 py-1.5 text-xs font-semibold border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#1e713e] transition-all cursor-pointer"
                                                    >
                                                        {accounts.length === 0 ? (
                                                            <option value="" disabled>
                                                                {isUrdu ? 'کوئی بینک اکاؤنٹ دستیاب نہیں' : 'No bank accounts available'}
                                                            </option>
                                                        ) : (
                                                            accounts.map((acc) => (
                                                                <option key={acc.id} value={acc.name}>
                                                                    {acc.name} ({acc.type} · Rs. {Number(acc.current_balance).toLocaleString('en-US')})
                                                                </option>
                                                            ))
                                                        )}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                        {isUrdu ? 'TID / ریفرنس نمبر (اختیاری)' : 'TID / Raast Ref (Optional)'}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={bankRefNo}
                                                        onChange={(e) => setBankRefNo(e.target.value)}
                                                        placeholder="e.g. TID-88231"
                                                        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-border rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1e713e] transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 2. BUYER */}
                                <div ref={stepBuyerRef} className="transition-all">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-5 h-5 rounded-full bg-[#1e713e] text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                                        <label className={`text-xs font-bold text-gray-700 uppercase tracking-wider ${isUrdu ? 'font-nastaliq text-sm' : ''}`}>
                                            {isUrdu ? 'خریدار (BUYER)' : 'BUYER'}
                                        </label>
                                    </div>
                                    <div ref={buyerContainerRef} className="relative">
                                        <Input
                                            ref={buyerInputRef}
                                            value={buyerSearchQuery}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setBuyerSearchQuery(val);
                                                setBuyerDropdownOpen(true);
                                                if (!val.trim()) {
                                                    setData(d => ({ ...d, merchant_id: '', merchant_code: '' }));
                                                }
                                            }}
                                            onClick={() => setBuyerDropdownOpen(true)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const trimmed = buyerSearchQuery.trim();
                                                    const codeMatch = merchants.find(m => String(m.code) === trimmed);
                                                    if (codeMatch) {
                                                        handleSelectBuyer(codeMatch);
                                                        return;
                                                    }
                                                    if (filteredMerchants.length > 0) {
                                                        handleSelectBuyer(filteredMerchants[0]);
                                                        return;
                                                    }
                                                } else if (e.key === 'Escape') {
                                                    setBuyerDropdownOpen(false);
                                                }
                                            }}
                                            placeholder={isUrdu ? 'کوڈ یا نام لکھیں...' : 'Code ya naam likhein...'}
                                            className="h-10 rounded-xl border-gray-200 px-3 pe-10 text-xs md:text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#1e713e] shadow-xs"
                                        />
                                        <Icon name="MagnifyingGlass" className="size-4 text-gray-400 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />

                                        {/* Dropdown list */}
                                        {buyerDropdownOpen && (
                                            <div className="absolute z-50 start-0 end-0 mt-1 max-h-56 overflow-y-auto bg-white rounded-2xl border border-gray-200 shadow-xl divide-y divide-gray-100">
                                                {filteredMerchants.length === 0 ? (
                                                    <div className="p-3 text-xs text-gray-500 text-center">
                                                        {isUrdu ? 'کوئی خریدار نہیں ملا' : 'No buyer found'}
                                                    </div>
                                                ) : (
                                                    filteredMerchants.map(m => (
                                                        <button
                                                            key={m.id}
                                                            type="button"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                handleSelectBuyer(m);
                                                            }}
                                                            className="w-full text-start px-4 py-2.5 text-xs hover:bg-gray-50 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                                                        >
                                                            <div className="flex items-center gap-2 truncate">
                                                                <span className="font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                                                                    #{m.code}
                                                                </span>
                                                                <span className={`font-semibold text-gray-800 truncate ${isUrdu ? 'font-nastaliq' : ''}`}>
                                                                    {isUrdu ? (m.name_ur || m.name_en) : (m.name_en || m.name_ur)}
                                                                </span>
                                                            </div>
                                                            <span className="text-gray-600 shrink-0 text-xs">
                                                                Rs. {Number(m.current_balance).toLocaleString()}
                                                            </span>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}

                                        {currentMerchant && (
                                            <div className="mt-1.5 text-xs text-gray-700 flex items-center gap-1.5 px-1 font-sans">
                                                <Icon name="CheckCircle" className="size-3.5 text-[#1e713e]" weight="bold" />
                                                <span className={`font-bold text-gray-900 ${isUrdu ? 'font-nastaliq' : ''}`}>
                                                    {isUrdu ? (currentMerchant.name_ur || currentMerchant.name_en) : (currentMerchant.name_en || currentMerchant.name_ur)}
                                                </span>
                                                <span className="text-gray-500">(#{currentMerchant.code})</span>
                                                <span className="text-gray-400">|</span>
                                                <span className="text-gray-500">{isUrdu ? 'بقایا:' : 'Balance:'}</span>
                                                <span className="font-bold text-emerald-800">
                                                    Rs. {Number(currentMerchant.current_balance).toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 3. ITEM */}
                                <div ref={stepItemRef} className="relative transition-all">
                                    <div className="flex items-center gap-2 mb-2.5">
                                        <span className="w-5 h-5 rounded-full bg-[#1e713e] text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
                                        <label className={`text-xs font-bold text-gray-700 uppercase tracking-wider ${isUrdu ? 'font-nastaliq text-sm' : ''}`}>
                                            {isUrdu ? 'مال / آئٹم (ITEM)' : 'ITEM'}
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                                        {quickItems.map(item => {
                                            const isSelected = String(data.item_id) === String(item.id);
                                            const initial = (item.name_en || item.name_ur || 'I')[0].toUpperCase();
                                            
                                            // Clean English name without parentheses (e.g. "Aloo (Potato)" -> "Aloo")
                                            const cleanName = (item.name_en || item.name_ur || '')
                                                .replace(/\s*\(.*?\)\s*/g, '')
                                                .trim();

                                            const liveStock = item.current_stock ?? item.opening_stock ?? 0;
                                            const isKhatam = item.status === 'khatam' || item.computed_status === 'khatam' || liveStock <= 0;
                                            const isExpired = !isKhatam && (item.status === 'expired' || item.computed_status === 'expired' || item.id === 4);
                                            const unitName = item.unit || 'Bori';

                                            let labelText = `${cleanName} - ${liveStock} ${unitName}`;
                                            if (isExpired) {
                                                labelText = `${cleanName} - Expired`;
                                            } else if (isKhatam) {
                                                labelText = `${cleanName} - Khatam`;
                                            }

                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    disabled={isExpired}
                                                    tabIndex={0}
                                                    onClick={() => handleItemSelect(item)}
                                                    className={cn(
                                                        "min-h-[40px] px-2 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer",
                                                        isSelected
                                                            ? isExpired
                                                                ? 'bg-red-600 text-white border-red-700 shadow-xs font-bold'
                                                                : 'bg-[#1e713e] text-white border-[#1e713e] shadow-xs font-bold'
                                                            : isExpired
                                                            ? 'bg-red-50 text-red-600 border-red-200 cursor-not-allowed font-bold'
                                                            : isKhatam
                                                            ? 'opacity-50 bg-gray-50 text-gray-400 border-gray-200 hover:opacity-75 font-medium'
                                                            : 'bg-white text-gray-800 border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 font-semibold'
                                                    )}
                                                >
                                                    <span className={`w-5.5 h-5.5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0 ${
                                                        isSelected
                                                            ? 'bg-white text-[#1e713e] shadow-xs'
                                                            : isExpired
                                                            ? 'bg-red-200 text-red-800'
                                                            : isKhatam
                                                            ? 'bg-gray-200 text-gray-500'
                                                            : 'bg-emerald-100/70 text-emerald-800'
                                                    }`}>
                                                        {initial}
                                                    </span>
                                                    <span className={cn(
                                                        "text-[11px] leading-tight",
                                                        isUrdu && "font-nastaliq",
                                                        isSelected
                                                            ? "text-white font-extrabold"
                                                            : isExpired
                                                            ? "text-red-600 font-bold"
                                                            : isKhatam
                                                            ? "text-gray-400 font-medium"
                                                            : "text-gray-900 font-semibold"
                                                    )}>
                                                        {isUrdu ? (item.name_ur || labelText) : labelText}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {items.length > quickItems.length && (
                                        <div className="mt-2.5 flex items-center gap-2">
                                            <span className={`text-xs text-gray-400 ${isUrdu ? 'font-nastaliq' : ''}`}>
                                                {isUrdu ? 'دیگر آئٹم:' : 'Other:'}
                                            </span>
                                            <select
                                                tabIndex={0}
                                                value={data.item_id}
                                                onChange={e => {
                                                    const it = items.find(i => String(i.id) === e.target.value);
                                                    if (it) handleItemSelect(it);
                                                }}
                                                className={`h-9 text-xs rounded-xl border border-gray-200 bg-white px-2.5 flex-1 max-w-xs text-gray-700 ${isUrdu ? 'font-nastaliq' : ''}`}
                                            >
                                                <option value="">{isUrdu ? 'آئٹم چنیں...' : 'Choose item...'}</option>
                                                {items.map(it => {
                                                    const clean = (it.name_en || '').replace(/\s*\(.*?\)\s*/g, '').trim();
                                                    const stStock = it.current_stock ?? it.opening_stock ?? 0;
                                                    const khat = it.status === 'khatam' || it.computed_status === 'khatam' || stStock <= 0;
                                                    const exp = !khat && (it.status === 'expired' || it.computed_status === 'expired' || it.id === 4);
                                                    const desc = khat ? `${clean} - Khatam` : exp ? `${clean} - Expired` : `${clean} - ${stStock} ${it.unit || 'Bori'}`;
                                                    return (
                                                        <option key={it.id} value={it.id}>
                                                            {it.code} - {isUrdu ? it.name_ur : desc}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {/* 4. QUANTITY */}
                                <div className="relative">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-[#1e713e] text-white text-[11px] font-bold flex items-center justify-center shrink-0">4</span>
                                            <label className={`text-xs font-bold text-gray-700 uppercase tracking-wider ${isUrdu ? 'font-nastaliq text-sm' : ''}`}>
                                                {isUrdu ? 'مقدار اور ریٹ (QUANTITY)' : 'QUANTITY'}
                                            </label>
                                        </div>

                                        {/* Packaging / Unit Option (Only Bori, Peti) */}
                                        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
                                            {(['Bori', 'Peti'] as const).map((unitOpt) => (
                                                <button
                                                    key={unitOpt}
                                                    type="button"
                                                    onClick={() => setPackingType(unitOpt)}
                                                    className={`px-4 py-1 rounded-lg text-xs sm:text-[13px] font-extrabold transition-all cursor-pointer ${
                                                        packingType === unitOpt
                                                            ? 'bg-[#14532d] text-white shadow-xs'
                                                            : 'text-gray-700 hover:text-black hover:bg-gray-200/60'
                                                    }`}
                                                >
                                                    {unitOpt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* UNITS / TADAAD */}
                                        <div
                                            ref={stepUnitsRef}
                                            className="h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-between px-3 transition-all focus-within:border-[#1e713e] focus-within:ring-2 focus-within:ring-[#1e713e]/20"
                                        >
                                            <span className={`text-xs font-semibold text-gray-700 shrink-0 ${isUrdu ? 'font-nastaliq' : ''}`}>
                                                {packingType} {isUrdu ? 'تعداد' : '(Tadaad)'}
                                            </span>
                                            <input
                                                ref={nagRef}
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={data.nag}
                                                onChange={e => setData('nag', e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        rateRef.current?.focus();
                                                    }
                                                }}
                                                placeholder="0"
                                                className="w-20 text-end font-bold text-gray-900 bg-transparent text-sm tabular-nums focus:outline-none placeholder:text-gray-400"
                                                required
                                            />
                                        </div>

                                        {/* RATE */}
                                        <div
                                            ref={stepRateRef}
                                            className="h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-between px-3 transition-all focus-within:border-[#1e713e] focus-within:ring-2 focus-within:ring-[#1e713e]/20"
                                        >
                                            <span className={`text-xs font-semibold text-gray-700 shrink-0 ${isUrdu ? 'font-nastaliq' : ''}`}>
                                                {isUrdu ? 'ریٹ' : 'Rate'} / {packingType.toLowerCase()}
                                            </span>
                                            <div className="flex items-center gap-1 font-bold text-gray-900">
                                                <span className="text-xs text-gray-400">Rs.</span>
                                                <input
                                                    ref={rateRef}
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={data.rate}
                                                    onChange={e => setData('rate', e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            if (isAddEnabled) attemptSubmit();
                                                        }
                                                    }}
                                                    placeholder="0"
                                                    className="w-20 text-end font-bold text-gray-900 bg-transparent text-sm tabular-nums focus:outline-none placeholder:text-gray-400"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT CARD: Bill Preview */}
                            <div className="lg:col-span-5 bg-white rounded-2xl p-5 md:p-6 border border-gray-200/80 shadow-xs flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <Icon name="Receipt" className="size-4 text-[#1e713e]" weight="bold" />
                                        <h3 className={`text-sm font-bold text-gray-900 ${isUrdu ? 'font-nastaliq text-base' : ''}`}>
                                            {isUrdu ? 'بل کی تفصیل (Bill Preview)' : 'Bill Preview'}
                                        </h3>
                                    </div>

                                    <div className="space-y-2.5 text-xs">
                                        <div className="flex justify-between items-center text-gray-600">
                                            <span className={isUrdu ? 'font-nastaliq' : 'font-medium'}>{isUrdu ? 'طریقہ ادائیگی' : 'Payment'}</span>
                                            <span className="font-bold text-gray-900">
                                                {data.payment_type
                                                    ? (data.payment_type === 'naqdi'
                                                        ? (isUrdu ? 'نقد (Cash)' : 'Cash')
                                                        : data.payment_type === 'bank'
                                                        ? (isUrdu ? `آن لائن (${selectedBankAccount || 'Bank'})` : `Online (${selectedBankAccount || 'Bank'})`)
                                                        : data.payment_type === 'split'
                                                        ? (isUrdu ? `آدھا نقد + آدھا ادھار (نقد: ${Number(data.cash_received || 0).toLocaleString()} · ادھار: ${Number(data.udhaar_amount || 0).toLocaleString()})` : `Adha Cash + Adha Udhaar (Cash: ${Number(data.cash_received || 0).toLocaleString()} · Udhaar: ${Number(data.udhaar_amount || 0).toLocaleString()})`)
                                                        : (isUrdu ? 'ادھار' : 'Udhaar'))
                                                    : '-'}
                                            </span>
                                        </div>
                                        <div className="border-t border-dashed border-gray-200" />

                                        <div className="flex justify-between items-center text-gray-600">
                                            <span className={isUrdu ? 'font-nastaliq' : 'font-medium'}>{isUrdu ? 'خریدار' : 'Buyer'}</span>
                                            <span className={`font-bold text-gray-900 truncate max-w-[200px] ${isUrdu ? 'font-nastaliq' : ''}`}>
                                                {currentMerchant
                                                    ? (isUrdu ? (currentMerchant.name_ur || currentMerchant.name_en) : (currentMerchant.name_en || currentMerchant.name_ur))
                                                    : '-'}
                                            </span>
                                        </div>
                                        <div className="border-t border-dashed border-gray-200" />

                                        <div className="flex justify-between items-center text-gray-600">
                                            <span className={isUrdu ? 'font-nastaliq' : 'font-medium'}>{isUrdu ? 'مال (آئٹم)' : 'Item'}</span>
                                            <span className={`font-bold text-gray-900 truncate max-w-[200px] ${isUrdu ? 'font-nastaliq' : ''}`}>
                                                {currentItem
                                                    ? (isUrdu ? (currentItem.name_ur || currentItem.name_en) : (currentItem.name_en || currentItem.name_ur))
                                                    : '-'}
                                            </span>
                                        </div>
                                        <div className="border-t border-dashed border-gray-200" />

                                        <div className="flex justify-between items-center text-gray-600">
                                            <span className={isUrdu ? 'font-nastaliq' : 'font-medium'}>
                                                {`${packingType} x Rate`}
                                            </span>
                                            <span className="font-bold text-gray-900 tabular-nums" dir="ltr">
                                                {numNag > 0 && numRate > 0
                                                    ? `${numNag} ${packingType} x ${numRate.toLocaleString()} = Rs. ${(numNag * numRate).toLocaleString()}`
                                                    : `0 ${packingType} x 0 = Rs. 0`}
                                            </span>
                                        </div>

                                        {numBardana > 0 && (
                                            <>
                                                <div className="border-t border-dashed border-gray-200" />
                                                <div className="flex justify-between items-center text-gray-600">
                                                    <span className={isUrdu ? 'font-nastaliq' : 'font-medium'}>{isUrdu ? 'بوری خرچہ' : 'Packing'}</span>
                                                    <span className="font-bold text-gray-900 tabular-nums" dir="ltr">
                                                        Rs. {numBardana.toLocaleString()}
                                                    </span>
                                                </div>
                                            </>
                                        )}

                                        {currentItem && (
                                            <>
                                                <div className="border-t border-dashed border-gray-200" />
                                                <div className="flex justify-between items-center text-gray-600">
                                                    <span className={isUrdu ? 'font-nastaliq' : 'font-medium'}>{isUrdu ? 'باقی اسٹاک' : 'Stock Baqi'}</span>
                                                    <span className="font-bold text-gray-900 tabular-nums">
                                                        {(currentItem.current_stock ?? currentItem.opening_stock ?? 0)} {currentItem.unit || packingType}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-5 space-y-3">
                                    <div className="bg-[#eef6f0] rounded-xl p-3 flex items-center justify-between">
                                        <span className={`text-[11px] font-bold text-gray-600 uppercase tracking-wider ${isUrdu ? 'font-nastaliq' : ''}`}>
                                            {isUrdu ? 'کل رقم' : 'TOTAL'}
                                        </span>
                                        <div className="text-2xl font-bold tabular-nums text-[#14532d]" dir="ltr">
                                            Rs. {grossAmount.toLocaleString()}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        {editingSale && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => resetForm()}
                                                className="h-10 px-4 rounded-xl border-red-300 text-red-600 hover:bg-red-50 text-xs font-semibold"
                                            >
                                                {isUrdu ? 'منسوخ' : 'Cancel'}
                                            </Button>
                                        )}
                                        <Button
                                            ref={submitBtnRef}
                                            type="submit"
                                            disabled={!isAddEnabled || processing}
                                            className={`w-full h-10 rounded-xl text-xs md:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-xs ${
                                                isAddEnabled
                                                    ? 'bg-[#1e713e] hover:bg-[#165a31] text-white cursor-pointer shadow-xs'
                                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-200'
                                            }`}
                                        >
                                            <span>
                                                {editingSale
                                                    ? (isUrdu ? 'تبدیل کریں' : 'Save Changes')
                                                    : (isUrdu ? 'محفوظ کریں' : 'Save Sale')}
                                            </span>
                                            <Icon name="Check" className="size-4" weight="bold" />
                                        </Button>
                                    </div>

                                    {!isAddEnabled && missingFields.length > 0 && (
                                        <p className="text-xs text-center text-gray-400 font-medium">
                                            {isUrdu ? 'باقی ہے: ' : 'Baqi hai: '}
                                            <span className="text-gray-600 font-semibold">{missingFields.join(isUrdu ? '، ' : ', ')}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </form>

                {/* 4. Controls Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-2xl border border-gray-100 shadow-xs">
                    <div className="flex items-center gap-2">
                        <span className={`text-xs text-muted-foreground ${isUrdu ? 'font-nastaliq' : ''}`}>
                            {isUrdu ? 'کل اندراج:' : 'Records:'}{' '}
                            <strong className="text-green-900">{sales.length}</strong>
                        </span>
                    </div>

                    {/* Search box */}
                    <form onSubmit={handleSearch} className="flex items-center gap-1 w-full md:w-60">
                        <Input
                            value={searchFilter}
                            onChange={e => setSearchFilter(e.target.value)}
                            placeholder={isUrdu ? "تلاش کریں..." : "Search..."}
                            className={`h-8 text-xs rounded-xl ${isUrdu ? 'font-nastaliq' : ''}`}
                        />
                        <Button type="submit" size="sm" variant="outline" className="h-8 px-2.5 rounded-xl">
                            <Icon name="MagnifyingGlass" className="size-3.5" />
                        </Button>
                    </form>
                </div>

                {/* 5. Entries Table */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px] font-semibold">
                            <thead className="bg-[#14532d] text-white select-none">
                                <tr>
                                    <th className={`p-2.5 text-center w-10 text-xs sm:text-sm ${isUrdu ? 'font-nastaliq' : ''}`}>#</th>
                                    <th className={`p-2.5 text-start w-24 text-xs sm:text-sm ${isUrdu ? 'font-nastaliq' : ''}`}>{isUrdu ? 'طریقہ' : 'Payment'}</th>
                                    <th className={`p-2.5 text-start w-16 text-xs sm:text-sm ${isUrdu ? 'font-nastaliq' : ''}`}>{isUrdu ? 'کوڈ' : 'Code'}</th>
                                    <th className={`p-2.5 text-start text-xs sm:text-sm ${isUrdu ? 'font-nastaliq' : ''}`}>{isUrdu ? 'خریدار' : 'Buyer'}</th>
                                    <th className={`p-2.5 text-start text-xs sm:text-sm ${isUrdu ? 'font-nastaliq' : ''}`}>{isUrdu ? 'آئٹم' : 'Item'}</th>
                                    <th className={`p-2.5 text-end w-28 text-xs sm:text-sm ${isUrdu ? 'font-nastaliq' : ''}`}>{isUrdu ? 'تعداد' : 'Units'}</th>
                                    <th className={`p-2.5 text-end w-24 text-xs sm:text-sm ${isUrdu ? 'font-nastaliq' : ''}`}>{isUrdu ? 'ریٹ' : 'Rate'}</th>
                                    <th className={`p-2.5 text-end w-28 text-xs sm:text-sm ${isUrdu ? 'font-nastaliq' : ''}`}>{isUrdu ? 'کل رقم' : 'Total'}</th>
                                    <th className={`p-2.5 text-center w-28 text-xs sm:text-sm ${isUrdu ? 'font-nastaliq' : ''}`}>{isUrdu ? 'کارروائی' : 'Actions'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {sales.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className={`p-6 text-center text-muted-foreground text-sm ${isUrdu ? 'font-nastaliq' : ''}`}>
                                            {isUrdu ? 'آج کا کوئی اندراج نہیں ہے۔' : 'No records found for today.'}
                                        </td>
                                    </tr>
                                ) : (
                                    sales.map((sale, idx) => {
                                        const isNaqdi = sale.payment_type === 'naqdi';
                                        const isLastAdded = lastAddedId === sale.id;
                                        const unitName = (sale.item?.unit && sale.item.unit.toLowerCase().includes('peti')) ? 'peti' : 'bori';

                                        return (
                                            <tr
                                                key={sale.id}
                                                className={`transition-colors ${
                                                    isLastAdded
                                                        ? 'bg-amber-100/90 font-medium'
                                                        : idx % 2 === 0
                                                        ? 'bg-white hover:bg-green-50/50'
                                                        : 'bg-green-50/20 hover:bg-green-50/50'
                                                }`}
                                            >
                                                <td className="p-2.5 text-center text-gray-500 text-xs">{idx + 1}</td>

                                                <td className="p-2.5">
                                                    {sale.payment_type === 'bank' ? (
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-900 border border-indigo-300 ${isUrdu ? 'font-nastaliq' : ''}`}>
                                                            {isUrdu ? 'آن لائن' : 'Online'}
                                                        </span>
                                                    ) : sale.payment_type === 'split' ? (
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 ${isUrdu ? 'font-nastaliq' : ''}`}>
                                                            {isUrdu ? 'نقد + ادھار' : 'Cash + Udhaar'}
                                                        </span>
                                                    ) : isNaqdi ? (
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-900 border border-green-300 ${isUrdu ? 'font-nastaliq' : ''}`}>
                                                            {isUrdu ? 'نقد' : 'Cash'}
                                                        </span>
                                                    ) : (
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-900 border border-blue-300 ${isUrdu ? 'font-nastaliq' : ''}`}>
                                                            {isUrdu ? 'ادھار' : 'Udhaar'}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="p-2.5 font-bold text-green-900">{sale.merchant?.code}</td>

                                                <td className={`p-2.5 font-semibold text-gray-900 text-[13px] ${isUrdu ? 'font-nastaliq' : ''}`}>
                                                    {isUrdu ? (sale.merchant?.name_ur || sale.merchant?.name_en) : (sale.merchant?.name_en || sale.merchant?.name_ur)}
                                                </td>

                                                <td className="p-2.5 text-[13px]">
                                                    <span className={`font-semibold text-gray-900 ${isUrdu ? 'font-nastaliq' : ''}`}>
                                                        {isUrdu ? (sale.item?.name_ur || sale.item?.name_en) : (sale.item?.name_en || sale.item?.name_ur)}
                                                    </span>
                                                </td>

                                                <td className="p-2.5 text-end tabular-nums font-bold text-[13px] text-gray-900">
                                                    {sale.nag} {unitName}
                                                </td>

                                                <td className="p-2.5 text-end tabular-nums text-[13px] font-medium text-gray-900">
                                                    {Number(sale.rate).toLocaleString()}
                                                </td>

                                                <td className="p-2.5 text-end tabular-nums font-bold text-green-900 text-[13px]">
                                                    {Number(sale.gross_amount).toLocaleString()}
                                                </td>

                                                <td className="p-2.5 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => openSlip(sale)}
                                                            className={`px-2 py-1 bg-green-100 hover:bg-green-200 text-green-900 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer ${isUrdu ? 'font-nastaliq' : ''}`}
                                                            title={isUrdu ? 'پرچی' : 'Slip'}
                                                        >
                                                            <span>{isUrdu ? 'پرچی' : 'Slip'}</span>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => startEdit(sale)}
                                                            className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg transition-colors cursor-pointer"
                                                            title={isUrdu ? 'ترمیم' : 'Edit'}
                                                        >
                                                            <Icon name="PencilSimple" className="size-3.5" />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => confirmDelete(sale)}
                                                            className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors cursor-pointer"
                                                            title={isUrdu ? 'حذف' : 'Delete'}
                                                        >
                                                            <Icon name="Trash" className="size-3.5" />
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
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
                <DialogContent className="max-w-md p-4 text-xs" dir={isUrdu ? 'rtl' : 'ltr'}>
                    <DialogHeader>
                        <DialogTitle className={`text-sm font-bold text-red-900 ${isUrdu ? 'font-nastaliq' : ''}`}>
                            {isUrdu ? 'حذف کرنے کی تصدیق' : 'Confirm Delete'}
                        </DialogTitle>
                    </DialogHeader>
                    <p className={`text-xs text-gray-800 py-2 ${isUrdu ? 'font-nastaliq' : ''}`}>
                        {isUrdu ? 'کیا آپ واقعی یہ انٹری ہٹانا چاہتے ہیں؟' : 'Are you sure you want to delete this entry?'}
                    </p>
                    <DialogFooter className="gap-1.5">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteModalOpen(false)}
                            className={isUrdu ? 'font-nastaliq text-xs' : 'text-xs'}
                        >
                            {isUrdu ? 'منسوخ' : 'Cancel'}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={executeDelete}
                            className={`bg-red-600 hover:bg-red-700 text-white text-xs ${isUrdu ? 'font-nastaliq' : ''}`}
                        >
                            {isUrdu ? 'ہاں، حذف کریں' : 'Yes, Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

                        {/* Record Sale Slip Modal */}
            <Dialog open={slipModalOpen} onOpenChange={setSlipModalOpen}>
                <DialogContent className="max-w-md p-6 font-sans text-xs bg-white text-black rounded-2xl shadow-2xl border border-gray-200" dir={isUrdu ? 'rtl' : 'ltr'}>
                    {slipSale && (
                        <div className="space-y-4">
                            <div id="printable-sale-slip" className="bg-white text-black p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
                                {/* Header */}
                                <div className="text-center border-b-2 border-emerald-800 pb-2.5 mb-2">
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                        <div className="w-7 h-7 rounded-lg bg-[#14532d] text-white flex items-center justify-center font-black text-sm shadow-xs">V</div>
                                        <h2 className="font-extrabold text-base tracking-wide text-[#14532d] uppercase">Vegetable POS</h2>
                                    </div>
                                    <p className="text-xs text-gray-700 font-semibold">{isUrdu ? 'سیل پرچی · امروزہ' : 'Sales Slip · Amroza'}</p>
                                </div>

                                {/* Slip Meta */}
                                <div className="grid grid-cols-2 gap-2 text-xs border-b border-gray-200 pb-3">
                                    <div>
                                        <span className="text-gray-500 font-medium">{isUrdu ? 'پرچی نمبر:' : 'Slip #:'} </span>
                                        <strong className="text-black font-bold">#{slipSale.id}</strong>
                                    </div>
                                    <div className="text-end">
                                        <span className="text-gray-500 font-medium">{isUrdu ? 'تاریخ:' : 'Date:'} </span>
                                        <strong className="text-black font-bold">{slipSale.date}</strong>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 font-medium">{isUrdu ? 'خریدار:' : 'Buyer:'} </span>
                                        <strong className="text-black font-bold">
                                            {isUrdu ? (slipSale.merchant?.name_ur || slipSale.merchant?.name_en) : (slipSale.merchant?.name_en || saleItemName(slipSale))} (#{slipSale.merchant?.code})
                                        </strong>
                                    </div>
                                    <div className="text-end">
                                        <span className="text-gray-500 font-medium">{isUrdu ? 'ادائیگی:' : 'Payment:'} </span>
                                        <strong className={`px-2 py-0.5 rounded text-xs font-extrabold ${slipSale.payment_type === 'naqdi' ? 'bg-green-100 text-green-800' : slipSale.payment_type === 'bank' ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {slipSale.payment_type === 'naqdi' ? (isUrdu ? 'نقد' : 'CASH') : slipSale.payment_type === 'bank' ? (isUrdu ? 'بینک' : 'BANK') : (isUrdu ? 'ادھار' : 'UDHAAR')}
                                        </strong>
                                    </div>
                                </div>

                                {/* Table */}
                                <table className="w-full text-xs my-2 border-collapse">
                                    <thead>
                                        <tr className="border-b border-t border-gray-300 text-gray-700 uppercase font-bold text-[11px] bg-gray-50">
                                            <th className="py-2 px-2 text-start">{isUrdu ? 'جنس' : 'Item'}</th>
                                            <th className="py-2 px-2 text-center">{isUrdu ? 'تعداد' : 'Qty'}</th>
                                            <th className="py-2 px-2 text-end">{isUrdu ? 'ریٹ' : 'Rate'}</th>
                                            <th className="py-2 px-2 text-end">{isUrdu ? 'کل رقم' : 'Total'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        <tr>
                                            <td className="py-2.5 px-2 font-bold text-black text-sm">
                                                {isUrdu ? (slipSale.item?.name_ur || slipSale.item?.name_en) : saleItemName(slipSale)}
                                            </td>
                                            <td className="py-2.5 px-2 text-center font-bold text-black text-sm">
                                                {slipSale.nag} {slipSale.item?.unit ? slipSale.item.unit.toLowerCase() : 'bori'}
                                            </td>
                                            <td className="py-2.5 px-2 text-end text-gray-900 font-semibold text-sm">
                                                Rs. {Number(slipSale.rate).toLocaleString()}
                                            </td>
                                            <td className="py-2.5 px-2 text-end font-extrabold text-[#14532d] text-sm">
                                                Rs. {Number(slipSale.gross_amount).toLocaleString()}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Total */}
                                <div className="flex justify-between items-center text-sm font-bold border-t-2 border-b border-gray-300 py-2.5">
                                    <span className="text-gray-900 font-extrabold">{isUrdu ? 'صافی رقم (GRAND TOTAL):' : 'GRAND TOTAL:'}</span>
                                    <span className="text-base font-black text-[#14532d]">Rs. {Number(slipSale.gross_amount).toLocaleString()}</span>
                                </div>

                                {/* Footer & Signatures */}
                                <div className="text-center pt-2 space-y-1.5">
                                    <p className="text-xs text-gray-600 font-semibold">
                                        {isUrdu ? 'آپ کی تشریف آوری کا شکریہ - Thank You!' : 'Thank you for your business! - شکریہ'}
                                    </p>
                                    <div className="text-center pt-1.5 text-[11px] text-gray-400 border-t border-gray-200">
                                        Printed on: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center gap-2 pt-1 print:hidden">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                        document.body.classList.add('printing-slip');
                                        window.print();
                                        setTimeout(() => {
                                            document.body.classList.remove('printing-slip');
                                        }, 1500);
                                    }}
                                    className={`flex-1 h-10 text-xs sm:text-sm bg-[#14532d] hover:bg-[#0e3b20] text-white font-bold cursor-pointer flex items-center justify-center gap-2 ${isUrdu ? 'font-nastaliq' : ''}`}
                                >
                                    <Icon name="Printer" className="size-4" />
                                    <span>{isUrdu ? 'پرچی پرنٹ کریں' : 'Print Slip'}</span>
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSlipModalOpen(false)}
                                    className={`h-10 text-xs sm:text-sm px-5 cursor-pointer font-semibold ${isUrdu ? 'font-nastaliq' : ''}`}
                                >
                                    {isUrdu ? 'بند کریں' : 'Close'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );

    function saleItemName(sale: Sale): string {
        return sale.item?.name_en || sale.item?.name_ur || 'Item';
    }
}

