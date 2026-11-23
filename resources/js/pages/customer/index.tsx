import React, { useState, useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import MandiPageHeader from '@/components/app/mandi-page-header';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface CustomerItem {
    id: number;
    code: number | string;
    name: string;
    description?: string;
    phone: string;
    city: string;
    customer_type: string;
    credit_limit: number;
    current_balance: number;
    opening_balance: number;
    notes?: string;
    status: string;
}

interface KhataEntry {
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
}

interface KhataData {
    merchant: {
        id: number;
        name: string;
        phone: string;
        city: string;
        customer_type: string;
        credit_limit: number;
        current_balance: number;
    };
    entries: KhataEntry[];
}

interface Props {
    customers: CustomerItem[];
    filters: {
        search?: string;
        only_baqaya?: boolean;
    };
}

const CUSTOMER_TYPE_OPTIONS = [
    { value: 'Dukandar', label: 'Dukandar (Shopkeeper)' },
    { value: 'Wholesaler', label: 'Wholesaler' },
    { value: 'Hotel', label: 'Hotel / Restaurant' },
    { value: 'Mashakhor', label: 'Mashakhor (Mandi Buyer)' },
    { value: 'Superstore', label: 'Superstore / Mart' },
    { value: 'Catering', label: 'Catering / Shaadi Hall' },
    { value: 'Aam_gahak', label: 'Aam Gahak (Walk-in)' },
];

export default function CustomerIndex({ customers = [], filters }: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    // Search and filter state
    const [searchQuery, setSearchQuery] = useState(filters?.search || '');
    const [onlyBaqaya, setOnlyBaqaya] = useState(Boolean(filters?.only_baqaya));

    // Modals state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null);

    // Form inputs for Create / Edit
    const [formName, setFormName] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formCity, setFormCity] = useState('');
    const [formType, setFormType] = useState(''); // Default unselected
    const [formCreditLimit, setFormCreditLimit] = useState('0'); // Default 0
    const [formOpeningBalance, setFormOpeningBalance] = useState('0');
    const [formNotes, setFormNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Khata Modal state
    const [khataCustomer, setKhataCustomer] = useState<CustomerItem | null>(null);
    const [khataLoading, setKhataLoading] = useState(false);
    const [khataData, setKhataData] = useState<KhataData | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'روزانہ کام' : 'Daily Kaam', href: '#' },
        { title: isUrdu ? 'گاہک' : 'Gahak (Customers)', href: '/customers' },
    ];

    // Filtered customers list
    const filteredCustomers = useMemo(() => {
        let list = customers;

        if (onlyBaqaya) {
            list = list.filter(c => Number(c.current_balance) > 0);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(c => {
                const name = (c.name || '').toLowerCase();
                const phone = (c.phone || '').toLowerCase();
                const city = (c.city || '').toLowerCase();
                const qism = (c.customer_type || '').toLowerCase();
                return name.includes(q) || phone.includes(q) || city.includes(q) || qism.includes(q);
            });
        }

        return list;
    }, [customers, searchQuery, onlyBaqaya]);

    function openCreateModal() {
        setFormName('');
        setFormPhone('');
        setFormCity('');
        setFormType(''); // Unselected by default
        setFormCreditLimit('0'); // 0 by default
        setFormOpeningBalance('0');
        setFormNotes('');
        setIsCreateOpen(true);
    }

    function openEditModal(c: CustomerItem) {
        setEditingCustomer(c);
        setFormName(c.name || '');
        setFormPhone(c.phone === '—' ? '' : c.phone);
        setFormCity(c.city === '—' ? '' : c.city);
        setFormType(c.customer_type || '');
        setFormCreditLimit(String(c.credit_limit || 0));
        setFormOpeningBalance(String(c.opening_balance || 0));
        setFormNotes(c.notes || '');
    }

    function closeFormModal() {
        setIsCreateOpen(false);
        setEditingCustomer(null);
    }

    function handleSaveCustomer(e: React.FormEvent) {
        e.preventDefault();

        if (!formName.trim()) {
            toast.error(isUrdu ? 'براہ کرم گاہک یا دکان کا نام درج کریں۔' : 'Baraye meherbani gahak / dukan ka naam darj karein.');
            return;
        }

        setSubmitting(true);

        const payload = {
            name: formName.trim(),
            phone: formPhone.trim() || null,
            city: formCity.trim() || null,
            customer_type: formType || null,
            credit_limit: parseFloat(formCreditLimit) || 0,
            opening_balance: parseFloat(formOpeningBalance) || 0,
            notes: formNotes.trim() || null,
        };

        if (editingCustomer) {
            router.put(`/customers/${editingCustomer.id}`, payload, {
                preserveScroll: true,
                onSuccess: () => {
                    setSubmitting(false);
                    closeFormModal();
                    toast.success(isUrdu ? 'گاہک کی معلومات کامیابی سے محفوظ ہو گئیں۔' : 'Gahak ki maloomat mehfooz ho gayi.');
                },
                onError: () => {
                    setSubmitting(false);
                    toast.error(isUrdu ? 'محفوظ کرنے میں خرابی پیش آئی۔' : 'Save karne mein masla pesh aaya.');
                },
            });
        } else {
            router.post('/customers', payload, {
                preserveScroll: true,
                onSuccess: () => {
                    setSubmitting(false);
                    closeFormModal();
                    toast.success(isUrdu ? 'نیا گاہک کامیابی سے شامل ہو گیا۔' : 'Naya gahak kamyabi se shamil ho gaya.');
                },
                onError: () => {
                    setSubmitting(false);
                    toast.error(isUrdu ? 'محفوظ کرنے میں خرابی پیش آئی۔' : 'Save karne mein masla pesh aaya.');
                },
            });
        }
    }

    // Open Khata Modal
    function openKhataModal(c: CustomerItem) {
        setKhataCustomer(c);
        setKhataLoading(true);
        setKhataData(null);

        fetch(`/customers/${c.id}/khata`)
            .then(res => res.json())
            .then(data => {
                setKhataData(data);
                setKhataLoading(false);
            })
            .catch(() => {
                setKhataLoading(false);
                toast.error(isUrdu ? 'کھاتہ لوڈ کرنے میں مسئلہ پیش آیا۔' : 'Khata load karne mein masla pesh aaya.');
            });
    }

    function closeKhataModal() {
        setKhataCustomer(null);
        setKhataData(null);
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'گاہک مینجمنٹ - جے کے سی' : 'Customer Management - Vegetable POS'} />

            {/* Main Outer Container */}
            <div className={`-mt-4 -mx-4 -mb-4 pb-28 bg-[#eef2ee] min-h-full font-sans text-gray-900 ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>
                
                {/* Green Header Banner */}
                <MandiPageHeader
                    title={isUrdu ? 'کسٹمر مینجمنٹ' : 'Customer Management'}
                    subtitle={isUrdu ? 'گاہکوں کے رابطے، ادھار کی حدود (کریڈٹ لمیٹ)، اور کل بقایا' : 'Gahakon ke rabtay, udhaar ki hudood (credit limit), aur kul baqaya'}
                    isUrdu={isUrdu}
                >
                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="min-h-[40px] h-10 px-4 rounded-xl bg-white text-[#14532d] hover:bg-emerald-50 text-xs md:text-sm font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                        <Icon name="Plus" />
                        <span>{isUrdu ? 'نیا گاہک شامل کریں' : 'Naya Gahak Shamil Karein'}</span>
                    </button>
                </MandiPageHeader>

                {/* Main Content Area */}
                <div className="max-w-7xl mx-auto px-3 md:px-6 -mt-6 md:-mt-8 space-y-4">
                    
                    {/* Filter & Search Bar */}
                    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                        {/* Search Input with Search Button */}
                        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-lg">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder={isUrdu ? 'گاہک کا نام، فون یا علاقہ تلاش کریں...' : 'Gahak ka naam, phone ya ilaqa talash karein...'}
                                className="w-full h-10 px-3.5 rounded-xl border border-gray-200 text-xs md:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] transition-all bg-white"
                            />
                            <button
                                type="button"
                                className="h-10 px-5 rounded-xl bg-[#1e713e] hover:bg-[#165a31] text-white text-xs md:text-sm font-semibold transition-colors cursor-pointer shrink-0"
                            >
                                {isUrdu ? 'تلاش' : 'Search'}
                            </button>
                        </div>

                        {/* Filter Button: Sirf Baqaya Udhaar Wale Gahak */}
                        <button
                            type="button"
                            onClick={() => setOnlyBaqaya(!onlyBaqaya)}
                            className={`h-10 px-4 rounded-xl text-xs md:text-sm font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                onlyBaqaya
                                    ? 'bg-[#eef7f0] border-[#1e713e] text-[#14532d] shadow-2xs font-bold'
                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {isUrdu ? 'صرف بقایا ادھار والے گاہک' : 'Sirf Baqaya Udhaar Wale Gahak'}
                        </button>
                    </div>

                    {/* Customers Table Card */}
                    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-start text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[#f8faf8] border-b border-gray-200 text-gray-700 font-bold">
                                        <th className="py-3 px-3.5 text-start whitespace-nowrap">
                                            {isUrdu ? 'گاہک کا نام' : 'Gahak Ka Naam'}
                                        </th>
                                        <th className="py-3 px-3 text-start whitespace-nowrap">
                                            {isUrdu ? 'فون' : 'Phone'}
                                        </th>
                                        <th className="py-3 px-3 text-start whitespace-nowrap">
                                            {isUrdu ? 'علاقہ / شہر' : 'Ilaqa / City'}
                                        </th>
                                        <th className="py-3 px-3 text-start whitespace-nowrap">
                                            {isUrdu ? 'قسم' : 'Qism'}
                                        </th>
                                        <th className="py-3 px-3 text-end whitespace-nowrap">
                                            {isUrdu ? 'کریڈٹ لمیٹ' : 'Credit Limit'}
                                        </th>
                                        <th className="py-3 px-3 text-end whitespace-nowrap">
                                            {isUrdu ? 'بقایا ادھار (لینا)' : 'Baqaya Udhaar (Lena)'}
                                        </th>
                                        <th className="py-3 px-3.5 text-center whitespace-nowrap">
                                            {isUrdu ? 'ایکشنز' : 'Actions'}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {filteredCustomers.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                                                {isUrdu ? 'کوئی گاہک نہیں ملا' : 'Koi gahak nahi mila'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredCustomers.map(c => {
                                            const hasBaqaya = Number(c.current_balance) > 0;
                                            return (
                                                <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                                                    {/* 1. Gahak Ka Naam (with small subtitle description) */}
                                                    <td className="py-3 px-3.5 text-start">
                                                        <div className="font-bold text-gray-900 text-xs md:text-sm">
                                                            {c.name}
                                                        </div>
                                                        {c.description && (
                                                            <div className="text-[11px] text-gray-400 mt-0.5">
                                                                {c.description}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* 2. Phone */}
                                                    <td className="py-3 px-3 text-gray-600 font-mono text-xs whitespace-nowrap">
                                                        {c.phone}
                                                    </td>

                                                    {/* 3. Ilaqa / City */}
                                                    <td className="py-3 px-3 text-gray-700 whitespace-nowrap">
                                                        {c.city}
                                                    </td>

                                                    {/* 4. Qism */}
                                                    <td className="py-3 px-3 whitespace-nowrap">
                                                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700">
                                                            {c.customer_type}
                                                        </span>
                                                    </td>

                                                    {/* 5. Credit Limit */}
                                                    <td className="py-3 px-3 text-end font-semibold text-gray-700 tabular-nums whitespace-nowrap">
                                                        Rs {Number(c.credit_limit || 0).toLocaleString()}
                                                    </td>

                                                    {/* 6. Baqaya Udhaar (Lena) (bold and red for positive baqaya) */}
                                                    <td className="py-3 px-3 text-end tabular-nums whitespace-nowrap">
                                                        <span className={`text-xs md:text-sm font-bold ${
                                                            hasBaqaya ? 'text-red-600 font-extrabold' : 'text-gray-900'
                                                        }`}>
                                                            Rs {Number(c.current_balance || 0).toLocaleString()}
                                                        </span>
                                                    </td>

                                                    {/* 7. Actions: Khata Dekhein & Edit */}
                                                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => openKhataModal(c)}
                                                                className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-[#eef7f0] hover:border-[#1e713e]/40 hover:text-[#14532d] text-gray-700 text-[11px] font-semibold transition-colors cursor-pointer"
                                                            >
                                                                {isUrdu ? 'کھاتہ دیکھیں' : 'Khata Dekhein'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openEditModal(c)}
                                                                className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-[11px] font-semibold transition-colors cursor-pointer"
                                                            >
                                                                {isUrdu ? 'ترمیم' : 'Edit'}
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

            {/* MODAL 1: NAYA GAHAK SHAMIL KAREIN / EDIT GAHAK */}
            {(isCreateOpen || editingCustomer) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
                    <div className={`bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>
                        {/* Modal Header */}
                        <div className="bg-[#1e713e] text-white px-5 py-3.5 flex items-center justify-between">
                            <h3 className="text-base font-bold">
                                {editingCustomer
                                    ? (isUrdu ? 'گاہک کی معلومات میں ترمیم' : 'Edit Gahak')
                                    : (isUrdu ? 'نیا گاہک شامل کریں' : 'Naya Gahak Shamil Karein')}
                            </h3>
                            <button
                                type="button"
                                onClick={closeFormModal}
                                className="text-white/80 hover:text-white transition-colors cursor-pointer text-lg leading-none"
                            >
                                <Icon name="X" />
                            </button>
                        </div>

                        {/* Modal Body Form */}
                        <form onSubmit={handleSaveCustomer} className="p-5 overflow-y-auto space-y-3.5">
                            {/* 1. Gahak / Dukan ka Naam * (required) */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    {isUrdu ? 'گاہک / دکان کا نام *' : 'Gahak / Dukan ka Naam *'}
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    placeholder={isUrdu ? 'مثلاً: حاجی بشیر سبزی اسٹور' : 'Maslan: Haji Bashir Sabzi Store'}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs md:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] transition-all bg-white"
                                />
                            </div>

                            {/* 2 & 3: Phone Number & Ilaqa / Mandi Area */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        {isUrdu ? 'فون نمبر' : 'Phone Number'}
                                    </label>
                                    <input
                                        type="text"
                                        value={formPhone}
                                        onChange={e => setFormPhone(e.target.value)}
                                        placeholder="0300-0000000"
                                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs md:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] transition-all bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        {isUrdu ? 'علاقہ / منڈی ایریا' : 'Ilaqa / Mandi Area'}
                                    </label>
                                    <input
                                        type="text"
                                        value={formCity}
                                        onChange={e => setFormCity(e.target.value)}
                                        placeholder={isUrdu ? 'پرانی منڈی، بائی پاس' : 'Purani Mandi, Bypass'}
                                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs md:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] transition-all bg-white"
                                    />
                                </div>
                            </div>

                            {/* 4 & 5: Qism (Customer Type) & Credit Limit (Rs) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        {isUrdu ? 'قسم (Customer Type)' : 'Qism (Customer Type)'}
                                    </label>
                                    <select
                                        value={formType}
                                        onChange={e => setFormType(e.target.value)}
                                        className="w-full h-10 px-2.5 rounded-xl border border-gray-200 text-xs md:text-sm font-medium bg-white text-gray-900 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] cursor-pointer"
                                    >
                                        <option value="">
                                            {isUrdu ? 'منتخب کریں...' : 'Select Customer Type...'}
                                        </option>
                                        {CUSTOMER_TYPE_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        {isUrdu ? 'کریڈٹ لمیٹ (Rs)' : 'Credit Limit (Rs)'}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={formCreditLimit}
                                        onChange={e => setFormCreditLimit(e.target.value)}
                                        placeholder="0"
                                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs md:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] transition-all bg-white"
                                    />
                                </div>
                            </div>

                            {/* 6. Purana / Sabqa Baqaya (Opening Balance Rs) */}
                            {!editingCustomer && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        {isUrdu ? 'پرانا / سابقہ بقایا (Opening Balance Rs)' : 'Purana / Sabqa Baqaya (Opening Balance Rs)'}
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formOpeningBalance}
                                        onChange={e => setFormOpeningBalance(e.target.value)}
                                        placeholder="0"
                                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs md:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] transition-all bg-white"
                                    />
                                </div>
                            )}

                            {/* 7. Wazaahat / Notes */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    {isUrdu ? 'وضاحت / نوٹس' : 'Wazaahat / Notes'}
                                </label>
                                <textarea
                                    rows={2}
                                    value={formNotes}
                                    onChange={e => setFormNotes(e.target.value)}
                                    placeholder={isUrdu ? 'گاہک کی کوئی خاص تفصیل...' : 'Gahak ki koi khas tafseel...'}
                                    className="w-full p-2.5 rounded-xl border border-gray-200 text-xs md:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1e713e] focus:ring-1 focus:ring-[#1e713e] transition-all bg-white resize-none"
                                />
                            </div>

                            {/* Modal Footer Buttons */}
                            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={closeFormModal}
                                    className="px-4 h-10 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs md:text-sm transition-colors cursor-pointer"
                                >
                                    {isUrdu ? 'منسوخ' : 'Mansookh'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 h-10 rounded-xl bg-[#1e713e] hover:bg-[#165a31] text-white font-bold text-xs md:text-sm transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {submitting
                                        ? (isUrdu ? 'محفوظ ہو رہا ہے...' : 'Saving...')
                                        : (isUrdu ? 'سیو کریں' : 'Save Karein')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: KHATA DEKHEIN */}
            {khataCustomer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
                    <div className={`bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>
                        {/* Header: Name, Phone, Area */}
                        <div className="bg-[#1e713e] text-white px-5 py-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-base md:text-lg font-bold">
                                    {khataCustomer.name}
                                </h3>
                                <p className="text-xs text-white/80 mt-0.5">
                                    {khataCustomer.phone} {khataCustomer.city !== '—' && `· ${khataCustomer.city}`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeKhataModal}
                                className="text-white/80 hover:text-white transition-colors cursor-pointer text-xl leading-none"
                            >
                                <Icon name="X" />
                            </button>
                        </div>

                        {/* Top Cards: Mojooda Baqaya Udhaar, Credit Limit, Qism */}
                        <div className="p-4 bg-[#f8faf8] border-b border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="bg-white p-3 rounded-xl border border-gray-200">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                    {isUrdu ? 'موجودہ بقایا ادھار' : 'MOJOODA BAQAYA UDHAAR'}
                                </span>
                                <span className="text-base font-extrabold text-red-600 mt-0.5 block tabular-nums">
                                    Rs {Number(khataCustomer.current_balance || 0).toLocaleString()}
                                </span>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-gray-200">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                    {isUrdu ? 'کریڈٹ لمیٹ' : 'CREDIT LIMIT'}
                                </span>
                                <span className="text-base font-bold text-gray-800 mt-0.5 block tabular-nums">
                                    Rs {Number(khataCustomer.credit_limit || 0).toLocaleString()}
                                </span>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-gray-200">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                    {isUrdu ? 'قسم' : 'QISM'}
                                </span>
                                <span className="text-sm font-bold text-gray-800 mt-0.5 block">
                                    {khataCustomer.customer_type}
                                </span>
                            </div>
                        </div>

                        {/* Table: Taza Tareen Khata Entries */}
                        <div className="p-4 overflow-y-auto space-y-2 flex-1">
                            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                {isUrdu ? 'تازہ ترین کھاتہ انٹریز' : 'Taza Tareen Khata Entries'}
                            </h4>

                            {khataLoading ? (
                                <div className="py-8 text-center text-gray-400 text-xs">
                                    {isUrdu ? 'لوڈ ہو رہا ہے...' : 'Loading entries...'}
                                </div>
                            ) : !khataData || khataData.entries.length === 0 ? (
                                <div className="py-8 text-center text-gray-400 text-xs">
                                    {isUrdu ? 'کوئی کھاتہ انٹری موجود نہیں' : 'Koi khata entry mojood nahi.'}
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-gray-200">
                                    <table className="w-full text-start text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-[#f8faf8] border-b border-gray-200 text-gray-700 font-bold">
                                                <th className="py-2 px-2.5 text-start whitespace-nowrap">
                                                    {isUrdu ? 'تاریخ' : 'Tareekh'}
                                                </th>
                                                <th className="py-2 px-2.5 text-start whitespace-nowrap">
                                                    {isUrdu ? 'تفصیل' : 'Tafseel'}
                                                </th>
                                                <th className="py-2 px-2.5 text-end whitespace-nowrap text-red-600">
                                                    {isUrdu ? 'بنام (Debit)' : 'Banam (Debit)'}
                                                </th>
                                                <th className="py-2 px-2.5 text-end whitespace-nowrap text-emerald-700">
                                                    {isUrdu ? 'جمع (Credit)' : 'Jama (Credit)'}
                                                </th>
                                                <th className="py-2 px-2.5 text-end whitespace-nowrap">
                                                    {isUrdu ? 'بقایا' : 'Baqaya'}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {khataData.entries.map((entry, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50/70">
                                                    <td className="py-2 px-2.5 text-gray-600 whitespace-nowrap">
                                                        {entry.date}
                                                    </td>
                                                    <td className="py-2 px-2.5 text-gray-900 font-medium">
                                                        {entry.description}
                                                    </td>
                                                    <td className="py-2 px-2.5 text-end font-semibold text-red-600 tabular-nums whitespace-nowrap">
                                                        {entry.debit > 0 ? `Rs ${entry.debit.toLocaleString()}` : '—'}
                                                    </td>
                                                    <td className="py-2 px-2.5 text-end font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                                                        {entry.credit > 0 ? `Rs ${entry.credit.toLocaleString()}` : '—'}
                                                    </td>
                                                    <td className="py-2 px-2.5 text-end font-bold text-gray-900 tabular-nums whitespace-nowrap">
                                                        Rs {entry.balance.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer: Band Karein */}
                        <div className="p-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
                            <button
                                type="button"
                                onClick={closeKhataModal}
                                className="px-5 h-9 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold text-xs md:text-sm transition-colors cursor-pointer"
                            >
                                {isUrdu ? 'بند کریں' : 'Band Karein'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
