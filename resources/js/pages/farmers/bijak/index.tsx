import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import MandiPageHeader from '@/components/app/mandi-page-header';
import Icon from '@/components/ui/icon';
import { type BreadcrumbItem } from '@/types';
import { toast } from 'sonner';

interface Area {
    id: number;
    name_en: string;
    name_ur: string;
}

interface FarmerMark {
    id: number;
    code: number;
    farmer_id: number;
    name_en: string;
    name_ur: string;
}

interface FarmerOption {
    id: number;
    code: number;
    name_en: string;
    name_ur: string;
    phone?: string;
    area?: Area;
    marks: FarmerMark[];
}

interface ItemOption {
    id: number;
    name_en: string;
    name_ur: string;
    unit: string;
    default_rate: number | null;
    default_bardana: number | null;
}

interface SavedBillItem {
    item_id?: number;
    name: string;
    nag: number;
    rate: number;
    gross: number;
}

interface SavedBillData {
    id: number;
    bill_no: string;
    farmer_name: string;
    truck_no?: string;
    items?: SavedBillItem[];
    net_amount: number;
    gross_amount: number;
    total_gross?: number;
    total_nag?: number;
    total_weight?: number;
    commission_pct?: number;
    commission_amount?: number;
    mazdoori_rate?: number;
    mazdoori_amount?: number;
    kiraya?: number;
    market_fee_pct?: number;
    market_fee_amount?: number;
    total_charges?: number;
    date: string;
}

interface Props {
    farmers: FarmerOption[];
    items: ItemOption[];
    saved_bill?: SavedBillData | null;
    filters: { date: string };
}

interface BillItemRow {
    item_id: number;
    name: string;
    nag: string;
    weight: string;
    rate: string;
}

export default function BijjakIndex({ farmers, items, saved_bill, filters }: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'روزانہ کام' : 'Daily Kaam', href: '#' },
        { title: isUrdu ? 'کسان کا بل (بیجک)' : 'Farmer Invoices (Bijak)', href: '/bijak' },
    ];

    // Top Card States
    const [farmerId, setFarmerId] = useState<string>('');
    const [truckNo, setTruckNo] = useState<string>('');
    const [billDate, setBillDate] = useState<string>(filters?.date || new Date().toISOString().split('T')[0]);

    // Bori input refs for focusing after quick add
    const boriInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

    // 30-second background polling for real-time updates
    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({ preserveScroll: true, preserveState: true });
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    // Selected Farmer Object
    const selectedFarmer = useMemo(() => {
        if (!farmerId) return null;
        return farmers.find(f => String(f.id) === String(farmerId)) || null;
    }, [farmers, farmerId]);

    // Quick Items resolution
    const getItemByKeyword = (kw: string) => {
        const lower = kw.toLowerCase().trim();
        return items.find(it => {
            const en = (it.name_en || '').toLowerCase();
            const ur = (it.name_ur || '').toLowerCase();
            if (lower === 'tamatar') return en.includes('tamatar') || en.includes('tomato') || ur.includes('ٹماٹر');
            if (lower === 'aloo') return en.includes('aloo') || en.includes('potato') || ur.includes('آلو');
            if (lower === 'pyaz') return en.includes('piyaz') || en.includes('pyaz') || en.includes('onion') || ur.includes('پیاز');
            if (lower === 'gobi') return en.includes('gobhi') || en.includes('gobi') || en.includes('cabbage') || ur.includes('گوبھی');
            if (lower === 'bhindi') return en.includes('bhindi') || en.includes('okra') || ur.includes('بھنڈی');
            if (lower === 'hari mirch') return en.includes('harri mirch') || en.includes('hari mirch') || en.includes('chilli') || ur.includes('ہری مرچ');
            return en.includes(lower) || ur.includes(lower);
        }) || null;
    };

    // Bill Items State (starts empty so user selects their own)
    const [billItems, setBillItems] = useState<BillItemRow[]>([]);

    // Charges States - empty by default so user enters their own values
    const [commissionPct, setCommissionPct] = useState<string>('');
    const [mazdooriRate, setMazdooriRate] = useState<string>('');
    const [kiraya, setKiraya] = useState<string>('');
    const [marketFeePct, setMarketFeePct] = useState<string>('');

    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [completedBill, setCompletedBill] = useState<SavedBillData | null>(saved_bill || null);
    const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);

    // Helpers
    const farmerTitle = (f: FarmerOption) => {
        const name = f.name_en || f.name_ur;
        const area = f.area ? (f.area.name_en || f.area.name_ur) : '';
        return area ? `${name} - ${area}` : name;
    };

    // Date change handler with filtering
    const handleDateChange = (newDate: string) => {
        setBillDate(newDate);
        router.get('/bijak', { date: newDate }, { preserveScroll: true, replace: true });
    };

    // Row management
    const addQuickItem = (name: string) => {
        const matched = getItemByKeyword(name);
        if (!matched) return;

        // Check if item already exists in billItems
        const existingIndex = billItems.findIndex(it => Number(it.item_id) === Number(matched.id));
        if (existingIndex !== -1) {
            setTimeout(() => {
                boriInputRefs.current[existingIndex]?.focus();
                boriInputRefs.current[existingIndex]?.select();
            }, 50);
            return;
        }

        // Check if there is an empty/untouched initial row
        const emptyIndex = billItems.findIndex(it => (!it.nag || it.nag === '0') && (!it.rate || it.rate === '0'));
        if (emptyIndex !== -1) {
            setBillItems(prev => {
                const copy = [...prev];
                copy[emptyIndex] = {
                    item_id: matched.id,
                    name: matched.name_en.split(' ')[0],
                    nag: '',
                    weight: '',
                    rate: matched.default_rate ? String(matched.default_rate) : '',
                };
                return copy;
            });
            setTimeout(() => {
                boriInputRefs.current[emptyIndex]?.focus();
            }, 50);
            return;
        }

        const newIndex = billItems.length;
        setBillItems(prev => [
            ...prev,
            {
                item_id: matched.id,
                name: matched.name_en.split(' ')[0],
                nag: '',
                weight: '',
                rate: matched.default_rate ? String(matched.default_rate) : '',
            },
        ]);
        setTimeout(() => {
            boriInputRefs.current[newIndex]?.focus();
        }, 50);
    };

    const updateRow = (index: number, field: keyof BillItemRow, value: any) => {
        setBillItems(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [field]: value };
            if (field === 'item_id') {
                const found = items.find(it => it.id === Number(value));
                if (found) {
                    copy[index].name = found.name_en.split(' ')[0];
                }
            }
            return copy;
        });
    };

    const removeRow = (index: number) => {
        setBillItems(prev => prev.filter((_, i) => i !== index));
    };

    // Live Calculations: Raqam = Bori x Rate per bori
    const calculations = useMemo(() => {
        let totalNag = 0;
        let totalGross = 0;

        billItems.forEach(item => {
            const n = parseFloat(item.nag) || 0;
            const r = parseFloat(item.rate) || 0;
            const g = Math.round(n * r);
            totalNag += n;
            totalGross += g;
        });

        const commPctNum = parseFloat(commissionPct) || 0;
        const commAmount = Math.round((totalGross * commPctNum) / 100);

        const mazRateNum = parseFloat(mazdooriRate) || 0;
        const mazdooriAmount = Math.round(totalNag * mazRateNum);

        const kirayaAmount = parseFloat(kiraya) || 0;

        const feePctNum = parseFloat(marketFeePct) || 0;
        const marketFeeAmount = Math.round((totalGross * feePctNum) / 100);

        const totalCharges = Math.round(commAmount + mazdooriAmount + kirayaAmount + marketFeeAmount);
        const netPayable = Math.max(0, Math.round(totalGross - totalCharges));

        return {
            totalNag,
            totalGross,
            commAmount,
            mazdooriAmount,
            kirayaAmount,
            marketFeeAmount,
            totalCharges,
            netPayable,
        };
    }, [billItems, commissionPct, mazdooriRate, kiraya, marketFeePct]);

    // Handle Save Bill
    const handleSaveBill = (e: React.FormEvent) => {
        e.preventDefault();
        if (!farmerId) {
            toast.error('Please select a farmer first');
            return;
        }

        if (billItems.length === 0) {
            toast.error('Baraye meharbani kam az kam aik maal item shamil karein');
            return;
        }

        setIsSaving(true);
        const payload = {
            date: billDate,
            farmer_id: farmerId,
            truck_no: truckNo || null,
            items: billItems.map(it => ({
                item_id: it.item_id,
                nag: parseFloat(it.nag) || 0,
                weight: 0,
                rate: parseFloat(it.rate) || 0,
            })),
            commission_pct: parseFloat(commissionPct) || 0,
            mazdoori_rate: parseFloat(mazdooriRate) || 0,
            kiraya: parseFloat(kiraya) || 0,
            market_fee_pct: parseFloat(marketFeePct) || 0,
        };

        router.post('/bijak', payload, {
            preserveScroll: true,
            onSuccess: (page: any) => {
                setIsSaving(false);
                toast.success(isUrdu ? 'بیجک محفوظ ہو گیا' : 'Bill saved successfully');
                const saved = page.props?.saved_bill;
                const fallbackItems: SavedBillItem[] = billItems.map(it => ({
                    item_id: it.item_id,
                    name: it.name,
                    nag: parseFloat(it.nag) || 0,
                    rate: parseFloat(it.rate) || 0,
                    gross: (parseFloat(it.nag) || 0) * (parseFloat(it.rate) || 0),
                }));
                const billData: SavedBillData = saved || {
                    id: Date.now(),
                    bill_no: 'BJ-' + String(Math.floor(1000 + Math.random() * 9000)),
                    farmer_name: selectedFarmer ? farmerTitle(selectedFarmer) : 'Farmer',
                    truck_no: truckNo,
                    items: fallbackItems,
                    net_amount: calculations.netPayable,
                    gross_amount: calculations.totalGross,
                    total_gross: calculations.totalGross,
                    total_nag: calculations.totalNag,
                    total_weight: 0,
                    total_charges: calculations.totalCharges,
                    commission_pct: parseFloat(commissionPct) || 0,
                    commission_amount: calculations.commAmount,
                    mazdoori_rate: parseFloat(mazdooriRate) || 0,
                    mazdoori_amount: calculations.mazdooriAmount,
                    kiraya: parseFloat(kiraya) || 0,
                    market_fee_pct: parseFloat(marketFeePct) || 0,
                    market_fee_amount: calculations.marketFeeAmount,
                    date: billDate,
                };
                setCompletedBill(billData);
                setShowSuccessModal(true);
            },
            onError: () => {
                setIsSaving(false);
                toast.error(isUrdu ? 'محفوظ نہیں ہو سکا' : 'Could not save bill');
            },
        });
    };

    const handleNewBill = () => {
        setShowSuccessModal(false);
        setCompletedBill(null);
        setFarmerId('');
        setBillItems([]);
        setTruckNo('');
        setCommissionPct('');
        setMazdooriRate('');
        setKiraya('');
        setMarketFeePct('');
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Farmer Invoice" />

            {/* Main Outer Container - edge to edge without side or bottom gaps */}
            <div className="-mt-4 -mx-4 -mb-8 pb-28 bg-[#f4f6f4] min-h-screen font-sans text-gray-900 print:hidden" dir={isUrdu ? 'rtl' : 'ltr'}>
                
                {/* Green Header Banner */}
                <MandiPageHeader
                    title={
                        <span className="flex items-center gap-2">
                            <span>{isUrdu ? 'کسان کا بل (بیجک)' : 'Farmer Invoice (Bijak)'}</span>
                            {!isUrdu && <span className="font-normal font-sans text-emerald-100 text-xl md:text-2xl">بیجک</span>}
                        </span>
                    }
                    subtitle={isUrdu ? 'کسان کے مال کا بل بنائیں' : 'Create invoice for farmer consignment'}
                    isUrdu={isUrdu}
                />

                {/* Floating Main Content Container */}
                <div className="max-w-7xl mx-auto px-3 md:px-6 -mt-6 md:-mt-8 space-y-5">
                    
                    {/* Top Floating Card (Farmer & Transport Details) */}
                    <div className="bg-white rounded-xl shadow-xs border border-gray-200/90 p-4 md:p-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                            {/* Kisan */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    {isUrdu ? 'کسان' : 'Kisan'}
                                </label>
                                <select
                                    value={farmerId}
                                    onChange={e => setFarmerId(e.target.value)}
                                    className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#14532d]"
                                >
                                    <option value="">{isUrdu ? '-- کسان منتخب کریں --' : '-- Select Farmer --'}</option>
                                    {farmers.map(f => (
                                        <option key={f.id} value={f.id}>
                                            {farmerTitle(f)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Truck No */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    {isUrdu ? 'ٹرک نمبر (اختیاری)' : 'Truck No (zaroori nahi)'}
                                </label>
                                <input
                                    type="text"
                                    value={truckNo}
                                    onChange={e => setTruckNo(e.target.value)}
                                    placeholder="e.g. NAB652"
                                    className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#14532d]"
                                />
                            </div>

                            {/* Tareekh */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    {isUrdu ? 'تاریخ' : 'Tareekh'}
                                </label>
                                <input
                                    type="date"
                                    value={billDate}
                                    onChange={e => handleDateChange(e.target.value)}
                                    className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#14532d]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Main 2-Column Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        
                        {/* LEFT COLUMN: Maal Card */}
                        <div className="lg:col-span-8 bg-white rounded-xl shadow-xs border border-gray-200/90 p-5 space-y-4">
                            
                            {/* Card Header */}
                            <div className="flex items-center justify-between">
                                <h2 className="text-base font-bold text-gray-900">{isUrdu ? 'مال' : 'Maal'}</h2>
                                <span className="text-xs text-gray-500 font-medium">
                                    {billItems.length} {isUrdu ? 'آئٹم' : 'item'} · {calculations.totalNag} {isUrdu ? 'بوری' : 'bori'}
                                </span>
                            </div>

                            {/* Quick Add Pills */}
                            <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                <span className="text-gray-500 font-medium mr-1">{isUrdu ? 'جلدی شامل کریں:' : 'Jaldi add karein:'}</span>
                                {['Tamatar', 'Aloo', 'Pyaz', 'Gobi', 'Bhindi', 'Hari Mirch'].map(pill => (
                                    <button
                                        key={pill}
                                        type="button"
                                        onClick={() => addQuickItem(pill)}
                                        className="inline-flex items-center px-2.5 py-1 bg-white border border-gray-300 rounded-full font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors cursor-pointer"
                                    >
                                        + {pill}
                                    </button>
                                ))}
                            </div>

                            {/* Items Table - Responsive with clean layout */}
                            <div className="w-full">
                                {/* Table Header */}
                                <div className="grid grid-cols-12 gap-2 px-2 py-2.5 bg-gray-50/90 rounded-lg text-xs font-semibold text-gray-600 mb-2 items-center">
                                    <div className="col-span-4">{isUrdu ? 'مال' : 'Maal'}</div>
                                    <div className="col-span-3 text-center">{isUrdu ? 'بوری (تعداد)' : 'Bori (Tadaad)'}</div>
                                    <div className="col-span-2 text-center">{isUrdu ? 'ریٹ (روپے/بوری)' : 'Rate (Rs/bori)'}</div>
                                    <div className="col-span-2 text-right pr-1">{isUrdu ? 'رقم' : 'Raqam'}</div>
                                    <div className="col-span-1 text-center"></div>
                                </div>

                                {/* Table Body Rows */}
                                <div className="space-y-2">
                                    {billItems.length === 0 ? (
                                        <div className="py-8 text-center text-gray-400 text-xs font-medium border border-dashed border-gray-200 rounded-lg">
                                            {isUrdu ? 'کوئی مال شامل نہیں ہے۔ اوپر دیے گئے بٹنوں (+ ٹماٹر، + آلو وغیرہ) پر کلک کرکے مال شامل کریں۔' : 'Koi maal shamil nahi hai. Upar diye gaye buttons (+ Tamatar, + Aloo waghera) par click karke maal shamil karein.'}
                                        </div>
                                    ) : (
                                        billItems.map((row, idx) => {
                                            const n = parseFloat(row.nag) || 0;
                                            const r = parseFloat(row.rate) || 0;
                                            const raqam = Math.round(n * r);

                                            return (
                                                <div key={idx} className="grid grid-cols-12 gap-2 px-2 py-1.5 items-center hover:bg-gray-50/50 rounded-lg transition-colors">
                                                    {/* Maal Name / Select */}
                                                    <div className="col-span-4">
                                                        <select
                                                            value={row.item_id}
                                                            onChange={e => updateRow(idx, 'item_id', Number(e.target.value))}
                                                            className="w-full h-9 px-2 border border-gray-200 rounded-lg text-xs md:text-sm font-medium text-gray-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#14532d]"
                                                        >
                                                            {items.map(it => (
                                                                <option key={it.id} value={it.id}>
                                                                    {it.name_en.split(' ')[0]}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Bori (Tadaad) */}
                                                    <div className="col-span-3">
                                                        <input
                                                            ref={el => { boriInputRefs.current[idx] = el; }}
                                                            type="number"
                                                            value={row.nag}
                                                            onChange={e => updateRow(idx, 'nag', e.target.value)}
                                                            className="w-full h-9 px-2 text-center border border-gray-200 rounded-lg text-xs md:text-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#14532d]"
                                                            placeholder="0"
                                                        />
                                                    </div>

                                                    {/* Rate (Rs/bori) */}
                                                    <div className="col-span-2">
                                                        <input
                                                            type="number"
                                                            value={row.rate}
                                                            onChange={e => updateRow(idx, 'rate', e.target.value)}
                                                            className="w-full h-9 px-2 text-center border border-gray-200 rounded-lg text-xs md:text-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#14532d]"
                                                            placeholder="0"
                                                        />
                                                    </div>

                                                    {/* Raqam */}
                                                    <div className="col-span-2 text-right font-bold text-gray-900 text-xs md:text-sm whitespace-nowrap pr-1">
                                                        Rs. {raqam.toLocaleString()}
                                                    </div>

                                                    {/* Delete Action Button */}
                                                    <div className="col-span-1 flex justify-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeRow(idx)}
                                                            className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center border border-red-200 text-red-500 hover:bg-red-50 rounded text-xs md:text-sm font-bold transition-colors cursor-pointer"
                                                            title="Delete row"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Table Footer / Totals Row */}
                                <div className="grid grid-cols-12 gap-2 px-2 py-3 border-t border-gray-200 mt-3 font-bold text-xs md:text-sm text-gray-900 items-center">
                                    <div className="col-span-4">{isUrdu ? 'کل' : 'Total'}</div>
                                    <div className="col-span-3 text-center">{calculations.totalNag}</div>
                                    <div className="col-span-2"></div>
                                    <div className="col-span-2 text-right whitespace-nowrap pr-1">Rs. {calculations.totalGross.toLocaleString()}</div>
                                    <div className="col-span-1"></div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Charges & Net Payable Cards */}
                        <div className="lg:col-span-4 space-y-4">
                            
                            {/* Charges Card */}
                            <div className="bg-white rounded-xl shadow-xs border border-gray-200/90 p-5 space-y-4">
                                <h2 className="text-base font-bold text-gray-900">{isUrdu ? 'اخراجات / چارجز' : 'Charges'}</h2>

                                <div className="space-y-3 text-sm">
                                    {/* 1. Commission (Arhat) */}
                                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                        <div>
                                            <div className="font-medium text-gray-800">{isUrdu ? 'کمیشن (آڑھت)' : 'Commission (Arhat)'}</div>
                                            <div className="text-xs text-gray-500">Rs. {calculations.commAmount.toLocaleString()}</div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="number"
                                                value={commissionPct}
                                                onChange={e => setCommissionPct(e.target.value)}
                                                placeholder="0"
                                                className="w-14 h-9 px-2 text-center border border-gray-200 rounded-lg text-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#14532d]"
                                            />
                                            <span className="text-xs text-gray-500 font-medium">%</span>
                                        </div>
                                    </div>

                                    {/* 2. Mazdoori */}
                                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                        <div>
                                            <div className="font-medium text-gray-800">{isUrdu ? 'مزدوری' : 'Mazdoori'}</div>
                                            <div className="text-xs text-gray-500">Rs. {calculations.mazdooriAmount.toLocaleString()}</div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="number"
                                                value={mazdooriRate}
                                                onChange={e => setMazdooriRate(e.target.value)}
                                                placeholder="0"
                                                className="w-14 h-9 px-2 text-center border border-gray-200 rounded-lg text-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#14532d]"
                                            />
                                            <span className="text-xs text-gray-500 font-medium">Rs/tadaad</span>
                                        </div>
                                    </div>

                                    {/* 3. Kiraya (Freight) */}
                                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                        <div>
                                            <div className="font-medium text-gray-800">{isUrdu ? 'کرایہ' : 'Kiraya (Freight)'}</div>
                                            <div className="text-xs text-gray-500">Rs. {calculations.kirayaAmount.toLocaleString()}</div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="number"
                                                value={kiraya}
                                                onChange={e => setKiraya(e.target.value)}
                                                placeholder="0"
                                                className="w-20 h-9 px-2 text-center border border-gray-200 rounded-lg text-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#14532d]"
                                            />
                                            <span className="text-xs text-gray-500 font-medium">Rs</span>
                                        </div>
                                    </div>

                                    {/* 4. Market fee */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-medium text-gray-800">{isUrdu ? 'مارکیٹ فیس' : 'Market fee'}</div>
                                            <div className="text-xs text-gray-500">Rs. {calculations.marketFeeAmount.toLocaleString()}</div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={marketFeePct}
                                                onChange={e => setMarketFeePct(e.target.value)}
                                                placeholder="0"
                                                className="w-14 h-9 px-2 text-center border border-gray-200 rounded-lg text-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#14532d]"
                                            />
                                            <span className="text-xs text-gray-500 font-medium">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Summary & Net Payable Card */}
                            <div className="bg-white rounded-xl shadow-xs border border-gray-200/90 p-5 space-y-4">
                                <div className="space-y-2 text-sm font-medium">
                                    <div className="flex justify-between items-center text-gray-800">
                                        <span>{isUrdu ? 'کل فروخت' : 'Gross sale'}</span>
                                        <span className="font-bold">Rs. {calculations.totalGross.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-amber-600">
                                        <span>{isUrdu ? 'کل اخراجات' : 'Total charges'}</span>
                                        <span className="font-bold">- Rs. {calculations.totalCharges.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Big Green Box: Net Payable */}
                                <div className="bg-[#14532d] text-white rounded-xl p-4 space-y-1">
                                    <div className="text-xs text-emerald-100 font-medium">
                                        {isUrdu ? 'کسان کو دینا ہے (خالص واجب الادا)' : 'Net Payable to Farmer'}
                                    </div>
                                    <div className="text-2xl font-bold tracking-tight">
                                        Rs. {calculations.netPayable.toLocaleString()}
                                    </div>
                                </div>

                                {/* Save Button */}
                                <button
                                    type="button"
                                    onClick={handleSaveBill}
                                    disabled={isSaving || billItems.length === 0}
                                    className="w-full py-3 bg-[#14532d] hover:bg-[#0f3f22] text-white font-semibold rounded-xl text-center shadow-xs transition-colors cursor-pointer disabled:opacity-50 text-sm"
                                >
                                    {isSaving ? (isUrdu ? 'محفوظ ہو رہا ہے...' : 'Bachaya ja raha hai...') : (isUrdu ? 'بیجک محفوظ کریں' : 'Bill save karein')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Success Modal with Complete Bill Preview */}
            {showSuccessModal && completedBill && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-sans backdrop-blur-xs">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4">
                        {/* Header */}
                        <div className="text-center border-b border-gray-100 pb-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center text-xl font-black mb-1.5">
                                ✓
                            </div>
                            <h2 className="text-lg font-bold text-gray-900">
                                {isUrdu ? 'بیجک محفوظ ہو گیا' : 'Bill Saved Successfully'}
                            </h2>
                            <p className="text-xs text-gray-500 font-semibold">
                                {completedBill.bill_no} · {completedBill.date}
                            </p>
                        </div>

                        {/* Bill Details */}
                        <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200 text-xs space-y-2">
                            <div className="flex justify-between items-center pb-1.5 border-b border-gray-200/60">
                                <span className="text-gray-500 font-medium">{isUrdu ? 'کسان:' : 'Farmer:'}</span>
                                <strong className="text-gray-900 font-bold">{completedBill.farmer_name}</strong>
                            </div>
                            {completedBill.truck_no && (
                                <div className="flex justify-between items-center pb-1.5 border-b border-gray-200/60">
                                    <span className="text-gray-500 font-medium">{isUrdu ? 'ٹرک نمبر:' : 'Truck No:'}</span>
                                    <span className="text-gray-800 font-semibold">{completedBill.truck_no}</span>
                                </div>
                            )}

                            {/* Items List */}
                            <div className="pt-1">
                                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                    {isUrdu ? 'اجناس' : 'Items'}
                                </div>
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-gray-200 text-gray-500 text-[11px]">
                                            <th className="text-start py-1">{isUrdu ? 'آئٹم' : 'Item'}</th>
                                            <th className="text-center py-1">{isUrdu ? 'تعداد' : 'Qty'}</th>
                                            <th className="text-end py-1">{isUrdu ? 'ریٹ' : 'Rate'}</th>
                                            <th className="text-end py-1">{isUrdu ? 'رقم' : 'Amount'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {(completedBill.items || []).map((it, idx) => (
                                            <tr key={idx}>
                                                <td className="py-1 font-semibold text-gray-900">{it.name}</td>
                                                <td className="py-1 text-center font-bold text-gray-800">{it.nag} bori</td>
                                                <td className="py-1 text-end text-gray-700">Rs. {Number(it.rate).toLocaleString()}</td>
                                                <td className="py-1 text-end font-bold text-gray-900">Rs. {Number(it.gross).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Charges summary */}
                            <div className="pt-2 border-t border-gray-200/70 space-y-1 text-[11px]">
                                <div className="flex justify-between text-gray-700">
                                    <span>{isUrdu ? 'کل فروخت:' : 'Gross Sale:'}</span>
                                    <span className="font-bold">Rs. {Number(completedBill.total_gross || completedBill.gross_amount).toLocaleString()}</span>
                                </div>
                                {(completedBill.commission_amount || 0) > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>{isUrdu ? 'کمیشن' : 'Commission'} ({completedBill.commission_pct}%):</span>
                                        <span>- Rs. {Number(completedBill.commission_amount).toLocaleString()}</span>
                                    </div>
                                )}
                                {(completedBill.mazdoori_amount || 0) > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>{isUrdu ? 'مزدوری:' : 'Mazdoori:'}</span>
                                        <span>- Rs. {Number(completedBill.mazdoori_amount).toLocaleString()}</span>
                                    </div>
                                )}
                                {(completedBill.kiraya || 0) > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>{isUrdu ? 'کرایہ:' : 'Kiraya:'}</span>
                                        <span>- Rs. {Number(completedBill.kiraya).toLocaleString()}</span>
                                    </div>
                                )}
                                {(completedBill.market_fee_amount || 0) > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>{isUrdu ? 'مارکیٹ فیس:' : 'Market Fee:'}</span>
                                        <span>- Rs. {Number(completedBill.market_fee_amount).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Net Payable Highlight */}
                        <div className="bg-[#14532d] text-white rounded-xl p-3 text-center space-y-0.5">
                            <span className="text-[11px] text-emerald-100 font-medium">
                                {isUrdu ? 'کسان کو قابل ادائیگی رقم (Net Payable)' : 'Farmer Net Payable'}
                            </span>
                            <div className="text-2xl font-black tracking-tight">
                                Rs. {Number(completedBill.net_amount).toLocaleString()}
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-2.5 pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    document.body.classList.add('printing-slip');
                                    window.print();
                                    setTimeout(() => {
                                        document.body.classList.remove('printing-slip');
                                    }, 1500);
                                }}
                                className="flex-1 h-11 bg-[#14532d] hover:bg-[#0e3b20] text-white text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                            >
                                <Icon name="Printer" className="size-4" />
                                <span>{isUrdu ? 'پرچی پرنٹ کریں' : 'Print Slip'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleNewBill}
                                className="flex-1 h-11 bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer"
                            >
                                {isUrdu ? 'نیا بیجک' : 'Naya Bill'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Thermal 80mm Print Document for Saved Bill */}
            {completedBill && (
                <div id="printable-farmer-bill" className="hidden print:block p-4 bg-white text-black font-sans text-xs max-w-[80mm] mx-auto print-document-container" dir="ltr">
                    <div className="text-center border-b-2 border-[#166534] pb-2 mb-3">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                            <div className="w-6 h-6 rounded bg-[#166534] flex items-center justify-center text-white font-black text-xs">V</div>
                            <h1 className="text-base font-extrabold tracking-tight text-[#166534] uppercase">
                                Vegetable POS
                            </h1>
                        </div>
                        <p className="text-[11px] font-semibold text-gray-700">
                            Kisan ka Bill (Bijak) · بیجک
                        </p>
                    </div>

                    <div className="border border-gray-400 rounded p-2 mb-3 text-[11px] space-y-1 bg-gray-50/50">
                        <div className="flex justify-between font-bold">
                            <span>Bill No: {completedBill.bill_no}</span>
                            <span>{completedBill.date}</span>
                        </div>
                        <div className="pt-0.5 border-t border-gray-200">
                            <strong>Farmer: </strong>
                            <span>{completedBill.farmer_name}</span>
                        </div>
                        {completedBill.truck_no && (
                            <div>
                                <strong>Truck No: </strong>
                                <span>{completedBill.truck_no}</span>
                            </div>
                        )}
                        <div>
                            <strong>Total Bags: </strong>
                            <span>{completedBill.total_nag || (completedBill.items || []).reduce((acc, it) => acc + (it.nag || 0), 0)} bori</span>
                        </div>
                    </div>

                    {/* Items table in thermal print */}
                    {(completedBill.items || []).length > 0 && (
                        <table className="w-full text-xs my-2 border-collapse">
                            <thead>
                                <tr className="border-b border-t border-gray-400 text-gray-700 text-[10px] uppercase font-bold">
                                    <th className="py-1 text-start">Item</th>
                                    <th className="py-1 text-center">Bags</th>
                                    <th className="py-1 text-end">Rate</th>
                                    <th className="py-1 text-end">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 text-[11px]">
                                {(completedBill.items || []).map((it, idx) => (
                                    <tr key={idx}>
                                        <td className="py-1 font-semibold">{it.name}</td>
                                        <td className="py-1 text-center font-bold">{it.nag}</td>
                                        <td className="py-1 text-end">Rs. {Number(it.rate).toLocaleString()}</td>
                                        <td className="py-1 text-end font-bold">Rs. {Number(it.gross).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    <div className="border border-black rounded p-2 mb-3 text-xs space-y-1">
                        <div className="flex justify-between">
                            <span>Gross Sale:</span>
                            <span className="font-bold">Rs. {Number(completedBill.total_gross || completedBill.gross_amount).toLocaleString()}</span>
                        </div>
                        {(completedBill.commission_amount || 0) > 0 && (
                            <div className="flex justify-between text-gray-700">
                                <span>Commission ({completedBill.commission_pct}%):</span>
                                <span>- Rs. {Number(completedBill.commission_amount).toLocaleString()}</span>
                            </div>
                        )}
                        {(completedBill.mazdoori_amount || 0) > 0 && (
                            <div className="flex justify-between text-gray-700">
                                <span>Mazdoori:</span>
                                <span>- Rs. {Number(completedBill.mazdoori_amount).toLocaleString()}</span>
                            </div>
                        )}
                        {(completedBill.kiraya || 0) > 0 && (
                            <div className="flex justify-between text-gray-700">
                                <span>Kiraya:</span>
                                <span>- Rs. {Number(completedBill.kiraya).toLocaleString()}</span>
                            </div>
                        )}
                        {(completedBill.market_fee_amount || 0) > 0 && (
                            <div className="flex justify-between text-gray-700">
                                <span>Market fee:</span>
                                <span>- Rs. {Number(completedBill.market_fee_amount).toLocaleString()}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center pt-1.5 border-t border-black font-bold text-sm">
                            <span>Farmer Net Payable:</span>
                            <span className="font-black">Rs. {Number(completedBill.net_amount).toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="text-center text-[9px] text-gray-500 pt-2 border-t border-gray-300">
                        Printed on: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
