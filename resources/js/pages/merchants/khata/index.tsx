import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Icon from '@/components/ui/icon';
import MandiPageHeader from '@/components/app/mandi-page-header';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface MerchantItem {
    id: number;
    code: number;
    name: string;
    name_en: string;
    name_ur: string;
    phone: string;
    city: string;
    customer_type: string;
    credit_limit: number;
    balance: number;
    opening_balance: number;
}

interface TopSummary {
    total_receivable: number;
    debt_customers_count: number;
    total_customers: number;
    today_credit_sale: number;
    today_recovery: number;
}

interface StatementEntry {
    id: string;
    entry_date: string;
    description: string;
    ref_type: string;
    entry_type: 'debit' | 'credit';
    debit: number;
    credit: number;
    amount: number;
    balance_after: number;
    timestamp: number;
}

interface StatementData {
    entries: StatementEntry[];
    total_debit: number;
    total_credit: number;
    final_balance: number;
}

interface Props {
    merchants: MerchantItem[];
    selectedMerchantId: number;
    selectedMerchant: MerchantItem | null;
    topSummary: TopSummary;
    statement: StatementData;
    filters: {
        from_date: string;
        to_date: string;
    };
    summary?: any;
    rows?: any;
}

export default function MerchantKhataIndex({
    merchants = [],
    selectedMerchantId,
    selectedMerchant,
    topSummary,
    statement,
    filters,
}: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [searchQuery, setSearchQuery] = useState('');
    const [debtOnly, setDebtOnly] = useState(false);
    const [fromDate, setFromDate] = useState(filters?.from_date || new Date().toISOString().slice(0, 8) + '01');
    const [toDate, setToDate] = useState(filters?.to_date || new Date().toISOString().split('T')[0]);

    // Format rupee with commas and optional decimals
    const formatRs = (val: number | string | null | undefined) => {
        const num = Number(val || 0);
        return 'Rs ' + num.toLocaleString('en-US', {
            minimumFractionDigits: num % 1 === 0 ? 0 : 1,
            maximumFractionDigits: 2,
        });
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Ledgers', href: '#' },
        { title: 'Customer Ledger', href: '/merchant-khata' },
    ];

    // Background refresh
    React.useEffect(() => {
        const interval = setInterval(() => {
            router.reload({ preserveScroll: true, preserveState: true });
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    // Selection handlers
    const handleMerchantSelect = (id: number) => {
        router.get(
            '/merchant-khata',
            {
                merchant_id: id,
                from_date: fromDate,
                to_date: toDate,
            },
            {
                preserveState: true,
                replace: true,
                preserveScroll: true,
            }
        );
    };

    const handleDateChange = (newFrom: string, newTo: string) => {
        setFromDate(newFrom);
        setToDate(newTo);
        router.get(
            '/merchant-khata',
            {
                merchant_id: selectedMerchant?.id || selectedMerchantId,
                from_date: newFrom,
                to_date: newTo,
            },
            {
                preserveState: true,
                replace: true,
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Ledger statement updated successfully');
                },
            }
        );
    };

    // Filter merchants list
    const filteredMerchants = (merchants || []).filter((m) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
            !q ||
            (m.name && m.name.toLowerCase().includes(q)) ||
            (m.name_en && m.name_en.toLowerCase().includes(q)) ||
            (m.name_ur && m.name_ur.includes(q)) ||
            (m.phone && m.phone.includes(q)) ||
            (m.city && m.city.toLowerCase().includes(q)) ||
            String(m.code).includes(q);

        const matchesDebt = debtOnly ? m.balance > 0 : true;
        return matchesSearch && matchesDebt;
    });

    const entries = statement?.entries || [];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Customer Ledger" />

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
            <div className={`-mt-4 -mx-4 -mb-4 pb-28 bg-[#eef2ee] min-h-full font-sans text-[#1a211c] print:hidden ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>
                {/* 1. Header Banner */}
                <MandiPageHeader
                    title={isUrdu ? t('gahak_khata.title') : 'Customer Ledger'}
                    subtitle={isUrdu ? t('gahak_khata.subtitle') : 'Customer credit accounts, invoices, recoveries and ledger statements'}
                    isUrdu={isUrdu}
                >
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="h-8.5 px-3.5 rounded-xl text-xs font-semibold bg-white text-emerald-900 hover:bg-emerald-50 shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                        <Icon name="Printer" className="size-4 text-emerald-800" />
                        <span>{isUrdu ? t('gahak_khata.print_khata') : 'Print Statement'}</span>
                    </button>
                </MandiPageHeader>

                {/* 2. Floating Content Area */}
                <div className="max-w-7xl mx-auto px-3 md:px-6 -mt-6 md:-mt-8 space-y-4">
                    {/* 4 Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        {/* Card 1: Market Ka Kul Baqaya */}
                        <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                                {isUrdu ? 'مارکیٹ کا کل بقایا (لینا):' : 'Total Market Receivable:'}
                            </span>
                            <div className="text-xl font-bold text-red-700 mt-1">
                                {formatRs(topSummary?.total_receivable || 0)}
                            </div>
                            <span className="text-[10px] text-gray-500 mt-0.5 block">
                                {isUrdu ? 'دکانداروں سے وصول کرنا ہے' : 'Dukandaron se wasool karna hai'}
                            </span>
                        </div>

                        {/* Card 2: Udhaar Wale Gahak */}
                        <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                                {isUrdu ? 'ادھار والے گاہک:' : 'Customers with Due Balance:'}
                            </span>
                            <div className="text-xl font-bold text-gray-900 mt-1">
                                {topSummary?.debt_customers_count || 0} / {topSummary?.total_customers || 0}
                            </div>
                            <span className="text-[10px] text-gray-500 mt-0.5 block">
                                {isUrdu ? 'جن کے ذمے بقایا ہے' : 'Jinke zimmay baqaya hai'}
                            </span>
                        </div>

                        {/* Card 3: Aaj Ki Udhaar Farokht */}
                        <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                                {isUrdu ? 'آج کی ادھار فروخت:' : 'Today Credit Sales:'}
                            </span>
                            <div className="text-xl font-bold text-gray-900 mt-1">
                                {formatRs(topSummary?.today_credit_sale || 0)}
                            </div>
                            <span className="text-[10px] text-gray-500 mt-0.5 block">
                                {isUrdu ? 'آج کا نیا ادھار' : 'New credit today'}
                            </span>
                        </div>

                        {/* Card 4: Aaj Ki Wasooli */}
                        <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                                {isUrdu ? 'آج کی وصولی (Recovered):' : 'Today Recoveries:'}
                            </span>
                            <div className="text-xl font-bold text-emerald-800 mt-1">
                                {formatRs(topSummary?.today_recovery || 0)}
                            </div>
                            <span className="text-[10px] text-gray-500 mt-0.5 block">
                                {isUrdu ? 'آج وصول شدہ نقد' : 'Aaj wasool shuda naqad'}
                            </span>
                        </div>
                    </div>

                    {/* 2-Panel Layout: Left = Customer Selector, Right = Detailed Ledger */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* Left Panel: Customer List (4 cols) */}
                        <div className="lg:col-span-4 bg-white border border-emerald-200 rounded-xl p-3.5 space-y-3 shadow-2xs">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                <span className="font-bold text-xs text-gray-900">{isUrdu ? 'گاہک منتخب کریں' : 'Select Customer'}</span>
                                <span className="text-[11px] text-gray-500 font-medium">
                                    {isUrdu ? `${filteredMerchants.length} دکاندار` : `${filteredMerchants.length} Customers`}
                                </span>
                            </div>

                            {/* Search & Debt Filter */}
                            <div className="space-y-2">
                                <div className="relative">
                                    <Icon
                                        name="MagnifyingGlass"
                                        className={`w-3.5 h-3.5 text-gray-400 absolute ${isUrdu ? 'right-2.5' : 'left-2.5'} top-2.5`}
                                    />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={isUrdu ? 'گاہک کا نام یا فون...' : 'Search customer by name or phone...'}
                                        className={`w-full ${isUrdu ? 'pr-8 pl-2.5' : 'pl-8 pr-2.5'} py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition`}
                                    />
                                </div>

                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-gray-600 font-medium">{isUrdu ? 'صرف بقایا والے:' : 'Due Balance Only:'}</span>
                                    <button
                                        type="button"
                                        onClick={() => setDebtOnly(!debtOnly)}
                                        className={`px-2.5 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                                            debtOnly
                                                ? 'bg-red-100 text-red-800'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {debtOnly ? (isUrdu ? 'ہاں' : 'Haan') : (isUrdu ? 'نہیں' : 'Nahi')}
                                    </button>
                                </div>
                            </div>

                            {/* Merchant Cards List */}
                            <div className="max-h-[540px] overflow-y-auto space-y-1.5 pr-1">
                                {filteredMerchants.length === 0 ? (
                                    <div className="py-8 text-center text-gray-400 text-xs">
                                        {isUrdu ? 'کوئی گاہک نہیں ملا۔' : 'Koi gahak nahi mila.'}
                                    </div>
                                ) : (
                                    filteredMerchants.map((m) => {
                                        const isSelected = selectedMerchant && m.id === selectedMerchant.id;
                                        const hasDebt = m.balance > 0;

                                        return (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => handleMerchantSelect(m.id)}
                                                className={`w-full p-2.5 rounded-lg border text-start transition flex items-center justify-between cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-emerald-50/70 border-emerald-600 ring-1 ring-emerald-600/30'
                                                        : 'bg-white border-gray-200 hover:bg-gray-50'
                                                }`}
                                            >
                                                <div className="truncate pr-2">
                                                    <div className="flex items-center space-x-1.5">
                                                        <span className="font-bold text-xs text-gray-900 truncate block">
                                                            {m.name || m.name_en || m.name_ur}
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
                                                        {m.phone || m.city || (isUrdu ? 'منڈی دکاندار' : 'Market Customer')}
                                                    </span>
                                                </div>

                                                <div className="text-end flex-shrink-0">
                                                    <span
                                                        className={`text-xs font-bold block ${
                                                            hasDebt ? 'text-red-700' : 'text-emerald-800'
                                                        }`}
                                                    >
                                                        {formatRs(m.balance)}
                                                    </span>
                                                    <span className="text-[9px] text-gray-400 font-medium">
                                                        {hasDebt ? (isUrdu ? 'لینا ہے' : 'Receivable') : (isUrdu ? 'صاف' : 'Cleared')}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Right Panel: Selected Customer Ledger (8 cols) */}
                        <div className="lg:col-span-8 bg-white border border-emerald-200 rounded-xl p-4 space-y-3 shadow-2xs">
                            {selectedMerchant ? (
                                <>
                                    {/* Customer Banner Header */}
                                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <div className="flex items-center space-x-2">
                                                <h3 className="font-bold text-base text-gray-900">
                                                    {selectedMerchant.name ||
                                                        selectedMerchant.name_en ||
                                                        selectedMerchant.name_ur}
                                                </h3>
                                                <span className="bg-emerald-100 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded capitalize">
                                                    {selectedMerchant.customer_type || (isUrdu ? 'دکاندار' : 'Customer')}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-gray-600 mt-1 flex flex-wrap gap-3">
                                                {selectedMerchant.phone && (
                                                    <span className="flex items-center space-x-1">
                                                        <Icon name="Phone" className="w-3 h-3 text-gray-500" />
                                                        <span>{selectedMerchant.phone}</span>
                                                    </span>
                                                )}
                                                {selectedMerchant.city && (
                                                    <span className="flex items-center space-x-1">
                                                        <Icon name="MapPin" className="w-3 h-3 text-gray-500" />
                                                        <span>{selectedMerchant.city}</span>
                                                    </span>
                                                )}
                                                <span>{isUrdu ? 'کریڈٹ لمٹ:' : 'Credit Limit:'} {formatRs(selectedMerchant.credit_limit)}</span>
                                            </div>
                                        </div>

                                        <div className="text-start sm:text-end bg-white px-3 py-1.5 rounded-lg border border-emerald-200">
                                            <span className="text-[10px] uppercase font-bold text-gray-500 block">
                                                {isUrdu ? 'بقایا ادھار (لینا ہے):' : 'Outstanding Due (Receivable):'}
                                            </span>
                                            <span
                                                className={`text-base font-bold block ${
                                                    selectedMerchant.balance > 0
                                                        ? 'text-red-700'
                                                        : 'text-emerald-800'
                                                }`}
                                            >
                                                {formatRs(selectedMerchant.balance)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Ribbon & Date Filters */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                                        <div className="flex items-center flex-wrap gap-2.5">
                                            <span className="font-bold text-xs text-gray-900">
                                                {isUrdu ? 'کھاتہ روزنامچہ اسٹیٹمنٹ:' : 'Customer Ledger Statement:'}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-xs">
                                                <span className="text-gray-500 text-[11px] font-medium">{isUrdu ? 'سے:' : 'Se:'}</span>
                                                <input
                                                    type="date"
                                                    value={fromDate}
                                                    onChange={(e) => handleDateChange(e.target.value, toDate)}
                                                    className="h-7.5 px-2 border border-gray-300 rounded text-xs text-gray-800 focus:outline-none focus:border-emerald-600 bg-white"
                                                />
                                                <span className="text-gray-500 text-[11px] font-medium">{isUrdu ? 'تک:' : 'Tak:'}</span>
                                                <input
                                                    type="date"
                                                    value={toDate}
                                                    onChange={(e) => handleDateChange(fromDate, e.target.value)}
                                                    className="h-7.5 px-2 border border-gray-300 rounded text-xs text-gray-800 focus:outline-none focus:border-emerald-600 bg-white"
                                                />
                                            </div>
                                        </div>

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

                                    {/* Statement Table (Simplified 3 Columns: Pese Lena, Wasooli, Baqaya) */}
                                    <div className="overflow-x-auto border border-emerald-200 rounded-lg">
                                        <table className="w-full text-start text-xs">
                                            <thead className="bg-emerald-50 text-gray-900 border-b border-emerald-200 font-bold">
                                                <tr>
                                                    <th className="py-2.5 px-4 text-start">{isUrdu ? 'تفصیل' : 'Description'}</th>
                                                    <th className="py-2.5 px-4 text-start">{isUrdu ? 'حوالہ' : 'Reference'}</th>
                                                    <th className="py-2.5 px-4 text-end text-red-700">{isUrdu ? 'پیسے لینا' : 'Debit (Charges)'}</th>
                                                    <th className="py-2.5 px-4 text-end text-emerald-800">{isUrdu ? 'وصولی' : 'Recovery'}</th>
                                                    <th className="py-2.5 px-4 text-end">{isUrdu ? 'بقایا' : 'Balance'}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {entries.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="py-8 text-center text-gray-400">
                                                            {isUrdu ? 'اس گاہک کے کھاتے میں اس مدت میں کوئی اندراج موجود نہیں ہے۔' : 'Is gahak ke khate mein is muddad mein koi entry mojood nahi hai.'}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    entries.map((e) => (
                                                        <tr key={e.id} className="hover:bg-gray-50/80 transition">
                                                            <td className="py-2.5 px-4 text-start font-medium text-gray-800">
                                                                {e.description || '-'}
                                                            </td>
                                                            <td className="py-2.5 px-4 text-start text-gray-500 whitespace-nowrap">
                                                                {e.ref_type || '-'}
                                                            </td>
                                                            <td className="py-2.5 px-4 text-end font-bold text-red-700 whitespace-nowrap">
                                                                {e.debit > 0 ? formatRs(e.debit) : '-'}
                                                            </td>
                                                            <td className="py-2.5 px-4 text-end font-bold text-emerald-800 whitespace-nowrap">
                                                                {e.credit > 0 ? formatRs(e.credit) : '-'}
                                                            </td>
                                                            <td className="py-2.5 px-4 text-end font-bold text-gray-900 whitespace-nowrap">
                                                                {formatRs(e.balance_after)}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                            {entries.length > 0 && (
                                                <tfoot className="bg-gray-50 font-bold border-t border-gray-200 text-xs">
                                                    <tr>
                                                        <td colSpan={2} className="py-2.5 px-4 text-start font-bold text-gray-800">
                                                            {isUrdu ? 'کل ٹوٹل' : 'Kul Total'}
                                                        </td>
                                                        <td className="py-2.5 px-4 text-end text-red-700 font-bold whitespace-nowrap">
                                                            {formatRs(statement?.total_debit || 0)}
                                                        </td>
                                                        <td className="py-2.5 px-4 text-end text-emerald-800 font-bold whitespace-nowrap">
                                                            {formatRs(statement?.total_credit || 0)}
                                                        </td>
                                                        <td className="py-2.5 px-4 text-end text-gray-900 font-bold whitespace-nowrap">
                                                            {formatRs(selectedMerchant.balance)}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <div className="py-12 text-center text-gray-400 text-xs">
                                    {isUrdu ? 'بائیں جانب سے کسی بھی گاہک پر کلک کریں اس کا مکمل کھاتہ دیکھنے کے لیے۔' : 'Click on any customer from the list on the left to view their full ledger statement.'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ==================== PRINT DOCUMENT (ONLY VISIBLE ON PRINT) ==================== */}
            <div className="hidden print:block print-document text-black bg-white p-6 max-w-4xl mx-auto font-sans">
                {selectedMerchant && (
                    <>
                        {/* Print Letterhead Header */}
                        <div className="text-center pb-4 mb-4 border-b-2 border-black">
                            <h1 className="text-2xl font-black tracking-tight uppercase">
                                VEGETABLE POS
                            </h1>
                            <p className="text-sm font-bold mt-1 uppercase tracking-wide">
                                Customer Ledger Statement
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                                Period: {fromDate} To {toDate} | Print Date: {new Date().toLocaleDateString('en-GB')}
                            </p>
                        </div>

                        {/* Merchant Details Box */}
                        <div className="grid grid-cols-2 gap-4 p-3 mb-4 border border-gray-300 rounded text-xs bg-gray-50">
                            <div>
                                <p>
                                    <span className="font-bold">Customer Name:</span>{' '}
                                    {selectedMerchant.name ||
                                        selectedMerchant.name_en ||
                                        selectedMerchant.name_ur}{' '}
                                    (#{selectedMerchant.code})
                                </p>
                                <p className="mt-1">
                                    <span className="font-bold">Qism (Category):</span>{' '}
                                    {selectedMerchant.customer_type || 'Customer'}
                                </p>
                                <p className="mt-1">
                                    <span className="font-bold">Phone:</span> {selectedMerchant.phone || '-'}
                                </p>
                            </div>
                            <div className="text-right">
                                <p>
                                    <span className="font-bold">Ilaqa (City):</span> {selectedMerchant.city || '-'}
                                </p>
                                <p className="mt-1">
                                    <span className="font-bold">Credit Limit:</span>{' '}
                                    {formatRs(selectedMerchant.credit_limit)}
                                </p>
                                <p className="mt-1 font-bold text-sm">
                                    <span>Outstanding Due (Receivable): </span>
                                    <span className="text-red-700">{formatRs(selectedMerchant.balance)}</span>
                                </p>
                            </div>
                        </div>

                        {/* Print Table (Simplified 3 Columns: Pese Lena, Wasooli, Baqaya) */}
                        <table className="w-full text-xs border border-gray-400 border-collapse">
                            <thead>
                                <tr className="bg-gray-100 border-b border-gray-400">
                                    <th className="p-2 text-start border border-gray-300 font-bold">Description</th>
                                    <th className="p-2 text-start border border-gray-300 font-bold">Hawala</th>
                                    <th className="p-2 text-end border border-gray-300 font-bold text-red-700">Receivable (Debit)</th>
                                    <th className="p-2 text-end border border-gray-300 font-bold text-emerald-800">Recovery (Credit)</th>
                                    <th className="p-2 text-end border border-gray-300 font-bold">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-4 text-center border border-gray-300 text-gray-500">
                                            Is muddad mein koi entry mojood nahi hai.
                                        </td>
                                    </tr>
                                ) : (
                                    entries.map((e) => (
                                        <tr
                                            key={e.id}
                                            className="border-b border-gray-300"
                                            style={{ pageBreakInside: 'avoid' }}
                                        >
                                            <td className="p-2 border border-gray-300 text-start font-medium text-gray-800">
                                                {e.description || '-'}
                                            </td>
                                            <td className="p-2 border border-gray-300 text-start text-gray-600 whitespace-nowrap">
                                                {e.ref_type || '-'}
                                            </td>
                                            <td className="p-2 border border-gray-300 text-end font-bold text-red-700 whitespace-nowrap">
                                                {e.debit > 0 ? formatRs(e.debit) : '-'}
                                            </td>
                                            <td className="p-2 border border-gray-300 text-end font-bold text-emerald-800 whitespace-nowrap">
                                                {e.credit > 0 ? formatRs(e.credit) : '-'}
                                            </td>
                                            <td className="p-2 border border-gray-300 text-end font-bold whitespace-nowrap">
                                                {formatRs(e.balance_after)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {entries.length > 0 && (
                                <tfoot>
                                    <tr className="bg-gray-100 border-t-2 border-gray-400 font-bold">
                                        <td colSpan={2} className="p-2 border border-gray-300 text-start font-bold">
                                            Kul Total
                                        </td>
                                        <td className="p-2 border border-gray-300 text-end font-black text-red-700 whitespace-nowrap">
                                            {formatRs(statement?.total_debit || 0)}
                                        </td>
                                        <td className="p-2 border border-gray-300 text-end font-black text-emerald-800 whitespace-nowrap">
                                            {formatRs(statement?.total_credit || 0)}
                                        </td>
                                        <td className="p-2 border border-gray-300 text-end font-black whitespace-nowrap">
                                            {formatRs(selectedMerchant.balance)}
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
                    </>
                )}
            </div>
        </AppLayout>
    );
}
