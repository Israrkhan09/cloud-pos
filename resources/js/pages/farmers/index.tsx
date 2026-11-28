import React, { useState, useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import MandiPageHeader from '@/components/app/mandi-page-header';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface FarmerItem {
    id: number;
    code: string;
    raw_code: number;
    name: string;
    description?: string;
    phone: string;
    area: string;
    area_id?: number | null;
    opening_balance: number;
    current_balance: number;
    status: string;
}

interface AreaItem {
    id: number;
    name: string;
}

interface KhataEntry {
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
}

interface KhataData {
    farmer: {
        id: number;
        name: string;
        phone: string;
        area: string;
        current_balance: number;
    };
    entries: KhataEntry[];
}

interface Props {
    farmers: FarmerItem[];
    areas: AreaItem[];
    filters: {
        search?: string;
        only_baqaya?: boolean;
    };
}

export default function FarmersIndex({ farmers = [], areas = [], filters }: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    // Search and filter state
    const [searchQuery, setSearchQuery] = useState(filters?.search || '');
    const [onlyBaqaya, setOnlyBaqaya] = useState(Boolean(filters?.only_baqaya));

    // Modals state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingFarmer, setEditingFarmer] = useState<FarmerItem | null>(null);

    // Form inputs for Create / Edit
    const [formName, setFormName] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formArea, setFormArea] = useState('');
    const [formOpeningBalance, setFormOpeningBalance] = useState('0');
    const [formNotes, setFormNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Khata Modal state
    const [khataFarmer, setKhataFarmer] = useState<FarmerItem | null>(null);
    const [khataLoading, setKhataLoading] = useState(false);
    const [khataData, setKhataData] = useState<KhataData | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'روزانہ کام' : 'Daily Operations', href: '#' },
        { title: isUrdu ? 'کسان' : 'Farmers', href: '/farmers' },
    ];

    // Filtered farmers list
    const filteredFarmers = useMemo(() => {
        let list = farmers;

        if (onlyBaqaya) {
            list = list.filter((f) => Number(f.current_balance) > 0);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(
                (f) =>
                    (f.name && f.name.toLowerCase().includes(q)) ||
                    (f.phone && f.phone.includes(q)) ||
                    (f.area && f.area.toLowerCase().includes(q)) ||
                    (f.code && f.code.toLowerCase().includes(q))
            );
        }

        return list;
    }, [farmers, onlyBaqaya, searchQuery]);

    const formatRs = (val: number | string | null | undefined) => {
        const num = Number(val || 0);
        return 'Rs ' + num.toLocaleString('en-US', {
            minimumFractionDigits: num % 1 === 0 ? 0 : 1,
            maximumFractionDigits: 2,
        });
    };

    // Open Create Modal
    function openCreateModal() {
        setEditingFarmer(null);
        setFormName('');
        setFormPhone('');
        setFormArea('');
        setFormOpeningBalance('0');
        setFormNotes('');
        setIsCreateOpen(true);
    }

    // Open Edit Modal
    function openEditModal(f: FarmerItem) {
        setEditingFarmer(f);
        setFormName(f.name);
        setFormPhone(f.phone !== '—' ? f.phone : '');
        setFormArea(f.area !== '—' ? f.area : '');
        setFormOpeningBalance(String(f.opening_balance || 0));
        setFormNotes(f.description || '');
        setIsCreateOpen(true);
    }

    function closeFormModal() {
        setIsCreateOpen(false);
        setEditingFarmer(null);
    }

    // Save Farmer
    function handleSaveFarmer(e: React.FormEvent) {
        e.preventDefault();
        if (submitting) return;

        if (!formName.trim()) {
            toast.error('Please enter farmer name.');
            return;
        }

        setSubmitting(true);

        const payload = {
            name: formName.trim(),
            phone: formPhone.trim() || null,
            area: formArea.trim() || null,
            opening_balance: parseFloat(formOpeningBalance) || 0,
            notes: formNotes.trim() || null,
        };

        if (editingFarmer) {
            router.put(`/farmers/${editingFarmer.id}`, payload, {
                preserveScroll: true,
                onSuccess: () => {
                    setSubmitting(false);
                    closeFormModal();
                    toast.success('Farmer details saved successfully.');
                },
                onError: () => {
                    setSubmitting(false);
                    toast.error('Failed to save farmer details.');
                },
            });
        } else {
            router.post('/farmers', payload, {
                preserveScroll: true,
                onSuccess: () => {
                    setSubmitting(false);
                    closeFormModal();
                    toast.success('New farmer added successfully.');
                },
                onError: () => {
                    setSubmitting(false);
                    toast.error('Failed to save farmer details.');
                },
            });
        }
    }

    // Open Khata Modal
    function openKhataModal(f: FarmerItem) {
        setKhataFarmer(f);
        setKhataLoading(true);
        setKhataData(null);

        fetch(`/farmers/${f.id}/khata`)
            .then((res) => res.json())
            .then((data) => {
                setKhataData(data);
                setKhataLoading(false);
            })
            .catch(() => {
                setKhataLoading(false);
                toast.error('Failed to load ledger records.');
            });
    }

    function closeKhataModal() {
        setKhataFarmer(null);
        setKhataData(null);
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'کسان کھاتہ' : 'Farmers Management'} />

            <div className="-mt-4 -mx-4 -mb-4 pb-28 bg-[#eef2ee] min-h-full font-sans text-gray-900" dir={isUrdu ? 'rtl' : 'ltr'}>
                {/* 1. Header Banner */}
                <MandiPageHeader
                    title={isUrdu ? t('farmers_management.title') : 'Farmers Management'}
                    subtitle={isUrdu ? t('farmers_management.subtitle') : 'Farmer supplier directory, invoice payables, and account statements'}
                    isUrdu={isUrdu}
                >
                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="min-h-[40px] h-10 px-4 rounded-xl bg-white text-[#14532d] hover:bg-emerald-50 text-xs md:text-sm font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                        <Icon name="Plus" />
                        <span>{isUrdu ? t('farmers_management.new_farmer') : 'Add New Farmer'}</span>
                    </button>
                </MandiPageHeader>

                {/* 2. Main Content Area */}
                <div className="max-w-7xl mx-auto px-3 md:px-6 -mt-6 md:-mt-8 space-y-4">
                    {/* Search & Filter Bar */}
                    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                        {/* Search Input with Search Button */}
                        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-lg">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={isUrdu ? 'کسان کا نام، فون یا علاقہ تلاش کریں...' : 'Search farmer by name, phone or area...'}
                                className="w-full h-10 px-3.5 rounded-xl border border-gray-200 text-xs md:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] transition-all bg-white"
                            />
                            <button
                                type="button"
                                className="h-10 px-5 rounded-xl bg-[#1e713e] hover:bg-[#165a31] text-white text-xs md:text-sm font-semibold transition-colors cursor-pointer shrink-0"
                            >
                                {isUrdu ? 'تلاش کریں' : 'Search'}
                            </button>
                        </div>

                        {/* Filter Button: Sirf Baqaya Wale Kisan */}
                        <button
                            type="button"
                            onClick={() => setOnlyBaqaya(!onlyBaqaya)}
                            className={`h-10 px-4 rounded-xl text-xs md:text-sm font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                onlyBaqaya
                                    ? 'bg-[#eef7f0] border-[#1e713e] text-[#14532d] shadow-2xs font-bold'
                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {isUrdu ? 'صرف بقایا والے کسان' : 'Farmers with Due Balance Only'}
                        </button>
                    </div>

                    {/* Farmers Table Card */}
                    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-start text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[#f8faf8] border-b border-gray-200 text-gray-700 font-bold">
                                        <th className="py-3 px-3.5 text-start whitespace-nowrap">{isUrdu ? 'کسان کا نام' : 'Farmer Name'}</th>
                                        <th className="py-3 px-3 text-start whitespace-nowrap">{isUrdu ? 'فون' : 'Phone'}</th>
                                        <th className="py-3 px-3 text-start whitespace-nowrap">{isUrdu ? 'علاقہ' : 'Area'}</th>
                                        <th className="py-3 px-3 text-start whitespace-nowrap">{isUrdu ? 'کوڈ' : 'Code'}</th>
                                        <th className="py-3 px-3 text-end whitespace-nowrap">{isUrdu ? 'ابتدائی رقم (روپے)' : 'Opening (Rs.)'}</th>
                                        <th className="py-3 px-3 text-end whitespace-nowrap">{isUrdu ? 'بقایا (دینا ہے)' : 'Payable Balance'}</th>
                                        <th className="py-3 px-3 text-center whitespace-nowrap">{isUrdu ? 'حالت' : 'Status'}</th>
                                        <th className="py-3 px-3.5 text-center whitespace-nowrap">{isUrdu ? 'کارروائی' : 'Actions'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {filteredFarmers.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">
                                                {isUrdu ? 'کوئی کسان نہیں ملا۔' : 'No farmers found.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredFarmers.map((f) => {
                                            const hasBaqaya = Number(f.current_balance) > 0;
                                            return (
                                                <tr key={f.id} className="hover:bg-gray-50/70 transition-colors">
                                                    {/* 1. Kisan Ka Naam */}
                                                    <td className="py-3 px-3.5 text-start">
                                                        <div className="font-bold text-gray-900 text-xs md:text-sm">
                                                            {f.name}
                                                        </div>
                                                        {f.description && (
                                                            <div className="text-[11px] text-gray-400 mt-0.5">
                                                                {f.description}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* 2. Phone */}
                                                    <td className="py-3 px-3 text-gray-600 font-mono text-xs whitespace-nowrap">
                                                        {f.phone}
                                                    </td>

                                                    {/* 3. Ilaqa / Area */}
                                                    <td className="py-3 px-3 text-gray-700 whitespace-nowrap">
                                                        {f.area}
                                                    </td>

                                                    {/* 4. Code */}
                                                    <td className="py-3 px-3 text-gray-700 font-mono font-bold whitespace-nowrap">
                                                        {f.code}
                                                    </td>

                                                    {/* 5. Opening */}
                                                    <td className="py-3 px-3 text-end text-gray-600 font-medium whitespace-nowrap">
                                                        {formatRs(f.opening_balance)}
                                                    </td>

                                                    {/* 6. Baqaya (Dena Hai) */}
                                                    <td className="py-3 px-3 text-end font-bold whitespace-nowrap">
                                                        <span
                                                            className={
                                                                hasBaqaya
                                                                    ? 'text-red-700 font-black'
                                                                    : 'text-emerald-800'
                                                            }
                                                        >
                                                            {formatRs(f.current_balance)}
                                                        </span>
                                                    </td>

                                                    {/* 7. Status */}
                                                    <td className="py-3 px-3 text-center whitespace-nowrap">
                                                        <span
                                                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                                f.status === 'active'
                                                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                                                            }`}
                                                        >
                                                            {isUrdu ? (f.status === 'active' ? 'فعال' : 'غیر فعال') : f.status}
                                                        </span>
                                                    </td>

                                                    {/* 8. Actions */}
                                                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => openKhataModal(f)}
                                                                className="h-8 px-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                                                            >
                                                                <Icon name="BookOpen" className="size-3.5" />
                                                                <span>{isUrdu ? 'کھاتہ دیکھیں' : 'View Ledger'}</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => openEditModal(f)}
                                                                className="h-8 px-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                                                            >
                                                                <Icon name="PencilSimple" className="size-3.5" />
                                                                <span>{isUrdu ? 'تبدیل کریں' : 'Edit'}</span>
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

            {/* Modal 1: Naya Kisan Form */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full border border-gray-200 shadow-xl overflow-hidden" dir={isUrdu ? 'rtl' : 'ltr'}>
                        <div className="bg-[#14532d] px-5 py-4 text-white flex justify-between items-center">
                            <h3 className="font-bold text-base">
                                {isUrdu 
                                    ? (editingFarmer ? 'کسان کی معلومات تبدیل کریں' : 'نیا کسان شامل کریں')
                                    : (editingFarmer ? 'Edit Farmer Details' : 'Add New Farmer')}
                            </h3>
                            <button
                                type="button"
                                onClick={closeFormModal}
                                disabled={submitting}
                                className="text-white/80 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                            >
                                <Icon name="X" className="size-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveFarmer} className="p-5 space-y-3.5 text-xs">
                            {/* 1. Kisan ka Naam * */}
                            <div>
                                <label className="block font-bold text-gray-700 mb-1">
                                    {isUrdu ? 'کسان کا نام' : 'Farmer Name'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder={isUrdu ? 'مثلاً: حاجی بشیر کسان' : 'e.g. Haji Bashir Farmer'}
                                    required
                                    className="w-full h-9 px-3 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-[#1e713e]"
                                />
                            </div>

                            {/* 2. Phone Number */}
                            <div>
                                <label className="block font-bold text-gray-700 mb-1">{isUrdu ? 'فون نمبر' : 'Phone Number'}</label>
                                <input
                                    type="text"
                                    value={formPhone}
                                    onChange={(e) => setFormPhone(e.target.value)}
                                    placeholder="0300-1234567"
                                    className="w-full h-9 px-3 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-[#1e713e]"
                                />
                            </div>

                            {/* 3. Ilaqa / Area */}
                            <div>
                                <label className="block font-bold text-gray-700 mb-1">{isUrdu ? 'علاقہ' : 'Area'}</label>
                                <input
                                    type="text"
                                    value={formArea}
                                    onChange={(e) => setFormArea(e.target.value)}
                                    placeholder={isUrdu ? 'مثلاً: اوکاڑہ، دیپالپور، منڈی بہاؤالدین' : 'e.g. Okara, Depalpur, Mandi Bahauddin'}
                                    className="w-full h-9 px-3 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-[#1e713e]"
                                />
                            </div>

                            {/* 4. Opening Balance (Rs.) */}
                            {!editingFarmer && (
                                <div>
                                    <label className="block font-bold text-gray-700 mb-1">
                                        {isUrdu ? 'ابتدائی رقم (روپے)' : 'Opening Balance (Rs.)'}
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={formOpeningBalance}
                                        onChange={(e) => setFormOpeningBalance(e.target.value)}
                                        placeholder="0"
                                        className="w-full h-9 px-3 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-[#1e713e]"
                                    />
                                </div>
                            )}

                            {/* 5. Wazaahat / Notes */}
                            <div>
                                <label className="block font-bold text-gray-700 mb-1">{isUrdu ? 'وضاحت / نوٹس' : 'Notes / Remarks'}</label>
                                <textarea
                                    value={formNotes}
                                    onChange={(e) => setFormNotes(e.target.value)}
                                    placeholder={isUrdu ? 'کسان کے متعلق کوئی خاص تفصیل...' : 'Any specific notes or details about the farmer...'}
                                    rows={2}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-[#1e713e]"
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={closeFormModal}
                                    disabled={submitting}
                                    className="h-9 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs transition cursor-pointer"
                                >
                                    {isUrdu ? 'منسوخ' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="h-9 px-5 rounded-lg bg-[#14532d] hover:bg-[#0f3d21] text-white font-bold text-xs transition shadow-xs cursor-pointer disabled:opacity-50"
                                >
                                    {submitting ? (isUrdu ? 'محفوظ ہو رہا ہے...' : 'Save ho raha hai...') : (isUrdu ? 'محفوظ کریں' : 'Save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 2: Khata Dekhein */}
            {khataFarmer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full border border-gray-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]" dir={isUrdu ? 'rtl' : 'ltr'}>
                        {/* Header */}
                        <div className="bg-[#14532d] px-5 py-4 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-bold text-base">{khataFarmer.name}</h3>
                                <p className="text-[11px] text-emerald-100 mt-0.5">
                                    {isUrdu ? 'فون:' : 'Phone:'} {khataFarmer.phone} | {isUrdu ? 'علاقہ:' : 'Ilaqa:'} {khataFarmer.area}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeKhataModal}
                                className="text-white/80 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                            >
                                <Icon name="X" className="size-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 overflow-y-auto space-y-4">
                            {/* Mojooda Baqaya Card */}
                            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex justify-between items-center">
                                <div>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase block">
                                        {isUrdu ? 'موجودہ بقایا (دینا ہے)' : 'Current Balance (Payable)'}
                                    </span>
                                    <span className="text-xl font-bold text-red-700 mt-0.5 block">
                                        {formatRs(khataData?.farmer?.current_balance ?? khataFarmer.current_balance)}
                                    </span>
                                </div>
                                <span className="text-[11px] text-gray-500">
                                    {isUrdu ? 'منڈی کی طرف سے کسان کو دینا ہے' : 'Market payable to farmer'}
                                </span>
                            </div>

                            {/* Entries Table */}
                            {khataLoading ? (
                                <div className="py-8 text-center text-gray-400 text-xs">
                                    {isUrdu ? 'کھاتہ لوڈ ہو رہا ہے...' : 'Loading ledger...'}
                                </div>
                            ) : !khataData || khataData.entries.length === 0 ? (
                                <div className="py-8 text-center text-gray-400 text-xs">
                                    {isUrdu ? 'اس کسان کے کھاتے میں کوئی اندراج موجود نہیں ہے۔' : 'No entries found in this farmer account.'}
                                </div>
                            ) : (
                                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                    <table className="w-full text-start text-xs border-collapse">
                                        <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                                            <tr>
                                                <th className="py-2 px-3 text-start">{isUrdu ? 'تاریخ' : 'Date'}</th>
                                                <th className="py-2 px-3 text-start">{isUrdu ? 'تفصیل' : 'Description'}</th>
                                                <th className="py-2 px-3 text-end text-red-700">{isUrdu ? 'بنام (ڈیبٹ)' : 'Debit'}</th>
                                                <th className="py-2 px-3 text-end text-emerald-800">{isUrdu ? 'جمع (کریڈٹ)' : 'Credit'}</th>
                                                <th className="py-2 px-3 text-end">{isUrdu ? 'بقایا' : 'Balance'}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {khataData.entries.map((entry, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="py-2 px-3 font-mono text-gray-600 whitespace-nowrap">
                                                        {entry.date}
                                                    </td>
                                                    <td className="py-2 px-3 font-medium text-gray-900">
                                                        {entry.description}
                                                    </td>
                                                    <td className="py-2 px-3 text-end text-red-700 font-bold whitespace-nowrap">
                                                        {entry.debit > 0 ? formatRs(entry.debit) : '—'}
                                                    </td>
                                                    <td className="py-2 px-3 text-end text-emerald-800 font-bold whitespace-nowrap">
                                                        {entry.credit > 0 ? formatRs(entry.credit) : '—'}
                                                    </td>
                                                    <td className="py-2 px-3 text-end font-bold whitespace-nowrap">
                                                        {formatRs(entry.balance)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 flex justify-end shrink-0">
                            <button
                                type="button"
                                onClick={closeKhataModal}
                                className="h-9 px-5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition cursor-pointer"
                            >
                                {isUrdu ? 'بند کریں' : 'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
