import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
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

interface DiscountRuleOption {
    id: number;
    rule_name: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    min_order_amount: number;
    is_active: boolean;
    description?: string;
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
        name?: string;
    };
    item?: {
        id: number;
        code: number;
        name_en: string;
        name_ur: string;
        name?: string;
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
    discountRules?: DiscountRuleOption[];
    filters: {
        date: string;
        search?: string;
    };
}

interface CartItem {
    id: string;
    item_id: number;
    item: ItemOption;
    name: string;
    code_str: string;
    unit: string;
    nag: number;
    rate: number;
    total: number;
}

interface ThermalSlipItem {
    name: string;
    unit: string;
    nag: number;
    rate: number;
    total: number;
}

interface ThermalSlipData {
    billNo: string;
    date: string;
    time: string;
    merchantCode: number;
    merchantName: string;
    merchantBalance: number;
    paymentType: 'naqdi' | 'udhaar' | 'bank' | 'split';
    bankAccount?: string;
    bankRef?: string;
    items: ThermalSlipItem[];
    subtotal: number;
    discount: number;
    tax: number;
    grandTotal: number;
    wasool: number;
    baqaya: number;
}

export default function AmrozaIndex({
    sales,
    summary,
    merchants,
    items,
    topItems = [],
    recentRates = {},
    discountRules = [],
    filters,
}: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    // Filters & Navigation
    const [selectedDate, setSelectedDate] = useState(filters.date || new Date().toISOString().split('T')[0]);
    const [searchFilter, setSearchFilter] = useState(filters.search || '');
    const [itemSearchQuery, setItemSearchQuery] = useState('');

    // Active Edit State
    const [editingSale, setEditingSale] = useState<Sale | null>(null);

    // Right Card: Customer (Gahak) State
    const [selectedMerchantId, setSelectedMerchantId] = useState<string>('');
    const [buyerSearchQuery, setBuyerSearchQuery] = useState('');
    const [buyerDropdownOpen, setBuyerDropdownOpen] = useState(false);
    const buyerContainerRef = useRef<HTMLDivElement>(null);

    // Right Card: Sabzi Cart Items State
    const [cartItems, setCartItems] = useState<CartItem[]>([]);

    // Right Card: Riaayat & Charges State
    const [discount, setDiscount] = useState<number>(0);
    const [tax, setTax] = useState<number>(0);
    const [activeDiscountRuleId, setActiveDiscountRuleId] = useState<number | null>(null);

    // Right Card: Payment Type State
    const [paymentType, setPaymentType] = useState<'naqdi' | 'udhaar' | 'bank' | 'split'>('udhaar');
    const [cashReceived, setCashReceived] = useState<string>('');
    const [udhaarAmount, setUdhaarAmount] = useState<string>('');

    // Banking Accounts for Bank / Online payment
    const [accounts, setAccounts] = useState<BankAccount[]>(() => getStoredBankAccounts());
    const [selectedBankAccount, setSelectedBankAccount] = useState<string>(() => {
        const accs = getStoredBankAccounts();
        return accs.length > 0 ? accs[0].name : '';
    });
    const [bankRefNo, setBankRefNo] = useState<string>('');

    // Submitting State
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Thermal Slip (80mm) Modal State
    const [slipModalOpen, setSlipModalOpen] = useState(false);
    const [slipData, setSlipData] = useState<ThermalSlipData | null>(null);

    // Delete Confirmation Dialog State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);

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

    // Handle outside clicks for Buyer dropdown
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (buyerContainerRef.current && !buyerContainerRef.current.contains(e.target as Node)) {
                setBuyerDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 30-second background polling for real-time updates
    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({ preserveScroll: true, preserveState: true });
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'خریدار کھاتہ' : 'Buyer Ledger', href: '#' },
        { title: isUrdu ? 'آج کی بکری (امروزہ)' : "Today's Sales", href: '/amroza' },
    ];

    // Selected Merchant object
    const selectedMerchant = useMemo(() => {
        return merchants.find(m => String(m.id) === String(selectedMerchantId)) || null;
    }, [merchants, selectedMerchantId]);

    // Filtered merchants for dropdown search
    const filteredMerchants = useMemo(() => {
        if (!buyerSearchQuery.trim()) return merchants.slice(0, 30);
        const q = buyerSearchQuery.toLowerCase().trim();
        return merchants.filter(m =>
            String(m.code).includes(q) ||
            (m.name_en && m.name_en.toLowerCase().includes(q)) ||
            (m.name_ur && m.name_ur.includes(q))
        ).slice(0, 30);
    }, [merchants, buyerSearchQuery]);

    // Quick Vegetables Display Source
    const displayItems = useMemo(() => {
        const source = (topItems && topItems.length > 0) ? topItems : items;
        if (!itemSearchQuery.trim()) return source;
        const q = itemSearchQuery.toLowerCase().trim();
        return source.filter(it =>
            (it.name_en && it.name_en.toLowerCase().includes(q)) ||
            (it.name_ur && it.name_ur.includes(q)) ||
            String(it.code).includes(q)
        );
    }, [topItems, items, itemSearchQuery]);

    // Calculations
    const subtotal = useMemo(() => {
        return cartItems.reduce((sum, item) => sum + (item.nag * item.rate), 0);
    }, [cartItems]);

    const grandTotal = useMemo(() => {
        return Math.max(0, Math.round((subtotal - discount + tax) * 100) / 100);
    }, [subtotal, discount, tax]);

    // Rebalance Split Payment whenever Grand Total changes
    useEffect(() => {
        if (paymentType === 'split') {
            const currentCash = parseFloat(cashReceived) || 0;
            if (currentCash > grandTotal) {
                setCashReceived(String(grandTotal));
                setUdhaarAmount('0');
            } else if (cashReceived !== '') {
                setUdhaarAmount(String(Math.max(0, Math.round((grandTotal - currentCash) * 100) / 100)));
            } else {
                const half = Math.round(grandTotal / 2);
                setCashReceived(String(half));
                setUdhaarAmount(String(grandTotal - half));
            }
        }
    }, [grandTotal, paymentType]);

    // Clean vegetable item name (removes parenthetical English)
    function cleanVegetableName(item: ItemOption): string {
        const raw = item.name_en || item.name_ur || 'Item';
        return raw.replace(/\s*\(.*?\)\s*/g, '').trim();
    }

    // Add vegetable to cart
    function handleAddVegetable(item: ItemOption) {
        const liveStock = item.current_stock ?? item.opening_stock ?? 0;
        const isKhatam = item.status === 'khatam' || item.computed_status === 'khatam' || liveStock <= 0;
        const isExpired = !isKhatam && (item.status === 'expired' || item.computed_status === 'expired' || item.id === 4);

        if (isExpired) {
            toast.error(isUrdu ? 'یہ مال ایکسپائر ہو چکا ہے، فروخت نہیں ہو سکتا' : 'Expired maal sale nahi ho sakta');
            return;
        }

        const cleanName = cleanVegetableName(item);
        const itemUnit = (item.unit && item.unit.toLowerCase().includes('peti')) ? 'Peti' : 'Bori';
        const defaultRate = item.default_rate || recentRates[item.id] || 0;

        setCartItems(prev => {
            const existingIdx = prev.findIndex(ci => ci.item_id === item.id);
            if (existingIdx >= 0) {
                // Increment existing item quantity
                const updated = [...prev];
                const newNag = updated[existingIdx].nag + 1;
                updated[existingIdx] = {
                    ...updated[existingIdx],
                    nag: newNag,
                    total: newNag * updated[existingIdx].rate,
                };
                toast.success(`${cleanName}: ${newNag} ${itemUnit}`);
                return updated;
            } else {
                // Add new item to cart
                const newItem: CartItem = {
                    id: `${item.id}-${Date.now()}`,
                    item_id: item.id,
                    item,
                    name: cleanName,
                    code_str: String(item.code || item.id),
                    unit: itemUnit,
                    nag: 1,
                    rate: defaultRate,
                    total: defaultRate,
                };
                toast.success(`${cleanName} bill mein shamil ho gaya`);
                return [...prev, newItem];
            }
        });
    }

    // Update cart item quantity
    function handleUpdateCartNag(id: string, val: string) {
        const num = parseFloat(val) || 0;
        setCartItems(prev => prev.map(ci => {
            if (ci.id === id) {
                return {
                    ...ci,
                    nag: num,
                    total: num * ci.rate,
                };
            }
            return ci;
        }));
    }

    // Update cart item rate
    function handleUpdateCartRate(id: string, val: string) {
        const num = parseFloat(val) || 0;
        setCartItems(prev => prev.map(ci => {
            if (ci.id === id) {
                return {
                    ...ci,
                    rate: num,
                    total: ci.nag * num,
                };
            }
            return ci;
        }));
    }

    // Remove item from cart
    function handleRemoveCartItem(id: string) {
        setCartItems(prev => prev.filter(ci => ci.id !== id));
    }

    // Clear entire cart
    function handleClearCart() {
        setCartItems([]);
        setDiscount(0);
        setTax(0);
        setActiveDiscountRuleId(null);
    }

    // Select Buyer from dropdown
    function handleSelectBuyer(m: MerchantOption) {
        setSelectedMerchantId(String(m.id));
        setBuyerSearchQuery(`${m.code} - ${m.name_en || m.name_ur}`);
        setBuyerDropdownOpen(false);
    }

    // Clear selected buyer
    function handleClearBuyer() {
        setSelectedMerchantId('');
        setBuyerSearchQuery('');
    }

    // Apply Discount Rule Chips (dynamically from discount_rules table)
    function handleApplyDiscountRule(rule: DiscountRuleOption) {
        if (activeDiscountRuleId === rule.id) {
            // Toggle off
            setActiveDiscountRuleId(null);
            setDiscount(0);
            return;
        }

        setActiveDiscountRuleId(rule.id);
        if (rule.discount_type === 'percentage') {
            const calculated = Math.round(subtotal * (rule.discount_value / 100) * 10) / 10;
            setDiscount(calculated);
        } else {
            setDiscount(rule.discount_value);
        }
    }

    // Keep active percentage discount synchronized when subtotal changes
    useEffect(() => {
        if (activeDiscountRuleId) {
            const currentRule = discountRules.find((r) => r.id === activeDiscountRuleId);
            if (currentRule && currentRule.discount_type === 'percentage') {
                const calculated = Math.round(subtotal * (currentRule.discount_value / 100) * 10) / 10;
                setDiscount(calculated);
            }
        }
    }, [subtotal, activeDiscountRuleId, discountRules]);

    // Manual discount change
    function handleDiscountChange(val: string) {
        const num = Math.max(0, parseFloat(val) || 0);
        setDiscount(num);
        setActiveDiscountRule(null);
    }

    // Manual tax change
    function handleTaxChange(val: string) {
        const num = Math.max(0, parseFloat(val) || 0);
        setTax(num);
    }

    // Select Payment Type
    function handleSelectPayment(type: 'naqdi' | 'udhaar' | 'bank' | 'split') {
        setPaymentType(type);
        if (type === 'split') {
            const half = Math.round(grandTotal / 2);
            setCashReceived(String(half));
            setUdhaarAmount(String(grandTotal - half));
        }
    }

    // Split payment cash change
    function handleCashReceivedChange(val: string) {
        setCashReceived(val);
        const cash = parseFloat(val) || 0;
        const remaining = Math.max(0, Math.round((grandTotal - cash) * 100) / 100);
        setUdhaarAmount(String(remaining));
    }

    // Split payment udhaar change
    function handleUdhaarAmountChange(val: string) {
        setUdhaarAmount(val);
        const udh = parseFloat(val) || 0;
        const cash = Math.max(0, Math.round((grandTotal - udh) * 100) / 100);
        setCashReceived(String(cash));
    }

    // Change Date
    function handleDateChange(newDate: string) {
        setSelectedDate(newDate);
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

    // Search Records Table
    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        router.get('/amroza', { date: selectedDate, search: searchFilter }, { preserveState: true, replace: true });
    }

    // Start editing an existing sale
    function startEdit(sale: Sale) {
        setEditingSale(sale);
        setSelectedMerchantId(String(sale.merchant_id));
        if (sale.merchant) {
            setBuyerSearchQuery(`${sale.merchant.code} - ${sale.merchant.name_en || sale.merchant.name_ur}`);
        }

        const it = items.find(i => i.id === sale.item_id);
        const cleanName = it ? cleanVegetableName(it) : (sale.item?.name_en || sale.item?.name_ur || 'Item');
        const itUnit = (sale.item?.unit && sale.item.unit.toLowerCase().includes('peti')) ? 'Peti' : 'Bori';

        setCartItems([{
            id: `edit-${sale.id}`,
            item_id: sale.item_id,
            item: it || (sale.item as any),
            name: cleanName,
            code_str: String(sale.item?.code || sale.item_id),
            unit: itUnit,
            nag: sale.nag,
            rate: Number(sale.rate),
            total: Number(sale.gross_amount),
        }]);

        const pType = (sale.payment_type as any) || 'udhaar';
        setPaymentType(pType);
        setCashReceived(String(sale.cash_received || ''));
        setUdhaarAmount(String(sale.udhaar_amount || ''));
        setDiscount(0);
        setTax(0);
        setActiveDiscountRule(null);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Cancel edit
    function cancelEdit() {
        setEditingSale(null);
        setCartItems([]);
        setDiscount(0);
        setTax(0);
        setActiveDiscountRule(null);
        setSelectedMerchantId('');
        setBuyerSearchQuery('');
    }

    // Submit Bill Save
    function handleSaveBill(e?: React.FormEvent) {
        if (e) e.preventDefault();

        if (!selectedMerchant) {
            toast.error(isUrdu ? 'براہ کرم خریدار (گاہک) منتخب کریں' : 'Please select a customer');
            return;
        }
        if (cartItems.length === 0) {
            toast.error(isUrdu ? 'کارٹ خالی ہے، سبزی شامل کریں' : 'Cart is empty. Please add items.');
            return;
        }
        for (const ci of cartItems) {
            if (ci.nag <= 0) {
                toast.error(`${ci.name} ki tadaad darj karein`);
                return;
            }
            if (ci.rate <= 0) {
                toast.error(`${ci.name} ka rate darj karein`);
                return;
            }
        }
        if (!paymentType) {
            toast.error('Payment type select karein');
            return;
        }
        if (paymentType === 'bank' && !selectedBankAccount) {
            toast.error('Bank account select karna zaroori hai');
            return;
        }

        setIsSubmitting(true);

        const payload = {
            date: selectedDate,
            merchant_id: selectedMerchant.id,
            payment_type: paymentType,
            discount: discount,
            tax: tax,
            cash_received: paymentType === 'split' ? (parseFloat(cashReceived) || 0) : (paymentType === 'naqdi' ? grandTotal : 0),
            udhaar_amount: paymentType === 'split' ? (parseFloat(udhaarAmount) || 0) : (paymentType === 'udhaar' ? grandTotal : 0),
            items: cartItems.map(ci => ({
                item_id: ci.item_id,
                nag: ci.nag,
                weight: 0,
                rate: ci.rate,
                bardana: 0,
            })),
        };

        const currentMerchantObj = selectedMerchant;
        const currentCartCopy = [...cartItems];
        const currentSubtotal = subtotal;
        const currentDiscount = discount;
        const currentTax = tax;
        const currentGrandTotal = grandTotal;
        const currentPaymentType = paymentType;
        const currentBankAcc = selectedBankAccount;
        const currentBankRef = bankRefNo;
        const currentCashRec = paymentType === 'split' ? (parseFloat(cashReceived) || 0) : (paymentType === 'naqdi' ? grandTotal : paymentType === 'bank' ? grandTotal : 0);
        const currentUdhaarAmt = paymentType === 'split' ? (parseFloat(udhaarAmount) || 0) : (paymentType === 'udhaar' ? grandTotal : 0);

        if (editingSale) {
            router.put(`/merchants/amroza/${editingSale.id}`, payload, {
                preserveScroll: true,
                onSuccess: () => {
                    setIsSubmitting(false);
                    toast.success(isUrdu ? 'بل کامیابی سے تبدیل ہو گیا!' : 'Bill updated successfully!');
                    cancelEdit();
                },
                onError: (errs) => {
                    setIsSubmitting(false);
                    const firstMsg = Object.values(errs)[0];
                    toast.error(typeof firstMsg === 'string' ? firstMsg : 'Error updating bill');
                },
            });
        } else {
            router.post('/merchants/amroza', payload, {
                preserveScroll: true,
                onSuccess: () => {
                    setIsSubmitting(false);

                    // Sync banking balance if bank was selected
                    if (currentPaymentType === 'bank' && currentBankAcc) {
                        updateAccountBalance(currentBankAcc, currentGrandTotal);
                        addStoredTransfer({
                            id: Date.now(),
                            title: `Sale Recovery → ${currentBankAcc}`,
                            subtext: `${selectedDate} · Buyer: ${currentMerchantObj.name_en || currentMerchantObj.name_ur} (Ref: ${currentBankRef || 'Online'})`,
                            amount: currentGrandTotal,
                            date: selectedDate,
                            bankName: currentBankAcc,
                            type: 'deposit',
                        });
                    }

                    // Prepare Thermal Slip Data
                    const billNoStr = `INV-${Date.now().toString().slice(-6)}`;
                    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const newMerchantBalance = (currentMerchantObj.current_balance || 0) + currentUdhaarAmt;

                    const slipObj: ThermalSlipData = {
                        billNo: billNoStr,
                        date: selectedDate,
                        time: timeStr,
                        merchantCode: currentMerchantObj.code,
                        merchantName: isUrdu ? (currentMerchantObj.name_ur || currentMerchantObj.name_en) : (currentMerchantObj.name_en || currentMerchantObj.name_ur),
                        merchantBalance: newMerchantBalance,
                        paymentType: currentPaymentType,
                        bankAccount: currentBankAcc,
                        bankRef: currentBankRef,
                        items: currentCartCopy.map(ci => ({
                            name: ci.name,
                            unit: ci.unit,
                            nag: ci.nag,
                            rate: ci.rate,
                            total: ci.total,
                        })),
                        subtotal: currentSubtotal,
                        discount: currentDiscount,
                        tax: currentTax,
                        grandTotal: currentGrandTotal,
                        wasool: currentCashRec,
                        baqaya: currentUdhaarAmt,
                    };

                    setSlipData(slipObj);
                    setSlipModalOpen(true);

                    // Reset cart & form for next fast sale
                    setCartItems([]);
                    setDiscount(0);
                    setTax(0);
                    setActiveDiscountRule(null);
                    setBankRefNo('');
                    toast.success(isUrdu ? 'بل محفوظ ہو گیا اور رسید تیار ہے!' : 'Bill saved and receipt ready!');
                },
                onError: (errs) => {
                    setIsSubmitting(false);
                    const firstMsg = Object.values(errs)[0];
                    toast.error(typeof firstMsg === 'string' ? firstMsg : 'Error saving bill');
                },
            });
        }
    }

    // Open Thermal Slip Modal for a row in Records table
    function openRecordSlip(sale: Sale) {
        const it = items.find(i => i.id === sale.item_id);
        const cleanName = it ? cleanVegetableName(it) : (sale.item?.name_en || sale.item?.name_ur || 'Item');
        const itUnit = (sale.item?.unit && sale.item.unit.toLowerCase().includes('peti')) ? 'Peti' : 'Bori';
        const mName = isUrdu ? (sale.merchant?.name_ur || sale.merchant?.name_en) : (sale.merchant?.name_en || sale.merchant?.name_ur);
        const wasoolAmt = sale.payment_type === 'naqdi' ? Number(sale.gross_amount) : sale.payment_type === 'bank' ? Number(sale.gross_amount) : sale.payment_type === 'split' ? Number(sale.cash_received || 0) : 0;
        const baqayaAmt = sale.payment_type === 'udhaar' ? Number(sale.gross_amount) : sale.payment_type === 'split' ? Number(sale.udhaar_amount || 0) : 0;

        const slipObj: ThermalSlipData = {
            billNo: `INV-${sale.id}`,
            date: sale.date,
            time: '12:00 PM',
            merchantCode: sale.merchant?.code || 0,
            merchantName: mName || 'Customer',
            merchantBalance: sale.merchant ? (sale.merchant as any).current_balance ?? 0 : 0,
            paymentType: (sale.payment_type as any) || 'udhaar',
            items: [{
                name: cleanName,
                unit: itUnit,
                nag: sale.nag,
                rate: Number(sale.rate),
                total: Number(sale.gross_amount),
            }],
            subtotal: Number(sale.gross_amount),
            discount: 0,
            tax: 0,
            grandTotal: Number(sale.gross_amount),
            wasool: wasoolAmt,
            baqaya: baqayaAmt,
        };

        setSlipData(slipObj);
        setSlipModalOpen(true);
    }

    // Delete sale
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
                toast.success(isUrdu ? 'انٹری حذف کر دی گئی' : 'Entry deleted');
                setSaleToDelete(null);
            },
        });
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'آج کی بکری (امروزہ)' : "Today's Sales"} />

            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #printable-thermal-slip, #printable-thermal-slip * {
                        visibility: visible;
                    }
                    #printable-thermal-slip {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 80mm !important;
                        padding: 3mm !important;
                        margin: 0 !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        box-shadow: none !important;
                        border: none !important;
                        font-family: 'Courier New', Courier, monospace, sans-serif !important;
                    }
                }
            `}</style>

            <div className="-mt-4 -mx-4 -mb-4 pb-24 bg-[#eef2ee] min-h-full font-sans text-[#1a211c] dark:text-[#e7ece8]" dir={isUrdu ? 'rtl' : 'ltr'}>
                {/* 1. Dark Green Top Header Banner */}
                <MandiPageHeader
                    title={isUrdu ? 'آج کی بکری (امروزہ)' : "Today's Sales"}
                    subtitle={isUrdu ? "آج کی سیل اینٹری (امروزہ)" : "Daily Sales Entry (Fast Billing POS)"}
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
                <div className="max-w-7xl mx-auto px-3 md:px-6 -mt-6 md:-mt-8 space-y-4">
                    {/* 2. Equal Width Two Cards Grid (Left: Naayi Sale / Available Vegetables | Right: Farokht Bill Khata) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

                        {/* LEFT CARD: Naayi Sale (Fast Billing & POS) */}
                        <div className="w-full bg-white rounded-2xl p-4 md:p-5 border border-gray-200/80 shadow-xs space-y-4">
                            {/* Card Header */}
                            <div>
                                <div className="flex items-center gap-2">
                                    <Icon name="ShoppingCart" className="size-5 text-[#1e713e]" weight="bold" />
                                    <h2 className="text-base font-bold text-gray-900">
                                        {isUrdu ? t('amroza_page.card_sale_title') : 'New Sale (Fast Billing & POS)'}
                                    </h2>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {isUrdu ? t('amroza_page.card_sale_sub') : 'Search product, enter quantity and print 80mm thermal receipt'}
                                </p>
                            </div>

                            {/* Search Vegetable Input */}
                            <div className="relative">
                                <Input
                                    value={itemSearchQuery}
                                    onChange={e => setItemSearchQuery(e.target.value)}
                                    placeholder={isUrdu ? t('amroza_page.search_item_placeholder') : 'Search products (e.g. Tomato, Potato, Onion)...'}
                                    className="h-10 rounded-xl border-gray-200 ps-10 pe-3 text-xs md:text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#1e713e] shadow-xs"
                                />
                                <Icon name="MagnifyingGlass" className="size-4 text-gray-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>

                            {/* Available Vegetables Header */}
                            <div className="flex items-center justify-between pt-1">
                                <span className="text-xs font-bold text-gray-700 tracking-wide uppercase">
                                    {isUrdu ? t('amroza_page.available_items') : 'Available Products (Click to Add):'}
                                </span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                    {displayItems.length} {isUrdu ? 'سبزیاں' : 'items'}
                                </span>
                            </div>

                            {/* Vegetable Items Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[540px] overflow-y-auto pe-1">
                                {displayItems.map(item => {
                                    const cleanName = cleanVegetableName(item);
                                    const itemUnit = (item.unit && item.unit.toLowerCase().includes('peti')) ? 'Peti' : 'Bori';
                                    const liveStock = item.current_stock ?? item.opening_stock ?? 0;
                                    const isKhatam = item.status === 'khatam' || item.computed_status === 'khatam' || liveStock <= 0;
                                    const isExpired = !isKhatam && (item.status === 'expired' || item.computed_status === 'expired' || item.id === 4);
                                    const defaultRate = item.default_rate || recentRates[item.id] || 0;
                                    const inCart = cartItems.find(ci => ci.item_id === item.id);

                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            disabled={isExpired}
                                            onClick={() => handleAddVegetable(item)}
                                            className={cn(
                                                "p-2.5 rounded-xl border text-start transition-all cursor-pointer flex flex-col justify-between min-h-[78px]",
                                                inCart
                                                    ? "bg-emerald-50/80 border-emerald-500 shadow-xs ring-1 ring-emerald-500"
                                                    : isExpired
                                                    ? "bg-red-50/50 border-red-200 cursor-not-allowed opacity-75"
                                                    : isKhatam
                                                    ? "bg-gray-50 border-gray-200 opacity-60 hover:opacity-80"
                                                    : "bg-white border-gray-200 hover:border-emerald-600 hover:shadow-xs"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-1 w-full">
                                                <div className="truncate">
                                                    <span className="block text-xs font-black text-gray-950 truncate">
                                                        {cleanName}
                                                    </span>
                                                    <span className="text-[10px] text-gray-600 font-mono font-semibold">
                                                        {item.code ? `#${item.code}` : `#${item.id}`}
                                                    </span>
                                                </div>
                                                {inCart && (
                                                    <span className="text-[10px] font-extrabold bg-[#1e713e] text-white px-1.5 py-0.5 rounded shrink-0">
                                                        {inCart.nag}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between gap-1 mt-2 pt-1.5 border-t border-gray-100 text-[11px]">
                                                <span className="font-black text-[#0f3d21] tabular-nums">
                                                    Rs. {defaultRate > 0 ? Number(defaultRate).toLocaleString() : '0'}
                                                    <span className="text-[10px] text-gray-700 font-medium">/{isUrdu ? (itemUnit === 'Peti' ? 'پیٹی' : 'بوری') : itemUnit.toLowerCase()}</span>
                                                </span>
                                                <span className={cn(
                                                    "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                                                    isExpired
                                                        ? "bg-red-100 text-red-700 font-bold"
                                                        : isKhatam
                                                        ? "bg-gray-200 text-gray-600"
                                                        : "bg-emerald-100/70 text-emerald-800"
                                                )}>
                                                    {isExpired ? (isUrdu ? 'ایکسپائرڈ' : 'Expired') : isKhatam ? (isUrdu ? 'ختم' : 'Out of Stock') : `${liveStock} ${isUrdu ? (itemUnit === 'Peti' ? 'پیٹی' : 'بوری') : itemUnit}`}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* RIGHT CARD: Farokht Bill Khata */}
                        <div className="w-full bg-white rounded-2xl p-4 md:p-5 border border-gray-200/80 shadow-xs space-y-4">
                            {/* Card Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon name="Receipt" className="size-5 text-[#1e713e]" weight="bold" />
                                    <h2 className="text-base font-bold text-gray-900">
                                        {isUrdu ? t('amroza_page.bill_title') : 'Sales Invoice'}
                                    </h2>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                        {cartItems.length} {isUrdu ? 'آئٹمز' : 'items'}
                                    </span>
                                </div>
                                {cartItems.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleClearCart}
                                        className="text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer"
                                    >
                                        {isUrdu ? t('amroza_page.clear_cart') : 'Cart Saaf Karein'}
                                    </button>
                                )}
                            </div>

                            {/* 1. Gahak (Customer) Dropdown - Full Width at Very Top, No Date Field */}
                            <div ref={buyerContainerRef} className="space-y-1">
                                <label className="block text-xs font-bold text-gray-700">
                                    {isUrdu ? t('amroza_page.customer_label') : 'Customer *'}
                                </label>
                                <div className="relative">
                                    <Input
                                        value={buyerSearchQuery}
                                        onChange={e => {
                                            setBuyerSearchQuery(e.target.value);
                                            setBuyerDropdownOpen(true);
                                            if (!e.target.value.trim()) {
                                                setSelectedMerchantId('');
                                            }
                                        }}
                                        onClick={() => setBuyerDropdownOpen(true)}
                                        placeholder={isUrdu ? t('amroza_page.customer_placeholder') : 'Search customer by code or name...'}
                                        className="h-10 rounded-xl border-gray-200 px-3 pe-8 text-xs md:text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#1e713e] shadow-xs"
                                    />
                                    {selectedMerchant ? (
                                        <button
                                            type="button"
                                            onClick={handleClearBuyer}
                                            className="absolute end-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                                            title={isUrdu ? 'گاہک صاف کریں' : 'Clear Customer'}
                                        >
                                            <Icon name="X" className="size-3.5" />
                                        </button>
                                    ) : (
                                        <Icon name="MagnifyingGlass" className="size-4 text-gray-400 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    )}

                                    {/* Dropdown Options */}
                                    {buyerDropdownOpen && (
                                        <div className="absolute z-50 start-0 end-0 mt-1 max-h-52 overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-xl divide-y divide-gray-100">
                                            {filteredMerchants.length === 0 ? (
                                                <div className="p-3 text-xs text-gray-500 text-center">
                                                    {isUrdu ? 'کوئی گاہک نہیں ملا' : 'Koi gahak nahi mila'}
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
                                                        className="w-full text-start px-3.5 py-2 text-xs hover:bg-emerald-50/60 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2 truncate">
                                                            <span className="font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">
                                                                #{m.code}
                                                            </span>
                                                            <span className="font-semibold text-gray-800 truncate">
                                                                {isUrdu ? (m.name_ur || m.name_en) : (m.name_en || m.name_ur)}
                                                            </span>
                                                        </div>
                                                        <span className="text-gray-600 shrink-0 text-xs font-semibold tabular-nums">
                                                            {isUrdu ? 'بقایا:' : 'Balance:'} Rs. {Number(m.current_balance).toLocaleString()}
                                                        </span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                {selectedMerchant && (
                                    <div className="flex items-center justify-between text-xs px-1 text-gray-600 pt-0.5">
                                        <span className="font-semibold text-gray-900 truncate">
                                            {isUrdu ? 'منتخب شدہ:' : 'Selected:'} #{selectedMerchant.code} - {isUrdu ? (selectedMerchant.name_ur || selectedMerchant.name_en) : (selectedMerchant.name_en || selectedMerchant.name_ur)}
                                        </span>
                                        <span className="font-bold text-emerald-800 tabular-nums shrink-0">
                                            {isUrdu ? 'بقایا:' : 'Balance:'} Rs. {Number(selectedMerchant.current_balance).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* 2. Sabzi Table (Sabzi, Miqdar, Rate, Kul) */}
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                                        <tr>
                                            <th className="py-2 px-3 text-start">{isUrdu ? t('amroza_page.table_item') : 'Item'}</th>
                                            <th className="py-2 px-2 text-center w-24">{isUrdu ? t('amroza_page.table_qty') : 'Quantity'}</th>
                                            <th className="py-2 px-2 text-end w-24">{isUrdu ? t('amroza_page.table_rate') : 'Rate'}</th>
                                            <th className="py-2 px-3 text-end w-24">{isUrdu ? t('amroza_page.table_total') : 'Total'}</th>
                                            <th className="py-2 px-2 text-center w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {cartItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-8 px-4 text-center text-gray-400 font-medium">
                                                    {isUrdu ? t('amroza_page.cart_empty') : 'Cart is empty. Click a product to add.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            cartItems.map((ci) => (
                                                <tr key={ci.id} className="hover:bg-gray-50/50">
                                                    <td className="py-2 px-3">
                                                        <span className="font-bold text-gray-900 block truncate max-w-[130px]">
                                                            {ci.name}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-medium">
                                                            {isUrdu ? (ci.unit?.toLowerCase().includes('peti') ? 'پیٹی' : 'بوری') : ci.unit}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-2 text-center">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            step="1"
                                                            value={ci.nag}
                                                            onChange={e => handleUpdateCartNag(ci.id, e.target.value)}
                                                            className="w-16 h-8 text-center font-bold text-xs border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1e713e]"
                                                        />
                                                    </td>
                                                    <td className="py-2 px-2 text-end">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            value={ci.rate}
                                                            onChange={e => handleUpdateCartRate(ci.id, e.target.value)}
                                                            className="w-20 h-8 text-end px-2 font-bold text-xs border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1e713e]"
                                                        />
                                                    </td>
                                                    <td className="py-2 px-3 text-end font-bold text-gray-900 tabular-nums">
                                                        Rs. {Number(ci.total).toLocaleString()}
                                                    </td>
                                                    <td className="py-2 px-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveCartItem(ci.id)}
                                                            className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                                                            title={isUrdu ? 'حذف کریں' : 'Remove Item'}
                                                        >
                                                            <Icon name="Trash" className="size-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* 3. Riaayat Rules Chips (dynamically from discount_rules table) */}
                            <div className="space-y-1.5 pt-1">
                                <label className="block text-xs font-bold text-gray-700">
                                    {isUrdu ? t('amroza_page.discount_rules_label') : 'Discount Rules:'}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {discountRules.map((rule) => {
                                        const isSelected = activeDiscountRuleId === rule.id;
                                        return (
                                            <button
                                                key={rule.id}
                                                type="button"
                                                onClick={() => handleApplyDiscountRule(rule)}
                                                className={cn(
                                                    "h-7 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border",
                                                    isSelected
                                                        ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                                                        : "bg-gray-100 hover:bg-gray-200/80 text-gray-700 border-gray-200"
                                                )}
                                            >
                                                {rule.rule_name}
                                            </button>
                                        );
                                    })}
                                    {discountRules.length === 0 && (
                                        <span className="text-xs text-gray-400">
                                            {isUrdu ? 'کوئی فعال رعایت رول نہیں ہے۔' : 'Koi active discount rule nahi hai.'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* 4. Financial Calculations (Subtotal, Discount, Tax, Grand Total) */}
                            <div className="space-y-2 pt-1 border-t border-gray-100">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-semibold text-gray-600">
                                        {isUrdu ? t('amroza_page.subtotal_label') : 'Subtotal:'}
                                    </span>
                                    <span className="font-bold text-gray-900 tabular-nums">
                                        Rs. {Number(subtotal).toLocaleString()}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                            {isUrdu ? t('amroza_page.discount_label') : 'Discount (Rs):'}
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={discount}
                                            onChange={e => handleDiscountChange(e.target.value)}
                                            placeholder="0"
                                            className="w-full h-8 px-2.5 text-xs font-bold border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1e713e]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                            {isUrdu ? t('amroza_page.tax_label') : 'Additional Charges (Tax/Toll):'}
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={tax}
                                            onChange={e => handleTaxChange(e.target.value)}
                                            placeholder="0"
                                            className="w-full h-8 px-2.5 text-xs font-bold border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1e713e]"
                                        />
                                    </div>
                                </div>

                                <div className="bg-[#eef6f0] rounded-xl p-3 flex items-center justify-between">
                                    <span className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                                        {isUrdu ? t('amroza_page.grand_total_label') : 'GRAND TOTAL:'}
                                    </span>
                                    <div className="text-xl font-bold tabular-nums text-[#14532d]">
                                        Rs. {Number(grandTotal).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            {/* 5. Payment Type Section (Cash, Udhaar, Bank, Adha Cash + Adha Udhaar) */}
                            <div className="space-y-2 pt-1 border-t border-gray-100">
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                                    {isUrdu ? t('amroza_page.payment_type_label') : 'PAYMENT TYPE'}
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleSelectPayment('naqdi')}
                                        className={cn(
                                            "h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer",
                                            paymentType === 'naqdi'
                                                ? "bg-[#1e713e] text-white shadow-xs"
                                                : "bg-white text-gray-800 border border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                                        )}
                                    >
                                        <span>{isUrdu ? 'نقد (Cash)' : 'Cash'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleSelectPayment('udhaar')}
                                        className={cn(
                                            "h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer",
                                            paymentType === 'udhaar'
                                                ? "bg-[#1e713e] text-white shadow-xs"
                                                : "bg-white text-gray-800 border border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                                        )}
                                    >
                                        <span>{isUrdu ? 'ادھار (Credit)' : 'Credit'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleSelectPayment('bank')}
                                        className={cn(
                                            "h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer",
                                            paymentType === 'bank'
                                                ? "bg-[#1e713e] text-white shadow-xs"
                                                : "bg-white text-gray-800 border border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                                        )}
                                    >
                                        <span>{isUrdu ? 'بینک (Bank)' : 'Bank'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleSelectPayment('split')}
                                        className={cn(
                                            "h-9 rounded-xl font-bold text-[11px] leading-tight flex items-center justify-center transition-all cursor-pointer text-center px-1",
                                            paymentType === 'split'
                                                ? "bg-[#1e713e] text-white shadow-xs"
                                                : "bg-white text-gray-800 border border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                                        )}
                                    >
                                        <span>{isUrdu ? t('amroza_page.split_payment') : 'Half Cash + Half Credit'}</span>
                                    </button>
                                </div>

                                {/* Bank Account Sub-row */}
                                {paymentType === 'bank' && (
                                    <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                    {isUrdu ? 'کس اکاؤنٹ میں وصولی ہوگی' : 'Destination Account for Payment'}
                                                </label>
                                                <select
                                                    value={selectedBankAccount}
                                                    onChange={e => setSelectedBankAccount(e.target.value)}
                                                    className="w-full px-2.5 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1e713e] cursor-pointer"
                                                >
                                                    {accounts.length === 0 ? (
                                                        <option value="" disabled>{isUrdu ? 'کوئی بینک اکاؤنٹ دستیاب نہیں' : 'No bank accounts available'}</option>
                                                    ) : (
                                                        accounts.map(acc => (
                                                            <option key={acc.id} value={acc.name}>
                                                                {acc.name} ({acc.type} · Rs. {Number(acc.current_balance).toLocaleString()})
                                                            </option>
                                                        ))
                                                    )}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                    {isUrdu ? 'ریفرنس / TID (اختیاری)' : 'TID / Raast Ref (Optional)'}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={bankRefNo}
                                                    onChange={e => setBankRefNo(e.target.value)}
                                                    placeholder="e.g. TID-88231"
                                                    className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1e713e]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Split Payment Sub-row */}
                                {paymentType === 'split' && (
                                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 animate-in fade-in duration-150">
                                        <div className="flex items-center justify-between text-xs text-amber-950 font-bold">
                                            <span>{isUrdu ? 'آدھا نقد + آدھا ادھار (اسپلٹ ادائیگی)' : 'Split Payment (Cash + Credit)'}</span>
                                            <span className="text-gray-600 font-semibold">
                                                {isUrdu ? 'کل بل:' : 'Total Bill:'} <strong className="text-green-900 font-bold">Rs. {Number(grandTotal).toLocaleString()}</strong>
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                    {isUrdu ? 'ابھی ملے (نقد رقم) *' : 'Cash Received Now *'}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={cashReceived}
                                                    onChange={e => handleCashReceivedChange(e.target.value)}
                                                    placeholder="0"
                                                    className="w-full h-8 px-2.5 text-xs font-bold border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1e713e]"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                                    {isUrdu ? 'ادھار باقی (بقایا کھاتہ) *' : 'Remaining Balance (Credit) *'}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={udhaarAmount}
                                                    onChange={e => handleUdhaarAmountChange(e.target.value)}
                                                    placeholder="0"
                                                    className="w-full h-8 px-2.5 text-xs font-bold border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1e713e]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 6. Save Action Button */}
                            <div className="pt-2">
                                <div className="flex gap-2">
                                    {editingSale && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={cancelEdit}
                                            className="h-11 px-4 rounded-xl border-red-300 text-red-600 hover:bg-red-50 text-xs font-semibold cursor-pointer"
                                        >
                                            {isUrdu ? 'منسوخ' : 'Cancel'}
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        onClick={() => handleSaveBill()}
                                        disabled={isSubmitting || cartItems.length === 0 || !selectedMerchant}
                                        className={cn(
                                            "w-full h-11 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer",
                                            cartItems.length > 0 && selectedMerchant && !isSubmitting
                                                ? "bg-[#1e713e] hover:bg-[#165a31] text-white shadow-xs"
                                                : "bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-200"
                                        )}
                                    >
                                        <Icon name="Printer" className="size-4" weight="bold" />
                                        <span>
                                            {editingSale
                                                ? (isUrdu ? 'تبدیل کریں' : 'Tabdeel Karein')
                                                : (isUrdu ? t('amroza_page.save_and_print') : 'Save Bill & Print Receipt')}
                                        </span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Controls Bar: Records Count & Search Box */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-2xl border border-gray-100 shadow-xs">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-semibold">
                                {isUrdu ? 'ریکارڈز:' : 'Records:'} <strong className="text-green-900">{sales.length}</strong>
                            </span>
                        </div>

                        {/* Search Box */}
                        <form onSubmit={handleSearch} className="flex items-center gap-1 w-full md:w-64">
                            <Input
                                value={searchFilter}
                                onChange={e => setSearchFilter(e.target.value)}
                                placeholder={isUrdu ? 'تلاش کریں...' : 'Search...'}
                                className="h-8 text-xs rounded-xl"
                            />
                            <Button type="submit" size="sm" variant="outline" className="h-8 px-2.5 rounded-xl cursor-pointer">
                                <Icon name="MagnifyingGlass" className="size-3.5" />
                            </Button>
                        </form>
                    </div>

                    {/* 4. Full Width Entries Table Below Both Cards */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
                        <div className="overflow-x-auto">
                            <table className="w-full text-[13px] font-semibold">
                                <thead className="bg-[#14532d] text-white select-none">
                                    <tr>
                                        <th className="p-2.5 text-center w-10 text-xs sm:text-sm">#</th>
                                        <th className="p-2.5 text-start w-24 text-xs sm:text-sm">{isUrdu ? t('amroza_page.col_payment') : 'Payment'}</th>
                                        <th className="p-2.5 text-start w-16 text-xs sm:text-sm">{isUrdu ? t('amroza_page.col_code') : 'Code'}</th>
                                        <th className="p-2.5 text-start text-xs sm:text-sm">{isUrdu ? t('amroza_page.col_buyer') : 'Buyer'}</th>
                                        <th className="p-2.5 text-start text-xs sm:text-sm">{isUrdu ? t('amroza_page.col_item') : 'Item'}</th>
                                        <th className="p-2.5 text-end w-28 text-xs sm:text-sm">{isUrdu ? t('amroza_page.col_units') : 'Units'}</th>
                                        <th className="p-2.5 text-end w-24 text-xs sm:text-sm">{isUrdu ? t('amroza_page.col_rate') : 'Rate'}</th>
                                        <th className="p-2.5 text-end w-28 text-xs sm:text-sm">{isUrdu ? t('amroza_page.col_total') : 'Total'}</th>
                                        <th className="p-2.5 text-center w-28 text-xs sm:text-sm">{isUrdu ? t('amroza_page.col_actions') : 'Actions'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sales.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="p-6 text-center text-muted-foreground text-sm">
                                                {isUrdu ? 'آج کا کوئی ریکارڈ موجود نہیں ہے۔' : 'No records found for today.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        sales.map((sale, idx) => {
                                            const isNaqdi = sale.payment_type === 'naqdi';
                                            const unitName = (sale.item?.unit && sale.item.unit.toLowerCase().includes('peti')) ? 'peti' : 'bori';

                                            return (
                                                <tr
                                                    key={sale.id}
                                                    className={`transition-colors ${
                                                        idx % 2 === 0
                                                            ? 'bg-white hover:bg-green-50/50'
                                                            : 'bg-green-50/20 hover:bg-green-50/50'
                                                    }`}
                                                >
                                                    <td className="p-2.5 text-center text-gray-500 text-xs">{idx + 1}</td>

                                                    <td className="p-2.5">
                                                        {sale.payment_type === 'bank' ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-900 border border-indigo-300">
                                                                {isUrdu ? 'بینک' : 'Bank'}
                                                            </span>
                                                        ) : sale.payment_type === 'split' ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                                                                {isUrdu ? 'نقد + ادھار' : 'Cash + Credit'}
                                                            </span>
                                                        ) : isNaqdi ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-900 border border-green-300">
                                                                {isUrdu ? 'نقد' : 'Cash'}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-900 border border-blue-300">
                                                                {isUrdu ? 'ادھار' : 'Credit'}
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className="p-2.5 font-bold text-green-900">#{sale.merchant?.code}</td>

                                                    <td className="p-2.5 font-semibold text-gray-900 text-[13px]">
                                                        {isUrdu ? (sale.merchant?.name_ur || sale.merchant?.name_en || 'گاہک') : (sale.merchant?.name_en || sale.merchant?.name_ur || 'Customer')}
                                                    </td>

                                                    <td className="p-2.5 text-[13px]">
                                                        <span className="font-semibold text-gray-900">
                                                            {(isUrdu ? (sale.item?.name_ur || sale.item?.name_en) : (sale.item?.name_en || sale.item?.name_ur) || 'Item').replace(/\s*\(.*?\)\s*/g, '').trim()}
                                                        </span>
                                                    </td>

                                                    <td className="p-2.5 text-end tabular-nums font-bold text-[13px] text-gray-900">
                                                        {sale.nag} {isUrdu ? (unitName.includes('peti') ? 'پیٹی' : 'بوری') : unitName}
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
                                                                onClick={() => openRecordSlip(sale)}
                                                                className="px-2.5 py-1 bg-green-100 hover:bg-green-200 text-green-900 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                                                title={isUrdu ? 'پرچی' : 'Slip'}
                                                            >
                                                                <span>{isUrdu ? 'پرچی' : 'Slip'}</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => startEdit(sale)}
                                                                className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg transition-colors cursor-pointer"
                                                                title={isUrdu ? 'تبدیل کریں' : 'Edit'}
                                                            >
                                                                <Icon name="PencilSimple" className="size-3.5" />
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => confirmDelete(sale)}
                                                                className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors cursor-pointer"
                                                                title={isUrdu ? 'حذف کریں' : 'Delete'}
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
                        <DialogTitle className="text-sm font-bold text-red-900">
                            {isUrdu ? 'حذف کرنے کی تصدیق' : 'Confirm Delete'}
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-xs text-gray-800 py-2">
                        {isUrdu ? 'کیا آپ واقعی اس اندراج کو حذف کرنا چاہتے ہیں؟' : 'Are you sure you want to delete this entry?'}
                    </p>
                    <DialogFooter className="gap-1.5">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteModalOpen(false)}
                            className="text-xs"
                        >
                            {isUrdu ? 'منسوخ' : 'Cancel'}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={executeDelete}
                            className="bg-red-600 hover:bg-red-700 text-white text-xs cursor-pointer"
                        >
                            {isUrdu ? 'ہاں، حذف کریں' : 'Yes, Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Thermal Receipt Modal (80mm) */}
            <Dialog open={slipModalOpen} onOpenChange={setSlipModalOpen}>
                <DialogContent className="max-w-md p-5 bg-white text-black rounded-2xl shadow-2xl border border-gray-200">
                    {slipData && (
                        <div className="space-y-4">
                            <div
                                id="printable-thermal-slip"
                                className="bg-white text-black p-4 rounded-xl border border-gray-200 shadow-2xs space-y-2.5 font-mono text-xs"
                            >
                                {/* Header */}
                                <div className="text-center border-b-2 border-emerald-900 pb-2">
                                    <h2 className="font-black text-base tracking-wider uppercase text-emerald-900">
                                        VEGETABLE POS
                                    </h2>
                                    <p className="text-[11px] text-gray-700 font-bold">
                                        Vegetable Wholesale & POS
                                    </p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">
                                        Sales Receipt
                                    </p>
                                </div>

                                {/* Meta Info */}
                                <div className="text-[11px] border-b border-gray-200 pb-2 space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 font-semibold">Bill No:</span>
                                        <span className="font-bold text-black">{slipData.billNo}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 font-semibold">Tareekh:</span>
                                        <span className="font-bold text-black">{slipData.date} {slipData.time}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 font-semibold">Customer:</span>
                                        <span className="font-bold text-black">
                                            #{slipData.merchantCode} - {slipData.merchantName}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 font-semibold">Payment Mode:</span>
                                        <span className="font-bold text-black uppercase">
                                            {slipData.paymentType === 'naqdi'
                                                ? 'CASH'
                                                : slipData.paymentType === 'bank'
                                                ? `BANK (${slipData.bankAccount || 'Online'})`
                                                : slipData.paymentType === 'split'
                                                ? 'ADHA CASH + ADHA UDHAAR'
                                                : 'UDHAAR'}
                                        </span>
                                    </div>
                                </div>

                                {/* Sabzi Items List */}
                                <div className="border-b border-gray-200 pb-2">
                                    <table className="w-full text-[11px]">
                                        <thead>
                                            <tr className="border-b border-gray-300 text-gray-700 font-bold">
                                                <th className="text-start py-1">Product</th>
                                                <th className="text-center py-1">Qty</th>
                                                <th className="text-end py-1">Rate</th>
                                                <th className="text-end py-1">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {slipData.items.map((it, idx) => (
                                                <tr key={idx}>
                                                    <td className="py-1 font-bold text-black">{it.name}</td>
                                                    <td className="py-1 text-center font-bold text-black">{it.nag} {it.unit.toLowerCase()}</td>
                                                    <td className="py-1 text-end text-gray-800">{Number(it.rate).toLocaleString()}</td>
                                                    <td className="py-1 text-end font-bold text-black">{Number(it.total).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Totals Breakdown */}
                                <div className="text-[11px] space-y-1 border-b border-gray-200 pb-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Subtotal:</span>
                                        <span className="font-bold text-black">Rs. {Number(slipData.subtotal).toLocaleString()}</span>
                                    </div>
                                    {slipData.discount > 0 && (
                                        <div className="flex justify-between text-emerald-800">
                                            <span>Discount:</span>
                                            <span className="font-bold">- Rs. {Number(slipData.discount).toLocaleString()}</span>
                                        </div>
                                    )}
                                    {slipData.tax > 0 && (
                                        <div className="flex justify-between text-gray-700">
                                            <span>Additional Charges:</span>
                                            <span className="font-bold">+ Rs. {Number(slipData.tax).toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-sm font-black text-emerald-950 pt-1 border-t border-dashed border-gray-300">
                                        <span>TOTAL BILL:</span>
                                        <span>Rs. {Number(slipData.grandTotal).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-800 pt-0.5">
                                        <span>Amount Paid:</span>
                                        <span className="font-bold text-emerald-800">Rs. {Number(slipData.wasool).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-800">
                                        <span>Invoice Balance Due:</span>
                                        <span className="font-bold text-red-800">Rs. {Number(slipData.baqaya).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-900 font-extrabold pt-1 border-t border-gray-200">
                                        <span>Total Outstanding Due:</span>
                                        <span className="font-black text-emerald-900">Rs. {Number(slipData.merchantBalance).toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="text-center pt-1 text-[10px] text-gray-500 space-y-0.5">
                                    <p className="font-bold text-gray-700">Tashreef Awari Ka Shukriya!</p>
                                    <p>Malik Sahab · Sabzi Mandi</p>
                                    <p className="text-[9px] text-gray-400">Printed: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center gap-2 pt-1 print:hidden">
                                <Button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="flex-1 h-10 bg-[#14532d] hover:bg-[#0e3b20] text-white font-bold cursor-pointer flex items-center justify-center gap-2 rounded-xl text-xs sm:text-sm"
                                >
                                    <Icon name="Printer" className="size-4" />
                                    <span>Print</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setSlipModalOpen(false)}
                                    className="h-10 px-5 text-xs sm:text-sm cursor-pointer font-semibold rounded-xl"
                                >
                                    Band Karein
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
