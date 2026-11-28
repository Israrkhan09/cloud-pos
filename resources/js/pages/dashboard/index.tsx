import React, { useState, useEffect } from 'react';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { getStoredBankAccounts } from '@/lib/banking-store';

interface DashboardStatsData {
    todaysSale: number;
    saleChangePct: number;
    cashSale: number;
    creditSale: number;
    cashReceived: number;
    cashPct: number;
    received: number;
    wasooliCount?: number;
    recoveryMerchantsCount: number;
    merchantsBalance: number;
    farmersBalance: number;
    cashGalla?: number;
    bankBalance?: number;
    totalCashAndBank?: number;
    lowStockCount?: number;
    cashInHand: number;
    expectedCash: number;
    cashDiff: number;
    billsToday: number;
    totalNagSold: number;
    weekChange: number;
}

interface ChartDay {
    day: string;
    date?: string;
    fullDate?: string;
    sale?: number;
    wasooli?: number;
    val?: number;
    amount: number;
    isToday: boolean;
    heightPct?: number;
}

interface ChartSummary {
    total: number;
    average: number;
    bestDay: string;
}

interface TopItemPoint {
    name_en: string;
    name_ur: string;
    name?: string;
    amount: number;
    nag: number;
}

interface RecentEntry {
    id?: number;
    time: string;
    type: string;
    isCash: boolean;
    party: string;
    item: string;
    nag: number | string;
    amount: number;
}

export default function Dashboard() {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';
    const pageProps = usePage().props as any;
    const isTestBiz = pageProps.business?.id === 'biz-test-business';
    const defaultDemoBank = isTestBiz ? 760000 : 0;

    const stats: DashboardStatsData = pageProps.stats || {
        todaysSale: 0,
        saleChangePct: 0,
        cashSale: 0,
        creditSale: 0,
        cashReceived: 0,
        cashPct: 0,
        received: 0,
        wasooliCount: 0,
        recoveryMerchantsCount: 0,
        merchantsBalance: 0,
        farmersBalance: 0,
        cashGalla: 0,
        bankBalance: defaultDemoBank,
        totalCashAndBank: defaultDemoBank,
        lowStockCount: 0,
        cashInHand: 0,
        expectedCash: 0,
        cashDiff: 0,
        billsToday: 0,
        totalNagSold: 0,
        weekChange: 0,
    };

    const chartData: ChartDay[] = pageProps.chartData || [];
    const chartSummary: ChartSummary = pageProps.chartSummary || {
        total: 0,
        average: 0,
        bestDay: '—',
    };

    const topItemsChart: TopItemPoint[] = pageProps.topItemsChart || [];
    const recentSales: RecentEntry[] = pageProps.recentSales || [];

    const activeRange = (pageProps.range || pageProps.activeRange || 'today') as 'today' | 'yesterday' | 'week' | 'month';
    const [range, setRange] = useState<'today' | 'yesterday' | 'week' | 'month'>(activeRange);
    const [bankAccountsTotal, setBankAccountsTotal] = useState<number>(0);

    // Sync client-side bank accounts
    useEffect(() => {
        try {
            const accs = getStoredBankAccounts();
            if (Array.isArray(accs) && accs.length > 0) {
                const total = accs.reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0);
                setBankAccountsTotal(total);
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        if (pageProps.range || pageProps.activeRange) {
            setRange((pageProps.range || pageProps.activeRange) as any);
        }
    }, [pageProps.range, pageProps.activeRange]);

    // Format current date
    const formattedDate = new Intl.DateTimeFormat(isUrdu ? 'ur-PK' : 'en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(new Date());

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: isUrdu ? 'ڈیش بورڈ' : 'Dashboard',
            href: '/dashboard',
        },
    ];

    const handleRangeChange = (r: 'today' | 'yesterday' | 'week' | 'month', label: string) => {
        setRange(r);
        router.get('/dashboard', { range: r }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onSuccess: () => {
                toast.success(isUrdu ? `${label} کا ڈیٹا لوڈ ہو گیا ہے` : `Loaded data for ${label}`);
            },
        });
    };

    const formatRupees = (amount?: number) => {
        return `Rs. ${Number(amount || 0).toLocaleString('en-US')}`;
    };

    const formatNum = (val?: number) => {
        return Number(val || 0).toLocaleString('en-US');
    };

    // Calculate dynamic Card 5: Naqad Galla + Bank
    const cashAmount = stats.cashGalla !== undefined && stats.cashGalla !== null ? stats.cashGalla : (stats.cashInHand || stats.cashSale || 0);
    const bankAmount = bankAccountsTotal > 0 ? bankAccountsTotal : (stats.bankBalance !== undefined ? stats.bankBalance : defaultDemoBank);
    const totalCashAndBank = stats.totalCashAndBank !== undefined && stats.totalCashAndBank !== null ? stats.totalCashAndBank : (cashAmount + bankAmount);

    // Range titles
    const saleCardTitle = range === 'today' 
        ? (isUrdu ? t('dashboard_page.today_sale') : "Today's Total Sales") 
        : (range === 'yesterday' 
            ? (isUrdu ? t('dashboard_page.yesterday_sale') : "Yesterday's Sales") 
            : (range === 'week' 
                ? (isUrdu ? t('dashboard_page.week_sale') : "This Week's Sales") 
                : (isUrdu ? t('dashboard_page.month_sale') : "This Month's Sales")));

    const wasooliCardTitle = range === 'today' 
        ? (isUrdu ? t('dashboard_page.today_wasooli') : 'Today\'s Recovery') 
        : (range === 'yesterday' 
            ? (isUrdu ? t('dashboard_page.yesterday_wasooli') : 'Yesterday\'s Recovery') 
            : (range === 'week' 
                ? (isUrdu ? t('dashboard_page.week_wasooli') : 'This Week\'s Recovery') 
                : (isUrdu ? t('dashboard_page.month_wasooli') : 'This Month\'s Recovery')));

    // Top items max calculation for horizontal bars
    const maxItemAmount = Math.max(...topItemsChart.map(i => i.amount || 0), 1);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'ڈیش بورڈ' : 'Dashboard'} />

            <div className="w-full max-w-[1440px] mx-auto space-y-4 pb-12 font-sans text-[#1a211c] dark:text-[#e7ece8]" dir={isUrdu ? 'rtl' : 'ltr'}>
                
                {/* 1. Header: Title & Existing Filter Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-2">
                    <div>
                        <h1 className={`text-[22px] font-bold tracking-tight text-[#1a211c] dark:text-[#e7ece8] ${isUrdu ? 'font-nastaliq text-2xl' : ''}`}>
                            {isUrdu ? 'ڈیش بورڈ' : 'Dashboard'}
                        </h1>
                        <p className={`text-xs text-[#68736b] dark:text-[#8b968e] mt-0.5 ${isUrdu ? 'font-nastaliq' : ''}`}>
                            {formattedDate}
                        </p>
                    </div>

                    {/* Filter Buttons: Today, Yesterday, This week, This month */}
                    <div className="inline-flex items-center p-0.5 border border-[#e6e9e6] dark:border-[#262d28] rounded-xl bg-white dark:bg-[#161b18] shadow-2xs self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={() => handleRangeChange('today', isUrdu ? 'آج' : 'Today')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                range === 'today'
                                    ? 'bg-[#ecf5ee] dark:bg-[#1b2a20] text-[#166534] dark:text-[#4ade80] shadow-2xs'
                                    : 'text-[#68736b] dark:text-[#8b968e] hover:text-[#1a211c] dark:hover:text-[#e7ece8]'
                            } ${isUrdu ? 'font-nastaliq' : ''}`}
                        >
                            {isUrdu ? 'آج' : 'Today'}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleRangeChange('yesterday', isUrdu ? 'کل' : 'Yesterday')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                range === 'yesterday'
                                    ? 'bg-[#ecf5ee] dark:bg-[#1b2a20] text-[#166534] dark:text-[#4ade80] shadow-2xs'
                                    : 'text-[#68736b] dark:text-[#8b968e] hover:text-[#1a211c] dark:hover:text-[#e7ece8]'
                            } ${isUrdu ? 'font-nastaliq' : ''}`}
                        >
                            {isUrdu ? 'کل' : 'Yesterday'}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleRangeChange('week', isUrdu ? 'ہفتہ' : 'This week')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                range === 'week'
                                    ? 'bg-[#ecf5ee] dark:bg-[#1b2a20] text-[#166534] dark:text-[#4ade80] shadow-2xs'
                                    : 'text-[#68736b] dark:text-[#8b968e] hover:text-[#1a211c] dark:hover:text-[#e7ece8]'
                            } ${isUrdu ? 'font-nastaliq' : ''}`}
                        >
                            {isUrdu ? 'ہفتہ' : 'This week'}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleRangeChange('month', isUrdu ? 'مہینہ' : 'This month')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                range === 'month'
                                    ? 'bg-[#ecf5ee] dark:bg-[#1b2a20] text-[#166534] dark:text-[#4ade80] shadow-2xs'
                                    : 'text-[#68736b] dark:text-[#8b968e] hover:text-[#1a211c] dark:hover:text-[#e7ece8]'
                            } ${isUrdu ? 'font-nastaliq' : ''}`}
                        >
                            {isUrdu ? 'مہینہ' : 'This month'}
                        </button>
                    </div>
                </div>

                {/* 2. STAT CARDS: 6 Cards in Exact Specified Order */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    
                    {/* Card 1: Aaj Ki Kul Sale */}
                    <div className="bg-white dark:bg-[#161b18] border border-[#e6e9e6] dark:border-[#262d28] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:border-emerald-600/40 transition-all">
                        <div>
                            <div className="flex items-center justify-between gap-1.5">
                                <span className="text-xs font-bold text-[#68736b] dark:text-[#8b968e] leading-tight">
                                    {saleCardTitle}
                                </span>
                                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/50">
                                    <Icon name="ShoppingCart" className="size-3.5" weight="bold" />
                                </div>
                            </div>
                            <div className="my-1.5">
                                <span className="text-lg xl:text-xl 2xl:text-[22px] font-black text-[#1a211c] dark:text-[#e7ece8] tracking-tight tabular-nums whitespace-nowrap block">
                                    {formatRupees(stats.todaysSale)}
                                </span>
                            </div>
                        </div>
                        <div className="border-t border-[#f0f2f0] dark:border-[#1e2420] pt-1.5 text-[11px] leading-tight text-[#68736b] dark:text-[#8b968e] flex items-center justify-between gap-1 flex-wrap font-medium">
                            <span>{isUrdu ? 'نقد:' : 'Cash:'} <b className="text-emerald-800 dark:text-emerald-300 font-bold">Rs {formatNum(stats.cashSale)}</b></span>
                            <span>{isUrdu ? 'ادھار:' : 'Credit:'} <b className="text-rose-800 dark:text-rose-300 font-bold">Rs {formatNum(stats.creditSale)}</b></span>
                        </div>
                    </div>

                    {/* Card 2: Aaj Ki Wasooli */}
                    <div className="bg-white dark:bg-[#161b18] border border-[#e6e9e6] dark:border-[#262d28] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:border-emerald-600/40 transition-all">
                        <div>
                            <div className="flex items-center justify-between gap-1.5">
                                <span className="text-xs font-bold text-[#68736b] dark:text-[#8b968e] leading-tight">
                                    {wasooliCardTitle}
                                </span>
                                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/50">
                                    <Icon name="Receipt" className="size-3.5" weight="bold" />
                                </div>
                            </div>
                            <div className="my-1.5">
                                <span className="text-lg xl:text-xl 2xl:text-[22px] font-black text-emerald-800 dark:text-emerald-400 tracking-tight tabular-nums whitespace-nowrap block">
                                    {formatRupees(stats.received)}
                                </span>
                            </div>
                        </div>
                        <div className="border-t border-[#f0f2f0] dark:border-[#1e2420] pt-1.5 text-[11px] leading-tight text-[#68736b] dark:text-[#8b968e] font-medium">
                            {isUrdu ? `کل ${stats.wasooliCount || stats.recoveryMerchantsCount || 0} وصولی پرچیاں` : `Total ${stats.wasooliCount || stats.recoveryMerchantsCount || 0} Recovery Receipts`}
                        </div>
                    </div>

                    {/* Card 3: Gahak Baqaya (Lena) */}
                    <div className="bg-white dark:bg-[#161b18] border border-[#e6e9e6] dark:border-[#262d28] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:border-amber-500/40 transition-all">
                        <div>
                            <div className="flex items-center justify-between gap-1.5">
                                <span className="text-xs font-bold text-[#68736b] dark:text-[#8b968e] leading-tight">
                                    {isUrdu ? t('dashboard_page.customer_due') : 'Customer Balance (Receivable)'}
                                </span>
                                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/50">
                                    <Icon name="ArrowDownLeft" className="size-3.5" weight="bold" />
                                </div>
                            </div>
                            <div className="my-1.5">
                                <span className="text-lg xl:text-xl 2xl:text-[22px] font-black text-amber-900 dark:text-amber-300 tracking-tight tabular-nums whitespace-nowrap block">
                                    {formatRupees(stats.merchantsBalance)}
                                </span>
                            </div>
                        </div>
                        <div className="border-t border-[#f0f2f0] dark:border-[#1e2420] pt-1.5 text-[11px] leading-tight text-[#68736b] dark:text-[#8b968e] font-medium">
                            {isUrdu ? 'مارکیٹ ادھار (وصول طلب)' : 'Customer Credit (Receivable)'}
                        </div>
                    </div>

                    {/* Card 4: Bopari / Kisan Dena */}
                    <div className="bg-white dark:bg-[#161b18] border border-[#e6e9e6] dark:border-[#262d28] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:border-rose-500/40 transition-all">
                        <div>
                            <div className="flex items-center justify-between gap-1.5">
                                <span className="text-xs font-bold text-[#68736b] dark:text-[#8b968e] leading-tight">
                                    {isUrdu ? t('dashboard_page.farmer_due') : 'Farmer Balance (Payable)'}
                                </span>
                                <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200/50">
                                    <Icon name="ArrowUpRight" className="size-3.5" weight="bold" />
                                </div>
                            </div>
                            <div className="my-1.5">
                                <span className="text-lg xl:text-xl 2xl:text-[22px] font-black text-rose-800 dark:text-rose-400 tracking-tight tabular-nums whitespace-nowrap block">
                                    {formatRupees(Math.round(stats.farmersBalance || 0))}
                                </span>
                            </div>
                        </div>
                        <div className="border-t border-[#f0f2f0] dark:border-[#1e2420] pt-1.5 text-[11px] leading-tight text-[#68736b] dark:text-[#8b968e] font-medium">
                            {isUrdu ? 'کل واجبات (ادائیگی)' : 'Total Payables to Farmers'}
                        </div>
                    </div>

                    {/* Card 5: Naqad Galla + Bank */}
                    <div className="bg-white dark:bg-[#161b18] border border-[#e6e9e6] dark:border-[#262d28] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:border-blue-500/40 transition-all">
                        <div>
                            <div className="flex items-center justify-between gap-1.5">
                                <span className="text-xs font-bold text-[#68736b] dark:text-[#8b968e] leading-tight">
                                    {isUrdu ? t('dashboard_page.cash_bank') : 'Cash in Hand + Bank'}
                                </span>
                                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/50">
                                    <Icon name="Bank" className="size-3.5" weight="bold" />
                                </div>
                            </div>
                            <div className="my-1.5">
                                <span className="text-lg xl:text-xl 2xl:text-[22px] font-black text-blue-900 dark:text-blue-300 tracking-tight tabular-nums whitespace-nowrap block">
                                    {formatRupees(totalCashAndBank)}
                                </span>
                            </div>
                        </div>
                        <div className="border-t border-[#f0f2f0] dark:border-[#1e2420] pt-1.5 text-[11px] leading-tight text-[#68736b] dark:text-[#8b968e] font-medium">
                            {isUrdu ? 'نقد گلہ:' : 'Cash in Hand:'} <b className="text-[#1a211c] dark:text-[#e7ece8] font-bold">Rs {formatNum(cashAmount)}</b>
                        </div>
                    </div>

                    {/* Card 6: Kam Stock Alerts */}
                    <div className="bg-white dark:bg-[#161b18] border border-[#e6e9e6] dark:border-[#262d28] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:border-amber-500/40 transition-all">
                        <div>
                            <div className="flex items-center justify-between gap-1.5">
                                <span className="text-xs font-bold text-[#68736b] dark:text-[#8b968e] leading-tight">
                                    {isUrdu ? t('dashboard_page.low_stock') : 'Low Stock Alerts'}
                                </span>
                                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/50">
                                    <Icon name="Warning" className="size-3.5" weight="bold" />
                                </div>
                            </div>
                            <div className="my-1.5">
                                <span className="text-lg xl:text-xl 2xl:text-[22px] font-black text-amber-900 dark:text-amber-400 tracking-tight tabular-nums whitespace-nowrap block">
                                    {stats.lowStockCount ?? 0} {isUrdu ? 'آئٹمز' : 'Items'}
                                </span>
                            </div>
                        </div>
                        <div className="border-t border-[#f0f2f0] dark:border-[#1e2420] pt-1.5 text-[11px] leading-tight text-[#68736b] dark:text-[#8b968e] font-medium">
                            {isUrdu ? 'ختم ہونے والی سبزیاں' : 'Low stock vegetable items'}
                        </div>
                    </div>

                </div>

                {/* 3. CHARTS GRID: 7-Day Trend (Left) + Top Selling Items (Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    
                    {/* Left: Pichle 7 Din Ka Farokht aur Wasooli Trend */}
                    <div className="lg:col-span-8 bg-white dark:bg-[#161b18] border border-[#e6e9e6] dark:border-[#262d28] rounded-2xl p-4 md:p-5 shadow-2xs flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <div>
                                    <h2 className="text-sm md:text-base font-bold text-[#1a211c] dark:text-[#e7ece8]">
                                        {isUrdu ? t('dashboard_page.trend_title') : 'Last 7 Days Sales & Recovery Trend'}
                                    </h2>
                                    <p className="text-xs text-[#68736b] dark:text-[#8b968e]">
                                        {isUrdu ? t('dashboard_page.trend_sub') : 'Daily sales and cash recovery comparison'}
                                    </p>
                                </div>
                                <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 shrink-0">
                                    {isUrdu ? t('dashboard_page.weekly_chart') : 'Weekly Chart'}
                                </span>
                            </div>

                            {/* Dual AreaChart: Kul Sale vs Wasooli */}
                            <div className="h-[280px] w-full pt-2" dir="ltr">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorSale" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#15803d" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#15803d" stopOpacity={0.02} />
                                            </linearGradient>
                                            <linearGradient id="colorWasooli" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#0284c7" stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6e9e6" />
                                        <XAxis
                                            dataKey="date"
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{ fontSize: 11, fill: '#68736b' }}
                                        />
                                        <YAxis
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{ fontSize: 10, fill: '#68736b' }}
                                            tickFormatter={(val) => (val >= 1000 ? `Rs ${(val / 1000).toFixed(0)}k` : `Rs ${val}`)}
                                        />
                                        <Tooltip
                                            formatter={(value: any, name: any) => [
                                                formatRupees(Number(value)),
                                                name === 'sale' 
                                                    ? (isUrdu ? 'کل فروخت (بکری)' : 'Total Sales') 
                                                    : (isUrdu ? 'وصولی (ریکوری)' : 'Recovery'),
                                            ]}
                                            contentStyle={{
                                                backgroundColor: '#18181b',
                                                borderRadius: '8px',
                                                color: '#ffffff',
                                                fontSize: '12px',
                                                border: 'none',
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="sale"
                                            stroke="#15803d"
                                            strokeWidth={2.5}
                                            fillOpacity={1}
                                            fill="url(#colorSale)"
                                            name="sale"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="wasooli"
                                            stroke="#0284c7"
                                            strokeWidth={2.5}
                                            fillOpacity={1}
                                            fill="url(#colorWasooli)"
                                            name="wasooli"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex items-center justify-center gap-6 text-xs text-[#68736b] dark:text-[#8b968e] mt-4 pt-3 border-t border-[#f0f2f0] dark:border-[#1e2420]">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-[#15803d]"></span>
                                <span className="font-bold text-[#1a211c] dark:text-[#e7ece8]">
                                    {isUrdu ? 'کل فروخت (بکری)' : 'Total Sales'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-[#0284c7]"></span>
                                <span className="font-bold text-[#1a211c] dark:text-[#e7ece8]">
                                    {isUrdu ? 'وصولی (ریکوری)' : 'Recovery'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Top Farokht Shuda Sabzian */}
                    <div className="lg:col-span-4 bg-white dark:bg-[#161b18] border border-[#e6e9e6] dark:border-[#262d28] rounded-2xl p-4 md:p-5 shadow-2xs flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <div>
                                    <h2 className="text-sm md:text-base font-bold text-[#1a211c] dark:text-[#e7ece8]">
                                        {isUrdu ? t('dashboard_page.top_items_title') : 'Top Selling Items'}
                                    </h2>
                                    <p className="text-xs text-[#68736b] dark:text-[#8b968e]">
                                        {isUrdu ? t('dashboard_page.top_items_sub') : 'Top revenue generating vegetable produce'}
                                    </p>
                                </div>
                                <Icon name="Sparkle" className="size-4 text-emerald-700" weight="bold" />
                            </div>

                            {/* Horizontal items ranking bars */}
                            <div className="space-y-3 pt-2">
                                {topItemsChart.length === 0 ? (
                                    <div className="py-12 text-center text-xs text-gray-400 font-medium">
                                        {isUrdu ? 'کوئی فروخت کا ریکارڈ نہیں ملا' : 'No sales records found'}
                                    </div>
                                ) : (
                                    topItemsChart.map((it, idx) => {
                                        const pct = Math.min(100, Math.max(12, Math.round((it.amount / maxItemAmount) * 100)));
                                        const displayName = isUrdu ? (it.name_ur || it.name_en || it.name) : (it.name_en || it.name_ur || it.name);
                                        return (
                                            <div key={idx} className="space-y-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-bold text-[#1a211c] dark:text-[#e7ece8] truncate">
                                                        {displayName}
                                                    </span>
                                                    <span className="font-extrabold text-[#1a211c] dark:text-[#e7ece8] tabular-nums">
                                                        Rs {formatNum(it.amount)}
                                                    </span>
                                                </div>
                                                <div className="h-4 rounded-md bg-[#f0f2f0] dark:bg-[#1e2420] overflow-hidden flex items-center">
                                                    <div
                                                        style={{ width: `${pct}%` }}
                                                        className="h-full bg-emerald-700 hover:bg-emerald-800 transition-all rounded-md flex items-center justify-end px-1.5"
                                                    >
                                                        {it.nag > 0 && (
                                                            <span className="text-[9px] font-bold text-white tracking-tight">
                                                                {it.nag}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Bottom note */}
                        <div className="border-t border-[#f0f2f0] dark:border-[#1e2420] pt-3 mt-4 flex items-center justify-between text-xs text-[#68736b]">
                            <span>{isUrdu ? 'کل 5 ٹاپ سبزیاں' : 'Top 5 Selling Items'}</span>
                            <Link href="/reports" className="font-bold text-emerald-800 hover:underline">
                                {isUrdu ? 'رپورٹ دیکھیں ←' : 'View Reports →'}
                            </Link>
                        </div>
                    </div>

                </div>

                {/* 4. Bottom Table: Recent Entries */}
                <div className="bg-white dark:bg-[#161b18] border border-[#e6e9e6] dark:border-[#262d28] rounded-2xl p-4 md:p-5 shadow-2xs">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-sm md:text-base font-bold text-[#1a211c] dark:text-[#e7ece8]">
                                {isUrdu ? t('dashboard_page.recent_entries_title') : 'Recent Entries'}
                            </h2>
                            <p className="text-xs text-[#68736b] dark:text-[#8b968e]">
                                {isUrdu ? t('dashboard_page.recent_entries_sub') : "Today's latest sales and payment recoveries"}
                            </p>
                        </div>
                        <Link
                            href="/amroza-detail"
                            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 transition-colors"
                        >
                            {isUrdu ? t('dashboard_page.view_all') : 'View All →'}
                        </Link>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-start">
                            <thead>
                                <tr className="border-b border-[#e6e9e6] dark:border-[#262d28] text-[#68736b] dark:text-[#8b968e]">
                                    <th className="py-2.5 px-3 text-start font-bold">{isUrdu ? t('dashboard_page.th_time') : 'Time'}</th>
                                    <th className="py-2.5 px-3 text-start font-bold">{isUrdu ? t('dashboard_page.th_type') : 'Type'}</th>
                                    <th className="py-2.5 px-3 text-start font-bold">{isUrdu ? t('dashboard_page.th_party') : 'Customer / Farmer'}</th>
                                    <th className="py-2.5 px-3 text-start font-bold">{isUrdu ? t('dashboard_page.th_item') : 'Item'}</th>
                                    <th className="py-2.5 px-3 text-end font-bold">{isUrdu ? t('dashboard_page.th_nag') : 'Units'}</th>
                                    <th className="py-2.5 px-3 text-end font-bold">{isUrdu ? t('dashboard_page.th_amount') : 'Amount'}</th>
                                </tr>
                            </thead>
                            <tbody className="tabular-nums divide-y divide-gray-100 dark:divide-zinc-800/60">
                                {recentSales.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-gray-400 font-medium">
                                            {isUrdu ? 'اس دورانیے میں کوئی حالیہ اندراج نہیں ہے' : 'No recent entries for this range'}
                                        </td>
                                    </tr>
                                ) : (
                                    recentSales.map((entry, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/70 dark:hover:bg-[#1e2420]/60 transition-colors">
                                            <td className="py-2.5 px-3 text-[#68736b] dark:text-[#8b968e] font-medium">
                                                {entry.time}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                                    entry.isCash
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                                                        : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300'
                                                }`}>
                                                    {entry.type}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 font-bold text-[#1a211c] dark:text-[#e7ece8]">
                                                {entry.party}
                                            </td>
                                            <td className="py-2.5 px-3 text-[#1a211c] dark:text-[#e7ece8]">
                                                {entry.item}
                                            </td>
                                            <td className="py-2.5 px-3 text-end font-medium text-[#1a211c] dark:text-[#e7ece8]">
                                                {entry.nag}
                                            </td>
                                            <td className="py-2.5 px-3 text-end font-bold text-[#1a211c] dark:text-[#e7ece8]">
                                                {entry.amount ? formatRupees(entry.amount) : '—'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </AppLayout>
    );
}
