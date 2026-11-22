import React, { useState, useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import InvestmentHeader from '@/components/investment/investment-header';
import AajKaHaal from '@/components/investment/aaj-ka-haal';
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

    // Export CSV functionality
    const handleExportCSV = () => {
        const headers = ['Partner Name', 'Hissa %', 'Lagaya Hua Sarmaya', 'Shareekon Ka Hissa', 'Pending Drawings', 'Status'];
        const rows = partners.map(p => [
            `"${p.name}"`,
            `${p.profit_percentage}%`,
            p.net_equity,
            p.draw_preview,
            p.pending_drawings,
            `"${p.status}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Partners_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'پارٹنرز - انویسٹمنٹ' : 'Partners - Investment'} />

            <div className="-mt-4 -mx-4 -mb-8 pb-28 bg-[#f4f6f4] min-h-screen font-sans text-[#1F2937]">
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
                    {/* Section B.6: Aaj Ka Haal (Exactly 3 Big Clickable Cards) */}
                    <AajKaHaal data={aajKaHaal} isUrdu={isUrdu} />

                    {/* Section B.1: Har Page Par Sirf 3 Numbers (Partners Page) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        {/* Number 1: Kul Sarmaya */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.net_capital)}
                            className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-2xs hover:border-[#14532d] transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#374151] uppercase tracking-wider">
                                    {isUrdu ? 'کل سرمایہ' : 'Kul Sarmaya'}
                                </span>
                                <Icon name="Info" className="size-4 text-[#4B5563] group-hover:text-[#14532d]" />
                            </div>
                            <span className="text-2xl font-black text-[#1F2937] block mt-2">
                                {formatRs(summary.net_capital)}
                            </span>
                            <span className="text-xs font-medium text-[#4B5563] block mt-1">
                                2 shareek dar · Tafseel dekhne ke liye click karein
                            </span>
                        </div>

                        {/* Number 2: Shareekon Ka Hissa */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.partners_share)}
                            className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-2xs hover:border-emerald-600 transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#374151] uppercase tracking-wider">
                                    {isUrdu ? 'شریکوں کا حصہ' : 'Shareekon Ka Hissa'}
                                </span>
                                <Icon name="Info" className="size-4 text-[#4B5563] group-hover:text-emerald-700" />
                            </div>
                            <span className="text-2xl font-black text-[#14532d] block mt-2">
                                {formatRs(summary.partners_profit_share)}
                            </span>
                            <span className="text-xs font-medium text-[#4B5563] block mt-1">
                                Bilal 2,000 + Ali 1,000 (Monthly Pool: Rs. 20k)
                            </span>
                        </div>

                        {/* Number 3: Malik Ki Manzoori Baaki */}
                        <div
                            onClick={() => setActiveBreakdown(breakdowns.pending_approvals)}
                            className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-2xs hover:border-amber-400 transition-all cursor-pointer group"
                            title="Tafseel dekhne ke liye click karein"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#374151] uppercase tracking-wider">
                                    {isUrdu ? 'مالک کی منظوری باقی' : 'Malik Ki Manzoori Baaki'}
                                </span>
                                <Icon name="Info" className="size-4 text-[#4B5563] group-hover:text-amber-700" />
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-2xl font-black text-amber-800">
                                    {summary.pending_approvals}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                    Pending Owner
                                </span>
                            </div>
                            <span className="text-xs font-medium text-[#4B5563] block mt-1">
                                Bilal Drawing Rs. 100,000
                            </span>
                        </div>
                    </div>

                    {/* Section B.2 & D: Profit Pool Base (Clean 1-line explainer) */}
                    <div className="p-3.5 rounded-xl bg-white border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs text-sm">
                        <div className="flex items-center gap-2">
                            <Icon name="Coins" className="size-4 text-[#14532d] shrink-0" />
                            <span className="font-bold text-[#1F2937]">
                                Monthly Munafa Pool: <span className="text-[#14532d]">{formatRs(profitPool.total_pool)}</span>
                            </span>
                        </div>
                        <div className="text-xs font-semibold text-[#4B5563]">
                            Malik ka hissa: <span className="text-[#1F2937] font-bold">85% ({formatRs(profitPool.owner_share)})</span> · Shareekon ka hissa: <span className="text-[#1F2937] font-bold">15% ({formatRs(summary.partners_profit_share)})</span>
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
                                        Malik (Owner)
                                    </span>
                                </div>
                                <span className="text-xs text-[#4B5563] block">Phone: {owner.phone}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-semibold">
                            <div>
                                <span className="text-[#4B5563] block">Hissa:</span>
                                <span className="text-[#1F2937] font-bold text-sm">{owner.ownership_percentage}% Mukammal Malik</span>
                            </div>
                            <div>
                                <span className="text-[#4B5563] block">Monthly Munafa:</span>
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
                                <button
                                    type="button"
                                    onClick={handleExportCSV}
                                    className="px-3 py-1.5 text-xs font-semibold text-[#374151] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Icon name="DownloadSimple" className="size-3.5" />
                                    <span>Excel / CSV</span>
                                </button>
                                <span className="text-xs text-[#4B5563]">
                                    {partners.length} Shareek
                                </span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-start text-sm border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[#374151] uppercase tracking-wider text-xs font-bold">
                                        <th className="py-3 px-4 text-start">Naam</th>
                                        <th className="py-3 px-4 text-center">Hissa %</th>
                                        <th className="py-3 px-4 text-end">Paisa Dala</th>
                                        <th className="py-3 px-4 text-end">Nikala</th>
                                        <th className="py-3 px-4 text-end">Equity</th>
                                        <th className="py-3 px-4 text-center">Is Mahine Ka Munafa Share</th>
                                        <th className="py-3 px-4 text-center">Tafseel</th>
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
                                                        Pending Drawing: -Rs. {formatNum(partner.pending_drawings)} (Manzoori baaki)
                                                    </span>
                                                )}
                                            </td>

                                            {/* Is Mahine Ka Munafa Share */}
                                            <td className="py-3.5 px-4 text-center font-bold text-[#14532d] text-sm">
                                                + {formatRs(partner.draw_preview || (partner.profit_percentage * 200))}
                                            </td>

                                            {/* Detail Button */}
                                            <td className="py-3.5 px-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveBreakdown(breakdowns.net_capital)}
                                                    className="px-2.5 py-1 text-xs font-bold text-[#374151] hover:text-black bg-gray-100 hover:bg-gray-200 rounded transition-colors cursor-pointer"
                                                >
                                                    Detail
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
