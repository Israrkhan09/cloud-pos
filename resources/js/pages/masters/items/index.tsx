import React, { useState, useMemo, useEffect } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import MandiPageHeader from '@/components/app/mandi-page-header';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Item {
    id: number;
    code?: string;
    name_en: string;
    name_ur: string;
    name: string;
    unit: string;
    kg_per_unit?: number;
    opening_stock?: number;
    current_stock?: number;
    low_stock_alert?: number;
    lot_date?: string;
    stock_note?: string;
    purchase_rate?: number;
    default_rate?: number;
    default_bardana?: number;
    shelf_life?: string;
    shelf_life_days?: number;
    discount_rate?: number;
    expiry_at?: string;
    status: string;
    computed_status?: string;
    expiry_countdown?: {
        text: string;
        type: 'active' | 'expiring_soon' | 'expired' | 'neutral' | 'khatam';
        hours_left: number | null;
    };
}

interface PaginatedData<T> {
    data: T[];
    total: number;
    current_page: number;
    last_page: number;
    links: Array<{ url: string | null; label: string; active: boolean }>;
}

interface Props {
    items: PaginatedData<Item>;
    filters: {
        search?: string;
    };
}

type ItemFilterType = 'all' | 'low_stock' | 'expiring_24h' | 'expired' | 'khatam';

export default function ItemsIndex({
    items,
    filters,
}: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [search, setSearch] = useState(filters.search || '');
    const [itemFilter, setItemFilter] = useState<ItemFilterType>('all');

    // Modals
    const [itemModalOpen, setItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);

    // Discount modal state
    const [discountModalItem, setDiscountModalItem] = useState<Item | null>(null);
    const [discountValue, setDiscountValue] = useState<string>('');

    // Stock Add Modal state
    const [stockAddModalOpen, setStockAddModalOpen] = useState(false);
    const [stockAddModalItem, setStockAddModalItem] = useState<Item | null>(null);
    const [stockAddQuantity, setStockAddQuantity] = useState('');
    const [stockAddNote, setStockAddNote] = useState('');

    // Stock Adjust Modal state
    const [stockAdjustModalOpen, setStockAdjustModalOpen] = useState(false);
    const [stockAdjustModalItem, setStockAdjustModalItem] = useState<Item | null>(null);
    const [stockAdjustNewStock, setStockAdjustNewStock] = useState('');
    const [stockAdjustReason, setStockAdjustReason] = useState('Ginti me farq (Count error)');

    // Purchase Modal state
    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
    const [purchaseModalItem, setPurchaseModalItem] = useState<Item | null>(null);
    const [purchaseQuantity, setPurchaseQuantity] = useState('');
    const [purchaseRate, setPurchaseRate] = useState('');
    const [purchaseFarmerName, setPurchaseFarmerName] = useState('');

    const cleanItemName = (name?: string): string => {
        if (!name) return '-';
        return name.replace(/\s*\([^)]*\)/g, '').trim();
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'روزانہ کام' : 'Daily Kaam', href: '#' },
        { title: isUrdu ? 'مال اور اسٹاک' : 'Maal aur Stock', href: '/masters/items' },
    ];

    // Item Form: Fields match updated columns
    const itemForm = useForm({
        name_en: '',
        name_ur: '',
        code: '',
        purchase_rate: '' as any,
        default_rate: '' as any,
        opening_stock: '' as any,
        shelf_life: '',
        low_stock_alert: '10' as any,
        stock_note: '',
        status: 'active',
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/masters/items', { search }, { preserveState: true });
    };

    // Calculate stats for filter chips
    const stats = useMemo(() => {
        let lowStockCount = 0;
        let expiringCount = 0;
        let expiredCount = 0;
        let khatamCount = 0;

        items.data.forEach((it) => {
            const current = it.current_stock ?? it.opening_stock ?? 0;
            const isKhat = it.status === 'khatam' || it.computed_status === 'khatam' || current <= 0;
            const isExp = !isKhat && (it.status === 'expired' || it.computed_status === 'expired');
            const isExp24 = !isKhat && !isExp && (it.computed_status === 'expiring_soon');
            const isLow = !isKhat && !isExp && (current <= (it.low_stock_alert ?? 10) || it.status === 'low_stock' || it.computed_status === 'low_stock');

            if (isKhat) {
                khatamCount++;
            } else if (isExp) {
                expiredCount++;
            } else if (isExp24) {
                expiringCount++;
            }

            if (isLow && !isKhat && !isExp) {
                lowStockCount++;
            }
        });

        return {
            total: items.total || items.data.length,
            lowStock: lowStockCount,
            expiring: expiringCount,
            expired: expiredCount,
            khatam: khatamCount,
        };
    }, [items]);

    // Filter items based on sub-filter
    const filteredItems = useMemo(() => {
        const orderMap: Record<number, number> = { 1: 1, 5: 2, 6: 3, 3: 4, 2: 5, 4: 6, 7: 7, 8: 8 };
        const list = items.data.filter((it) => {
            const current = it.current_stock ?? it.opening_stock ?? 0;
            const isKhat = it.status === 'khatam' || it.computed_status === 'khatam' || current <= 0;
            const isExp = !isKhat && (it.status === 'expired' || it.computed_status === 'expired');
            const isExp24 = !isKhat && !isExp && (it.computed_status === 'expiring_soon');
            const isLow = !isKhat && !isExp && (current <= (it.low_stock_alert ?? 10) || it.status === 'low_stock' || it.computed_status === 'low_stock');

            if (itemFilter === 'low_stock') return isLow;
            if (itemFilter === 'expiring_24h') return isExp24;
            if (itemFilter === 'expired') return isExp;
            if (itemFilter === 'khatam') return isKhat;
            return true;
        });

        return list.slice().sort((a, b) => {
            const orderA = orderMap[a.id] ?? (a.id + 100);
            const orderB = orderMap[b.id] ?? (b.id + 100);
            return orderA - orderB;
        });
    }, [items, itemFilter]);

    // Format numbers
    const formatNum = (val?: number) => Number(val || 0).toLocaleString('en-US');

    // Default subtitles for vegetables
    const getItemSubtitle = (it: Item): string => {
        if (it.stock_note && it.stock_note.trim().length > 0) {
            return it.stock_note;
        }
        const defaultSubtitles: Record<number, string> = {
            1: 'Okara New Crop (50kg Bori)',
            2: 'Desi Mandi Special',
            3: 'Sindh Grade-A Farm',
            4: 'Sindh Special Teekhi',
            5: 'Kisan Farm Phool Gobi',
            6: 'Desi Barik Lehsan',
            7: 'Kasur Special Mirchi',
            8: 'Kasur Special Bhindi',
        };
        return defaultSubtitles[it.id] || 'Taaza Mandi Stock';
    };

    // Item Add Modal
    const openAddItem = () => {
        setEditingItem(null);
        itemForm.reset();
        itemForm.setData({
            name_en: '',
            name_ur: '',
            code: '',
            purchase_rate: '' as any,
            default_rate: '' as any,
            opening_stock: '' as any,
            shelf_life: '',
            low_stock_alert: '10' as any,
            stock_note: '',
            status: 'active',
        });
        setItemModalOpen(true);
    };

    // Item Edit Modal
    const openEditItem = (it: Item) => {
        setEditingItem(it);
        const displayName = it.name_en || it.name || it.name_ur || '';
        itemForm.setData({
            name_en: displayName,
            name_ur: displayName,
            code: it.code || '',
            purchase_rate: it.purchase_rate !== undefined && it.purchase_rate !== null ? it.purchase_rate : ('' as any),
            default_rate: it.default_rate !== undefined && it.default_rate !== null ? it.default_rate : ('' as any),
            opening_stock: (it.opening_stock ?? it.current_stock ?? '') as any,
            shelf_life: it.shelf_life || (it.shelf_life_days ? `${it.shelf_life_days} din` : ''),
            low_stock_alert: it.low_stock_alert || (10 as any),
            stock_note: it.stock_note || '',
            status: it.status || 'active',
        });
        setItemModalOpen(true);
    };

    // Submit Item Form
    const handleItemSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalName = itemForm.data.name_en.trim();
        if (!finalName) {
            toast.error(isUrdu ? 'نام درج کرنا لازمی ہے' : 'Sabzi ka naam likhna zaroori hai');
            return;
        }

        // Parse shelf_life_days
        let days: number | null = null;
        const matches = (itemForm.data.shelf_life || '').match(/\d+/g);
        if (matches && matches.length > 0) {
            days = parseInt(matches[matches.length - 1], 10);
        }

        const payload = {
            name_en: finalName,
            name_ur: finalName,
            code: itemForm.data.code.trim() || null,
            unit: editingItem ? (editingItem.unit || 'Bori') : 'Bori',
            purchase_rate: itemForm.data.purchase_rate !== '' && itemForm.data.purchase_rate !== null ? Number(itemForm.data.purchase_rate) : null,
            default_rate: itemForm.data.default_rate !== '' && itemForm.data.default_rate !== null ? Number(itemForm.data.default_rate) : null,
            opening_stock: itemForm.data.opening_stock !== '' && itemForm.data.opening_stock !== null ? Number(itemForm.data.opening_stock) : 0,
            current_stock: editingItem ? (editingItem.current_stock ?? Number(itemForm.data.opening_stock)) : Number(itemForm.data.opening_stock || 0),
            shelf_life: itemForm.data.shelf_life || null,
            shelf_life_days: days,
            low_stock_alert: itemForm.data.low_stock_alert !== '' && itemForm.data.low_stock_alert !== null ? Number(itemForm.data.low_stock_alert) : 10,
            stock_note: itemForm.data.stock_note.trim() || null,
            status: itemForm.data.status || 'active',
        };

        if (editingItem) {
            itemForm.put(`/masters/items/${editingItem.id}`, {
                data: payload,
                onSuccess: () => {
                    toast.success(isUrdu ? 'سبزی تبدیل ہو گئی' : 'Sabzi update ho gayi');
                    setItemModalOpen(false);
                },
                onError: (errs) => {
                    const msg = Object.values(errs)[0];
                    toast.error(msg || (isUrdu ? 'خرابی واقع ہوئی' : 'Failed to update item'));
                },
            });
        } else {
            itemForm.post('/masters/items', {
                data: payload,
                onSuccess: () => {
                    toast.success(isUrdu ? 'نئی سبزی شامل ہو گئی' : 'Nayi sabzi shamil ho gayi');
                    setItemModalOpen(false);
                },
                onError: (errs) => {
                    const msg = Object.values(errs)[0];
                    toast.error(msg || (isUrdu ? 'خرابی واقع ہوئی' : 'Failed to create item'));
                },
            });
        }
    };

    // Open Discount Dialog
    const handleOpenDiscount = (it: Item) => {
        setDiscountModalItem(it);
        const suggested = it.discount_rate || Math.round((it.default_rate || 850) * 0.85);
        setDiscountValue(String(suggested));
    };

    const handleApplyDiscountSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!discountModalItem) return;

        const rate = parseFloat(discountValue);
        if (isNaN(rate) || rate <= 0) {
            toast.error('Barae meherbani durust discount rate enter karein.');
            return;
        }

        router.post(`/masters/items/${discountModalItem.id}/discount`, {
            discount_rate: rate,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(`${discountModalItem.name_en} par discount rate Rs. ${rate} lag gaya!`);
                setDiscountModalItem(null);
            },
        });
    };

    const handleWastage = (it: Item) => {
        if ((it.current_stock ?? 0) <= 0 || it.status === 'khatam') {
            toast.info('Is sabzi ka stock pehle se khatam / wastage hai.');
            return;
        }
        router.post(`/masters/items/${it.id}/wastage`, {}, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(`${cleanItemName(it.name_en)} ka wastage record darj ho gaya (Stock 0).`);
            },
            onError: (errs) => {
                const msg = Object.values(errs)[0];
                toast.error(msg || 'Wastage record darj karne mein masla aya.');
            },
        });
    };

    // --- QUICK ACTION MODAL HANDLERS ---
    const openStockAddModal = (it: Item) => {
        setStockAddModalItem(it);
        setStockAddQuantity('');
        setStockAddNote('');
        setStockAddModalOpen(true);
    };

    const handleStockAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!stockAddModalItem) return;
        const qty = parseFloat(stockAddQuantity);
        if (isNaN(qty) || qty <= 0) {
            toast.error(isUrdu ? 'براہ کرم درست تعداد درج کریں' : 'Barae meherbani durust tadaad enter karein');
            return;
        }
        router.post(`/masters/items/${stockAddModalItem.id}/stock-add`, {
            quantity: qty,
            note: stockAddNote,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(`${cleanItemName(stockAddModalItem.name_en)} me ${qty} ${stockAddModalItem.unit || 'Bori'} stock add ho gaya`);
                setStockAddModalOpen(false);
            },
        });
    };

    const openStockAdjustModal = (it: Item) => {
        setStockAdjustModalItem(it);
        setStockAdjustNewStock(String(it.current_stock ?? it.opening_stock ?? 0));
        setStockAdjustReason('Ginti me farq (Count error)');
        setStockAdjustModalOpen(true);
    };

    const handleStockAdjustSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!stockAdjustModalItem) return;
        const nStock = parseFloat(stockAdjustNewStock);
        if (isNaN(nStock) || nStock < 0) {
            toast.error(isUrdu ? 'براہ کرم درست اسٹاک درج کریں' : 'Barae meherbani durust stock enter karein');
            return;
        }
        router.post(`/masters/items/${stockAdjustModalItem.id}/stock-adjust`, {
            new_stock: nStock,
            reason: stockAdjustReason,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(`${cleanItemName(stockAdjustModalItem.name_en)} stock ${nStock} adjust ho gaya`);
                setStockAdjustModalOpen(false);
            },
        });
    };

    const openPurchaseModal = (it: Item) => {
        setPurchaseModalItem(it);
        setPurchaseQuantity('');
        setPurchaseRate(String(it.default_rate || ''));
        setPurchaseFarmerName('');
        setPurchaseModalOpen(true);
    };

    const handlePurchaseSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!purchaseModalItem) return;
        const qty = parseFloat(purchaseQuantity);
        if (isNaN(qty) || qty <= 0) {
            toast.error(isUrdu ? 'براہ کرم خریداری تعداد درج کریں' : 'Barae meherbani purchase quantity enter karein');
            return;
        }
        router.post(`/masters/items/${purchaseModalItem.id}/purchase`, {
            quantity: qty,
            rate: parseFloat(purchaseRate) || 0,
            farmer_name: purchaseFarmerName,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(`${cleanItemName(purchaseModalItem.name_en)} ki purchase save ho gayi aur stock add ho gaya`);
                setPurchaseModalOpen(false);
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'مال اور اسٹاک' : 'Maal aur Stock (Products & Stocks)'} />

            <div className="-mt-4 -mx-4 -mb-4 pb-28 bg-[#eef2ee] min-h-full font-sans text-[#1a211c] print:hidden" dir={isUrdu ? 'rtl' : 'ltr'}>
                
                {/* 1. Dark Green Top Header Banner */}
                <MandiPageHeader
                    title={isUrdu ? 'مال اور اسٹاک (پروڈکٹس)' : 'Maal aur Stock (Sabzi Products & Inventory)'}
                    subtitle={isUrdu ? 'سبزی جنس کا ریکارڈ، خرید و فروخت ریٹ، اور اسٹاک لیول' : 'Sabzi jins ka record, khareed o farokht rate, aur stock level alerts'}
                    isUrdu={isUrdu}
                >
                    <button
                        type="button"
                        onClick={openAddItem}
                        className="h-9 px-4 rounded-xl text-xs md:text-sm font-semibold bg-white text-emerald-900 hover:bg-emerald-50 shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                        <Icon name="Plus" className="size-4 text-emerald-800" weight="bold" />
                        <span>Nayi Sabzi Shamil Karein</span>
                    </button>
                </MandiPageHeader>

                {/* 2. Content Container */}
                <div className="max-w-7xl mx-auto px-3 md:px-6 -mt-6 md:-mt-8 space-y-3.5 relative">

                    {/* Search & Actions Bar (Category Dropdown Completely Removed as per Requirement 7) */}
                    <div className="bg-white rounded-xl border border-gray-200/90 shadow-xs p-3 flex flex-wrap items-center justify-between gap-3">
                        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
                            <div className="relative flex-1">
                                <Input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Sabzi ka naam ya code talash karein..."
                                    className="h-10 text-xs md:text-sm ps-9 rounded-xl border-gray-200 bg-white"
                                />
                                <Icon name="MagnifyingGlass" className="size-4 text-gray-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                            <Button type="submit" className="h-10 px-4 bg-[#14532d] hover:bg-[#0e3b20] text-white text-xs font-semibold rounded-xl cursor-pointer">
                                Search
                            </Button>
                        </form>
                    </div>

                    {/* Filter Chips Bar (Card style with borders: Products 8, Low Stock 0, 24h expiry 1, Expired 2, Khatam 4) */}
                    <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                        {/* All Products */}
                        <button
                            type="button"
                            onClick={() => setItemFilter('all')}
                            className={cn(
                                "px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border shadow-2xs",
                                itemFilter === 'all'
                                    ? "bg-white text-emerald-950 border-emerald-600 ring-2 ring-emerald-600/30 shadow-xs"
                                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                            )}
                        >
                            <span>Products</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold">
                                {stats.total}
                            </span>
                        </button>

                        {/* Low Stock */}
                        <button
                            type="button"
                            onClick={() => setItemFilter('low_stock')}
                            className={cn(
                                "px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border shadow-2xs",
                                itemFilter === 'low_stock'
                                    ? "bg-amber-50 text-amber-950 border-amber-500 ring-2 ring-amber-500/30 shadow-xs"
                                    : "bg-white text-amber-900 border-amber-200/80 hover:border-amber-300 hover:bg-amber-50/40"
                            )}
                        >
                            <span>Low Stock</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 font-extrabold">
                                {stats.lowStock}
                            </span>
                        </button>

                        {/* 24h expiry */}
                        <button
                            type="button"
                            onClick={() => setItemFilter('expiring_24h')}
                            className={cn(
                                "px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border shadow-2xs",
                                itemFilter === 'expiring_24h'
                                    ? "bg-amber-50 text-amber-950 border-amber-500 ring-2 ring-amber-500/30 shadow-xs"
                                    : "bg-white text-amber-900 border-amber-200/80 hover:border-amber-300 hover:bg-amber-50/40"
                            )}
                        >
                            <span>24h expiry</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 font-extrabold">
                                {stats.expiring}
                            </span>
                        </button>

                        {/* Expired */}
                        <button
                            type="button"
                            onClick={() => setItemFilter('expired')}
                            className={cn(
                                "px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border shadow-2xs",
                                itemFilter === 'expired'
                                    ? "bg-red-50 text-red-950 border-red-500 ring-2 ring-red-500/30 shadow-xs"
                                    : "bg-white text-red-900 border-red-200/80 hover:border-red-300 hover:bg-red-50/40"
                            )}
                        >
                            <span>Expired</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-200 text-red-950 font-extrabold">
                                {stats.expired}
                            </span>
                        </button>

                        {/* Khatam */}
                        <button
                            type="button"
                            onClick={() => setItemFilter('khatam')}
                            className={cn(
                                "px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border shadow-2xs",
                                itemFilter === 'khatam'
                                    ? "bg-gray-100 text-gray-900 border-gray-500 ring-2 ring-gray-400/30 shadow-xs"
                                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                            )}
                        >
                            <span>Khatam</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-800 font-extrabold">
                                {stats.khatam}
                            </span>
                        </button>
                    </div>

                    {/* 3. Products Table (Updated Columns Order & Clean Mandi Bismillah Spacing) */}
                    <div className="bg-white rounded-xl border border-gray-200/90 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs sm:text-[13px] font-sans">
                                <thead>
                                    <tr className="bg-[#14532d] text-white font-bold select-none text-xs">
                                        <th className="px-2.5 py-3 text-start w-16">Code</th>
                                        <th className="px-2.5 py-3 text-start min-w-[150px]">Sabzi Ka Naam</th>
                                        <th className="px-2 py-3 text-end w-24">Khareed Rate</th>
                                        <th className="px-2 py-3 text-end w-24">Farokht Rate</th>
                                        <th className="px-2 py-3 text-end w-28">Mojooda Stock</th>
                                        <th className="px-2 py-3 text-start w-20">Shelf Life</th>
                                        <th className="px-1.5 py-3 text-center w-20">Status</th>
                                        <th className="px-2 py-3 text-start w-32">Expiry</th>
                                        <th className="px-2 py-3 text-center w-36">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm">
                                                No items found in this view
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredItems.map((it) => {
                                            const currentStock = it.current_stock ?? it.opening_stock ?? 0;
                                            const isKhatam = it.status === 'khatam' || it.computed_status === 'khatam' || currentStock <= 0;
                                            const isExpired = !isKhatam && (it.status === 'expired' || it.computed_status === 'expired');
                                            const isLowStock = !isKhatam && !isExpired && (it.status === 'low_stock' || it.computed_status === 'low_stock' || (it.low_stock_alert !== undefined && currentStock <= it.low_stock_alert));
                                            const isExpiringSoon = !isKhatam && !isExpired && (it.computed_status === 'expiring_soon');

                                            const unitName = it.unit || 'Bori';
                                            const displayName = cleanItemName(it.name_en || it.name || it.name_ur);
                                            const subtitle = getItemSubtitle(it);
                                            const codeDisplay = it.code || `ALO-${String(it.id).padStart(2, '0')}`;
                                            const purchaseRateVal = it.purchase_rate ?? (it.default_rate ? Math.round(it.default_rate * 0.8) : null);

                                            return (
                                                <tr
                                                    key={it.id}
                                                    className={cn(
                                                        "transition-colors",
                                                        isExpiringSoon && !isKhatam && "bg-[#fffdf2] hover:bg-[#fff9e6]",
                                                        isExpired && "bg-[#fef7f7] hover:bg-[#feecec]",
                                                        !isExpiringSoon && !isExpired && "hover:bg-gray-50/70"
                                                    )}
                                                >
                                                    {/* 1. Code */}
                                                    <td className="px-2.5 py-2.5 font-bold text-gray-900 whitespace-nowrap text-xs font-mono w-16">
                                                        {codeDisplay}
                                                    </td>

                                                    {/* 2. Sabzi Ka Naam with Subtitle Description */}
                                                    <td className="px-2.5 py-2.5 text-start min-w-[150px]">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-gray-900 font-bold text-xs sm:text-[13px]">
                                                                {displayName}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => openEditItem(it)}
                                                                className="text-gray-400 hover:text-emerald-800 p-0.5 cursor-pointer"
                                                                title="Edit Sabzi"
                                                            >
                                                                <Icon name="PencilSimple" className="size-3" />
                                                            </button>
                                                        </div>
                                                        <span className="text-[11px] text-gray-500 font-normal leading-tight block truncate max-w-[200px]">
                                                            {subtitle}
                                                        </span>
                                                    </td>

                                                    {/* 3. Khareed Rate (Bold & Right-Aligned) */}
                                                    <td className="px-2 py-2.5 text-end font-bold text-gray-800 whitespace-nowrap text-xs sm:text-[13px] tabular-nums w-24">
                                                        {purchaseRateVal ? `Rs ${formatNum(purchaseRateVal)}` : '-'}
                                                    </td>

                                                    {/* 4. Farokht Rate (Bold & Right-Aligned) */}
                                                    <td className="px-2 py-2.5 text-end font-bold text-gray-900 whitespace-nowrap text-xs sm:text-[13px] tabular-nums w-24">
                                                        {it.discount_rate && !isKhatam ? (
                                                            <span className="flex items-center justify-end gap-1">
                                                                <span className="text-gray-400 font-normal line-through text-[11px]">Rs {formatNum(it.default_rate)}</span>
                                                                <span className="text-emerald-900 font-bold">Rs {formatNum(it.discount_rate)}</span>
                                                            </span>
                                                        ) : (
                                                            <span>{it.default_rate ? `Rs ${formatNum(it.default_rate)}` : '-'}</span>
                                                        )}
                                                    </td>

                                                    {/* 5. Mojooda Stock (Bold & Right-Aligned with Unit) */}
                                                    <td className="px-2 py-2.5 text-end font-bold text-gray-900 whitespace-nowrap text-xs sm:text-[13px] tabular-nums w-28">
                                                        <span>{formatNum(currentStock)}</span>{' '}
                                                        <span className="text-[11px] text-gray-500 font-medium">{unitName.toLowerCase()}</span>
                                                    </td>

                                                    {/* 6. Shelf Life */}
                                                    <td className="px-2 py-2.5 text-start text-gray-700 whitespace-nowrap text-xs font-medium w-20">
                                                        {it.shelf_life || (it.shelf_life_days ? `${it.shelf_life_days} din` : '4-5 din')}
                                                    </td>

                                                    {/* 7. Status */}
                                                    <td className="px-1.5 py-2.5 text-center whitespace-nowrap w-20">
                                                        {isKhatam ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                                                                Khatam
                                                            </span>
                                                        ) : isExpired ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200">
                                                                Expired
                                                            </span>
                                                        ) : isLowStock ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                                                Kam
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                Dastiyab
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* 8. Expiry (lot-wise, exactly like existing POS) */}
                                                    <td className="px-2 py-2.5 whitespace-nowrap text-xs w-32 text-start">
                                                        {isKhatam ? (
                                                            <span className="text-gray-500 font-medium text-[11px]">Timer band (0)</span>
                                                        ) : isExpired ? (
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-red-700 font-medium text-[11px]">3h pehle</span>
                                                                {(it.current_stock ?? 0) > 0 && it.status !== 'khatam' ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleWastage(it)}
                                                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#991b1b] hover:bg-[#7f1d1d] text-white shadow-2xs transition-colors cursor-pointer"
                                                                    >
                                                                        Wastage
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-gray-400 font-bold select-none text-[11px]">—</span>
                                                                )}
                                                            </div>
                                                        ) : isExpiringSoon ? (
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-amber-900 font-medium text-[11px]">{it.expiry_countdown?.text || '23h 40m'}</span>
                                                                {it.discount_rate ? (
                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                                        Rs. {it.discount_rate}
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenDiscount(it)}
                                                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#854d0e] hover:bg-[#713f12] text-white shadow-2xs transition-colors cursor-pointer"
                                                                    >
                                                                        Discount
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-0.5">
                                                                <span className="text-emerald-900 font-medium text-xs">
                                                                    {it.expiry_countdown?.text && it.expiry_countdown.text !== '-'
                                                                        ? it.expiry_countdown.text
                                                                        : (it.shelf_life ? `${it.shelf_life} baaki` : '-')}
                                                                </span>
                                                                {it.lot_date && (
                                                                    <div className="text-[10px] text-gray-400">{it.lot_date}</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* 9. Action (Stock add & Adjust buttons) */}
                                                    <td className="px-2 py-2.5 text-center whitespace-nowrap w-36">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            {isKhatam ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openPurchaseModal(it)}
                                                                    className="px-2 py-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 text-[11px] font-semibold transition-all shadow-2xs cursor-pointer"
                                                                >
                                                                    Purchase
                                                                </button>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openStockAddModal(it)}
                                                                        className="px-2 py-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 text-[11px] font-semibold transition-all shadow-2xs cursor-pointer"
                                                                    >
                                                                        Stock add
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openStockAdjustModal(it)}
                                                                        className="px-2 py-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 text-[11px] font-semibold transition-all shadow-2xs cursor-pointer"
                                                                    >
                                                                        Adjust
                                                                    </button>
                                                                </>
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

                        {/* Pagination */}
                        {items.last_page > 1 && (
                            <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                <span>
                                    Total {items.total} records · Page {items.current_page} of {items.last_page}
                                </span>
                                <div className="flex gap-1">
                                    {items.links.map((link, idx) => (
                                        <button
                                            key={idx}
                                            disabled={!link.url}
                                            onClick={() => link.url && router.get(link.url, {}, { preserveState: true })}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                            className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                                                link.active
                                                    ? 'bg-[#14532d] text-white font-bold'
                                                    : 'hover:bg-gray-100 text-gray-700 disabled:opacity-30'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Explanatory footer note */}
                    <div className="bg-[#f0f4f0] border border-emerald-200/80 rounded-xl p-3 text-xs text-gray-700 leading-relaxed">
                        <strong>Kaise chalta hai:</strong> Stock = Aamad - Sale · Timer lot-wise, stock 0 par band · Low Stock (10 ya kam): notification save · Expiry alert 5 second mein hat jata hai
                    </div>
                </div>
            </div>

            {/* Naya Product Form Modal (Nayi Sabzi Shamil Karein) - Requirement 6 */}
            <Dialog open={itemModalOpen} onOpenChange={setItemModalOpen}>
                <DialogContent className="max-w-lg font-sans p-6 bg-white rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-gray-900">
                            {editingItem ? 'Sabzi Edit Karein' : 'Nayi Sabzi Shamil Karein'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleItemSubmit} className="space-y-3.5 pt-2">
                        {/* Row 1: Sabzi Ka Naam & Code */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">
                                    Sabzi Ka Naam *
                                </Label>
                                <Input
                                    required
                                    value={itemForm.data.name_en}
                                    onChange={e => {
                                        const val = e.target.value;
                                        itemForm.setData({
                                            ...itemForm.data,
                                            name_en: val,
                                            name_ur: val,
                                        });
                                    }}
                                    placeholder="e.g. Tamatar"
                                    className="h-9.5 text-sm border-gray-200 rounded-lg focus:border-[#14532d]"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">
                                    Code
                                </Label>
                                <Input
                                    value={itemForm.data.code}
                                    onChange={e => itemForm.setData('code', e.target.value)}
                                    placeholder="e.g. TMT-01"
                                    className="h-9.5 text-sm border-gray-200 rounded-lg focus:border-[#14532d] uppercase font-mono"
                                />
                            </div>
                        </div>

                        {/* Row 2: Khareed Rate & Farokht Rate */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">
                                    Khareed Rate (Rs.)
                                </Label>
                                <Input
                                    type="number"
                                    step="any"
                                    value={itemForm.data.purchase_rate}
                                    onChange={e => itemForm.setData('purchase_rate', e.target.value)}
                                    placeholder="e.g. 850"
                                    className="h-9.5 text-sm border-gray-200 rounded-lg focus:border-[#14532d]"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">
                                    Farokht Rate (Rs.) *
                                </Label>
                                <Input
                                    type="number"
                                    step="any"
                                    value={itemForm.data.default_rate}
                                    onChange={e => itemForm.setData('default_rate', e.target.value)}
                                    placeholder="e.g. 1000"
                                    className="h-9.5 text-sm border-gray-200 rounded-lg focus:border-[#14532d]"
                                />
                            </div>
                        </div>

                        {/* Row 3: Mojooda/Ibtidayi Stock & Shelf Life */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">
                                    Mojooda / Ibtidayi Stock
                                </Label>
                                <Input
                                    type="number"
                                    value={itemForm.data.opening_stock}
                                    onChange={e => itemForm.setData('opening_stock', e.target.value)}
                                    placeholder="e.g. 100"
                                    className="h-9.5 text-sm border-gray-200 rounded-lg focus:border-[#14532d]"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">
                                    Shelf Life
                                </Label>
                                <Input
                                    value={itemForm.data.shelf_life}
                                    onChange={e => itemForm.setData('shelf_life', e.target.value)}
                                    placeholder="e.g. 4-5 din"
                                    className="h-9.5 text-sm border-gray-200 rounded-lg focus:border-[#14532d]"
                                />
                            </div>
                        </div>

                        {/* Row 4: Stock Alert Limit & Notes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">
                                    Stock Alert Limit
                                </Label>
                                <Input
                                    type="number"
                                    value={itemForm.data.low_stock_alert}
                                    onChange={e => itemForm.setData('low_stock_alert', e.target.value)}
                                    placeholder="10"
                                    className="h-9.5 text-sm border-gray-200 rounded-lg focus:border-[#14532d]"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">
                                    Notes / Subtitle Description
                                </Label>
                                <Input
                                    value={itemForm.data.stock_note}
                                    onChange={e => itemForm.setData('stock_note', e.target.value)}
                                    placeholder="e.g. Kasur Special, A-Class Farm"
                                    className="h-9.5 text-sm border-gray-200 rounded-lg focus:border-[#14532d]"
                                />
                            </div>
                        </div>

                        {/* Buttons: Mansookh (Cancel) aur Mehfooz Karein (Save) */}
                        <DialogFooter className="pt-3 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setItemModalOpen(false)}
                                className="min-h-[40px] px-5 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                            >
                                Mansookh (Cancel)
                            </button>
                            <button
                                type="submit"
                                disabled={itemForm.processing}
                                className="min-h-[40px] px-6 py-2 bg-[#14532d] hover:bg-[#166534] active:bg-[#0f3d21] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
                            >
                                Mehfooz Karein (Save)
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Discount Modal */}
            {discountModalItem && (
                <Dialog open={!!discountModalItem} onOpenChange={(open) => !open && setDiscountModalItem(null)}>
                    <DialogContent className="max-w-sm font-sans p-6 bg-white rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-base font-bold text-gray-900">
                                {discountModalItem.name_en} par Discount Lagayein
                            </DialogTitle>
                        </DialogHeader>

                        <form onSubmit={handleApplyDiscountSubmit} className="space-y-4 pt-2">
                            <div className="text-xs space-y-1 text-gray-600">
                                <div className="flex justify-between">
                                    <span>Mawjooda Rate:</span>
                                    <span className="font-bold text-gray-900">Rs. {formatNum(discountModalItem.default_rate)}</span>
                                </div>
                                <div className="flex justify-between text-amber-800">
                                    <span>Suggested (15% off):</span>
                                    <span className="font-bold">Rs. {formatNum(Math.round((discountModalItem.default_rate || 850) * 0.85))}</span>
                                </div>
                            </div>

                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">
                                    Naya Discount Rate (Rs.)
                                </Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={discountValue}
                                    onChange={e => setDiscountValue(e.target.value)}
                                    placeholder="720"
                                    className="h-10 text-sm font-bold text-gray-900 border-gray-200 rounded-lg focus:border-[#14532d]"
                                />
                            </div>

                            <DialogFooter className="pt-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setDiscountModalItem(null)}
                                    className="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-lg cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-[#854d0e] hover:bg-[#713f12] text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                                >
                                    Discount Save Karein
                                </button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}

            {/* Stock Add Modal */}
            {stockAddModalItem && (
                <Dialog open={stockAddModalOpen} onOpenChange={setStockAddModalOpen}>
                    <DialogContent className="max-w-md font-sans p-6 bg-white rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-base font-bold text-gray-900">
                                Stock Add Karein · {cleanItemName(stockAddModalItem.name_en)}
                            </DialogTitle>
                        </DialogHeader>

                        <form onSubmit={handleStockAddSubmit} className="space-y-4 pt-2">
                            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/80 flex items-center justify-between text-xs">
                                <span className="text-emerald-900 font-semibold">Mojooda Stock:</span>
                                <span className="font-extrabold text-emerald-950 text-sm">
                                    {stockAddModalItem.current_stock ?? stockAddModalItem.opening_stock ?? 0} {stockAddModalItem.unit || 'Bori'}
                                </span>
                            </div>

                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">
                                    Kitna Stock Add Karna Hai? ({stockAddModalItem.unit || 'Bori'}) *
                                </Label>
                                <Input
                                    type="number"
                                    min="1"
                                    step="any"
                                    required
                                    value={stockAddQuantity}
                                    onChange={e => setStockAddQuantity(e.target.value)}
                                    placeholder="e.g. 50"
                                    className="h-10 text-sm font-bold text-gray-900 border-gray-200 rounded-lg focus:border-[#14532d]"
                                    autoFocus
                                />
                            </div>

                            {Number(stockAddQuantity) > 0 && (
                                <div className="p-2.5 bg-gray-50 rounded-lg text-xs flex justify-between items-center text-gray-700">
                                    <span>Naya Kul Stock Hoga:</span>
                                    <span className="font-bold text-emerald-900 text-sm">
                                        {(stockAddModalItem.current_stock ?? 0) + Number(stockAddQuantity)} {stockAddModalItem.unit || 'Bori'}
                                    </span>
                                </div>
                            )}

                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">
                                    Wajah / Note (Optional)
                                </Label>
                                <Input
                                    value={stockAddNote}
                                    onChange={e => setStockAddNote(e.target.value)}
                                    placeholder="e.g. Mandi gaari aamad, Warehouse stock"
                                    className="h-9 text-xs border-gray-200 rounded-lg focus:border-[#14532d]"
                                />
                            </div>

                            <DialogFooter className="pt-2 gap-2">
                                <Button type="button" variant="outline" onClick={() => setStockAddModalOpen(false)} className="text-xs">
                                    Cancel
                                </Button>
                                <Button type="submit" className="bg-[#14532d] hover:bg-[#0e3b20] text-white text-xs font-bold px-4">
                                    Stock Add Karein
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}

            {/* Stock Adjust Modal */}
            {stockAdjustModalItem && (
                <Dialog open={stockAdjustModalOpen} onOpenChange={setStockAdjustModalOpen}>
                    <DialogContent className="max-w-md font-sans p-6 bg-white rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-base font-bold text-gray-900">
                                Stock Adjust Karein · {cleanItemName(stockAdjustModalItem.name_en)}
                            </DialogTitle>
                        </DialogHeader>

                        <form onSubmit={handleStockAdjustSubmit} className="space-y-4 pt-2">
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 flex items-center justify-between text-xs">
                                <span className="text-amber-900 font-semibold">System Stock:</span>
                                <span className="font-extrabold text-amber-950 text-sm">
                                    {stockAdjustModalItem.current_stock ?? stockAdjustModalItem.opening_stock ?? 0} {stockAdjustModalItem.unit || 'Bori'}
                                </span>
                            </div>

                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">
                                    Naya Asal Stock (Physical Count) *
                                </Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="any"
                                    required
                                    value={stockAdjustNewStock}
                                    onChange={e => setStockAdjustNewStock(e.target.value)}
                                    placeholder="0"
                                    className="h-10 text-sm font-bold text-gray-900 border-gray-200 rounded-lg focus:border-[#14532d]"
                                    autoFocus
                                />
                            </div>

                            {stockAdjustNewStock !== '' && (
                                <div className="p-2.5 bg-gray-50 rounded-lg text-xs flex justify-between items-center text-gray-700">
                                    <span>Stock Me Farq:</span>
                                    <span className={cn(
                                        "font-bold text-sm",
                                        Number(stockAdjustNewStock) - (stockAdjustModalItem.current_stock ?? 0) >= 0
                                            ? "text-emerald-800"
                                            : "text-rose-800"
                                    )}>
                                        {Number(stockAdjustNewStock) - (stockAdjustModalItem.current_stock ?? 0) > 0 ? '+' : ''}
                                        {Number(stockAdjustNewStock) - (stockAdjustModalItem.current_stock ?? 0)} {stockAdjustModalItem.unit || 'Bori'}
                                    </span>
                                </div>
                            )}

                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">
                                    Wajah (Reason) *
                                </Label>
                                <select
                                    value={stockAdjustReason}
                                    onChange={e => setStockAdjustReason(e.target.value)}
                                    className="w-full h-9.5 px-3 text-xs border border-gray-200 rounded-lg bg-white font-medium focus:border-[#14532d] cursor-pointer"
                                >
                                    <option value="Ginti me farq (Count error)">Ginti me farq (Count error)</option>
                                    <option value="Kharab maal / Wastage">Kharab maal / Wastage</option>
                                    <option value="Wazan kam nikla">Wazan kam nikla</option>
                                    <option value="Digar (Other)">Digar (Other)</option>
                                </select>
                            </div>

                            <DialogFooter className="pt-2 gap-2">
                                <Button type="button" variant="outline" onClick={() => setStockAdjustModalOpen(false)} className="text-xs">
                                    Cancel
                                </Button>
                                <Button type="submit" className="bg-[#14532d] hover:bg-[#0e3b20] text-white text-xs font-bold px-4">
                                    Stock Adjust Karein
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}

            {/* Purchase Modal */}
            {purchaseModalItem && (
                <Dialog open={purchaseModalOpen} onOpenChange={setPurchaseModalOpen}>
                    <DialogContent className="max-w-md font-sans p-6 bg-white rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-base font-bold text-gray-900">
                                Nayi Purchase (Bijak) · {cleanItemName(purchaseModalItem.name_en)}
                            </DialogTitle>
                        </DialogHeader>

                        <form onSubmit={handlePurchaseSubmit} className="space-y-4 pt-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs font-semibold text-gray-700 block mb-1">Jins (Item)</Label>
                                    <Input
                                        disabled
                                        value={`${cleanItemName(purchaseModalItem.name_en)} (${purchaseModalItem.unit || 'Bori'})`}
                                        className="h-9.5 text-xs bg-gray-50 border-gray-200 rounded-lg text-gray-900 font-bold"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-gray-700 block mb-1">Kisan / Supplier</Label>
                                    <Input
                                        value={purchaseFarmerName}
                                        onChange={e => setPurchaseFarmerName(e.target.value)}
                                        placeholder="e.g. Aslam Khan (Kisan)"
                                        className="h-9.5 text-xs border-gray-200 rounded-lg focus:border-[#14532d]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs font-semibold text-gray-700 block mb-1">
                                        Tadaad ({purchaseModalItem.unit || 'Bori'}) *
                                    </Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        step="any"
                                        required
                                        value={purchaseQuantity}
                                        onChange={e => setPurchaseQuantity(e.target.value)}
                                        placeholder="100"
                                        className="h-9.5 text-sm font-bold text-gray-900 border-gray-200 rounded-lg focus:border-[#14532d]"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-gray-700 block mb-1">
                                        Rate per {purchaseModalItem.unit || 'Bori'} (Rs.)
                                    </Label>
                                    <Input
                                        type="number"
                                        step="any"
                                        value={purchaseRate}
                                        onChange={e => setPurchaseRate(e.target.value)}
                                        placeholder="1200"
                                        className="h-9.5 text-sm font-bold text-gray-900 border-gray-200 rounded-lg focus:border-[#14532d]"
                                    />
                                </div>
                            </div>

                            {Number(purchaseQuantity) > 0 && (
                                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/80 flex items-center justify-between text-xs">
                                    <span className="text-emerald-900 font-semibold">Kul Purchase Rakam:</span>
                                    <span className="font-extrabold text-emerald-950 text-base">
                                        Rs. {(Number(purchaseQuantity || 0) * (Number(purchaseRate) || 0)).toLocaleString()}
                                    </span>
                                </div>
                            )}

                            <DialogFooter className="pt-2 gap-2">
                                <Button type="button" variant="outline" onClick={() => setPurchaseModalOpen(false)} className="text-xs">
                                    Cancel
                                </Button>
                                <Button type="submit" className="bg-[#14532d] hover:bg-[#0e3b20] text-white text-xs font-bold px-4">
                                    Purchase Save Karein
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </AppLayout>
    );
}
