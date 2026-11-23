import React, { useState, useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import InvestmentHeader from '@/components/investment/investment-header';
import EntryDrawer from '@/components/investment/entry-drawer';
import BreakdownModal, { BreakdownData } from '@/components/investment/breakdown-modal';
import Icon from '@/components/ui/icon';

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
    is_new_partner?: boolean;
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

interface Props {
    userName?: string;
    isOwner?: boolean;
    pendingApprovalsCount?: number;
    lastUpdated?: string;
    partnersList: any[];
    loansList: any[];
    surplusList: any[];
    bankAccounts: string[];
    aajKaHaal: {
        dena_hai: number;
        dena_hai_sub?: string;
        lena_hai: number;
        lena_hai_sub?: string;
        kaam_count?: number;
        kaam_text?: string;
        kaam_sub?: string;
    };
    singleAlert?: {
        text: string;
        action_label: string;
        action_url: string;
    } | null;
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
        partners_profit_share: number;
        pending_approvals: number;
        profit_pool_base: number;
    };
    owner: OwnerData;
    partners: PartnerRow[];
    breakdowns: Record<string, BreakdownData>;
}

export default function InvestmentPartnersPage({
    userName,
    pendingApprovalsCount = 0,
    partnersList,
    loansList,
    surplusList,
    bankAccounts,
    aajKaHaal,
    singleAlert,
    profitPool,
    summary,
    owner,
    partners,
    breakdowns,
}: Props) {
    const { i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [isEntryDrawerOpen, setIsEntryDrawerOpen] = useState(false);
    const [activeBreakdown, setActiveBreakdown] = useState<BreakdownData | null>(null);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    // 30-second live background update (Section D)
    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({ only: ['aajKaHaal', 'singleAlert', 'summary', 'partners', 'pendingApprovalsCount'] });
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'انویسٹمنٹ' : 'Investment', href: '/investment/partners' },
        { title: isUrdu ? 'پارٹنرز (حصہ دار)' : 'Partners', href: '/investment/partners' },
    ];

    const formatRs = (val: number) => 'Rs. ' + Number(val || 0).toLocaleString('en-US');
    const formatNum = (val: number) => Number(val || 0).toLocaleString('en-US');

    // Export CSV functionality for all or specific partner
    const handleExportCSV = (targetId: number | 'all' = 'all') => {
        const headers = ['Partner Name', 'Hissa %', 'Lagaya Hua Sarmaya', 'Shareekon Ka Hissa', 'Pending Drawings', 'Status'];
        const targetList = targetId === 'all' ? partners : partners.filter(p => p.id === targetId);

        const rows = targetList.map(p => [
            `"${p.name}"`,
            `${p.profit_percentage}%`,
            p.net_equity,
            p.draw_preview,
            p.pending_drawings,
            `"${p.status}"`
        ]);

        const fileName = targetId === 'all'
            ? `Partners_All_${new Date().toISOString().slice(0, 10)}.csv`
            : `Partner_${(targetList[0]?.name || 'Detail').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'پارٹنرز - انویسٹمنٹ' : 'Partners - Investment'} />

            <div className={`-mt-4 -mx-4 -mb-4 pb-12 bg-[#eef2ee] min-h-full font-sans text-[#1F2937] ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>
                {/* Header (Section B.5 short tabs & single alert line) */}
                <InvestmentHeader
                    currentTab="partners"
                    userName={userName}
                    pendingApprovalsCount={pendingApprovalsCount}
                    singleAlert={singleAlert}
                    onOpenEntry={() => setIsEntryDrawerOpen(true)}
                    isUrdu={isUrdu}
                />

                <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
                    {/* Section B.1: Har Page Par Sirf 3 Numbers (Partners Page) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        {/* Number 1: Kul Sarmaya */}
                        <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-2xs">
                            <span className="text-xs font-bold text-[#374151] uppercase tracking-wider block">
                                {isUrdu ? 'کل سرمایہ' : 'Kul Sarmaya'}
                            </span>
                            <span className="text-2xl font-black text-[#1F2937] block mt-2">
                                {formatRs(summary.net_capital)}
                            </span>
                            <span className="text-xs font-medium text-[#4B5563] block mt-1">
                                {isUrdu ? `${partners.length} شریک دار (منظور شدہ ایکویٹی)` : `${partners.length} shareek dar (Approved Equity)`}
                            </span>
                        </div>

                        {/* Number 2: Shareekon Ka Hissa */}
                        <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-2xs">
                            <span className="text-xs font-bold text-[#374151] uppercase tracking-wider block">
                                {isUrdu ? 'شریکوں کا حصہ' : 'Shareekon Ka Hissa'}
                            </span>
                            <span className="text-2xl font-black text-[#14532d] block mt-2">
                                {formatRs(summary.partners_profit_share)}
                            </span>
                            <span className="text-xs font-medium text-[#4B5563] block mt-1">
                                {isUrdu ? `ماہانہ پول: ${formatRs(profitPool.total_pool)}` : `Monthly Pool: ${formatRs(profitPool.total_pool)}`}
                            </span>
                        </div>

                        {/* Number 3: Malik Ki Manzoori Baaki */}
                        <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-2xs">
                            <span className="text-xs font-bold text-[#374151] uppercase tracking-wider block">
                                {isUrdu ? 'مالک کی منظوری باقی' : 'Malik Ki Manzoori Baaki'}
                            </span>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-2xl font-black text-amber-800">
                                    {summary.pending_approvals}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                    {isUrdu ? 'زیر التواء مالک' : 'Pending Owner'}
                                </span>
                            </div>
                            <span className="text-xs font-medium text-[#4B5563] block mt-1">
                                {isUrdu ? 'منظوری درکار' : 'Bilal Drawing Rs. 100,000'}
                            </span>
                        </div>
                    </div>

                    {/* Section B.2 & D: Profit Pool Base (Clean 1-line explainer) */}
                    <div className="p-3.5 rounded-xl bg-white border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs text-sm">
                        <div className="flex items-center gap-2">
                            <Icon name="Coins" className="size-4 text-[#14532d] shrink-0" />
                            <span className="font-bold text-[#1F2937]">
                                {isUrdu ? 'ماہانہ منافع پول:' : 'Monthly Munafa Pool:'} <span className="text-[#14532d]">{formatRs(profitPool.total_pool)}</span>
                            </span>
                        </div>
                        <div className="text-xs font-semibold text-[#4B5563]">
                            {isUrdu ? 'مالک کا حصہ:' : 'Malik ka hissa:'} <span className="text-[#1F2937] font-bold">85% ({formatRs(profitPool.owner_share)})</span> · {isUrdu ? 'شریکوں کا حصہ:' : 'Shareekon ka hissa:'} <span className="text-[#1F2937] font-bold">15% ({formatRs(summary.partners_profit_share)})</span>
                        </div>
                    </div>

                    {/* Malik (Owner) Section - Dedicated & Clean */}
                    <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center shrink-0">
                                <Icon name="Crown" className="size-5 text-purple-800" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-[#1F2937]">{owner.name}</span>
                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-900">
                                        {isUrdu ? 'مالک (Owner)' : 'Malik (Owner)'}
                                    </span>
                                </div>
                                <span className="text-xs text-[#4B5563] block">{isUrdu ? 'فون:' : 'Phone:'} {owner.phone}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-semibold">
                            <div>
                                <span className="text-[#4B5563] block">{isUrdu ? 'حصہ:' : 'Hissa:'}</span>
                                <span className="text-[#1F2937] font-bold text-sm">{owner.ownership_percentage}% {isUrdu ? 'مکمل مالک' : 'Mukammal Malik'}</span>
                            </div>
                            <div>
                                <span className="text-[#4B5563] block">{isUrdu ? 'ماہانہ منافع:' : 'Monthly Munafa:'}</span>
                                <span className="text-[#14532d] font-black text-sm">{formatRs(owner.profit_share)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Partners Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon name="UsersThree" className="size-5 text-[#14532d]" />
                                <h3 className="text-sm font-bold text-[#1F2937]">
                                    {isUrdu ? 'شریک داروں کا کھاتہ' : 'Partners (Shareek Daron Ka Khata)'}
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                                        className="px-3 py-1.5 text-xs font-semibold text-[#374151] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Icon name="DownloadSimple" className="size-3.5" />
                                        <span>Excel / CSV</span>
                                        <Icon name="CaretDown" className="size-3 text-[#4B5563]" />
                                    </button>

                                    {/* Party selection dropdown menu */}
                                    {isExportMenuOpen && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-20"
                                                onClick={() => setIsExportMenuOpen(false)}
                                            />
                                            <div className="absolute end-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1.5 font-sans animate-in fade-in slide-in-from-top-1 text-start">
                                                <div className="px-3 py-1.5 text-[11px] font-bold text-[#4B5563] uppercase border-b border-gray-100 flex items-center justify-between">
                                                    <span>{isUrdu ? 'پارٹی / حصہ دار منتخب کریں' : 'Party / Hissedar Chunein'}</span>
                                                    <span className="text-[10px] text-gray-400">CSV Export</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleExportCSV('all');
                                                        setIsExportMenuOpen(false);
                                                    }}
                                                    className="w-full text-start px-3.5 py-2 text-xs font-bold text-[#14532d] hover:bg-emerald-50 flex items-center justify-between cursor-pointer transition-colors"
                                                >
                                                    <span>{isUrdu ? 'سب پارٹنرز (مکمل ڈیٹا)' : 'Sab Partners (Mukammal Data)'}</span>
                                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                                        {partners.length}
                                                    </span>
                                                </button>
                                                <div className="border-t border-gray-100 my-1" />
                                                <div className="max-h-48 overflow-y-auto">
                                                    {partners.map(p => (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            onClick={() => {
                                                                handleExportCSV(p.id);
                                                                setIsExportMenuOpen(false);
                                                            }}
                                                            className="w-full text-start px-3.5 py-2 text-xs text-[#1F2937] hover:bg-gray-100 flex items-center justify-between cursor-pointer transition-colors"
                                                        >
                                                            <div>
                                                                <span className="font-bold text-[#1F2937] block">{p.name}</span>
                                                                <span className="text-[11px] text-[#4B5563]">{isUrdu ? 'حصہ:' : 'Hissa:'} {p.profit_percentage}%</span>
                                                            </div>
                                                            <span className="text-xs font-bold text-[#14532d]">{formatRs(p.net_equity)}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <span className="text-xs text-[#4B5563]">
                                    {isUrdu ? `${partners.length} شریک` : `${partners.length} Shareek`}
                                </span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-start text-sm border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[#374151] uppercase tracking-wider text-xs font-bold">
                                        <th className="py-3 px-4 text-start">{isUrdu ? 'نام' : 'Naam'}</th>
                                        <th className="py-3 px-4 text-center">{isUrdu ? 'حصہ %' : 'Hissa %'}</th>
                                        <th className="py-3 px-4 text-end">{isUrdu ? 'پیسہ ڈالا' : 'Paisa Dala'}</th>
                                        <th className="py-3 px-4 text-end">{isUrdu ? 'نکالا' : 'Nikala'}</th>
                                        <th className="py-3 px-4 text-end">{isUrdu ? 'ایکویٹی' : 'Equity'}</th>
                                        <th className="py-3 px-4 text-center">{isUrdu ? 'اس مہینے کا منافع شیئر' : 'Is Mahine Ka Munafa Share'}</th>
                                        <th className="py-3 px-4 text-center">{isUrdu ? 'تفصیل' : 'Tafseel'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-[#1F2937]">
                                    {partners.map((partner) => (
                                        <tr key={partner.id} className="hover:bg-gray-50/70 transition-colors">
                                            {/* Naam */}
                                            <td className="py-3.5 px-4 font-bold">
                                                <div>
                                                    <span className="text-sm font-bold text-[#1F2937]">{partner.name}</span>
                                                    {partner.phone && (
                                                        <span className="text-xs text-[#4B5563] block font-normal">{partner.phone}</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Hissa % */}
                                            <td className="py-3.5 px-4 text-center font-bold text-[#374151] text-sm">
                                                {partner.profit_percentage}%
                                            </td>

                                            {/* Paisa Dala (Capital In) */}
                                            <td className="py-3.5 px-4 text-end font-semibold text-[#1F2937] text-sm">
                                                Rs. {formatNum(partner.cap_in || partner.net_equity)}
                                            </td>

                                            {/* Nikala (Drawings) */}
                                            <td className="py-3.5 px-4 text-end font-semibold text-[#374151] text-sm">
                                                {partner.drawings > 0 ? `Rs. ${formatNum(partner.drawings)}` : 'Rs. 0'}
                                            </td>

                                            {/* Equity (Pending drawing alag line mein) */}
                                            <td className="py-3.5 px-4 text-end">
                                                <span className="font-black text-sm text-[#1F2937] block">
                                                    {formatRs(partner.net_equity)}
                                                </span>
                                                {partner.pending_drawings > 0 && (
                                                    <span className="text-xs text-amber-800 font-bold block mt-0.5 leading-tight">
                                                        {isUrdu ? `نکاسی زیرِ التواء: -Rs. ${formatNum(partner.pending_drawings)} (منظوری باقی)` : `Pending Drawing: -Rs. ${formatNum(partner.pending_drawings)} (Manzoori baaki)`}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Is Mahine Ka Munafa Share */}
                                            <td className="py-3.5 px-4 text-center font-bold text-sm">
                                                {(partner.is_new_partner || partner.draw_preview === 0) ? (
                                                    <span className="text-gray-500 font-semibold text-xs inline-flex items-center gap-1 justify-center">
                                                        Rs. 0 <span className="text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 font-medium">{isUrdu ? '(1 مہینے بعد)' : '(1 mahine baad)'}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-[#14532d]">
                                                        + {formatRs(partner.draw_preview)}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Detail Button */}
                                            <td className="py-3.5 px-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveBreakdown({
                                                        title: `${partner.name} (Shareek) Khata Tafseel`,
                                                        total: partner.net_equity,
                                                        items: [
                                                            { label: 'Paisa Dala (Capital In)', amount: partner.cap_in || partner.net_equity, note: 'Karobar mein lagaya hua kul sarmaya' },
                                                            { label: 'Paisa Nikala (Drawings)', amount: partner.drawings, note: 'Ab tak nikali gayi manzoor shuda rakam' },
                                                            { label: 'Mawjooda Approved Equity', amount: partner.net_equity, note: 'Approved active sarmaya' },
                                                            { label: `Is Mahine Ka Munafa Share (${partner.profit_percentage}%)`, amount: partner.draw_preview || (partner.profit_percentage * 200), note: 'Monthly profit pool se hissa' },
                                                            ...(partner.pending_drawings > 0 ? [{ label: 'Pending Drawing (Zir-e-Tawa)', amount: partner.pending_drawings, note: 'Malik ki manzoori baaki hai' }] : []),
                                                        ],
                                                        note: `Phone: ${partner.phone || 'N/A'} · Hissa: ${partner.profit_percentage}% · Status: ${partner.status}`,
                                                    })}
                                                    className="px-2.5 py-1 text-xs font-bold text-[#374151] hover:text-black bg-gray-100 hover:bg-gray-200 rounded transition-colors cursor-pointer"
                                                >
                                                    {isUrdu ? 'تفصیل' : 'Detail'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Entry Drawer */}
                <EntryDrawer
                    isOpen={isEntryDrawerOpen}
                    onClose={() => setIsEntryDrawerOpen(false)}
                    category="partners"
                    partners={partnersList}
                    loans={loansList}
                    surplusFunds={surplusList}
                    bankAccounts={bankAccounts}
                    isUrdu={isUrdu}
                />

                {/* Breakdown Modal */}
                <BreakdownModal
                    isOpen={!!activeBreakdown}
                    onClose={() => setActiveBreakdown(null)}
                    data={activeBreakdown}
                />
            </div>
        </AppLayout>
    );
}
