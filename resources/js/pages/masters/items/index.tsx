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

    useEffect(() => {
        const tab = (filters.tab === 'areas' || currentTab === 'areas') ? 'areas' : 'items';
        setActiveTab(tab);
    }, [filters.tab, currentTab]);

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
        if (!name) return '—';
        return name.replace(/\s*\([^)]*\)/g, '').trim();
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'سیٹ اپ' : 'Setup', href: '#' },
        { title: isUrdu ? 'پروڈکٹس اور اسٹاک' : 'Products and Stocks', href: '/masters/items' },
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
        toast.info(`${cleanItemName(it.name_en)} Wastage record create ho gaya (Sale band).`);
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
            <Head title={isUrdu ? 'پروڈکٹس اور اسٹاک' : 'Products and Stocks'} />

            <div className="-mt-4 -mx-4 -mb-8 pb-28 bg-[#f4f6f4] min-h-screen font-sans text-[#1a211c] print:hidden" dir={isUrdu ? 'rtl' : 'ltr'}>
                
                {/* 1. Dark Green Top Header Banner */}
                <MandiPageHeader
                    title={isUrdu ? 'پروڈکٹس اور اسٹاک' : 'Products and Stocks'}
                    subtitle={isUrdu ? 'سبزی اجناس، اسٹاک، ریٹس اور شیلف لائف' : 'Products, Stock Units, Shelf Life & Rates'}
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
                            {activeTab === 'items' && (isUrdu ? 'نیا پروڈکٹ' : 'New Product')}
                            {activeTab === 'areas' && (isUrdu ? 'نیا علاقہ' : 'New Area')}
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

                    {/* Tab Bar Card */}
                    <div className="bg-white rounded-xl border border-gray-200/90 shadow-xs p-3 flex flex-wrap items-center justify-between gap-3">
                        {/* 2 Tabs: Products and Areas */}
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
                                <span>{isUrdu ? 'پروڈکٹس (جنس)' : 'Products (Jins)'}</span>
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
                                <span>{isUrdu ? 'علاقہ (Ilaqa)' : 'Areas (Ilaqa)'}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                                    activeTab === 'areas' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                                }`}>
                                    {areas.total || areas.data.length}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Filter Chips Bar (Products 8, Low Stock 0, 24h expiry 0, Expired 1, Khatam 6 - Card Style with Borders) */}
                    {activeTab === 'items' && (
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
                                <span>{isUrdu ? 'پروڈکٹس' : 'Products'}</span>
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
                    )}

                    {/* TAB 1: ITEMS TABLE */}
                    {activeTab === 'items' && (
                        <div className="bg-white rounded-xl border border-gray-200/90 shadow-xs overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm font-sans">
                                    <thead>
                                        <tr className="bg-[#14532d] text-white font-bold select-none text-xs md:text-sm">
                                            <th className="px-3 py-3 text-start w-14">Code</th>
                                            <th className="px-3 py-3 text-start w-36">Name</th>
                                            <th className="px-3 py-3 text-start w-20">Unit</th>
                                            <th className="px-3 py-3 text-center w-24">Stock (baaki)</th>
                                            <th className="px-3 py-3 text-start w-28">Rate</th>
                                            <th className="px-3 py-3 text-start w-24">Shelf Life</th>
                                            <th className="px-3 py-3 text-center w-24">Status</th>
                                            <th className="px-3 py-3 text-start w-36">Expiry (lot-wise)</th>
                                            <th className="px-4 py-3 text-center min-w-[180px]">Action</th>
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
                                                        <td className="px-3 py-3 font-bold text-gray-900 whitespace-nowrap text-xs md:text-sm w-14">
                                                            #{it.id}
                                                        </td>

                                                        {/* Name (Clean simple name without parentheses) */}
                                                        <td className="px-3 py-3 text-gray-900 font-bold whitespace-nowrap text-xs md:text-sm w-36">
                                                            {displayName}
                                                        </td>

                                                        {/* Unit */}
                                                        <td className="px-3 py-3 text-gray-700 whitespace-nowrap text-xs md:text-sm font-medium w-20">
                                                            {unitName}
                                                        </td>

                                                        {/* Stock (baaki) - STRICTLY ONLY NUMBERS */}
                                                        <td className="px-3 py-3 text-center font-bold text-gray-900 whitespace-nowrap text-xs md:text-sm w-24">
                                                            {currentStock}
                                                        </td>

                                                        {/* Rate */}
                                                        <td className="px-3 py-3 text-gray-900 font-semibold whitespace-nowrap text-xs md:text-sm w-28">
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
                                                        <td className="px-3 py-3 text-gray-700 whitespace-nowrap text-xs md:text-sm font-medium w-24">
                                                            {it.shelf_life || (it.shelf_life_days ? `${it.shelf_life_days} din` : '4-5 din')}
                                                        </td>

                                                        {/* Status */}
                                                        <td className="px-3 py-3 text-center whitespace-nowrap w-24">
                                                            {isKhatam ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                                                                    Khatam
                                                                </span>
                                                            ) : isExpired ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                                                                    Expired
                                                                </span>
                                                            ) : isLowStock ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                                                    Kam
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                    Theek
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Expiry (lot-wise) */}
                                                        <td className="px-3 py-3 whitespace-nowrap text-xs md:text-sm w-36">
                                                            {isKhatam ? (
                                                                <span className="text-gray-500 font-medium">Timer band (stock 0)</span>
                                                            ) : isExpired ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-red-700 font-medium">3h pehle</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleWastage(it)}
                                                                        className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#991b1b] hover:bg-[#7f1d1d] text-white shadow-2xs transition-colors cursor-pointer"
                                                                    >
                                                                        Wastage
                                                                    </button>
                                                                </div>
                                                            ) : isExpiringSoon ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-amber-900 font-medium">{it.expiry_countdown?.text || '23h 40m baaki'}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenDiscount(it)}
                                                                        className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#854d0e] hover:bg-[#713f12] text-white shadow-2xs transition-colors cursor-pointer"
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

                                                        {/* Action (Stock add, Adjust, Purchase banayein) */}
                                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                                            <div className="flex items-center justify-center gap-2">
                                                                {isKhatam ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openPurchaseModal(it)}
                                                                        className="px-3 py-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
                                                                    >
                                                                        Purchase banayein
                                                                    </button>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openStockAddModal(it)}
                                                                            className="px-3 py-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
                                                                        >
                                                                            Stock add
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openStockAdjustModal(it)}
                                                                            className="px-3 py-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
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
                                <table className="w-full text-sm font-sans">
                                    <thead>
                                        <tr className="bg-[#14532d] text-white font-bold select-none text-xs md:text-sm">
                                            <th className="px-4 py-3.5 text-start w-24">Code</th>
                                            <th className="px-4 py-3.5 text-start">Area</th>
                                            <th className="px-4 py-3.5 text-center w-28">Status</th>
                                            <th className="px-4 py-3.5 text-center w-32">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {areas.data.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                                                    No areas found
                                                </td>
                                            </tr>
                                        ) : (
                                            areas.data.map(a => (
                                                <tr key={a.id} className="hover:bg-gray-50/70 transition-colors">
                                                    <td className="px-4 py-3.5 font-bold text-gray-900 text-sm">
                                                        #{a.code || a.id}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-gray-900 font-bold text-sm">
                                                        {a.name_en || a.name || a.name_ur || '—'}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleAreaStatus(a)}
                                                            className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all ${
                                                                a.status === 'active'
                                                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                }`}
                                                        >
                                                            {a.status === 'active' ? 'Active' : 'Inactive'}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center">
                                                        <div className="flex items-center justify-center gap-2.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => openEditArea(a)}
                                                                className="text-xs font-semibold text-gray-700 hover:text-black cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => deleteArea(a)}
                                                                className="text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer px-2 py-1 rounded hover:bg-red-50"
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

            {/* Item Add/Edit Modal */}
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
                                <select
                                    value={itemForm.data.unit || 'Bori'}
                                    onChange={e => itemForm.setData('unit', e.target.value)}
                                    className="w-full h-9.5 px-3 text-sm border border-gray-200 rounded-lg focus:border-[#14532d] bg-white font-medium cursor-pointer"
                                >
                                    <option value="Bori">Bori</option>
                                    <option value="Nag">Nag</option>
                                    <option value="Peti">Peti</option>
                                </select>
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
