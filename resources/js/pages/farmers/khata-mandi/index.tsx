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
    name: string;
    phone: string;
    area: string;
    balance: number;
    opening_balance: number;
}

interface KisanEntry {
    id: number;
    entry_no: string;
    kisan_id: number;
    kisan_name: string;
    kisan_phone: string;
    kisan_area: string;
    entry_date: string;
    item_name: string;
    nag_quantity: number;
    gross_sale: number;
    commission_percent: number;
    commission_amount: number;
    net_payable: number;
    paid_amount: number;
    remaining_balance: number;
    truck_no: string;
    rate: number;
    kiraya: number;
    mazdoori: number;
    market_fee: number;
    status: string;
}

interface KisanSummary {
    total_balance_due: number;
    total_nags: number;
    total_entries: number;
    total_commission: number;
    total_paid: number;
    total_gross: number;
    total_net: number;
}

interface AccountItem {
    id: number;
    account_name: string;
}

interface Props {
    farmers: FarmerItem[];
    entries: KisanEntry[];
    kisanSummary: KisanSummary;
    selectedFarmerId: string | number;
    selectedFarmer: FarmerItem | null;
    accounts: AccountItem[];
}

export default function FarmerKhataPage({
    farmers = [],
    entries = [],
    kisanSummary,
    selectedFarmerId = 'all',
    selectedFarmer,
    accounts = [],
}: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [farmerSearch, setFarmerSearch] = useState('');
    const [farmerPayableOnly, setFarmerPayableOnly] = useState(false);

    // Modals
    const [isParchiOpen, setIsParchiOpen] = useState(false);
    const [parchiData, setParchiData] = useState<any>(null);
    const [parchiLoading, setParchiLoading] = useState(false);

    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<KisanEntry | null>(null);
    const [payAmount, setPayAmount] = useState('');
    const [payAccount, setPayAccount] = useState('Cash Counter');
    const [submittingPayment, setSubmittingPayment] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Ledgers', href: '#' },
        { title: 'Farmer Ledger', href: '/farmer-khata' },
    ];

    const formatRs = (val: number | string | null | undefined) => {
        const num = Number(val || 0);
        return 'Rs ' + num.toLocaleString('en-US', {
            minimumFractionDigits: num % 1 === 0 ? 0 : 1,
            maximumFractionDigits: 2,
        });
    };

    // Filtered farmers list for left panel
    const filteredFarmers = useMemo(() => {
        return farmers.filter((f) => {
            const q = farmerSearch.toLowerCase().trim();
            const matchesSearch =
                !q ||
                (f.name && f.name.toLowerCase().includes(q)) ||
                (f.phone && f.phone.includes(q)) ||
                (f.area && f.area.toLowerCase().includes(q)) ||
                String(f.code).includes(q);

            const matchesPayable = farmerPayableOnly ? f.balance > 0 : true;
            return matchesSearch && matchesPayable;
        });
    }, [farmers, farmerSearch, farmerPayableOnly]);

    // Entries for current selection
    const currentEntries = useMemo(() => {
        if (selectedFarmerId === 'all') return entries;
        return entries.filter((e) => String(e.kisan_id) === String(selectedFarmerId));
    }, [entries, selectedFarmerId]);

    // Totals for table footer
    const totalGross = useMemo(() => currentEntries.reduce((s, e) => s + Number(e.gross_sale || 0), 0), [currentEntries]);
    const totalComm = useMemo(() => currentEntries.reduce((s, e) => s + Number(e.commission_amount || 0), 0), [currentEntries]);
    const totalNet = useMemo(() => currentEntries.reduce((s, e) => s + Number(e.net_payable || 0), 0), [currentEntries]);
    const totalRemaining = useMemo(() => currentEntries.reduce((s, e) => s + Number(e.remaining_balance || 0), 0), [currentEntries]);

    // Selection handler
    const handleSelectFarmer = (id: string | number) => {
        router.get(
            '/farmer-khata',
            { farmer_id: id },
            { preserveState: true, replace: true, preserveScroll: true }
        );
    };

    // Open Parchi Modal
    const handleOpenParchi = (entryId: number) => {
        setParchiLoading(true);
        setIsParchiOpen(true);
        fetch(`/farmer-khata/${entryId}/parchi`)
            .then((res) => res.json())
            .then((data) => {
                setParchiLoading(false);
                if (data.success) {
                    setParchiData(data.entry);
                }
            })
            .catch(() => {
                setParchiLoading(false);
                toast.error('Failed to load voucher details.');
            });
    };

    // Open Pay Modal
    const handleOpenPay = (entry: KisanEntry) => {
        setSelectedEntry(entry);
        setPayAmount(String(entry.remaining_balance));
        setIsPayModalOpen(true);
    };

    // Submit Pay Form
    const handlePaySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (submittingPayment || !selectedEntry) return;

        const amt = parseFloat(payAmount);
        if (!amt || amt <= 0) {
            toast.error('Durust adaigi raqam darj karein.');
            return;
        }

        setSubmittingPayment(true);
        router.post(
            '/farmer-khata/pay',
            {
                bill_id: selectedEntry.id,
                amount: amt,
                account: payAccount,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSubmittingPayment(false);
                    setIsPayModalOpen(false);
                    setSelectedEntry(null);
                    setPayAmount('');
                    toast.success('Farmer payment recorded successfully.');
                },
                onError: () => {
                    setSubmittingPayment(false);
                    toast.error('Adaigi save karne mein masla pesh aaya.');
                },
            }
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Farmer Ledger" />

            <style
                dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        @page {
                            size: A4 portrait;
                            margin: 12mm;
                        }
                        body {
                            background: white !important;
                            color: black !important;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        .print\\:hidden, header, nav, aside, .sidebar-wrapper {
                            display: none !important;
                        }
                        thead {
                            display: table-header-group;
                        }
                        tr {
                            page-break-inside: avoid;
                        }
                    }
                `,
                }}
            />

            {/* Screen UI */}
            <div className={`-mt-4 -mx-4 -mb-4 pb-28 bg-[#eef2ee] min-h-full font-sans text-gray-900 print:hidden ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>
                {/* 1. Top Header Banner */}
                <MandiPageHeader
                    title={isUrdu ? t('farmer_khata.title') : 'Farmer Ledger'}
                    subtitle={isUrdu ? t('farmer_khata.subtitle') : 'Farmer consignment arrivals, billing invoices, and settlement history'}
                    isUrdu={isUrdu}
                >
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="h-8.5 px-3.5 rounded-xl text-xs font-semibold bg-white text-emerald-900 hover:bg-emerald-50 shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                        <Icon name="Printer" className="size-4 text-emerald-800" />
                        <span>{isUrdu ? t('farmer_khata.print_khata') : 'Print Statement'}</span>
                    </button>
                </MandiPageHeader>

                {/* 2. Main Content Area */}
                <div className="max-w-7xl mx-auto px-3 md:px-6 -mt-6 md:-mt-8 space-y-4">
                    {/* 4 Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        {/* Card 1: Kisan ka Kul Dena (Payable) */}
                        <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                                {isUrdu ? 'کسان کا کل دینا (Payable):' : 'Total Farmer Payable:'}
                            </span>
                            <div className="text-xl font-bold text-red-700 mt-1">
                                {formatRs(kisanSummary?.total_balance_due || 0)}
                            </div>
                            <span className="text-[10px] text-gray-500 mt-0.5 block">
                                {isUrdu ? 'منڈی نے کسان کو ادا کرنا ہے' : 'Mandi ne kisan ko ada karna hai'}
                            </span>
                        </div>

                        {/* Card 2: Kul Mandi Aamad Nag */}
                        <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                                {isUrdu ? 'کل منڈی آمد نگ:' : 'Total Consignment Units:'}
                            </span>
                            <div className="text-xl font-bold text-gray-900 mt-1">
                                {kisanSummary?.total_nags || 0} {isUrdu ? 'نگ / بوریاں' : 'Nag / Borian'}
                            </div>
                            <span className="text-[10px] text-gray-500 mt-0.5 block">
                                {kisanSummary?.total_entries || 0} {isUrdu ? 'آمد لاٹس' : 'Arrival Lots'}
                            </span>
                        </div>

                        {/* Card 3: Mandi Commission */}
                        <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                                {isUrdu ? 'منڈی کمیشن (آمدنی):' : 'Mandi Commission (Aamdani):'}
                            </span>
                            <div className="text-xl font-bold text-emerald-800 mt-1">
                                {formatRs(kisanSummary?.total_commission || 0)}
                            </div>
                            <span className="text-[10px] text-gray-500 mt-0.5 block">{isUrdu ? 'آڑھت منافع' : 'Arht munafa'}</span>
                        </div>

                        {/* Card 4: Kisan ko Ada Shuda */}
                        <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                                {isUrdu ? 'کسان کو ادا شدہ (Paid):' : 'Total Paid to Farmers:'}
                            </span>
                            <div className="text-xl font-bold text-gray-900 mt-1">
                                {formatRs(kisanSummary?.total_paid || 0)}
                            </div>
                            <span className="text-[10px] text-gray-500 mt-0.5 block">{isUrdu ? 'کیش / بینک ادائیگی' : 'Cash / Bank adaigi'}</span>
                        </div>
                    </div>

                    {/* 2-Panel Layout: Left = Kisan Selector, Right = Hisaab Ledger */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* Left Panel: Farmers Selector (4 cols) */}
                        <div className="lg:col-span-4 bg-white border border-emerald-200 rounded-xl p-3.5 space-y-3 shadow-2xs">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                <span className="font-bold text-xs text-gray-900">{isUrdu ? 'کسان منتخب کریں' : 'Select Farmer'}</span>
                                <span className="text-[11px] text-gray-500 font-medium">
                                    {isUrdu ? `${filteredFarmers.length} کسان` : `${filteredFarmers.length} Farmers`}
                                </span>
                            </div>

                            {/* Search & Payable Filter */}
                            <div className="space-y-2">
                                <div className="relative">
                                    <Icon
                                        name="MagnifyingGlass"
                                        className={`w-3.5 h-3.5 text-gray-400 absolute ${isUrdu ? 'right-2.5' : 'left-2.5'} top-2.5`}
                                    />
                                    <input
                                        type="text"
                                        value={farmerSearch}
                                        onChange={(e) => setFarmerSearch(e.target.value)}
                                        placeholder={isUrdu ? 'کسان کا نام یا فون...' : 'Search farmer by name or phone...'}
                                        className={`w-full ${isUrdu ? 'pr-8 pl-2.5' : 'pl-8 pr-2.5'} py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition`}
                                    />
                                </div>

                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-gray-600 font-medium">{isUrdu ? 'صرف بقایا دینا والے:' : 'Payable Due Only:'}</span>
                                    <button
                                        type="button"
                                        onClick={() => setFarmerPayableOnly(!farmerPayableOnly)}
                                        className={`px-2.5 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                                            farmerPayableOnly
                                                ? 'bg-red-100 text-red-800'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {farmerPayableOnly ? (isUrdu ? 'ہاں' : 'Haan') : (isUrdu ? 'نہیں' : 'Nahi')}
                                    </button>
                                </div>
                            </div>

                            {/* Farmers List */}
                            <div className="max-h-[540px] overflow-y-auto space-y-1.5 pr-1">
                                {/* Option 1: Tamam Kisano Ka Kul Record */}
                                <button
                                    type="button"
                                    onClick={() => handleSelectFarmer('all')}
                                    className={`w-full p-2.5 rounded-lg border text-start transition flex items-center justify-between cursor-pointer ${
                                        selectedFarmerId === 'all'
                                            ? 'bg-emerald-50/70 border-emerald-600 ring-1 ring-emerald-600/30'
                                            : 'bg-white border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center space-x-1.5">
                                            <span className="font-bold text-xs text-gray-900">
                                                {isUrdu ? 'تمام کسان (کل ریکارڈ)' : 'All Farmers (Consolidated)'}
                                            </span>
                                            {selectedFarmerId === 'all' && (
                                                <Icon
                                                    name="Check"
                                                    className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0"
                                                    weight="bold"
                                                />
                                            )}
                                        </div>
                                        <span className="text-[10px] text-gray-500 block mt-0.5">
                                            {isUrdu ? `کل منڈی پرچیاں (${entries.length})` : `Kul Mandi Parchiyan (${entries.length})`}
                                        </span>
                                    </div>
                                    <div className="text-end flex-shrink-0">
                                        <span className="text-xs font-bold text-red-700 block">
                                            {formatRs(kisanSummary?.total_balance_due || 0)}
                                        </span>
                                        <span className="text-[9px] text-gray-400 font-medium">{isUrdu ? 'کل دینا' : 'Total Payable'}</span>
                                    </div>
                                </button>

                                {/* Individual Farmers */}
                                {filteredFarmers.map((f) => {
                                    const isSelected = String(f.id) === String(selectedFarmerId);
                                    const hasDue = f.balance > 0;

                                    return (
                                        <button
                                            key={f.id}
                                            type="button"
                                            onClick={() => handleSelectFarmer(f.id)}
                                            className={`w-full p-2.5 rounded-lg border text-start transition flex items-center justify-between cursor-pointer ${
                                                isSelected
                                                    ? 'bg-emerald-50/70 border-emerald-600 ring-1 ring-emerald-600/30'
                                                    : 'bg-white border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="truncate pr-2">
                                                <div className="flex items-center space-x-1.5">
                                                    <span className="font-bold text-xs text-gray-900 truncate block">
                                                        {f.name}
                                                    </span>
                                                    {isSelected && (
                                                        <Icon
                                                            name="Check"
                                                            className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0"
                                                            weight="bold"
                                                        />
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-gray-500 block truncate mt-0.5">
                                                    {f.phone || f.area || (isUrdu ? 'کسان' : 'Kisan')}
                                                </span>
                                            </div>

                                            <div className="text-end flex-shrink-0">
                                                <span
                                                    className={`text-xs font-bold block ${
                                                        hasDue ? 'text-red-700' : 'text-emerald-800'
                                                    }`}
                                                >
                                                    {formatRs(f.balance)}
                                                </span>
                                                <span className="text-[9px] text-gray-400 font-medium">
                                                    {hasDue ? (isUrdu ? 'دینا ہے' : 'Payable') : (isUrdu ? 'صاف' : 'Cleared')}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right Panel: Selected Farmer Hisaab & Parchiyan Table (8 cols) */}
                        <div className="lg:col-span-8 bg-white border border-emerald-200 rounded-xl p-4 space-y-3 shadow-2xs">
                            {/* Header Banner */}
                            <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <h3 className="font-bold text-base text-gray-900">
                                            {selectedFarmer
                                                ? selectedFarmer.name
                                                : (isUrdu ? 'تمام کسانوں کی منڈی پرچیاں' : 'All Farmer Consignment Bills')}
                                        </h3>
                                        <span className="bg-emerald-100 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded capitalize">
                                            {selectedFarmer ? (isUrdu ? 'رجسٹرڈ کسان' : 'Registered Farmer') : (isUrdu ? 'کل منڈی ریکارڈ' : 'Consolidated Market Record')}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-gray-600 mt-1 flex flex-wrap gap-3">
                                        {selectedFarmer?.phone && (
                                            <span className="flex items-center space-x-1">
                                                <Icon name="Phone" className="w-3 h-3 text-gray-500" />
                                                <span>{selectedFarmer.phone}</span>
                                            </span>
                                        )}
                                        {selectedFarmer?.area && (
                                            <span className="flex items-center space-x-1">
                                                <Icon name="MapPin" className="w-3 h-3 text-gray-500" />
                                                <span>{selectedFarmer.area}</span>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="text-start sm:text-end bg-white px-3 py-1.5 rounded-lg border border-emerald-200">
                                    <span className="text-[10px] uppercase font-bold text-gray-500 block">
                                        {selectedFarmer
                                            ? (isUrdu ? 'کسان کا بقایا دینا:' : 'Farmer Balance Payable:')
                                            : (isUrdu ? 'منڈی کا کل بقایا دینا:' : 'Total Market Payable:')}
                                    </span>
                                    <span className="text-base font-bold text-red-700 block">
                                        {formatRs(
                                            selectedFarmer
                                                ? selectedFarmer.balance
                                                : kisanSummary?.total_balance_due || 0
                                        )}
                                    </span>
                                </div>
                            </div>

                            {/* Action Ribbon: Title & Print */}
                            <div className="flex items-center justify-between pt-1 text-xs">
                                <span className="font-bold text-gray-900">
                                    {isUrdu ? `منڈی آمد و پرچی حساب (${currentEntries.length} پرچیاں):` : `Consignment Invoices & Ledger (${currentEntries.length} Invoices):`}
                                </span>

                                <div>
                                    <button
                                        type="button"
                                        onClick={() => window.print()}
                                        className="bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 text-xs cursor-pointer shadow-2xs"
                                    >
                                        <Icon name="Printer" className="w-3.5 h-3.5" />
                                        <span>{isUrdu ? 'پرنٹ کھاتہ' : 'Print Statement'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Statement Table */}
                            <div className="overflow-x-auto border border-emerald-200 rounded-lg">
                                <table className="w-full text-start text-xs">
                                    <thead className="bg-emerald-50 text-gray-900 border-b border-emerald-200 font-bold">
                                        <tr>
                                            <th className="py-2.5 px-3 text-start">{isUrdu ? 'پرچی #' : 'Parchi #'}</th>
                                            <th className="py-2.5 px-3 text-start">{isUrdu ? 'نام' : 'Name'}</th>
                                            <th className="py-2.5 px-3 text-start">{isUrdu ? 'تاریخ' : 'Date'}</th>
                                            <th className="py-2.5 px-3 text-start">{isUrdu ? 'سبزی جنس' : 'Sabzi Jins'}</th>
                                            <th className="py-2.5 px-3 text-end">{isUrdu ? 'نگ' : 'Nag'}</th>
                                            <th className="py-2.5 px-3 text-end">{isUrdu ? 'کل بکری (خام)' : 'Kul Bikri (Gross)'}</th>
                                            <th className="py-2.5 px-3 text-end">{isUrdu ? 'کمیشن' : 'Commission'}</th>
                                            <th className="py-2.5 px-3 text-end">{isUrdu ? 'صافی رقم (Net)' : 'Raqam (Net)'}</th>
                                            <th className="py-2.5 px-3 text-end">{isUrdu ? 'بقایا دینا' : 'Payable Balance'}</th>
                                            <th className="py-2.5 px-3 text-center">{isUrdu ? 'کارروائی' : 'Actions'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {currentEntries.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} className="py-8 text-center text-gray-400">
                                                    {isUrdu ? 'اس کسان کی کوئی آمد پرچی موجود نہیں ہے۔' : 'Is kisan ki koi aamad parchi mojood nahi hai.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            currentEntries.map((entry) => {
                                                const hasDue = entry.remaining_balance > 0;
                                                return (
                                                    <tr key={entry.id} className="hover:bg-gray-50/80 transition">
                                                        <td className="py-2.5 px-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                                                            {entry.entry_no}
                                                        </td>
                                                        <td className="py-2.5 px-3 font-bold text-gray-900 whitespace-nowrap">
                                                            {entry.kisan_name}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-gray-600 font-mono whitespace-nowrap">
                                                            {entry.entry_date}
                                                        </td>
                                                        <td className="py-2.5 px-3 font-medium text-gray-900">
                                                            {entry.item_name}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-end font-bold text-gray-900">
                                                            {entry.nag_quantity}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-end font-bold text-gray-900 whitespace-nowrap">
                                                            {formatRs(entry.gross_sale)}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-end font-bold text-emerald-800 whitespace-nowrap">
                                                            {formatRs(entry.commission_amount)} ({entry.commission_percent}%)
                                                        </td>
                                                        <td className="py-2.5 px-3 text-end font-bold text-gray-900 whitespace-nowrap">
                                                            {formatRs(entry.net_payable)}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-end font-bold whitespace-nowrap">
                                                            <span className={hasDue ? 'text-red-700' : 'text-emerald-800'}>
                                                                {formatRs(entry.remaining_balance)}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center space-x-1.5 whitespace-nowrap">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenParchi(entry.id)}
                                                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-1 rounded text-[11px] font-bold transition inline-flex items-center space-x-1 cursor-pointer"
                                                            >
                                                                <Icon name="Printer" className="w-3 h-3" />
                                                                <span>{isUrdu ? 'پرچی' : 'Parchi'}</span>
                                                            </button>

                                                            {hasDue && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenPay(entry)}
                                                                    className="bg-[#14532d] hover:bg-[#0f3d21] text-white px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer"
                                                                >
                                                                    {isUrdu ? 'ادائیگی کریں' : 'Ada Karein'}
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                    {currentEntries.length > 0 && (
                                        <tfoot className="bg-gray-50 font-bold border-t border-gray-200 text-xs">
                                            <tr>
                                                <td
                                                    colSpan={5}
                                                    className="py-2.5 px-3 text-end text-gray-900 font-bold"
                                                >
                                                    {isUrdu ? 'کل میزان:' : 'Total Summary:'}
                                                </td>
                                                <td className="py-2.5 px-3 text-end text-gray-900 font-bold whitespace-nowrap">
                                                    {formatRs(totalGross)}
                                                </td>
                                                <td className="py-2.5 px-3 text-end text-emerald-800 font-bold whitespace-nowrap">
                                                    {formatRs(totalComm)}
                                                </td>
                                                <td className="py-2.5 px-3 text-end text-gray-900 font-bold whitespace-nowrap">
                                                    {formatRs(totalNet)}
                                                </td>
                                                <td className="py-2.5 px-3 text-end text-red-700 font-bold whitespace-nowrap">
                                                    {formatRs(totalRemaining)}
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal: Parchi Preview */}
            {isParchiOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full border border-gray-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-[#14532d] px-5 py-3.5 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-sm">
                                    Farmer Invoice Voucher {parchiData?.entry_no ? `#${parchiData.entry_no}` : ''}
                                </h3>
                                <p className="text-[11px] text-emerald-100">Farmer Settlement Slip</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsParchiOpen(false)}
                                className="text-white/80 hover:text-white p-1 rounded-lg"
                            >
                                <Icon name="X" className="size-5" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-4 text-xs">
                            {parchiLoading ? (
                                <div className="py-12 text-center text-gray-400">Loading voucher...</div>
                            ) : parchiData ? (
                                <div id="parchi-print-area" className="border border-gray-300 rounded-xl p-4 bg-gray-50/50 space-y-3 font-sans">
                                    <div className="text-center border-b pb-2">
                                        <h4 className="font-black text-base uppercase">VEGETABLE POS</h4>
                                        <p className="text-[11px] font-bold text-gray-600">KISAN MANDI PARCHI</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <p><span className="font-bold">Voucher #:</span> {parchiData.entry_no}</p>
                                        <p className="text-right"><span className="font-bold">Date:</span> {parchiData.entry_date}</p>
                                        <p><span className="font-bold">Farmer:</span> {parchiData.kisan_name}</p>
                                        <p className="text-right"><span className="font-bold">Ilaqa:</span> {parchiData.kisan_area}</p>
                                    </div>

                                    <div className="border border-gray-300 rounded overflow-hidden">
                                        <table className="w-full text-xs">
                                            <thead className="bg-gray-100 font-bold border-b">
                                                <tr>
                                                    <th className="p-2 text-left">Sabzi Jins</th>
                                                    <th className="p-2 text-right">Nag</th>
                                                    <th className="p-2 text-right">Rate</th>
                                                    <th className="p-2 text-right">Kul Bikri</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td className="p-2">{parchiData.item_name}</td>
                                                    <td className="p-2 text-right">{parchiData.nag_quantity}</td>
                                                    <td className="p-2 text-right">{formatRs(parchiData.rate)}</td>
                                                    <td className="p-2 text-right font-bold">{formatRs(parchiData.gross_sale)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Deductions breakdown */}
                                    <div className="space-y-1.5 pt-2 border-t text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Kul Bikri (Gross):</span>
                                            <span className="font-bold">{formatRs(parchiData.gross_sale)}</span>
                                        </div>
                                        <div className="flex justify-between text-emerald-800">
                                            <span>Market Commission ({parchiData.commission_percent}%):</span>
                                            <span>- {formatRs(parchiData.commission_amount)}</span>
                                        </div>
                                        {parchiData.mazdoori > 0 && (
                                            <div className="flex justify-between text-gray-600">
                                                <span>Mazdoori:</span>
                                                <span>- {formatRs(parchiData.mazdoori)}</span>
                                            </div>
                                        )}
                                        {parchiData.kiraya_deduction > 0 && (
                                            <div className="flex justify-between text-gray-600">
                                                <span>Kiraya:</span>
                                                <span>- {formatRs(parchiData.kiraya_deduction)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between border-t pt-2 font-bold text-sm text-gray-900">
                                            <span>Saaf Raqam (Net Payable):</span>
                                            <span>{formatRs(parchiData.net_payable)}</span>
                                        </div>
                                        <div className="flex justify-between font-bold text-red-700">
                                            <span>Payable Due:</span>
                                            <span>{formatRs(parchiData.remaining_balance)}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsParchiOpen(false)}
                                className="h-9 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs"
                            >
                                Band Karein
                            </button>
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="h-9 px-4 rounded-lg bg-[#14532d] hover:bg-[#0f3d21] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                            >
                                <Icon name="Printer" className="size-4" />
                                <span>Print Voucher</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Ada Karein (Pay Farmer) */}
            {isPayModalOpen && selectedEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full border border-gray-200 shadow-xl overflow-hidden">
                        <div className="bg-[#14532d] px-5 py-4 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-base">Payment to Farmer: {selectedEntry.kisan_name}</h3>
                                <p className="text-[11px] text-emerald-100 mt-0.5">Voucher #: {selectedEntry.entry_no}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsPayModalOpen(false)}
                                disabled={submittingPayment}
                                className="text-white/80 hover:text-white p-1 rounded-lg"
                            >
                                <Icon name="X" className="size-5" />
                            </button>
                        </div>

                        <form onSubmit={handlePaySubmit} className="p-5 space-y-4 text-xs">
                            <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 flex justify-between items-center">
                                <span className="font-bold text-gray-700">{isUrdu ? 'کسان کا بقایا دینا:' : 'Farmer Balance Payable:'}</span>
                                <span className="text-red-700 text-lg font-black">
                                    {formatRs(selectedEntry.remaining_balance)}
                                </span>
                            </div>

                            <div>
                                <label className="block font-bold text-gray-700 mb-1">
                                    {isUrdu ? 'ادائیگی رقم (روپے)' : 'Adaigi Raqam (Rs)'} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    max={selectedEntry.remaining_balance}
                                    required
                                    className="w-full h-9 px-3 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-[#1e713e]"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-gray-700 mb-1">
                                    {isUrdu ? 'کھاتہ (ادائیگی ذریعہ)' : 'Khaata (Payment Account)'}
                                </label>
                                <select
                                    value={payAccount}
                                    onChange={(e) => setPayAccount(e.target.value)}
                                    className="w-full h-9 px-3 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-[#1e713e] bg-white"
                                >
                                    {accounts.map((acc) => (
                                        <option key={acc.id} value={acc.account_name}>
                                            {acc.account_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsPayModalOpen(false)}
                                    disabled={submittingPayment}
                                    className="h-9 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs"
                                >
                                    {isUrdu ? 'منسوخ' : 'Mansookh'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingPayment}
                                    className="h-9 px-5 rounded-lg bg-[#14532d] hover:bg-[#0f3d21] text-white font-bold text-xs transition shadow-xs disabled:opacity-50"
                                >
                                    {submittingPayment
                                        ? (isUrdu ? 'ادائیگی ہو رہی ہے...' : 'Adaigi ho rahi hai...')
                                        : (isUrdu ? 'ادائیگی محفوظ کریں' : 'Adaigi Mehfooz Karein')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ==================== PRINT DOCUMENT (ONLY VISIBLE ON PRINT) ==================== */}
            <div className="hidden print:block print-document text-black bg-white p-6 max-w-5xl mx-auto font-sans">
                {/* Print Letterhead Header */}
                <div className="text-center pb-4 mb-4 border-b-2 border-black">
                    <h1 className="text-2xl font-black tracking-tight uppercase">
                        VEGETABLE POS
                    </h1>
                    <p className="text-sm font-bold mt-1 uppercase tracking-wide">
                        Farmer Consignment & Ledger Statement
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                        {selectedFarmer
                            ? `Farmer: ${selectedFarmer.name} (${selectedFarmer.code}) | Area: ${selectedFarmer.area}`
                            : 'All Farmers Market Records'}
                        {' | '}Print Date: {new Date().toLocaleDateString('en-GB')}
                    </p>
                </div>

                {/* Print Table */}
                <table className="w-full text-xs border border-gray-400 border-collapse">
                    <thead>
                        <tr className="bg-gray-100 border-b border-gray-400">
                            <th className="p-2 text-start border border-gray-300 font-bold">Voucher #</th>
                            <th className="p-2 text-start border border-gray-300 font-bold">Name</th>
                            <th className="p-2 text-start border border-gray-300 font-bold">Tareekh</th>
                            <th className="p-2 text-start border border-gray-300 font-bold">Sabzi Jins</th>
                            <th className="p-2 text-end border border-gray-300 font-bold">Nag</th>
                            <th className="p-2 text-end border border-gray-300 font-bold">Kul Bikri (Gross)</th>
                            <th className="p-2 text-end border border-gray-300 font-bold">Commission</th>
                            <th className="p-2 text-end border border-gray-300 font-bold">Raqam (Net)</th>
                            <th className="p-2 text-end border border-gray-300 font-bold">Balance Payable</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentEntries.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="p-4 text-center border border-gray-300 text-gray-500">
                                    Koi parchi mojood nahi hai.
                                </td>
                            </tr>
                        ) : (
                            currentEntries.map((e) => (
                                <tr key={e.id} className="border-b border-gray-300" style={{ pageBreakInside: 'avoid' }}>
                                    <td className="p-2 border border-gray-300 font-mono font-bold whitespace-nowrap">
                                        {e.entry_no}
                                    </td>
                                    <td className="p-2 border border-gray-300 font-bold whitespace-nowrap">
                                        {e.kisan_name}
                                    </td>
                                    <td className="p-2 border border-gray-300 font-mono whitespace-nowrap">
                                        {e.entry_date}
                                    </td>
                                    <td className="p-2 border border-gray-300 font-medium">{e.item_name}</td>
                                    <td className="p-2 border border-gray-300 text-end font-bold">{e.nag_quantity}</td>
                                    <td className="p-2 border border-gray-300 text-end font-bold whitespace-nowrap">
                                        {formatRs(e.gross_sale)}
                                    </td>
                                    <td className="p-2 border border-gray-300 text-end font-bold text-emerald-800 whitespace-nowrap">
                                        {formatRs(e.commission_amount)}
                                    </td>
                                    <td className="p-2 border border-gray-300 text-end font-bold whitespace-nowrap">
                                        {formatRs(e.net_payable)}
                                    </td>
                                    <td className="p-2 border border-gray-300 text-end font-bold text-red-700 whitespace-nowrap">
                                        {formatRs(e.remaining_balance)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    {currentEntries.length > 0 && (
                        <tfoot>
                            <tr className="bg-gray-100 border-t-2 border-gray-400 font-bold">
                                <td colSpan={5} className="p-2 border border-gray-300 text-end font-black">
                                    Kul Mizan (Totals):
                                </td>
                                <td className="p-2 border border-gray-300 text-end font-black whitespace-nowrap">
                                    {formatRs(totalGross)}
                                </td>
                                <td className="p-2 border border-gray-300 text-end font-black text-emerald-800 whitespace-nowrap">
                                    {formatRs(totalComm)}
                                </td>
                                <td className="p-2 border border-gray-300 text-end font-black whitespace-nowrap">
                                    {formatRs(totalNet)}
                                </td>
                                <td className="p-2 border border-gray-300 text-end font-black text-red-700 whitespace-nowrap">
                                    {formatRs(totalRemaining)}
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>

                {/* Print Footer */}
                <div className="mt-8 pt-4 border-t border-gray-300 flex justify-between items-center text-[10px] text-gray-500">
                    <span>Vegetable POS - System Generated Statement | Page 1</span>
                    <span>Print Date: {new Date().toLocaleString()}</span>
                </div>
            </div>
        </AppLayout>
    );
}
