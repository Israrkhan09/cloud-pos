import React, { useState, useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import MandiPageHeader from '@/components/app/mandi-page-header';
import { type BreadcrumbItem } from '@/types';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface RozanaRow {
    id: number;
    bill_no: string;
    customer_name: string;
    date: string;
    item_count: string;
    item_name: string;
    gross_amount: number;
    cash_paid: number;
    udhaar_baqaya: number;
    payment_type: string;
}

interface RozanaData {
    from_date: string;
    to_date: string;
    bills_count: number;
    total_gross: number;
    total_cash: number;
    total_udhaar: number;
    rows: RozanaRow[];
}

interface MahanaRow {
    month: string;
    bills_count: number;
    total_sale: number;
    cash_wasooli: number;
    udhaar_baqaya: number;
    discount: number;
}

interface MahanaData {
    year: number;
    rows: MahanaRow[];
    totals: {
        bills_count: number;
        total_sale: number;
        cash_wasooli: number;
        udhaar_baqaya: number;
        discount: number;
    };
}

interface StockRow {
    id: number;
    name: string;
    stock: number;
    unit: string;
    cost_rate: number;
    total_cost: number;
    sale_rate: number;
    total_sale: number;
}

interface StockData {
    items_count: number;
    cost_valuation: number;
    sale_valuation: number;
    expected_profit: number;
    rows: StockRow[];
}

interface GahakRow {
    id: number;
    name: string;
    phone: string;
    area: string;
    credit_limit: number;
    balance: number;
    last_sale: string;
    last_wasooli: string;
}

interface GahakData {
    total_market_udhaar: number;
    rows: GahakRow[];
}

interface PnlData {
    from_date: string;
    to_date: string;
    gross_revenue: number;
    cogs: number;
    gross_profit: number;
    farmer_commission: number;
    wastage_loss: number;
    total_discounts: number;
    net_profit: number;
}

interface ReportItem {
    id: string;
    title: string;
    title_ur: string;
    desc: string;
    desc_ur: string;
    url: string;
    isRange?: boolean;
}

interface Category {
    id: string;
    name: string;
    name_ur: string;
    icon: string;
    reports: ReportItem[];
}

interface ReportDataResponse {
    report: string;
    date: string;
    from_date: string;
    to_date: string;
    title: string;
    title_ur: string;
    columns: string[];
    rows: any[];
    totals: string[];
}

interface Props {
    initialTab?: string;
    initialFromDate?: string;
    initialToDate?: string;
    initialYear?: number;
    rozanaData: RozanaData;
    mahanaData: MahanaData;
    stockData: StockData;
    gahakData: GahakData;
    pnlData: PnlData;
}

export default function ReportsPage({
    initialTab = 'rozana',
    initialFromDate = new Date().toISOString().split('T')[0],
    initialToDate = new Date().toISOString().split('T')[0],
    initialYear = new Date().getFullYear(),
    rozanaData,
    mahanaData,
    stockData,
    gahakData,
    pnlData,
}: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    // Tabs state
    const [activeTab, setActiveTab] = useState<string>(initialTab);

    // Filters state
    const [filterFromDate, setFilterFromDate] = useState<string>(initialFromDate);
    const [filterToDate, setFilterToDate] = useState<string>(initialToDate);
    const [selectedYear, setSelectedYear] = useState<number>(initialYear);

    // Legacy "Baqi Reports" accordion state
    const [showBaqiReports, setShowBaqiReports] = useState<boolean>(false);
    const [activeLegacyCategory, setActiveLegacyCategory] = useState<string>('merchants');

    // Legacy Report Preview Modal state
    const [legacyModalOpen, setLegacyModalOpen] = useState(false);
    const [legacyReportData, setLegacyReportData] = useState<ReportDataResponse | null>(null);
    const [legacyLoading, setLegacyLoading] = useState(false);

    // Formatting helpers
    const formatRs = (val: number) => {
        return 'Rs ' + Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    };

    const formatNum = (val: number) => {
        return Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    };

    // Tab Change handler
    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
    };

    // Date Filter Submit handler
    const handleApplyDateFilter = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        router.get('/reports', {
            tab: activeTab,
            from_date: filterFromDate,
            to_date: filterToDate,
            year: selectedYear,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    // Year Change handler
    const handleYearChange = (newYear: number) => {
        setSelectedYear(newYear);
        router.get('/reports', {
            tab: activeTab,
            from_date: filterFromDate,
            to_date: filterToDate,
            year: newYear,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    // Print active tab
    const handlePrintActiveTab = () => {
        window.print();
    };

    // CSV Export button text
    const getCsvButtonText = () => {
        switch (activeTab) {
            case 'stock':
                return 'Stock CSV Export';
            case 'gahak':
                return 'Gahak Baqaya CSV';
            default:
                return 'CSV Export';
        }
    };

    // Export Active Tab to CSV
    const handleCsvExportActiveTab = () => {
        let csvContent = '';
        let fileName = '';

        if (activeTab === 'rozana') {
            fileName = `Rozana_Sale_Report_${filterFromDate}_to_${filterToDate}.csv`;
            if (!rozanaData.rows || rozanaData.rows.length === 0) {
                csvContent = 'Is tareekh ka koi record nahi\n';
            } else {
                csvContent = 'Bill #,Gahak Ka Naam,Tareekh,Sabzi Items,Kul Bill (Rs),Naqad Ada (Rs),Udhaar Baqaya (Rs),Tariqa\n';
                rozanaData.rows.forEach(r => {
                    csvContent += `"${r.bill_no}","${r.customer_name}","${r.date}","${r.item_count}","${r.gross_amount.toFixed(2)}","${r.cash_paid.toFixed(2)}","${r.udhaar_baqaya.toFixed(2)}","${r.payment_type}"\n`;
                });
                csvContent += `Total,,,"${rozanaData.bills_count} Bills","${rozanaData.total_gross.toFixed(2)}","${rozanaData.total_cash.toFixed(2)}","${rozanaData.total_udhaar.toFixed(2)}",\n`;
            }
        } else if (activeTab === 'mahana') {
            fileName = `Mahana_Sale_Summary_${selectedYear}.csv`;
            if (!mahanaData.rows || mahanaData.rows.length === 0) {
                csvContent = 'Is saal ka koi record nahi\n';
            } else {
                csvContent = 'Mahina (Month),Kul Bills,Kul Sale (Rs),Naqad Wasooli (Rs),Udhaar Baqaya (Rs),Riaayat / Discount (Rs)\n';
                mahanaData.rows.forEach(r => {
                    csvContent += `"${r.month}","${r.bills_count}","${r.total_sale.toFixed(2)}","${r.cash_wasooli.toFixed(2)}","${r.udhaar_baqaya.toFixed(2)}","${r.discount.toFixed(2)}"\n`;
                });
                csvContent += `Total,"${mahanaData.totals.bills_count}","${mahanaData.totals.total_sale.toFixed(2)}","${mahanaData.totals.cash_wasooli.toFixed(2)}","${mahanaData.totals.udhaar_baqaya.toFixed(2)}","${mahanaData.totals.discount.toFixed(2)}"\n`;
            }
        } else if (activeTab === 'stock') {
            fileName = `Stock_Valuation_${new Date().toISOString().split('T')[0]}.csv`;
            if (!stockData.rows || stockData.rows.length === 0) {
                csvContent = 'Koi stock record nahi mila\n';
            } else {
                csvContent = 'Sabzi Ka Naam,Mojooda Stock,Unit,Khareed Rate (Rs),Kul Khareed Cost (Rs),Sale Rate (Rs),Kul Sale Malyaat (Rs)\n';
                stockData.rows.forEach(r => {
                    csvContent += `"${r.name}","${r.stock}","${r.unit}","${r.cost_rate.toFixed(2)}","${r.total_cost.toFixed(2)}","${r.sale_rate.toFixed(2)}","${r.total_sale.toFixed(2)}"\n`;
                });
                csvContent += `Total,"${stockData.items_count} Items",,,"${stockData.cost_valuation.toFixed(2)}",,"${stockData.sale_valuation.toFixed(2)}"\n`;
            }
        } else if (activeTab === 'gahak') {
            fileName = `Gahak_Baqaya_Udhaar_${new Date().toISOString().split('T')[0]}.csv`;
            if (!gahakData.rows || gahakData.rows.length === 0) {
                csvContent = 'Koi baqaya udhaar nahi hai\n';
            } else {
                csvContent = 'Gahak Ka Naam,Phone,Ilaqa,Credit Limit (Rs),Baqaya Udhaar (Rs),Aakhri Sale,Aakhri Wasooli\n';
                gahakData.rows.forEach(r => {
                    csvContent += `"${r.name}","${r.phone}","${r.area}","${r.credit_limit.toFixed(2)}","${r.balance.toFixed(2)}","${r.last_sale}","${r.last_wasooli}"\n`;
                });
                csvContent += `Total Market Udhaar,,,,${gahakData.total_market_udhaar.toFixed(2)},,\n`;
            }
        } else if (activeTab === 'pnl') {
            fileName = `Nafa_Nuqsan_Statement_${filterFromDate}_to_${filterToDate}.csv`;
            csvContent = 'Mad (Statement Line),Raqam (Rs)\n';
            csvContent += `"Kul Farokht (Gross Sales Revenue)","${pnlData.gross_revenue.toFixed(2)}"\n`;
            csvContent += `"Maal Khareed Cost (Purchase Cost of Goods Sold)","-${pnlData.cogs.toFixed(2)}"\n`;
            csvContent += `"Kham Munafa (Gross Profit on Sales)","${pnlData.gross_profit.toFixed(2)}"\n`;
            csvContent += `"Mandi Commission Aamdani (Farmer Commission Earned)","+${pnlData.farmer_commission.toFixed(2)}"\n`;
            csvContent += `"Kharab / Zaya Sabzi Nuqsan (Spoilage Loss)","-${pnlData.wastage_loss.toFixed(2)}"\n`;
            csvContent += `"Kul Riaayat / Discounts","-${pnlData.total_discounts.toFixed(2)}"\n`;
            csvContent += `"SAAF MUNAFA (NET PROFIT)","${pnlData.net_profit.toFixed(2)}"\n`;
        }

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`${fileName} download ho gaya.`);
    };

    // Legacy Reports Categories
    const legacyCategories: Category[] = [
        {
            id: 'merchants',
            name: 'Merchants',
            name_ur: 'خریدار (مرچنٹس)',
            icon: 'Users',
            reports: [
                { id: 'amroza_print', title: 'Amroza Print', title_ur: 'امروزہ پرنٹ', desc: 'Aaj ki sale ki list', desc_ur: 'آج کی سیل کی لسٹ', url: '/amroza' },
                { id: 'amroza_parchi', title: 'Amroza Parchi', title_ur: 'امروزہ پرچی', desc: 'Merchant ko dene ki parchi', desc_ur: 'مرچنٹ کو دینے کی پرچی', url: '/amroza' },
                { id: 'naqdi_print', title: 'Naqdi Print', title_ur: 'نقدی پرنٹ', desc: 'Naqdi wasooli ki list', desc_ur: 'نقدی وصولی کی لسٹ', url: '/naqdi' },
                { id: 'wasooli_print', title: 'Wasooli Print', title_ur: 'وصولی پرنٹ', desc: 'Wasooli (recovery) ki list', desc_ur: 'وصولی (ریکوری) کی لسٹ', url: '/wasooli' },
                { id: 'merchant_amroza', title: 'Merchant Amroza', title_ur: 'مرچنٹ امروزہ', desc: 'Merchant wise sale', desc_ur: 'مرچنٹ کے مطابق سیل', url: '/merchant-amroza' },
                { id: 'merchant_wasooli', title: 'Merchant Wasooli', title_ur: 'مرچنٹ وصولی', desc: 'Merchant wise wasooli', desc_ur: 'مرچنٹ کے مطابق وصولی', url: '/merchant-wasooli' },
                { id: 'amroza_tafseel', title: 'Amroza Tafseel', title_ur: 'امروزہ تفصیل', desc: 'Sale ki poori tafseel', desc_ur: 'سیل کی پوری تفصیل', url: '/amroza-detail', isRange: true },
                { id: 'wasooli_tafseel', title: 'Wasooli Tafseel', title_ur: 'وصولی تفصیل', desc: 'Wasooli ki poori tafseel', desc_ur: 'وصولی کی پوری تفصیل', url: '/wasooli-detail', isRange: true },
                { id: 'amroza_wasooli', title: 'Amroza / Wasooli', title_ur: 'امروزہ / وصولی سمری', desc: 'Sale aur wasooli ek saath', desc_ur: 'سیل اور وصولی ایک ساتھ', url: '/amroza-wasooli', isRange: true },
            ],
        },
        {
            id: 'farmers',
            name: 'Farmers',
            name_ur: 'زمیندار (کسان)',
            icon: 'Tractor',
            reports: [
                { id: 'farmer_bill', title: 'Farmer Bill (Bijak)', title_ur: 'کسان بل (بیجک)', desc: 'Kisan ka rozana ka hisab', desc_ur: 'کسان کا روزانہ کا حساب', url: '/bijak' },
                { id: 'farmer_khata', title: 'Farmer Khata', title_ur: 'کسان کھاتہ', desc: 'Farmer ka Jama / Banam (Fard Hisab)', desc_ur: 'کسان کا جمع / بنام (فرد حساب)', url: '/khata' },
                { id: 'farmer_list', title: 'Farmer List', title_ur: 'کسان لسٹ', desc: 'Tamaam farmers ki fehrist', desc_ur: 'تمام کسانوں کی فہرست', url: '/masters/farmers' },
                { id: 'farmer_marks', title: 'Farmer Marks', title_ur: 'کسان مارکس', desc: 'Farmer marks aur bariyan', desc_ur: 'کسان مارکس اور باڑیاں', url: '/masters/marks' },
                { id: 'farmer_balances', title: 'Farmer Balances', title_ur: 'کسان بقایا جات', desc: 'Farmer baqaya jaat', desc_ur: 'کسان کے بقایا جات', url: '/khata' },
            ],
        },
        {
            id: 'ledger',
            name: 'Ledger',
            name_ur: 'لیجر',
            icon: 'BookBookmark',
            reports: [
                { id: 'sale_report', title: 'Sale Report', title_ur: 'سیل رپورٹ', desc: 'aaj ki list', desc_ur: 'آج کی لسٹ', url: '/amroza' },
                { id: 'munafa_nuqsan', title: 'Munafa / Nuqsan', title_ur: 'منافع / نقصان', desc: 'item wise', desc_ur: 'آئٹم کے مطابق', url: '/reports' },
                { id: 'udhaar_report', title: 'Udhaar Report', title_ur: 'ادھار رپورٹ', desc: 'kis se kitna lena', desc_ur: 'کس سے کتنا لینا', url: '/merchant-khata' },
                { id: 'stock_report', title: 'Stock Report', title_ur: 'اسٹاک رپورٹ', desc: 'value aur kam stock', desc_ur: 'ویلیو اور کم اسٹاک', url: '/masters/items' },
                { id: 'kisan_hisaab', title: 'Kisan Hisaab', title_ur: 'کسان حساب', desc: 'dena baqi', desc_ur: 'دینا باقی', url: '/khata' },
            ],
        },
    ];

    const selectedLegacyCat = legacyCategories.find(c => c.id === activeLegacyCategory) || legacyCategories[0];

    // Fetch and preview legacy report
    async function handleLegacyPreview(rep: ReportItem) {
        setLegacyLoading(true);
        try {
            const res = await fetch(`/reports/data?report=${rep.id}&date=${filterFromDate}&from_date=${filterFromDate}&to_date=${filterToDate}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data: ReportDataResponse = await res.json();
            setLegacyReportData(data);
            setLegacyModalOpen(true);
        } catch {
            toast.error('Rapoort load nahi ho saki');
        } finally {
            setLegacyLoading(false);
        }
    }

    // Export legacy report to excel
    async function handleLegacyExcel(rep: ReportItem) {
        setLegacyLoading(true);
        try {
            const res = await fetch(`/reports/data?report=${rep.id}&date=${filterFromDate}&from_date=${filterFromDate}&to_date=${filterToDate}`);
            if (!res.ok) throw new Error('Failed');
            const data: ReportDataResponse = await res.json();
            if (!data.rows || data.rows.length === 0) {
                toast.error('Is tareekh ka koi record nahi');
                return;
            }
            let csv = data.columns.join(',') + '\n';
            data.rows.forEach(r => {
                csv += Object.values(r).map(v => `"${v}"`).join(',') + '\n';
            });
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${rep.id}_${filterFromDate}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Excel / CSV download ho gaya');
        } catch {
            toast.error('Export fail ho gaya');
        } finally {
            setLegacyLoading(false);
        }
    }

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'رپورٹس' : 'Reports', href: '/reports' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mandi Rapoort (Reports, Audits & Profit/Loss) - Vegetable POS" />

            <div className={`-mt-4 -mx-4 -mb-4 pb-28 bg-[#eef2ee] min-h-full space-y-4 ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>
                {/* 1. Green Header Section */}
                <MandiPageHeader
                    title={isUrdu ? t('reports_mandi.title') : 'Mandi Rapoort (Reports, Audits & Profit/Loss)'}
                    subtitle={isUrdu ? t('reports_mandi.subtitle') : 'Rozana aur mahana bikri, stock valuation, gahak baqaya aur munafa rapoort'}
                    isUrdu={isUrdu}
                >
                    <button
                        type="button"
                        onClick={handlePrintActiveTab}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-50 text-[#14532d] border border-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
                    >
                        <Icon name="Printer" className="size-4 text-[#14532d]" weight="bold" />
                        <span>{isUrdu ? t('reports_mandi.print_btn') : 'Print Karein'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleCsvExportActiveTab}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-50 text-[#14532d] border border-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
                    >
                        <Icon name="DownloadSimple" className="size-4 text-[#14532d]" weight="bold" />
                        <span>{getCsvButtonText()}</span>
                    </button>
                </MandiPageHeader>

                <div className="w-full px-4 md:px-6 -mt-6 md:-mt-8 space-y-5">
                    {/* 2. Tabs Switcher (Exact Order) */}
                    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-print scrollbar-none">
                        {[
                            { id: 'rozana', label: isUrdu ? t('reports_mandi.rozana_tab') : 'Rozana Sale Report' },
                            { id: 'mahana', label: isUrdu ? t('reports_mandi.mahana_tab') : 'Mahana Sale Summary' },
                            { id: 'stock', label: isUrdu ? t('reports_mandi.stock_tab') : 'Stock Valuation (Malyaat)' },
                            { id: 'gahak', label: isUrdu ? t('reports_mandi.gahak_tab') : 'Gahak Baqaya (Udhaar)' },
                            { id: 'pnl', label: isUrdu ? t('reports_mandi.pnl_tab') : 'Nafa-Nuqsan (Munafa P&L)' },
                        ].map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => handleTabChange(t.id)}
                            className={cn(
                                "px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer shrink-0 border",
                                activeTab === t.id
                                    ? "bg-[#0d3b1e] text-white border-2 border-white font-bold shadow-xs"
                                    : "bg-white text-[#14532d] border border-white hover:bg-emerald-50 font-semibold shadow-2xs"
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* 3. Tab Contents */}

                {/* ==================== TAB A: ROZANA SALE REPORT ==================== */}
                {activeTab === 'rozana' && (
                    <div className="space-y-4">
                        {/* Tareekh Filter Bar */}
                        <form onSubmit={handleApplyDateFilter} className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-3 flex flex-wrap items-center gap-3 no-print">
                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                <Icon name="Calendar" className="size-4 text-emerald-800" />
                                <span>{isUrdu ? 'تاریخ فلٹر:' : 'Tareekh Filter:'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{isUrdu ? 'شروع:' : 'Shuru:'}</span>
                                <input
                                    type="date"
                                    value={filterFromDate}
                                    onChange={(e) => setFilterFromDate(e.target.value)}
                                    className="h-9 px-3 text-xs border border-gray-300 rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{isUrdu ? 'آخر:' : 'Aakhir:'}</span>
                                <input
                                    type="date"
                                    value={filterToDate}
                                    onChange={(e) => setFilterToDate(e.target.value)}
                                    className="h-9 px-3 text-xs border border-gray-300 rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white"
                                />
                            </div>
                            <button
                                type="submit"
                                className="h-9 px-4 rounded-lg bg-[#14532d] hover:bg-[#0f3d21] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                            >
                                {isUrdu ? 'فلٹر لگائیں' : 'Filter Lagayein'}
                            </button>
                        </form>

                        {/* 4 Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                            <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-4.5 shadow-2xs">
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
                                    {isUrdu ? 'کل بلز تعداد:' : 'Kul Bills Count:'}
                                </span>
                                <span className="text-2xl font-black text-gray-900 dark:text-white block mt-1.5">
                                    {rozanaData.bills_count} {isUrdu ? 'بلز' : 'Bills'}
                                </span>
                            </div>

                            <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-4.5 shadow-2xs">
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
                                    {isUrdu ? 'کل فروخت (Sales):' : 'Kul Farokht (Sales):'}
                                </span>
                                <span className="text-2xl font-black text-gray-900 dark:text-white block mt-1.5">
                                    {formatRs(rozanaData.total_gross)}
                                </span>
                            </div>

                            <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-4.5 shadow-2xs">
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
                                    {isUrdu ? 'نقد وصولی:' : 'Naqad Wasooli:'}
                                </span>
                                <span className="text-2xl font-black text-emerald-800 dark:text-emerald-400 block mt-1.5">
                                    {formatRs(rozanaData.total_cash)}
                                </span>
                            </div>

                            <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-4.5 shadow-2xs">
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
                                    {isUrdu ? 'ادھار بقایا:' : 'Udhaar Baqaya:'}
                                </span>
                                <span className="text-2xl font-black text-red-700 dark:text-red-400 block mt-1.5">
                                    {formatRs(rozanaData.total_udhaar)}
                                </span>
                            </div>
                        </div>

                        {/* Rozana Sale Report Table */}
                        <div className="w-full bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl shadow-xs overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-start border-collapse text-xs sm:text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-border bg-emerald-50/40 dark:bg-muted/30">
                                            <th className="py-3 px-3.5 text-start font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'بل #' : 'Bill #'}</th>
                                            <th className="py-3 px-3.5 text-start font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'گاہک کا نام' : 'Gahak Ka Naam'}</th>
                                            <th className="py-3 px-3.5 text-start font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'تاریخ' : 'Tareekh'}</th>
                                            <th className="py-3 px-3.5 text-start font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'سبزی جنس' : 'Sabzi Items'}</th>
                                            <th className="py-3 px-3.5 text-end font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'کل بل' : 'Kul Bill'}</th>
                                            <th className="py-3 px-3.5 text-end font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'نقد ادا' : 'Naqad Ada'}</th>
                                            <th className="py-3 px-3.5 text-end font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'ادھار بقایا' : 'Udhaar Baqaya'}</th>
                                            <th className="py-3 px-3.5 text-center font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'طریقہ' : 'Tariqa'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-border">
                                        {rozanaData.rows.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="py-12 text-center text-xs text-gray-400">
                                                    {isUrdu ? 'اس تاریخ کا کوئی ریکارڈ نہیں' : 'Is tareekh ka koi record nahi'}
                                                </td>
                                            </tr>
                                        ) : (
                                            rozanaData.rows.map((row) => (
                                                <tr key={row.id} className="hover:bg-gray-50/60 dark:hover:bg-muted/20 transition-colors">
                                                    <td className="py-3 px-3.5 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                                        {row.bill_no}
                                                    </td>
                                                    <td className="py-3 px-3.5 font-semibold text-gray-800 dark:text-gray-200">
                                                        {row.customer_name}
                                                    </td>
                                                    <td className="py-3 px-3.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                        {row.date}
                                                    </td>
                                                    <td className="py-3 px-3.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                        {row.item_count}
                                                    </td>
                                                    <td className="py-3 px-3.5 text-end font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                                        Rs {row.gross_amount.toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-3.5 text-end font-semibold text-emerald-800 dark:text-emerald-400 whitespace-nowrap">
                                                        Rs {row.cash_paid.toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-3.5 text-end font-bold text-red-700 dark:text-red-400 whitespace-nowrap">
                                                        Rs {row.udhaar_baqaya.toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                                        <span
                                                            className={cn(
                                                                "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider",
                                                                row.payment_type.includes('UDHAAR')
                                                                    ? "bg-red-50 text-red-800 border border-red-200"
                                                                    : row.payment_type.includes('ADHA')
                                                                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                                                                    : row.payment_type.includes('BANK')
                                                                    ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                                                                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                                            )}
                                                        >
                                                            {row.payment_type}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== TAB B: MAHANA SALE SUMMARY ==================== */}
                {activeTab === 'mahana' && (
                    <div className="space-y-4">
                        {/* Heading & Year Selector */}
                        <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-3.5 flex items-center justify-between no-print">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                {isUrdu ? `ماہانہ فروخت سمری (${selectedYear})` : `Mahana Farokht Summary (${selectedYear})`}
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 font-medium">{isUrdu ? 'سال چنیں:' : 'Saal chunein:'}</span>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => handleYearChange(Number(e.target.value))}
                                    className="h-8.5 px-3 text-xs border border-gray-300 rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white font-bold cursor-pointer"
                                >
                                    {[2026, 2025, 2024, 2023].map((y) => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Mahana Table */}
                        <div className="w-full bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl shadow-xs overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-start border-collapse text-xs sm:text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-border bg-emerald-50/40 dark:bg-muted/30">
                                            <th className="py-3 px-4 text-start font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'مہینہ (Month)' : 'Mahina (Month)'}</th>
                                            <th className="py-3 px-4 text-center font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'کل بلز' : 'Kul Bills'}</th>
                                            <th className="py-3 px-4 text-end font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'کل سیل (Rs)' : 'Kul Sale (Rs)'}</th>
                                            <th className="py-3 px-4 text-end font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'نقد وصولی (Rs)' : 'Naqad Wasooli (Rs)'}</th>
                                            <th className="py-3 px-4 text-end font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'ادھار بقایا (Rs)' : 'Udhaar Baqaya (Rs)'}</th>
                                            <th className="py-3 px-4 text-end font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'رعایت / ڈسکاؤنٹ (Rs)' : 'Riaayat / Discount (Rs)'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-border">
                                        {mahanaData.rows.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center text-xs text-gray-400">
                                                    {isUrdu ? 'اس سال کا کوئی ریکارڈ نہیں' : 'Is saal ka koi record nahi'}
                                                </td>
                                            </tr>
                                        ) : (
                                            mahanaData.rows.map((row) => (
                                                <tr key={row.month} className="hover:bg-gray-50/60 dark:hover:bg-muted/20 transition-colors">
                                                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                                        {row.month}
                                                    </td>
                                                    <td className="py-3 px-4 text-center font-semibold text-gray-800 dark:text-gray-200">
                                                        {row.bills_count}
                                                    </td>
                                                    <td className="py-3 px-4 text-end font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                                        Rs {row.total_sale.toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-4 text-end font-semibold text-emerald-800 dark:text-emerald-400 whitespace-nowrap">
                                                        Rs {row.cash_wasooli.toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-4 text-end font-bold text-red-700 dark:text-red-400 whitespace-nowrap">
                                                        Rs {row.udhaar_baqaya.toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-4 text-end text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                        Rs {row.discount.toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {mahanaData.rows.length > 0 && (
                                        <tfoot>
                                            <tr className="border-t-2 border-gray-200 dark:border-border bg-gray-50 dark:bg-muted/40 font-bold">
                                                <td className="py-3 px-4 text-gray-900 dark:text-white">{isUrdu ? 'کل ٹوٹل' : 'Total'}</td>
                                                <td className="py-3 px-4 text-center text-gray-900 dark:text-white">{mahanaData.totals.bills_count}</td>
                                                <td className="py-3 px-4 text-end text-gray-900 dark:text-white">Rs {mahanaData.totals.total_sale.toFixed(2)}</td>
                                                <td className="py-3 px-4 text-end text-emerald-800 dark:text-emerald-400">Rs {mahanaData.totals.cash_wasooli.toFixed(2)}</td>
                                                <td className="py-3 px-4 text-end text-red-700 dark:text-red-400">Rs {mahanaData.totals.udhaar_baqaya.toFixed(2)}</td>
                                                <td className="py-3 px-4 text-end text-gray-700 dark:text-gray-300">Rs {mahanaData.totals.discount.toFixed(2)}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== TAB C: STOCK VALUATION (MALYAAT) ==================== */}
                {activeTab === 'stock' && (
                    <div className="space-y-4">
                        {/* 4 Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                            <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-4.5 shadow-2xs">
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
                                    {isUrdu ? 'کل سبزی جنس:' : 'Kul Sabzi Items:'}
                                </span>
                                <span className="text-2xl font-black text-gray-900 dark:text-white block mt-1.5">
                                    {stockData.items_count} {isUrdu ? 'اجناس' : 'Items'}
                                </span>
                            </div>

                            <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-4.5 shadow-2xs">
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
                                    {isUrdu ? 'خرید مالیت (Cost):' : 'Khareed Malyaat (Cost):'}
                                </span>
                                <span className="text-2xl font-black text-gray-900 dark:text-white block mt-1.5">
                                    Rs {Math.round(stockData.cost_valuation).toLocaleString()}
                                </span>
                            </div>

                            <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-4.5 shadow-2xs">
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
                                    {isUrdu ? 'فروخت مالیت (متوقع):' : 'Farokht Malyaat (Expected):'}
                                </span>
                                <span className="text-2xl font-black text-emerald-800 dark:text-emerald-400 block mt-1.5">
                                    Rs {Math.round(stockData.sale_valuation).toLocaleString()}
                                </span>
                            </div>

                            <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-4.5 shadow-2xs">
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
                                    {isUrdu ? 'متوقع منافع:' : 'Mutawaqqe Munafa:'}
                                </span>
                                <span className="text-2xl font-black text-emerald-900 dark:text-emerald-300 block mt-1.5">
                                    Rs {Math.round(stockData.expected_profit).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* Stock Valuation Table */}
                        <div className="w-full bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl shadow-xs overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-start border-collapse text-xs sm:text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-border bg-emerald-50/40 dark:bg-muted/30">
                                            <th className="py-3 px-4 text-start font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'سبزی کا نام' : 'Sabzi Ka Naam'}</th>
                                            <th className="py-3 px-4 text-center font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'موجودہ اسٹاک' : 'Mojooda Stock'}</th>
                                            <th className="py-3 px-4 text-end font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'خرید ریٹ' : 'Khareed Rate'}</th>
                                            <th className="py-3 px-4 text-end font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'کل خرید لاگت' : 'Kul Khareed Cost'}</th>
                                            <th className="py-3 px-4 text-end font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'فروخت ریٹ' : 'Sale Rate'}</th>
                                            <th className="py-3 px-4 text-end font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'کل فروخت مالیت' : 'Kul Sale Malyaat'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-border">
                                        {stockData.rows.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center text-xs text-gray-400">
                                                    {isUrdu ? 'کوئی اسٹاک ڈیٹا دستیاب نہیں ہے' : 'Koi stock data dastiyab nahi hai'}
                                                </td>
                                            </tr>
                                        ) : (
                                            stockData.rows.map((row) => (
                                                <tr key={row.id} className="hover:bg-gray-50/60 dark:hover:bg-muted/20 transition-colors">
                                                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                                        {row.name}
                                                    </td>
                                                    <td className="py-3 px-4 text-center font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                                                        {row.stock} {row.unit}
                                                    </td>
                                                    <td className="py-3 px-4 text-end text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                        Rs {Math.round(row.cost_rate)}
                                                    </td>
                                                    <td className="py-3 px-4 text-end font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                                                        Rs {Math.round(row.total_cost).toLocaleString()}
                                                    </td>
                                                    <td className="py-3 px-4 text-end text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                        Rs {Math.round(row.sale_rate)}
                                                    </td>
                                                    <td className="py-3 px-4 text-end font-bold text-emerald-800 dark:text-emerald-400 whitespace-nowrap">
                                                        Rs {Math.round(row.total_sale).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {stockData.rows.length > 0 && (
                                        <tfoot>
                                            <tr className="border-t-2 border-gray-200 dark:border-border bg-gray-50 dark:bg-muted/40 font-bold">
                                                <td className="py-3 px-4 text-gray-900 dark:text-white">{isUrdu ? 'کل ٹوٹل' : 'Total'}</td>
                                                <td className="py-3 px-4 text-center text-gray-900 dark:text-white">{stockData.items_count} {isUrdu ? 'اجناس' : 'Items'}</td>
                                                <td className="py-3 px-4 text-end text-gray-400">—</td>
                                                <td className="py-3 px-4 text-end text-gray-900 dark:text-white">Rs {Math.round(stockData.cost_valuation).toLocaleString()}</td>
                                                <td className="py-3 px-4 text-end text-gray-400">—</td>
                                                <td className="py-3 px-4 text-end text-emerald-800 dark:text-emerald-400">Rs {Math.round(stockData.sale_valuation).toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== TAB D: GAHAK BAQAYA (UDHAAR) ==================== */}
                {activeTab === 'gahak' && (
                    <div className="space-y-4">
                        {/* Heading & Kul Baqaya Udhaar Total */}
                        <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                                    {isUrdu ? 'مارکیٹ میں پھنسا کل ادھار (Receivables)' : 'Market Mein Phansa Kul Udhaar (Receivables)'}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {isUrdu ? 'بقایا ادھار والے تمام گاہک اور دکاندار' : 'Baqaya udhaar wale tamam gahak aur dukandar'}
                                </p>
                            </div>
                            <div className="text-start sm:text-end">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">
                                    {isUrdu ? 'کل بقایا ادھار:' : 'Kul Baqaya Udhaar:'}
                                </span>
                                <span className="text-xl sm:text-2xl font-black text-red-700 dark:text-red-400 block mt-0.5 font-mono">
                                    Rs {Math.round(gahakData.total_market_udhaar).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* Gahak Baqaya Table */}
                        <div className="w-full bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl shadow-xs overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-start border-collapse text-xs sm:text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-border bg-emerald-50/40 dark:bg-muted/30">
                                            <th className="py-3 px-4 text-start font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'گاہک کا نام' : 'Gahak Ka Naam'}</th>
                                            <th className="py-3 px-3 text-start font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'فون' : 'Phone'}</th>
                                            <th className="py-3 px-3 text-start font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'علاقہ' : 'Ilaqa'}</th>
                                            <th className="py-3 px-3 text-end font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'کریڈٹ لمٹ' : 'Credit Limit'}</th>
                                            <th className="py-3 px-4 text-end font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'بقایا ادھار (Rs)' : 'Baqaya Udhaar (Rs)'}</th>
                                            <th className="py-3 px-3 text-center font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'آخری سیل' : 'Aakhri Sale'}</th>
                                            <th className="py-3 px-3 text-center font-bold text-gray-700 dark:text-gray-300">{isUrdu ? 'آخری وصولی' : 'Aakhri Wasooli'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-border">
                                        {gahakData.rows.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-12 text-center text-xs text-gray-400">
                                                    {isUrdu ? 'کوئی بقایا ادھار نہیں ہے' : 'Koi baqaya udhaar nahi hai'}
                                                </td>
                                            </tr>
                                        ) : (
                                            gahakData.rows.map((row) => (
                                                <tr key={row.id} className="hover:bg-gray-50/60 dark:hover:bg-muted/20 transition-colors">
                                                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                                        {row.name}
                                                    </td>
                                                    <td className="py-3 px-3 text-gray-600 dark:text-gray-400 font-mono text-xs whitespace-nowrap">
                                                        {row.phone}
                                                    </td>
                                                    <td className="py-3 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                        {row.area}
                                                    </td>
                                                    <td className="py-3 px-3 text-end text-gray-600 dark:text-gray-400 whitespace-nowrap font-mono">
                                                        Rs {Math.round(row.credit_limit).toLocaleString()}
                                                    </td>
                                                    <td className="py-3 px-4 text-end font-black text-red-700 dark:text-red-400 whitespace-nowrap text-sm font-mono">
                                                        Rs {Math.round(row.balance).toLocaleString()}
                                                    </td>
                                                    <td className="py-3 px-3 text-center text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap font-mono">
                                                        {row.last_sale}
                                                    </td>
                                                    <td className="py-3 px-3 text-center text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap font-mono">
                                                        {row.last_wasooli}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {gahakData.rows.length > 0 && (
                                        <tfoot>
                                            <tr className="border-t-2 border-gray-200 dark:border-border bg-gray-50 dark:bg-muted/40 font-bold">
                                                <td colSpan={4} className="py-3 px-4 text-gray-900 dark:text-white text-end">{isUrdu ? 'کل بقایا ادھار:' : 'Kul Baqaya Udhaar:'}</td>
                                                <td className="py-3 px-4 text-end font-black text-red-700 dark:text-red-400 text-sm font-mono">
                                                    Rs {Math.round(gahakData.total_market_udhaar).toLocaleString()}
                                                </td>
                                                <td colSpan={2}></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== TAB E: NAFA-NUQSAN (MUNAFA P&L) ==================== */}
                {activeTab === 'pnl' && (
                    <div className="space-y-4">
                        {/* Tareekh Filter Bar */}
                        <form onSubmit={handleApplyDateFilter} className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-3 flex flex-wrap items-center gap-3 no-print">
                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                <Icon name="Calendar" className="size-4 text-emerald-800" />
                                <span>{isUrdu ? 'تاریخ فلٹر:' : 'Tareekh Filter:'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{isUrdu ? 'شروع:' : 'Shuru:'}</span>
                                <input
                                    type="date"
                                    value={filterFromDate}
                                    onChange={(e) => setFilterFromDate(e.target.value)}
                                    className="h-9 px-3 text-xs border border-gray-300 rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white font-mono"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{isUrdu ? 'آخر:' : 'Aakhir:'}</span>
                                <input
                                    type="date"
                                    value={filterToDate}
                                    onChange={(e) => setFilterToDate(e.target.value)}
                                    className="h-9 px-3 text-xs border border-gray-300 rounded-lg bg-white dark:bg-background text-gray-900 dark:text-white font-mono"
                                />
                            </div>
                            <button
                                type="submit"
                                className="h-9 px-4 rounded-lg bg-[#14532d] hover:bg-[#0f3d21] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                            >
                                {isUrdu ? 'فلٹر لگائیں' : 'Filter Lagayein'}
                            </button>
                        </form>

                        {/* P&L Statement Center Card */}
                        <div className="max-w-3xl mx-auto bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-2xl shadow-xs p-6 sm:p-8 space-y-6">
                            {/* Card Header */}
                            <div className="text-center space-y-1 border-b border-gray-100 dark:border-border pb-5">
                                <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-tight">
                                    Vegetable POS
                                </h3>
                                <p className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300">
                                    {isUrdu ? 'نفع و نقصان اسٹیٹمنٹ (Profit & Loss Statement)' : 'Nafa-Nuqsan Statement (Profit & Loss Statement)'}
                                </p>
                                <p className="text-xs text-gray-400 font-mono mt-0.5">
                                    {isUrdu ? 'مدت: ' : 'Muddad: '}{filterFromDate} {isUrdu ? 'تا' : 'Ta'} {filterToDate}
                                </p>
                            </div>

                            {/* Statement Rows */}
                            <div className="space-y-3.5 text-xs sm:text-sm">
                                {/* Row 1: Kul Farokht */}
                                <div className="flex items-center justify-between py-1">
                                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                                        {isUrdu ? 'کل فروخت (Gross Sales Revenue):' : 'Kul Farokht (Gross Sales Revenue):'}
                                    </span>
                                    <span className="font-black text-gray-900 dark:text-white font-mono">
                                        Rs {formatNum(pnlData.gross_revenue)}
                                    </span>
                                </div>

                                {/* Row 2: Maal Khareed Cost */}
                                <div className="flex items-center justify-between py-1 text-gray-600 dark:text-gray-400">
                                    <span>
                                        {isUrdu ? 'مال خرید لاگت (Purchase Cost of Goods Sold):' : 'Maal Khareed Cost (Purchase Cost of Goods Sold):'}
                                    </span>
                                    <span className="font-semibold text-red-600 dark:text-red-400 font-mono">
                                        - Rs {formatNum(pnlData.cogs)}
                                    </span>
                                </div>

                                {/* Row 3: Kham Munafa */}
                                <div className="flex items-center justify-between py-2 border-y border-gray-100 dark:border-border bg-gray-50/60 dark:bg-muted/20 px-3 rounded-lg">
                                    <span className="font-bold text-gray-900 dark:text-white">
                                        {isUrdu ? 'خام منافع (Gross Profit on Sales):' : 'Kham Munafa (Gross Profit on Sales):'}
                                    </span>
                                    <span className="font-black text-gray-900 dark:text-white text-base font-mono">
                                        Rs {formatNum(pnlData.gross_profit)}
                                    </span>
                                </div>

                                {/* Row 4: Mandi Commission */}
                                <div className="flex items-center justify-between py-1 text-emerald-800 dark:text-emerald-400">
                                    <span className="font-semibold">
                                        {isUrdu ? 'منڈی کمیشن آمدنی (Farmer Commission Earned):' : 'Mandi Commission Aamdani (Farmer Commission Earned):'}
                                    </span>
                                    <span className="font-bold font-mono">
                                        + Rs {formatNum(pnlData.farmer_commission)}
                                    </span>
                                </div>

                                {/* Row 5: Spoilage / Wastage */}
                                <div className="flex items-center justify-between py-1 text-gray-600 dark:text-gray-400">
                                    <span>
                                        {isUrdu ? 'خراب / ضائع سبزی نقصان (Spoilage Loss):' : 'Kharab / Zaya Sabzi Nuqsan (Spoilage Loss):'}
                                    </span>
                                    <span className="font-semibold text-red-600 dark:text-red-400 font-mono">
                                        - Rs {formatNum(pnlData.wastage_loss)}
                                    </span>
                                </div>

                                {/* Row 6: Discounts */}
                                <div className="flex items-center justify-between py-1 text-gray-600 dark:text-gray-400">
                                    <span>
                                        {isUrdu ? 'کل رعایت / Discounts:' : 'Kul Riaayat / Discounts:'}
                                    </span>
                                    <span className="font-semibold text-red-600 dark:text-red-400 font-mono">
                                        - Rs {formatNum(pnlData.total_discounts)}
                                    </span>
                                </div>
                            </div>

                            {/* Highlighted SAAF MUNAFA Box */}
                            <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <h4 className="text-sm font-black text-emerald-950 dark:text-emerald-200 tracking-wide uppercase">
                                        {isUrdu ? 'صاف منافع (NET PROFIT):' : 'SAAF MUNAFA (NET PROFIT):'}
                                    </h4>
                                    <p className="text-xs text-emerald-800/80 dark:text-emerald-400 mt-0.5">
                                        {isUrdu ? 'تمام آمدنی اور نقصانات کے بعد' : 'Tamam aamdani aur nuqsanat ke baad'}
                                    </p>
                                </div>
                                <div className="text-start sm:text-end">
                                    <span className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-300 font-mono">
                                        Rs {formatNum(pnlData.net_profit)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== 4. BAQI REPORTS ACCORDION ==================== */}
                <div className="pt-6 border-t border-gray-200 dark:border-border space-y-3 no-print">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                {isUrdu ? 'باقی رپورٹس (گاہک، کسان اور لیجر دستاویزی)' : 'Baqi Reports (Merchants, Farmers & Ledger Documents)'}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {isUrdu ? 'روزنامچہ، پرچی، امروزہ اور کھاتہ کے الگ الگ پرنٹس' : 'Roznamcha, Parchi, Amroza, aur Khata ke alag alag prints'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowBaqiReports(!showBaqiReports)}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:hover:bg-muted cursor-pointer transition-colors"
                        >
                            {showBaqiReports ? (isUrdu ? 'چھپائیں' : 'Chhupayein') : (isUrdu ? 'دکھائیں' : 'Dikhayein')}
                        </button>
                    </div>

                    {showBaqiReports && (
                        <div className="bg-white dark:bg-card border border-gray-200/90 dark:border-border rounded-xl p-4 space-y-4 animate-in fade-in duration-200">
                            {/* Category switcher */}
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                                {legacyCategories.map(cat => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setActiveLegacyCategory(cat.id)}
                                        className={cn(
                                            "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                            activeLegacyCategory === cat.id
                                                ? "bg-[#14532d] text-white"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        )}
                                    >
                                        {cat.name} ({cat.reports.length})
                                    </button>
                                ))}
                            </div>

                            {/* Reports list */}
                            <div className="space-y-2">
                                {selectedLegacyCat.reports.map(rep => (
                                    <div
                                        key={rep.id}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-emerald-100 hover:bg-emerald-50/20 transition-all gap-2"
                                    >
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                                                {rep.title}
                                            </h4>
                                            <p className="text-[11px] text-gray-500">
                                                {rep.desc}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 self-start sm:self-auto">
                                            <button
                                                type="button"
                                                onClick={() => handleLegacyPreview(rep)}
                                                className="px-2.5 py-1 rounded text-[11px] font-semibold border border-gray-300 hover:bg-gray-50 cursor-pointer"
                                            >
                                                {isUrdu ? 'پریویو' : 'Preview'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleLegacyExcel(rep)}
                                                className="px-2.5 py-1 rounded text-[11px] font-semibold border border-gray-300 hover:bg-gray-50 cursor-pointer"
                                            >
                                                Excel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleLegacyPreview(rep)}
                                                className="px-2.5 py-1 rounded text-[11px] font-semibold border border-gray-300 hover:bg-gray-50 cursor-pointer"
                                            >
                                                PDF
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ==================== 5. PRINT DOCUMENT (ONLY VISIBLE ON PRINT) ==================== */}
                <div className="hidden print:block print-document text-black bg-white p-6">
                    {/* Print Letterhead */}
                    <div className="text-center pb-4 mb-4 border-b-2 border-black">
                        <h1 className="text-2xl font-black tracking-tight uppercase">
                            VEGETABLE POS
                        </h1>
                        <p className="text-sm font-bold mt-1">
                            {activeTab === 'rozana' && 'Rozana Sale Report'}
                            {activeTab === 'mahana' && `Mahana Farokht Summary (${selectedYear})`}
                            {activeTab === 'stock' && 'Stock Valuation Report (Malyaat)'}
                            {activeTab === 'gahak' && 'Market Gahak Baqaya (Udhaar) Report'}
                            {activeTab === 'pnl' && 'Nafa-Nuqsan Statement (Profit & Loss)'}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                            {(activeTab === 'rozana' || activeTab === 'pnl') && `Tareekh: ${filterFromDate} Ta ${filterToDate}`}
                            {activeTab === 'mahana' && `Saal: ${selectedYear}`}
                            {(activeTab === 'stock' || activeTab === 'gahak') && `Tareekh: ${new Date().toISOString().split('T')[0]}`}
                        </p>
                    </div>

                    {/* Print Tab Contents */}
                    {activeTab === 'rozana' && (
                        <div>
                            <table className="w-full text-xs border border-gray-400 border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 border-b border-gray-400">
                                        <th className="p-2 text-start border border-gray-300 font-bold">Bill #</th>
                                        <th className="p-2 text-start border border-gray-300 font-bold">Gahak Ka Naam</th>
                                        <th className="p-2 text-start border border-gray-300 font-bold">Tareekh</th>
                                        <th className="p-2 text-start border border-gray-300 font-bold">Items</th>
                                        <th className="p-2 text-end border border-gray-300 font-bold">Kul Bill</th>
                                        <th className="p-2 text-end border border-gray-300 font-bold">Naqad Ada</th>
                                        <th className="p-2 text-end border border-gray-300 font-bold">Udhaar Baqaya</th>
                                        <th className="p-2 text-center border border-gray-300 font-bold">Tariqa</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rozanaData.rows.length === 0 ? (
                                        <tr><td colSpan={8} className="p-4 text-center">Is tareekh ka koi record nahi</td></tr>
                                    ) : (
                                        rozanaData.rows.map(r => (
                                            <tr key={r.id} className="border-b border-gray-300">
                                                <td className="p-2 border border-gray-300 font-bold">{r.bill_no}</td>
                                                <td className="p-2 border border-gray-300">{r.customer_name}</td>
                                                <td className="p-2 border border-gray-300">{r.date}</td>
                                                <td className="p-2 border border-gray-300">{r.item_count}</td>
                                                <td className="p-2 border border-gray-300 text-end font-bold">Rs {r.gross_amount.toFixed(2)}</td>
                                                <td className="p-2 border border-gray-300 text-end">Rs {r.cash_paid.toFixed(2)}</td>
                                                <td className="p-2 border border-gray-300 text-end font-bold">Rs {r.udhaar_baqaya.toFixed(2)}</td>
                                                <td className="p-2 border border-gray-300 text-center">{r.payment_type}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-100 font-bold border-t border-gray-400">
                                        <td colSpan={4} className="p-2 border border-gray-300 text-end">Total ({rozanaData.bills_count} Bills):</td>
                                        <td className="p-2 border border-gray-300 text-end">Rs {rozanaData.total_gross.toFixed(2)}</td>
                                        <td className="p-2 border border-gray-300 text-end">Rs {rozanaData.total_cash.toFixed(2)}</td>
                                        <td className="p-2 border border-gray-300 text-end">Rs {rozanaData.total_udhaar.toFixed(2)}</td>
                                        <td className="p-2 border border-gray-300"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {activeTab === 'mahana' && (
                        <div>
                            <table className="w-full text-xs border border-gray-400 border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 border-b border-gray-400">
                                        <th className="p-2 text-start border border-gray-300 font-bold">Mahina (Month)</th>
                                        <th className="p-2 text-center border border-gray-300 font-bold">Kul Bills</th>
                                        <th className="p-2 text-end border border-gray-300 font-bold">Kul Sale (Rs)</th>
                                        <th className="p-2 text-end border border-gray-300 font-bold">Naqad Wasooli (Rs)</th>
                                        <th className="p-2 text-end border border-gray-300 font-bold">Udhaar Baqaya (Rs)</th>
                                        <th className="p-2 text-end border border-gray-300 font-bold">Riaayat / Discount (Rs)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mahanaData.rows.length === 0 ? (
                                        <tr><td colSpan={6} className="p-4 text-center">Is saal ka koi record nahi</td></tr>
                                    ) : (
                                        mahanaData.rows.map(r => (
                                            <tr key={r.month} className="border-b border-gray-300">
                                                <td className="p-2 border border-gray-300 font-bold">{r.month}</td>
                                                <td className="p-2 border border-gray-300 text-center">{r.bills_count}</td>
                                                <td className="p-2 border border-gray-300 text-end font-bold">Rs {r.total_sale.toFixed(2)}</td>
                                                <td className="p-2 border border-gray-300 text-end">Rs {r.cash_wasooli.toFixed(2)}</td>
                                                <td className="p-2 border border-gray-300 text-end font-bold">Rs {r.udhaar_baqaya.toFixed(2)}</td>
                                                <td className="p-2 border border-gray-300 text-end">Rs {r.discount.toFixed(2)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-100 font-bold border-t border-gray-400">
                                        <td className="p-2 border border-gray-300">Total</td>
                                        <td className="p-2 border border-gray-300 text-center">{mahanaData.totals.bills_count}</td>
                                        <td className="p-2 border border-gray-300 text-end">Rs {mahanaData.totals.total_sale.toFixed(2)}</td>
                                        <td className="p-2 border border-gray-300 text-end">Rs {mahanaData.totals.cash_wasooli.toFixed(2)}</td>
                                        <td className="p-2 border border-gray-300 text-end">Rs {mahanaData.totals.udhaar_baqaya.toFixed(2)}</td>
                                        <td className="p-2 border border-gray-300 text-end">Rs {mahanaData.totals.discount.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {activeTab === 'stock' && (
                        <div>
                            <table className="w-full text-xs border border-gray-400 border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 border-b border-gray-400">
                                        <th className="p-2 text-start border border-gray-300 font-bold">Sabzi Ka Naam</th>
                                        <th className="p-2 text-center border border-gray-300 font-bold">Mojooda Stock</th>
                                        <th className="p-2 text-end border border-gray-300 font-bold">Khareed Rate</th>
                                        <th className="p-2 text-end border border-gray-300 font-bold">Kul Khareed Cost</th>
                                        <th className="p-2 text-end border border-gray-300 font-bold">Sale Rate</th>
                                        <th className="p-2 text-end border border-gray-300 font-bold">Kul Sale Malyaat</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stockData.rows.length === 0 ? (
                                        <tr><td colSpan={6} className="p-4 text-center">Koi stock record nahi</td></tr>
                                    ) : (
                                        stockData.rows.map(r => (
                                            <tr key={r.id} className="border-b border-gray-300">
                                                <td className="p-2 border border-gray-300 font-bold">{r.name}</td>
                                                <td className="p-2 border border-gray-300 text-center">{r.stock} {r.unit}</td>
                                                <td className="p-2 border border-gray-300 text-end">Rs {Math.round(r.cost_rate)}</td>
                                                <td className="p-2 border border-gray-300 text-end">Rs {Math.round(r.total_cost).toLocaleString()}</td>
                                                <td className="p-2 border border-gray-300 text-end">Rs {Math.round(r.sale_rate)}</td>
                                                <td className="p-2 border border-gray-300 text-end font-bold">Rs {Math.round(r.total_sale).toLocaleString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-100 font-bold border-t border-gray-400">
                                        <td className="p-2 border border-gray-300">Total ({stockData.items_count} Items)</td>
                                        <td className="p-2 border border-gray-300 text-center">—</td>
                                        <td className="p-2 border border-gray-300 text-end">—</td>
                                        <td className="p-2 border border-gray-300 text-end">Rs {Math.round(stockData.cost_valuation).toLocaleString()}</td>
                                        <td className="p-2 border border-gray-300 text-end">—</td>
                                        <td className="p-2 border border-gray-300 text-end">Rs {Math.round(stockData.sale_valuation).toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {activeTab === 'gahak' && (
                        <div>
                            <table className="w-full text-xs border border-gray-400 border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 border-b border-gray-400">
                                        <th className="p-2 text-start border border-gray-300 font-bold">Gahak Ka Naam</th>
                                        <th className="p-2 text-start border border-gray-300 font-bold">Phone</th>
                                        <th className="p-2 text-start border border-gray-300 font-bold">Ilaqa</th>
                                        <th className="p-2 text-end border border-gray-300 font-bold">Credit Limit</th>
                                        <th className="p-2 text-end border border-gray-300 font-bold">Baqaya Udhaar</th>
                                        <th className="p-2 text-center border border-gray-300 font-bold">Aakhri Sale</th>
                                        <th className="p-2 text-center border border-gray-300 font-bold">Aakhri Wasooli</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gahakData.rows.length === 0 ? (
                                        <tr><td colSpan={7} className="p-4 text-center">Koi baqaya udhaar nahi hai</td></tr>
                                    ) : (
                                        gahakData.rows.map(r => (
                                            <tr key={r.id} className="border-b border-gray-300">
                                                <td className="p-2 border border-gray-300 font-bold">{r.name}</td>
                                                <td className="p-2 border border-gray-300">{r.phone}</td>
                                                <td className="p-2 border border-gray-300">{r.area}</td>
                                                <td className="p-2 border border-gray-300 text-end">Rs {Math.round(r.credit_limit).toLocaleString()}</td>
                                                <td className="p-2 border border-gray-300 text-end font-bold">Rs {Math.round(r.balance).toLocaleString()}</td>
                                                <td className="p-2 border border-gray-300 text-center">{r.last_sale}</td>
                                                <td className="p-2 border border-gray-300 text-center">{r.last_wasooli}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-100 font-bold border-t border-gray-400">
                                        <td colSpan={4} className="p-2 border border-gray-300 text-end">Kul Baqaya Udhaar:</td>
                                        <td className="p-2 border border-gray-300 text-end font-bold">Rs {Math.round(gahakData.total_market_udhaar).toLocaleString()}</td>
                                        <td colSpan={2} className="p-2 border border-gray-300"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {activeTab === 'pnl' && (
                        <div className="border border-gray-400 p-4 space-y-3">
                            <div className="flex justify-between py-1 border-b border-gray-200">
                                <span>Kul Farokht (Gross Sales Revenue):</span>
                                <span className="font-bold">Rs {formatNum(pnlData.gross_revenue)}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-200">
                                <span>Maal Khareed Cost (Purchase Cost of Goods Sold):</span>
                                <span className="font-bold">- Rs {formatNum(pnlData.cogs)}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-200 bg-gray-100 p-1 font-bold">
                                <span>Kham Munafa (Gross Profit on Sales):</span>
                                <span>Rs {formatNum(pnlData.gross_profit)}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-200">
                                <span>Mandi Commission Aamdani (Farmer Commission Earned):</span>
                                <span className="font-bold">+ Rs {formatNum(pnlData.farmer_commission)}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-200">
                                <span>Kharab / Zaya Sabzi Nuqsan (Spoilage Loss):</span>
                                <span className="font-bold">- Rs {formatNum(pnlData.wastage_loss)}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-200">
                                <span>Kul Riaayat / Discounts:</span>
                                <span className="font-bold">- Rs {formatNum(pnlData.total_discounts)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-2 border-black p-2 bg-gray-100 font-black text-sm">
                                <span>SAAF MUNAFA (NET PROFIT):</span>
                                <span>Rs {formatNum(pnlData.net_profit)}</span>
                            </div>
                        </div>
                    )}

                    {/* Print Footer */}
                    <div className="mt-8 pt-4 border-t border-gray-400 flex items-center justify-between text-[11px] text-gray-500">
                        <span>Print Tareekh: {new Date().toLocaleString('en-US')}</span>
                        <span>Sabzi Mandi POS</span>
                    </div>
                </div>
                </div>

                {/* Legacy Report Preview Modal */}
                <Dialog open={legacyModalOpen} onOpenChange={setLegacyModalOpen}>
                    <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-base font-bold text-gray-900 dark:text-white">
                                {legacyReportData?.title || 'Report Preview'}
                            </DialogTitle>
                        </DialogHeader>
                        {legacyLoading ? (
                            <div className="py-12 text-center text-xs text-gray-500">{isUrdu ? 'لوڈ ہو رہا ہے...' : 'Loading...'}</div>
                        ) : legacyReportData ? (
                            <div className="space-y-4">
                                <div className="text-xs text-gray-500">
                                    {isUrdu ? 'تاریخ: ' : 'Tareekh: '}{legacyReportData.from_date || legacyReportData.date}
                                </div>
                                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                {legacyReportData.columns.map((col, idx) => (
                                                    <th key={idx} className="p-2.5 text-start font-bold text-gray-700">{col}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {legacyReportData.rows.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    {Object.values(row).map((val: any, cIdx) => (
                                                        <td key={cIdx} className="p-2.5">{val}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : null}
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
