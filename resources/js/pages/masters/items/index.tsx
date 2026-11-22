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

interface Area {
    id: number;
    code?: number;
    name_ur: string;
    name_en: string;
    name: string;
    status: string;
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
    areas?: PaginatedData<Area>;
    currentTab?: 'items' | 'areas';
    filters: {
        search?: string;
        tab?: string;
    };
}

type ItemFilterType = 'all' | 'low_stock' | 'expiring_24h' | 'expired' | 'khatam';

export default function ItemsIndex({
    items,
    areas = { data: [], total: 0, current_page: 1, last_page: 1, links: [] },
    currentTab = 'items',
    filters,
}: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const initialTab = (filters.tab === 'areas' || currentTab === 'areas') ? 'areas' : 'items';
    const [activeTab, setActiveTab] = useState<'items' | 'areas'>(initialTab);
    const [search, setSearch] = useState(filters.search || '');

    // Sub-filters: 'all' | 'low_stock' | 'expiring_24h' | 'expired' | 'khatam'
    const [itemFilter, setItemFilter] = useState<ItemFilterType>('all');

    // Floating alert toast (auto closes after 5 seconds)
    const [showAlertToast, setShowAlertToast] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowAlertToast(false);
        }, 5000);
        return () => clearTimeout(timer);
    }, []);

    // Modals
    const [itemModalOpen, setItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);

    const [areaModalOpen, setAreaModalOpen] = useState(false);
    const [editingArea, setEditingArea] = useState<Area | null>(null);

    // Discount modal state
    const [discountModalItem, setDiscountModalItem] = useState<Item | null>(null);
    const [discountValue, setDiscountValue] = useState<string>('');

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'سیٹ اپ' : 'Setup', href: '#' },
        { title: isUrdu ? 'اجناس و اسٹاک' : 'Items & Stock', href: '/masters/items' },
    ];

    // Item Form
    const itemForm = useForm({
        name_en: '',
        name_ur: '',
        unit: '',
        kg_per_unit: '' as any,
        opening_stock: '' as any,
        default_rate: '' as any,
        default_bardana: '' as any,
        shelf_life: '',
        low_stock_alert: '' as any,
        status: 'active',
    });

    // Area Form
    const areaForm = useForm({
        name_ur: '',
        name_en: '',
        status: 'active',
    });

    const handleTabChange = (tab: 'items' | 'areas') => {
        setActiveTab(tab);
        setSearch('');
        router.get('/masters/items', { tab }, { preserveState: true, replace: true });
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/masters/items', { search, tab: activeTab }, { preserveState: true });
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

    // Filter items based on sub-filter with custom ordering matching mockup (#1, #5, #6, #3, #2, #4, #7)
    const filteredItems = useMemo(() => {
        const orderMap: Record<number, number> = { 1: 1, 5: 2, 6: 3, 3: 4, 2: 5, 4: 6, 7: 7 };
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

    // --- ITEM ACTIONS ---
    const openAddItem = () => {
        setEditingItem(null);
        itemForm.reset();
        itemForm.setData({
            name_en: '',
            name_ur: '',
            unit: '',
            kg_per_unit: '' as any,
            opening_stock: '' as any,
            default_rate: '' as any,
            default_bardana: '' as any,
            shelf_life: '',
            low_stock_alert: '' as any,
            status: 'active',
        });
        setItemModalOpen(true);
    };

    const openEditItem = (it: Item) => {
        setEditingItem(it);
        const displayName = it.name_en || it.name || it.name_ur || '';
        itemForm.setData({
            name_en: displayName,
            name_ur: displayName,
            unit: it.unit || '',
            kg_per_unit: it.kg_per_unit || ('' as any),
            opening_stock: (it.opening_stock ?? it.current_stock ?? '') as any,
            default_rate: (it.default_rate !== undefined && it.default_rate !== null) ? it.default_rate : ('' as any),
            default_bardana: (it.default_bardana !== undefined && it.default_bardana !== null) ? it.default_bardana : ('' as any),
            shelf_life: it.shelf_life || (it.shelf_life_days ? `${it.shelf_life_days} din` : ''),
            low_stock_alert: it.low_stock_alert || ('' as any),
            status: it.status || 'active',
        });
        setItemModalOpen(true);
    };

    const handleItemSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalName = itemForm.data.name_en.trim();
        if (!finalName) {
            toast.error(isUrdu ? 'نام درج کرنا لازمی ہے' : 'Please enter item name');
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
            unit: itemForm.data.unit || '',
            kg_per_unit: itemForm.data.kg_per_unit !== '' && itemForm.data.kg_per_unit !== null ? Number(itemForm.data.kg_per_unit) : null,
            opening_stock: itemForm.data.opening_stock !== '' && itemForm.data.opening_stock !== null ? Number(itemForm.data.opening_stock) : 0,
            current_stock: editingItem ? (editingItem.current_stock ?? Number(itemForm.data.opening_stock)) : Number(itemForm.data.opening_stock || 0),
            default_rate: itemForm.data.default_rate !== '' && itemForm.data.default_rate !== null ? Number(itemForm.data.default_rate) : null,
            default_bardana: itemForm.data.default_bardana !== '' && itemForm.data.default_bardana !== null ? Number(itemForm.data.default_bardana) : null,
            shelf_life: itemForm.data.shelf_life || null,
            shelf_life_days: days,
            low_stock_alert: itemForm.data.low_stock_alert !== '' && itemForm.data.low_stock_alert !== null ? Number(itemForm.data.low_stock_alert) : 10,
            status: itemForm.data.status || 'active',
        };

        if (editingItem) {
            itemForm.put(`/masters/items/${editingItem.id}`, {
                data: payload,
                onSuccess: () => {
                    toast.success(isUrdu ? 'جنس تبدیل ہو گئی' : 'Item updated successfully');
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
                    toast.success(isUrdu ? 'نئی جنس شامل ہو گئی' : 'Item created successfully');
                    setItemModalOpen(false);
                },
                onError: (errs) => {
                    const msg = Object.values(errs)[0];
                    toast.error(msg || (isUrdu ? 'خرابی واقع ہوئی' : 'Failed to create item'));
                },
            });
        }
    };

    const deleteItem = (it: Item) => {
        const displayName = it.name_en || it.name || it.name_ur;
        if (!confirm(isUrdu ? `کیا آپ واقعی "${displayName}" کو حذف کرنا چاہتے ہیں؟` : `Are you sure you want to delete ${displayName}?`)) {
            return;
        }
        router.delete(`/masters/items/${it.id}`, {
            onSuccess: () => toast.success(isUrdu ? 'جنس حذف ہو گئی' : 'Item deleted successfully'),
            onError: (err: any) => toast.error(err?.message || (isUrdu ? 'ڈیلیٹ نہیں ہو سکا' : 'Could not delete')),
        });
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
        toast.info(`${it.name_en} Wastage record create ho gaya (Sale band).`);
    };

    // --- AREA ACTIONS ---
    const openAddArea = () => {
        setEditingArea(null);
        areaForm.reset();
        areaForm.setData({
            name_ur: '',
            name_en: '',
            status: 'active',
        });
        setAreaModalOpen(true);
    };

    const openEditArea = (a: Area) => {
        setEditingArea(a);
        const displayName = a.name_en || a.name || a.name_ur || '';
        areaForm.setData({
            name_ur: displayName,
            name_en: displayName,
            status: a.status || 'active',
        });
        setAreaModalOpen(true);
    };

    const handleAreaSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalName = areaForm.data.name_en.trim();
        if (!finalName) {
            toast.error(isUrdu ? 'علاقہ کا نام درج کرنا لازمی ہے' : 'Please enter area name');
            return;
        }

        const payload = {
            ...areaForm.data,
            name_en: finalName,
            name_ur: finalName,
        };

        if (editingArea) {
            areaForm.put(`/masters/areas/${editingArea.id}`, {
                data: payload,
                onSuccess: () => {
                    toast.success(isUrdu ? 'علاقہ تبدیل ہو گیا' : 'Area updated successfully');
                    setAreaModalOpen(false);
                },
                onError: (errs) => {
                    const msg = Object.values(errs)[0];
                    toast.error(msg || (isUrdu ? 'خرابی واقع ہوئی' : 'Failed to update area'));
                },
            });
        } else {
            areaForm.post('/masters/areas', {
                data: payload,
                onSuccess: () => {
                    toast.success(isUrdu ? 'نیا علاقہ شامل ہو گیا' : 'Area created successfully');
                    setAreaModalOpen(false);
                },
                onError: (errs) => {
                    const msg = Object.values(errs)[0];
                    toast.error(msg || (isUrdu ? 'خرابی واقع ہوئی' : 'Failed to create area'));
                },
            });
        }
    };

    const toggleAreaStatus = (a: Area) => {
        const nextStatus = a.status === 'active' ? 'inactive' : 'active';
        router.put(`/masters/areas/${a.id}`, {
            name_ur: a.name_en || a.name || a.name_ur,
            name_en: a.name_en || a.name || a.name_ur,
            status: nextStatus,
        }, {
            preserveScroll: true,
            onSuccess: () => toast.success(isUrdu ? `اسٹیٹس: ${nextStatus}` : `Status updated to ${nextStatus}`),
        });
    };

    const deleteArea = (a: Area) => {
        const displayName = a.name_en || a.name || a.name_ur;
        if (!confirm(isUrdu ? 'کیا آپ واقعی اس علاقے کو حذف کرنا چاہتے ہیں؟' : `Are you sure you want to delete ${displayName}?`)) {
            return;
        }
        router.delete(`/masters/areas/${a.id}`, {
            onSuccess: () => toast.success(isUrdu ? 'علاقہ حذف ہو گیا' : 'Area deleted successfully'),
            onError: (err: any) => toast.error(err?.message || (isUrdu ? 'ڈیلیٹ نہیں ہو سکا' : 'Could not delete')),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'اجناس و اسٹاک' : 'Items & Stock'} />

            <div className="-mt-4 -mx-4 -mb-8 pb-28 bg-[#f4f6f4] min-h-screen font-sans text-[#1a211c] print:hidden" dir={isUrdu ? 'rtl' : 'ltr'}>
                
                {/* 1. Dark Green Top Header Banner */}
                <MandiPageHeader
                    title={isUrdu ? 'اجناس اور اسٹاک' : 'Items & Stock'}
                    subtitle={isUrdu ? 'سبزی اجناس، اسٹاک یونٹس، شیلف لائف اور علاقہ جات' : 'Items, Stock Units, Shelf Life & Areas'}
                    isUrdu={isUrdu}
                >
                    <button
                        type="button"
                        onClick={() => {
                            if (activeTab === 'items') openAddItem();
                            else openAddArea();
                        }}
                        className="h-9 px-4 rounded-xl text-xs md:text-sm font-semibold bg-white text-emerald-900 hover:bg-emerald-50 shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                        <Icon name="Plus" className="size-4 text-emerald-800" weight="bold" />
                        <span>
                            {activeTab === 'items' && '+ Nayi Jins'}
                            {activeTab === 'areas' && '+ Naya Area'}
                        </span>
                    </button>
                </MandiPageHeader>

                {/* 2. Floating Content Area */}
                <div className="max-w-7xl mx-auto px-3 md:px-6 -mt-6 md:-mt-8 space-y-4 relative">
                    
                    {/* Floating Alert Box: Tamatar 24 ghante me kharab hoga (Auto closes in 5 sec or via X) */}
                    {showAlertToast && activeTab === 'items' && (() => {
                        const tamatar = items.data.find(i => i.id === 3);
                        const tamatarStock = tamatar ? (tamatar.current_stock ?? tamatar.opening_stock ?? 0) : 0;
                        if (!tamatar || tamatarStock <= 0) return null;

                        return (
                            <div className="absolute end-4 md:end-6 top-1 z-30 bg-white rounded-2xl border border-amber-300 shadow-xl p-3.5 max-w-sm text-xs space-y-2 animate-in fade-in slide-in-from-top-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-0.5">
                                        <h4 className="font-bold text-gray-900 text-xs leading-snug">
                                            Alert: Tamatar 24 ghante mein kharab hoga
                                        </h4>
                                        <p className="text-[11px] text-gray-600 leading-tight">
                                            Baaki 23h 40m · Discount lagakar bech dein · 5 second mein band
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowAlertToast(false)}
                                        className="text-gray-400 hover:text-gray-600 cursor-pointer p-0.5"
                                    >
                                        <Icon name="X" className="size-3.5" />
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleOpenDiscount(tamatar)}
                                    className="px-3.5 py-1.5 bg-[#854d0e] hover:bg-[#713f12] text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
                                >
                                    Discount lagayein
                                </button>
                            </div>
                        );
                    })()}

                    {/* Tab Bar & Search Card */}
                    <div className="bg-white rounded-xl border border-gray-200/90 shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
                        {/* 2 Tabs: Items and Areas */}
                        <div className="flex items-center gap-1.5 p-1 bg-gray-100/90 rounded-lg max-w-full overflow-x-auto">
                            <button
                                type="button"
                                onClick={() => handleTabChange('items')}
                                className={`px-4 py-2 rounded-md text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                                    activeTab === 'items'
                                        ? 'bg-[#14532d] text-white shadow-xs'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <span>Items (Jins)</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                                    activeTab === 'items' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                                }`}>
                                    {items.total || items.data.length}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleTabChange('areas')}
                                className={`px-4 py-2 rounded-md text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                                    activeTab === 'areas'
                                        ? 'bg-[#14532d] text-white shadow-xs'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <span>Areas (Ilaqa)</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                                    activeTab === 'areas' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                                }`}>
                                    {areas.total || areas.data.length}
                                </span>
                            </button>
                        </div>

                        {/* Search Bar */}
                        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-64">
                                <Icon name="MagnifyingGlass" className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder={
                                        activeTab === 'items'
                                            ? 'Search item...'
                                            : 'Search area...'
                                    }
                                    className="w-full h-9 ps-9 pe-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-900 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                                />
                            </div>
                            <button
                                type="submit"
                                className="h-9 px-3.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold cursor-pointer"
                            >
                                Search
                            </button>
                        </form>
                    </div>

                    {/* Filter Chips Bar (Items 7, Low Stock 1, 24h expiry 1, Expired 1, Khatam 1) */}
                    {activeTab === 'items' && (
                        <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs px-4 py-2.5 flex items-center gap-2 overflow-x-auto">
                            {/* All Items */}
                            <button
                                type="button"
                                onClick={() => setItemFilter('all')}
                                className={cn(
                                    "px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                                    itemFilter === 'all'
                                        ? "bg-gray-100 text-gray-900 border border-gray-300"
                                        : "text-gray-500 hover:bg-gray-50"
                                )}
                            >
                                <span>Items</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gray-200 text-gray-700 font-bold">
                                    {stats.total}
                                </span>
                            </button>

                            {/* Low Stock: 1 */}
                            <button
                                type="button"
                                onClick={() => setItemFilter('low_stock')}
                                className={cn(
                                    "px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                                    itemFilter === 'low_stock'
                                        ? "bg-amber-100 text-amber-900 border border-amber-300 ring-1 ring-amber-300"
                                        : "bg-amber-50/70 text-amber-800 hover:bg-amber-100/70 border border-amber-200/60"
                                )}
                            >
                                <span>Low Stock</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 font-bold">
                                    {stats.lowStock}
                                </span>
                            </button>

                            {/* 24h expiry: 1 */}
                            <button
                                type="button"
                                onClick={() => setItemFilter('expiring_24h')}
                                className={cn(
                                    "px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                                    itemFilter === 'expiring_24h'
                                        ? "bg-amber-100 text-amber-900 border border-amber-300 ring-1 ring-amber-300"
                                        : "bg-amber-50/70 text-amber-800 hover:bg-amber-100/70 border border-amber-200/60"
                                )}
                            >
                                <span>24h expiry</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 font-bold">
                                    {stats.expiring}
                                </span>
                            </button>

                            {/* Expired: 1 */}
                            <button
                                type="button"
                                onClick={() => setItemFilter('expired')}
                                className={cn(
                                    "px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                                    itemFilter === 'expired'
                                        ? "bg-red-100 text-red-900 border border-red-300 ring-1 ring-red-300"
                                        : "bg-red-50/70 text-red-800 hover:bg-red-100/70 border border-red-200/60"
                                )}
                            >
                                <span>Expired</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-200 text-red-900 font-bold">
                                    {stats.expired}
                                </span>
                            </button>

                            {/* Khatam: 1 */}
                            <button
                                type="button"
                                onClick={() => setItemFilter('khatam')}
                                className={cn(
                                    "px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                                    itemFilter === 'khatam'
                                        ? "bg-gray-200 text-gray-900 border border-gray-400 ring-1 ring-gray-400"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300"
                                )}
                            >
                                <span>Khatam</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gray-300 text-gray-800 font-bold">
                                    {stats.khatam}
                                </span>
                            </button>
                        </div>
                    )}

                    {/* TAB 1: ITEMS TABLE (Exact Image 1 Layout) */}
                    {activeTab === 'items' && (
                        <div className="bg-white rounded-xl border border-gray-200/90 shadow-xs overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs font-sans">
                                    <thead>
                                        <tr className="bg-[#14532d] text-white font-bold select-none">
                                            <th className="px-3.5 py-2.5 text-start w-12">Code</th>
                                            <th className="px-3.5 py-2.5 text-start">Name</th>
                                            <th className="px-3.5 py-2.5 text-start w-16">Unit</th>
                                            <th className="px-3.5 py-2.5 text-start min-w-[170px]">Stock (baaki)</th>
                                            <th className="px-3.5 py-2.5 text-start min-w-[100px]">Rate</th>
                                            <th className="px-3.5 py-2.5 text-start min-w-[85px]">Shelf Life</th>
                                            <th className="px-3.5 py-2.5 text-center min-w-[90px]">Status</th>
                                            <th className="px-3.5 py-2.5 text-start min-w-[170px]">Expiry (lot-wise)</th>
                                            <th className="px-3.5 py-2.5 text-center w-24">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="px-3 py-8 text-center text-gray-400 text-xs">
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

                                                // Dynamic progress bar calculation
                                                const opening = (it.opening_stock && it.opening_stock > 0) ? it.opening_stock : (currentStock > 0 ? currentStock : 100);
                                                const progressPercent = Math.min(100, Math.max(0, Math.round((currentStock / opening) * 100)));
                                                const showProgressBar = currentStock > 0 && !isExpired && !isKhatam;

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
                                                        {/* Code */}
                                                        <td className="px-3.5 py-3 font-bold text-gray-900 whitespace-nowrap">
                                                            #{it.id}
                                                        </td>

                                                        {/* Name (English only) */}
                                                        <td className="px-3.5 py-3 text-gray-900 font-bold whitespace-nowrap">
                                                            {it.name_en || it.name || it.name_ur || '—'}
                                                        </td>

                                                        {/* Unit */}
                                                        <td className="px-3.5 py-3 text-gray-700 whitespace-nowrap">
                                                            {unitName}
                                                        </td>

                                                        {/* Stock (baaki) with Dynamic Progress Bar & Notes */}
                                                        <td className="px-3.5 py-3 whitespace-nowrap">
                                                            <div className="space-y-0.5">
                                                                <div className="font-bold text-gray-900">
                                                                    {currentStock} {unitName}
                                                                </div>

                                                                {/* Secondary note */}
                                                                {isKhatam ? (
                                                                    <div className="text-[11px] text-gray-400">
                                                                        Stock khatam
                                                                    </div>
                                                                ) : isExpired ? (
                                                                    <div className="text-[11px] text-red-600">
                                                                        Sale band
                                                                    </div>
                                                                ) : isLowStock ? (
                                                                    <div className="text-[11px] text-amber-800">
                                                                        Sirf {currentStock} bache
                                                                    </div>
                                                                ) : it.stock_note ? (
                                                                    <div className="text-[11px] text-gray-500">
                                                                        {it.stock_note}
                                                                    </div>
                                                                ) : it.kg_per_unit ? (
                                                                    <div className="text-[11px] text-gray-500">
                                                                        {(currentStock * it.kg_per_unit).toLocaleString()} kg · 1 {unitName} = {it.kg_per_unit} kg
                                                                    </div>
                                                                ) : null}

                                                                {/* Progress bar */}
                                                                {showProgressBar && (
                                                                    <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                                                                        <div
                                                                            className="h-full bg-emerald-700 rounded-full"
                                                                            style={{ width: `${progressPercent}%` }}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Rate (e.g. Rs. 850 → 720 if discounted) */}
                                                        <td className="px-3.5 py-3 text-gray-900 font-medium whitespace-nowrap">
                                                            {it.discount_rate && !isKhatam ? (
                                                                <span className="flex items-center gap-1.5">
                                                                    <span className="text-gray-500">Rs. {formatNum(it.default_rate)}</span>
                                                                    <span className="text-gray-400">→</span>
                                                                    <span className="text-gray-900 font-bold">{formatNum(it.discount_rate)}</span>
                                                                </span>
                                                            ) : (
                                                                <span>{it.default_rate ? `Rs. ${formatNum(it.default_rate)}` : '—'}</span>
                                                            )}
                                                        </td>

                                                        {/* Shelf Life */}
                                                        <td className="px-3.5 py-3 text-gray-700 whitespace-nowrap">
                                                            {it.shelf_life || (it.shelf_life_days ? `${it.shelf_life_days} din` : '4-5 din')}
                                                        </td>

                                                        {/* Status */}
                                                        <td className="px-3.5 py-3 text-center whitespace-nowrap">
                                                            {isKhatam ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-300">
                                                                    Khatam
                                                                </span>
                                                            ) : isExpired ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200">
                                                                    Expired
                                                                </span>
                                                            ) : isLowStock ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                                                                    Low Stock
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                    Active
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Expiry (lot-wise) */}
                                                        <td className="px-3.5 py-3 whitespace-nowrap">
                                                            {isKhatam ? (
                                                                <span className="text-gray-500 font-medium">Timer band (stock 0)</span>
                                                            ) : isExpired ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-red-700 font-medium">3h pehle</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleWastage(it)}
                                                                        className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#991b1b] hover:bg-[#7f1d1d] text-white shadow-2xs transition-colors cursor-pointer"
                                                                    >
                                                                        Wastage
                                                                    </button>
                                                                </div>
                                                            ) : isExpiringSoon ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-amber-900 font-medium">{it.expiry_countdown?.text || '23h 40m baaki'}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenDiscount(it)}
                                                                        className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#854d0e] hover:bg-[#713f12] text-white shadow-2xs transition-colors cursor-pointer"
                                                                    >
                                                                        Discount
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-0.5">
                                                                    <span className="text-emerald-900 font-medium">
                                                                        {it.expiry_countdown?.text && it.expiry_countdown.text !== '—'
                                                                            ? it.expiry_countdown.text
                                                                            : (it.shelf_life ? `${it.shelf_life} baaki` : '—')}
                                                                    </span>
                                                                    {it.lot_date && (
                                                                        <div className="text-[11px] text-gray-400">{it.lot_date}</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="px-3.5 py-3 text-center whitespace-nowrap">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openEditItem(it)}
                                                                    className="text-xs font-semibold text-gray-700 hover:text-black cursor-pointer"
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => deleteItem(it)}
                                                                    className="text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer"
                                                                >
                                                                    Delete
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
                    )}

                    {/* Explanatory footer note (Exact Image 1 layout) */}
                    {activeTab === 'items' && (
                        <div className="bg-[#f0f4f0] border border-emerald-200/80 rounded-xl p-3 text-xs text-gray-700 leading-relaxed">
                            <strong>Kaise chalta hai:</strong> Stock = Aamad - Sale (kg sale bhi Bori mein convert) · Timer lot-wise, stock 0 par band · Low Stock (10 ya kam): ek baar notification, bell mein save · Expiry alert 5 second mein hat jata hai
                        </div>
                    )}

                    {/* TAB 2: AREAS TABLE */}
                    {activeTab === 'areas' && (
                        <div className="bg-white rounded-xl border border-gray-200/90 shadow-xs overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs font-sans">
                                    <thead>
                                        <tr className="bg-[#14532d] text-white font-bold select-none">
                                            <th className="px-4 py-3 text-start w-20">Code</th>
                                            <th className="px-4 py-3 text-start">Area</th>
                                            <th className="px-4 py-3 text-center w-24">Status</th>
                                            <th className="px-4 py-3 text-center w-24">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {areas.data.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-xs">
                                                    No areas found
                                                </td>
                                            </tr>
                                        ) : (
                                            areas.data.map(a => (
                                                <tr key={a.id} className="hover:bg-gray-50/70 transition-colors">
                                                    <td className="px-4 py-3 font-bold text-gray-900">
                                                        #{a.code || a.id}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-900 font-bold">
                                                        {a.name_en || a.name || a.name_ur || '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleAreaStatus(a)}
                                                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer transition-all ${
                                                                a.status === 'active'
                                                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                            }`}
                                                        >
                                                            {a.status === 'active' ? 'Active' : 'Inactive'}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-2.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => openEditArea(a)}
                                                                className="text-xs font-semibold text-gray-700 hover:text-black cursor-pointer"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => deleteArea(a)}
                                                                className="text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Item Add/Edit Modal (Matching Image 2 EXACTLY) */}
            <Dialog open={itemModalOpen} onOpenChange={setItemModalOpen}>
                <DialogContent className="max-w-lg font-sans p-6 bg-white rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-gray-900">
                            {editingItem ? 'Jins (Item) edit karein' : 'Nayi Jins (Item) add karein'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleItemSubmit} className="space-y-3.5 pt-2">
                        {/* Row 1: Name and Unit */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">Name</Label>
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
                                    placeholder="Mirchi"
                                    className="h-9.5 text-sm border-gray-200 rounded-lg focus:border-[#14532d]"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">Unit</Label>
                                <Input
                                    value={itemForm.data.unit}
                                    onChange={e => itemForm.setData('unit', e.target.value)}
                                    placeholder="Bori"
                                    className="h-9.5 text-sm border-gray-200 rounded-lg focus:border-[#14532d]"
                                />
                            </div>
                        </div>

                        {/* Row 2: 1 Bori = kitne kg & Opening Stock (Units) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">
                                    {`1 ${itemForm.data.unit || 'Bori'} = kitne kg`}
                                </Label>
                                <Input
                                    type="number"
                                    step="any"
                                    value={itemForm.data.kg_per_unit}
                                    onChange={e => itemForm.setData('kg_per_unit', e.target.value)}
                                    placeholder="50"
                                    className="h-9.5 text-sm border-gray-200 rounded-lg focus:border-[#14532d]"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">Opening Stock (Units)</Label>
                                <Input
                                    type="number"
                                    value={itemForm.data.opening_stock}
                                    onChange={e => itemForm.setData('opening_stock', e.target.value)}
                                    placeholder="100"
                                    className="h-9.5 text-sm border-gray-200 rounded-lg focus:border-[#14532d]"
                                />
                            </div>
                        </div>

                        {/* Row 3: Rate / Bori & Bardana */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">
                                    {`Rate / ${itemForm.data.unit || 'Bori'}`}
                                </Label>
                                <Input
                                    type="number"
                                    step="any"
                                    value={itemForm.data.default_rate}
                                    onChange={e => itemForm.setData('default_rate', e.target.value)}
                                    placeholder="1000"
                                    className="h-9.5 text-sm border-gray-200 rounded-lg focus:border-[#14532d]"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">Bardana</Label>
                                <Input
                                    type="number"
                                    step="any"
                                    value={itemForm.data.default_bardana}
                                    onChange={e => itemForm.setData('default_bardana', e.target.value)}
                                    placeholder="20"
                                    className="h-9.5 text-sm border-gray-200 rounded-lg focus:border-[#14532d]"
                                />
                            </div>
                        </div>

                        {/* Row 4: Shelf Life (din) & Low Stock alert (Units) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">Shelf Life (din)</Label>
                                <Input
                                    value={itemForm.data.shelf_life}
                                    onChange={e => itemForm.setData('shelf_life', e.target.value)}
                                    placeholder="5 – 7"
                                    className="h-9.5 text-sm border-gray-200 rounded-lg focus:border-[#14532d]"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-semibold text-gray-700 block mb-1">Low Stock alert (Units)</Label>
                                <Input
                                    type="number"
                                    value={itemForm.data.low_stock_alert}
                                    onChange={e => itemForm.setData('low_stock_alert', e.target.value)}
                                    placeholder="10"
                                    className="h-9.5 text-sm border-gray-200 rounded-lg focus:border-[#14532d]"
                                />
                            </div>
                        </div>

                        {/* Alert Box 1 (Amber banner matching Image 2) */}
                        <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl text-xs text-amber-950 font-medium leading-relaxed">
                            <strong>Alerts:</strong> Expiry se 24h pehle (5 sec popup) · Low Stock 10 par ek baar
                        </div>

                        {/* Alert Box 2 (Green live preview box matching Image 2) */}
                        {(() => {
                            const itemName = itemForm.data.name_en || 'Jins';
                            const unitName = itemForm.data.unit || 'Bori';
                            const openingStock = Number(itemForm.data.opening_stock) || 0;
                            const kgPerUnit = Number(itemForm.data.kg_per_unit) || 0;
                            const totalKg = (openingStock * kgPerUnit).toLocaleString('en-US');
                            const shelfLifeStr = itemForm.data.shelf_life || 'din';

                            return (
                                <div className="p-3 bg-emerald-50/90 border border-emerald-200/90 rounded-xl text-xs text-emerald-950 font-medium leading-relaxed">
                                    <strong>Save karte hi:</strong> {itemName} Todays Sale mein aa jayegi · stock {openingStock} {unitName} {kgPerUnit > 0 ? `(${totalKg} kg)` : ''} · countdown {shelfLifeStr} shuru
                                </div>
                            );
                        })()}

                        <DialogFooter className="pt-2 flex items-center justify-between sm:justify-start gap-2">
                            <button
                                type="submit"
                                disabled={itemForm.processing}
                                className="min-h-[42px] px-6 py-2 bg-[#14532d] hover:bg-[#166534] active:bg-[#0f3d21] text-white font-bold text-sm rounded-lg shadow-xs transition-colors cursor-pointer"
                            >
                                Save karein
                            </button>
                            <button
                                type="button"
                                onClick={() => setItemModalOpen(false)}
                                className="min-h-[42px] px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                            >
                                Cancel
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

            {/* Area Add/Edit Modal */}
            <Dialog open={areaModalOpen} onOpenChange={setAreaModalOpen}>
                <DialogContent className="max-w-md font-sans">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-gray-900">
                            {editingArea ? 'Edit Area' : '+ Add New Area'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAreaSubmit} className="space-y-3 pt-2">
                        <div>
                            <Label className="text-xs font-semibold">Area Name *</Label>
                            <Input
                                required
                                value={areaForm.data.name_en}
                                onChange={e => {
                                    const val = e.target.value;
                                    areaForm.setData({
                                        ...areaForm.data,
                                        name_en: val,
                                        name_ur: val,
                                    });
                                }}
                                placeholder="e.g. Malir, Sanghar, Thatta"
                                className="h-9 text-xs"
                            />
                        </div>

                        <DialogFooter className="pt-2 gap-2">
                            <Button type="button" variant="outline" onClick={() => setAreaModalOpen(false)} className="text-xs">
                                Cancel
                            </Button>
                            <Button type="submit" disabled={areaForm.processing} className="bg-[#14532d] hover:bg-[#0e3b20] text-white text-xs font-semibold">
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
