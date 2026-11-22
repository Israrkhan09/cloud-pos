import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import InvestmentHeader from '@/components/investment/investment-header';
import EntryDrawer from '@/components/investment/entry-drawer';
import BreakdownModal, { BreakdownData } from '@/components/investment/breakdown-modal';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';

interface PartnerRow {
    id: number;
    name: string;
    name_ur?: string;
    role: string;
    profit_percentage: number;
    opening: number;
    cap_in: number;
    drawings: number;
    pending_drawings: number;
    pending_cap_in: number;
    net_equity: number;
    available_equity: number;
    draw_preview: number;
    status: string;
    phone?: string;
}

interface OwnerData {
    name: string;
    name_ur?: string;
    ownership_percentage: number;
    profit_share: number;
    status: string;
    phone?: string;
}

interface AlertItem {
    id: number;
    partner_name: string;
    attempted_amount: number;
    excess_amount: number;
    notes?: string;
}

interface Props {
    userName?: string;
    isOwner?: boolean;
    currentRole: 'munshi' | 'owner';
    pendingApprovalsCount?: number;
    lastUpdated?: string;
    partnersList: any[];
    loansList: any[];
    surplusList: any[];
    bankAccounts: string[];
    aajKaKhulasa: {
        dena_hai: number;
        lena_hai: number;
        overdue_loans_count: number;
        matured_surplus_count: number;
    };
    dueCalendar: Array<{
        type: string;
        title: string;
        due_date: string;
        amount: number;
        status: string;
        party: string;
        direction: string;
    }>;
    profitPool: {
        total_pool: number;
        owner_share: number;
        owner_percentage: number;
        owner_name: string;
        partners: Array<{
            name: string;
            role: string;
            percentage: number;
            amount: number;
        }>;
    };
    summary: {
        net_capital: number;
        short_term_loans: number;
        principal_loans: number;
        loan_fees: number;
        active_surplus: number;
        surplus_gain: number;
        partners_profit_share: number;
        profit_pool_base: number;
        pending_approvals: number;
    };
    owner: OwnerData;
    partners: PartnerRow[];
    alerts: AlertItem[];
    breakdowns: Record<string, BreakdownData>;
}

export default function InvestmentPartnersPage({
    userName,
    pendingApprovalsCount = 0,
    lastUpdated,
    partnersList,
    loansList,
    surplusList,
    bankAccounts,
    aajKaKhulasa,
    dueCalendar,
    profitPool,
    summary,
    owner,
    partners,
    alerts,
    breakdowns,
}: Props) {
    const { i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [isEntryDrawerOpen, setIsEntryDrawerOpen] = useState(false);
    const [activeBreakdown, setActiveBreakdown] = useState<BreakdownData | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'انویسٹمنٹ' : 'Investment', href: '/investment/partners' },
        { title: isUrdu ? 'پارٹنرز اور ایکویٹی' : 'Partners & Equity', href: '/investment/partners' },
    ];

    const formatRs = (val: number) => 'Rs. ' + Number(val || 0).toLocaleString('en-US');
    const formatNum = (val: number) => Number(val || 0).toLocaleString('en-US');

    // Export CSV functionality
    const handleExportCSV = () => {
        const headers = ['Partner Name', 'Profit %', 'Opening', 'Cap In', 'Approved Drawings', 'Pending Drawings', 'Net Equity', 'Available Equity', 'Status'];
        const rows = partners.map(p => [
            `"${p.name}"`,
            `${p.profit_percentage}%`,
            p.opening,
            p.cap_in,
            p.drawings,
            p.pending_drawings,
            p.net_equity,
            p.available_equity,
            `"${p.status}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Partners_Equity_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'پارٹنرز اور ایکویٹی - انویسٹمنٹ' : 'Partners & Equity - Investment'} />

            <div className="-mt-4 -mx-4 -mb-8 pb-28 bg-[#f4f6f4] min-h-screen font-sans text-[#1a211c]">
                {/* Module Header Bar (No page search bar, no role switcher) */}
                <InvestmentHeader
                    currentTab="partners"
                    userName={userName}
                    pendingApprovalsCount={pendingApprovalsCount}
                    lastUpdated={lastUpdated}
                    onOpenEntry={() => setIsEntryDrawerOpen(true)}
                    isUrdu={isUrdu}
                />

                <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
                    {/* Section E.1: Aaj Ka Khulasa (Today's Executive Summary) */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-4 md:p-5">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                            <div className="flex items-center gap-2">
                                <Icon name="CalendarBlank" className="size-5 text-[#14532d]" />
                                <h3 className="text-xs md:text-sm font-bold text-gray-900 uppercase tracking-wide">
                                    {isUrdu ? 'آج کا خلاصہ (کاروباری پوزیشن)' : 'Aaj Ka Khulasa (Karobari Position)'}
                                </h3>
                            </div>
                            <span className="text-[11px] font-semibold text-gray-500">22 Nov 2026</span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                                <span className="text-gray-500 block text-[11px] font-medium">Kul Dena Hai (Payable Loans):</span>
                                <span className="text-base md:text-lg font-black text-red-600 block mt-1">
                                    {formatRs(aajKaKhulasa.dena_hai)}
                                </span>
                                <span className="text-[10px] text-gray-500">3 Mandi Short-Term Qarze</span>
                            </div>

                            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                                <span className="text-gray-500 block text-[11px] font-medium">Kul Lena Hai (Surplus Wapsi):</span>
                                <span className="text-base md:text-lg font-black text-[#14532d] block mt-1">
                                    {formatRs(aajKaKhulasa.lena_hai)}
                                </span>
                                <span className="text-[10px] text-gray-500">Active Funds (Asal + Kaghzi)</span>
                            </div>

                            <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200">
                                <span className="text-amber-800 block text-[11px] font-medium">Overdue Qarza Alert:</span>
                                <span className="text-base md:text-lg font-black text-amber-900 block mt-1">
                                    {aajKaKhulasa.overdue_loans_count} Qarza Overdue
                                </span>
                                <span className="text-[10px] text-amber-700">Sohail (2 din overdue)</span>
                            </div>

                            <div className="p-3 rounded-lg bg-rose-50/70 border border-rose-200">
                                <span className="text-rose-800 block text-[11px] font-medium">Matured Fund Alert:</span>
                                <span className="text-base md:text-lg font-black text-rose-900 block mt-1">
                                    1 Fund 38 Din Se Overdue
                                </span>
                                <span className="text-[10px] text-rose-700">Gold Savings (Rs. 124,200)</span>
                            </div>
                        </div>
                    </div>

                    {/* Section B.1, B.9 & F.2: Summary Cards with Clickable Breakdown Modals */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5">
                        {/* 1. Net Capital / Equity */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.net_capital)}
                            className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs hover:border-[#14532d] transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                    {isUrdu ? 'نیٹ کیپیٹل / ایکویٹی' : 'Kul Sarmaya / Net Equity'}
                                </span>
                                <Icon name="Info" className="size-3.5 text-gray-400 group-hover:text-[#14532d]" />
                            </div>
                            <div className="mt-2">
                                <span className="text-lg md:text-xl font-black text-[#14532d] block">
                                    {formatRs(summary.net_capital)}
                                </span>
                                <span className="text-[10px] text-gray-500 block mt-0.5">2 Partners Approved Equity</span>
                            </div>
                        </div>

                        {/* 2. Short-Term Loans Payable (Reconciled naming Section B.9) */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.loans_payable)}
                            className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs hover:border-red-400 transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                    {isUrdu ? 'کل بقایا قرضہ (فیس سمیت)' : 'Baqaya Qarza (Fee Samet)'}
                                </span>
                                <Icon name="Info" className="size-3.5 text-gray-400 group-hover:text-red-600" />
                            </div>
                            <div className="mt-2">
                                <span className="text-lg md:text-xl font-black text-gray-900 block">
                                    {formatRs(summary.short_term_loans)}
                                </span>
                                <span className="text-[10px] text-gray-500 block mt-0.5">
                                    Asal {formatRs(summary.principal_loans)} + Fee {formatRs(summary.loan_fees)}
                                </span>
                            </div>
                        </div>

                        {/* 3. Active Surplus */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.active_surplus)}
                            className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs hover:border-gray-400 transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                    {isUrdu ? 'ایکٹیو سرپلس' : 'Active Surplus (Faltu Paisa)'}
                                </span>
                                <Icon name="Info" className="size-3.5 text-gray-400 group-hover:text-gray-700" />
                            </div>
                            <div className="mt-2">
                                <span className="text-lg md:text-xl font-black text-gray-900 block">
                                    {formatRs(summary.active_surplus)}
                                </span>
                                <span className="text-[10px] text-gray-500 block mt-0.5">2 Chalu Funds</span>
                            </div>
                        </div>

                        {/* 4. Surplus Se Nafa (Separated Card Section B.1) */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.surplus_gain)}
                            className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs hover:border-emerald-500 transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                    {isUrdu ? 'سرپلس سے نفع' : 'Surplus Se Nafa'}
                                </span>
                                <Icon name="Info" className="size-3.5 text-gray-400 group-hover:text-emerald-700" />
                            </div>
                            <div className="mt-2">
                                <span className="text-lg md:text-xl font-black text-emerald-700 block">
                                    + {formatRs(summary.surplus_gain)}
                                </span>
                                <span className="text-[10px] text-gray-500 block mt-0.5">Mila 4,200 + Kaghzi 8,000</span>
                            </div>
                        </div>

                        {/* 5. Partners Ka Munafa Share (Separated Card Section B.1) */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.partners_share)}
                            className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs hover:border-emerald-500 transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                    {isUrdu ? 'پارٹنرز کا منافع حصہ' : 'Partners Munafa Share'}
                                </span>
                                <Icon name="Info" className="size-3.5 text-gray-400 group-hover:text-emerald-700" />
                            </div>
                            <div className="mt-2">
                                <span className="text-lg md:text-xl font-black text-emerald-800 block">
                                    {formatRs(summary.partners_profit_share)}
                                </span>
                                <span className="text-[10px] text-gray-500 block mt-0.5">Bilal 2,000 + Ali 1,000</span>
                            </div>
                        </div>

                        {/* 6. Pending Approvals */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.pending_approvals)}
                            className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs hover:border-amber-400 transition-all cursor-pointer group col-span-2 md:col-span-1"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                    {isUrdu ? 'زیر التواء منظوریاں' : 'Pending Approvals'}
                                </span>
                                <Icon name="Info" className="size-3.5 text-gray-400 group-hover:text-amber-700" />
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-lg md:text-xl font-black text-amber-700">
                                    {summary.pending_approvals}
                                </span>
                                {summary.pending_approvals > 0 && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                        Pending Owner
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section B.2: Profit Pool Base Banner (Clarifying Rs. 20,000 Pool and Owner 85% Share) */}
                    <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-300 text-emerald-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Icon name="Coins" className="size-5 text-[#14532d]" />
                                <h4 className="text-xs md:text-sm font-bold text-gray-900">
                                    Monthly Munafa Pool Base: <span className="text-[#14532d] font-black">{formatRs(profitPool.total_pool)}</span>
                                </h4>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">
                                Karobar ka monthly nafa base Rs. 20,000 hai. Is pool mein se Malik ka hissa <span className="font-bold text-gray-900">{profitPool.owner_percentage}% ({formatRs(profitPool.owner_share)})</span> hai, aur baqi 15% ({formatRs(summary.partners_profit_share)}) shareek daron ko milta hai.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-xs text-gray-800 font-semibold shadow-2xs">
                                Malik (Hajji Muhammad): <span className="text-[#14532d] font-bold">85% ({formatRs(17000)})</span>
                            </div>
                        </div>
                    </div>

                    {/* Section A.5: Dedicated Owner (Malik) Section - Outside the partners table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-4 md:p-5">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200">
                                    Owner (Malik)
                                </span>
                                <h3 className="text-sm font-bold text-gray-900">
                                    {owner.name} {owner.name_ur && <span className="text-xs text-gray-500 font-normal">({owner.name_ur})</span>}
                                </h3>
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                {owner.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3.5 text-xs">
                            <div>
                                <span className="text-gray-500 block text-[11px] font-medium">Hissa-dari / Ownership:</span>
                                <span className="text-base font-bold text-gray-900 block mt-0.5">{owner.ownership_percentage}% Mukammal Malik</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block text-[11px] font-medium">Monthly Munafa Share:</span>
                                <span className="text-base font-black text-emerald-700 block mt-0.5">{formatRs(owner.profit_share)}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block text-[11px] font-medium">Contact Phone:</span>
                                <span className="text-sm font-semibold text-gray-800 block mt-0.5">{owner.phone || '0300-1234567'}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block text-[11px] font-medium">Ikhtiyarat (Permissions):</span>
                                <span className="text-xs font-semibold text-gray-700 block mt-0.5">Tamam Ledger aur Approvals ke Mukammal Ikhtiyar</span>
                            </div>
                        </div>
                    </div>

                    {/* Section E.2: Due Calendar (Agle 7 Din Mein Wapsi) */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-4 md:p-5">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                            <div className="flex items-center gap-2">
                                <Icon name="ClockCountdown" className="size-5 text-[#14532d]" />
                                <h3 className="text-xs md:text-sm font-bold text-gray-900 uppercase tracking-wide">
                                    {isUrdu ? 'اگلے 7 دن میں کیا واپس ہونا ہے (Due Calendar)' : 'Due Calendar (Agle 7 Din Mein Wapsi)'}
                                </h3>
                            </div>
                            <span className="text-[11px] text-gray-500">{dueCalendar.length} Madat Wajib</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {dueCalendar.map((item, idx) => (
                                <div key={idx} className="p-3 rounded-lg border border-gray-200 bg-gray-50/60 flex items-start justify-between gap-2">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className={cn(
                                                "size-2 rounded-full",
                                                item.direction === 'out' ? "bg-red-500" : "bg-emerald-500"
                                            )} />
                                            <span className="text-xs font-bold text-gray-900">{item.title}</span>
                                        </div>
                                        <p className="text-[11px] text-gray-600">{item.party} — Tareekh: {item.due_date}</p>
                                        <span className="inline-block text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                                            {item.status}
                                        </span>
                                    </div>
                                    <div className="text-end shrink-0">
                                        <span className={cn(
                                            "text-xs md:text-sm font-black block",
                                            item.direction === 'out' ? "text-red-600" : "text-[#14532d]"
                                        )}>
                                            {item.direction === 'out' ? '- ' : '+ '}{formatRs(item.amount)}
                                        </span>
                                        <span className="text-[10px] text-gray-400">
                                            {item.direction === 'out' ? 'Dena Hai' : 'Wapsi Aani Hai'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Section 2: Partners Table (Cleaned up, Owner removed, Pending Drawings shown explicitly) */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Icon name="UsersThree" className="size-5 text-[#14532d]" />
                                <h3 className="text-sm font-bold text-gray-900">
                                    {isUrdu ? 'پارٹنرز اور کیپیٹل کھاتہ' : 'Partners & Equity Khata (Shareek Daron Ka Hisab)'}
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleExportCSV}
                                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Icon name="DownloadSimple" className="size-3.5" />
                                    <span>Excel / CSV</span>
                                </button>
                                <span className="text-xs text-gray-500">
                                    {partners.length} {isUrdu ? 'پارٹنرز' : 'Partners'}
                                </span>
                            </div>
                        </div>

                        {/* Desktop & Tablet Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-start text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[11px] font-bold">
                                        <th className="py-3 px-4 text-start font-bold">Partner (Shareek)</th>
                                        <th className="py-3 px-4 text-center font-bold">Munafa %</th>
                                        <th className="py-3 px-4 text-end font-bold">Shuruati (Opening)</th>
                                        <th className="py-3 px-4 text-end font-bold">Cap In (Lagaya)</th>
                                        <th className="py-3 px-4 text-end font-bold">Approved Drawings</th>
                                        <th className="py-3 px-4 text-end font-bold text-amber-800">Pending Drawings</th>
                                        <th className="py-3 px-4 text-end font-bold text-gray-900">Net Equity (Kul Baqaya)</th>
                                        <th className="py-3 px-4 text-center font-bold">Munafa Share</th>
                                        <th className="py-3 px-4 text-center font-bold">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {partners.map((partner) => (
                                        <tr key={partner.id} className="hover:bg-gray-50/70 transition-colors">
                                            {/* Partner Name & Role Pill (Section C.2 matching style) */}
                                            <td className="py-3.5 px-4 font-semibold text-gray-900">
                                                <div className="flex items-center gap-2">
                                                    <span>{partner.name}</span>
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-300">
                                                        Partner (Shareek)
                                                    </span>
                                                </div>
                                                {partner.phone && (
                                                    <span className="text-[10px] text-gray-400 block font-normal">{partner.phone}</span>
                                                )}
                                            </td>

                                            {/* Profit % */}
                                            <td className="py-3.5 px-4 text-center font-bold text-gray-700">
                                                {partner.profit_percentage > 0 ? `${partner.profit_percentage}%` : '—'}
                                            </td>

                                            {/* Opening */}
                                            <td className="py-3.5 px-4 text-end text-gray-600 font-medium">
                                                {formatNum(partner.opening)}
                                            </td>

                                            {/* Cap In */}
                                            <td className="py-3.5 px-4 text-end text-emerald-800 font-medium">
                                                {partner.cap_in > 0 ? formatNum(partner.cap_in) : '0'}
                                            </td>

                                            {/* Approved Drawings */}
                                            <td className="py-3.5 px-4 text-end text-red-600 font-medium">
                                                {partner.drawings > 0 ? formatNum(partner.drawings) : '0'}
                                            </td>

                                            {/* Section B.3: Pending Drawings Explicit Column */}
                                            <td className="py-3.5 px-4 text-end">
                                                {partner.pending_drawings > 0 ? (
                                                    <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 block">
                                                        Pending: -{formatNum(partner.pending_drawings)}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 font-normal">—</span>
                                                )}
                                            </td>

                                            {/* Net Equity */}
                                            <td className="py-3.5 px-4 text-end">
                                                <span className="font-black text-sm text-gray-900 block">
                                                    {formatNum(partner.net_equity)}
                                                </span>
                                                {partner.pending_drawings > 0 && (
                                                    <span className="text-[10px] text-gray-500 block">
                                                        Dastiyab: {formatNum(partner.available_equity)}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Draw Preview */}
                                            <td className="py-3.5 px-4 text-center text-gray-700 font-medium">
                                                {partner.draw_preview > 0 ? (
                                                    <span className="text-emerald-700 font-bold">
                                                        + {formatNum(partner.draw_preview)} hissa
                                                    </span>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>

                                            {/* Status Badge (Section C.1 standardized) */}
                                            <td className="py-3.5 px-4 text-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                    Approved
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Guardrail Alert Banner */}
                    {alerts.length > 0 && (
                        <div className="space-y-2">
                            {alerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className="p-4 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs"
                                >
                                    <div className="flex items-start gap-3">
                                        <Icon name="WarningCircle" className="size-5 text-amber-700 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-semibold leading-relaxed">
                                                Alert: {alert.partner_name} ke capital se <span className="font-bold text-red-800">Rs. {formatNum(alert.excess_amount)}</span> zyada nikaalne ki koshish ki gayi (blocked, Drawings/Advance ke tor par record hona chahiye).
                                            </p>
                                            {alert.notes && (
                                                <p className="text-[11px] text-amber-800 mt-0.5">{alert.notes}</p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsEntryDrawerOpen(true)}
                                        className="px-3.5 py-1.5 text-xs font-bold bg-white hover:bg-amber-100/60 text-amber-900 border border-amber-300 rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
                                    >
                                        Review Karein
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Entry Drawer (Ctrl+N Wizard) */}
                <EntryDrawer
                    isOpen={isEntryDrawerOpen}
                    onClose={() => setIsEntryDrawerOpen(false)}
                    partners={partnersList}
                    loans={loansList}
                    surplusFunds={surplusList}
                    bankAccounts={bankAccounts}
                    isUrdu={isUrdu}
                />

                {/* Clickable Breakdown Modal */}
                <BreakdownModal
                    isOpen={!!activeBreakdown}
                    onClose={() => setActiveBreakdown(null)}
                    data={activeBreakdown}
                />
            </div>
        </AppLayout>
    );
}
