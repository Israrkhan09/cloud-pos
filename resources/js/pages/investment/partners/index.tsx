import React, { useState } from 'react';
import { Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import InvestmentHeader from '@/components/investment/investment-header';
import EntryDrawer from '@/components/investment/entry-drawer';
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
    net_equity: number;
    draw_preview: number;
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
    currentRole: 'munshi' | 'owner';
    partnersList: any[];
    loansList: any[];
    surplusList: any[];
    bankAccounts: string[];
    summary: {
        net_capital: number;
        short_term_loans: number;
        loan_fees: number;
        active_surplus: number;
        net_investment_gain: number;
        pending_approvals: number;
    };
    partners: PartnerRow[];
    alerts: AlertItem[];
}

export default function InvestmentPartnersPage({
    currentRole,
    partnersList,
    loansList,
    surplusList,
    bankAccounts,
    summary,
    partners,
    alerts,
}: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [searchTerm, setSearchTerm] = useState('');
    const [isEntryDrawerOpen, setIsEntryDrawerOpen] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'انویسٹمنٹ' : 'Investment', href: '/investment/partners' },
        { title: isUrdu ? 'پارٹنرز اور ایکویٹی' : 'Partners & Equity', href: '/investment/partners' },
    ];

    // Filter partners based on search
    const filteredPartners = partners.filter((p) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
            p.name.toLowerCase().includes(q) ||
            p.role.toLowerCase().includes(q) ||
            (p.name_ur && p.name_ur.includes(q))
        );
    });

    const formatRs = (val: number) => {
        return 'Rs. ' + Number(val || 0).toLocaleString('en-US');
    };

    const formatNum = (val: number) => {
        return Number(val || 0).toLocaleString('en-US');
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'پارٹنرز اور ایکویٹی - انویسٹمنٹ' : 'Partners & Equity - Investment'} />

            <div className="-mt-4 -mx-4 -mb-8 pb-28 bg-[#f4f6f4] min-h-screen font-sans text-[#1a211c]">
                {/* Module Header Bar with Tabs, Search, Role Switcher and + Entry button */}
                <InvestmentHeader
                    currentTab="partners"
                    currentRole={currentRole}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onOpenEntry={() => setIsEntryDrawerOpen(true)}
                    isUrdu={isUrdu}
                />

                <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
                    {/* 1. Summary Cards (5 Key Metrics) */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                        {/* Net Capital / Equity */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs transition-shadow">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                {isUrdu ? 'نیٹ کیپیٹل / ایکویٹی' : 'Kul Sarmaya / Net Equity'}
                            </span>
                            <div className="mt-2 flex items-baseline gap-1">
                                <span className="text-xl md:text-2xl font-black text-[#14532d]">
                                    {formatRs(summary.net_capital)}
                                </span>
                            </div>
                        </div>

                        {/* Short-Term Loans Payable */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs transition-shadow">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                {isUrdu ? 'مختصر مدت کے قرضے' : 'Wajib-ul-Ada Qarze'}
                            </span>
                            <div className="mt-2">
                                <span className="text-xl md:text-2xl font-black text-gray-900 block">
                                    {formatRs(summary.short_term_loans)}
                                </span>
                                {summary.loan_fees > 0 && (
                                    <span className="text-[11px] font-medium text-gray-500 mt-0.5 block">
                                        + Fee Rs. {formatNum(summary.loan_fees)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Active Surplus */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs transition-shadow">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                {isUrdu ? 'ایکٹیو سرپلس' : 'Active Surplus (Faltu Paisa)'}
                            </span>
                            <div className="mt-2">
                                <span className="text-xl md:text-2xl font-black text-gray-900 block">
                                    {formatRs(summary.active_surplus)}
                                </span>
                            </div>
                        </div>

                        {/* Net Investment Gain */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs transition-shadow">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                {isUrdu ? 'نیٹ انویسٹمنٹ نفع' : 'Kul Nafa (Investment Gain)'}
                            </span>
                            <div className="mt-2">
                                <span className="text-xl md:text-2xl font-black text-emerald-700 block">
                                    + {formatRs(summary.net_investment_gain)}
                                </span>
                            </div>
                        </div>

                        {/* Pending Approvals */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-xs transition-shadow col-span-2 md:col-span-1">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                                {isUrdu ? 'زیر التواء منظوریاں' : 'Baqi Manzooriyan'}
                            </span>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-xl md:text-2xl font-black text-amber-700">
                                    {summary.pending_approvals}
                                </span>
                                {summary.pending_approvals > 0 && (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                        Manzoori Darkar
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2. Partners Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon name="UsersThree" className="size-5 text-[#14532d]" />
                                <h3 className="text-sm font-bold text-gray-900">
                                    {isUrdu ? 'پارٹنرز اور کیپیٹل کھاتہ' : 'Partners & Equity Khata (Hissa-dari)'}
                                </h3>
                            </div>
                            <span className="text-xs text-gray-500">
                                {filteredPartners.length} {isUrdu ? 'پارٹنرز' : 'Partners'}
                            </span>
                        </div>

                        {/* Desktop & Tablet Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-start text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[11px] font-bold">
                                        <th className="py-3 px-4 text-start font-bold">Partner (Shareek)</th>
                                        <th className="py-3 px-4 text-center font-bold">Munafa %</th>
                                        <th className="py-3 px-4 text-end font-bold">Shuruati (Opening)</th>
                                        <th className="py-3 px-4 text-end font-bold">Paisa Lagaya (Cap In)</th>
                                        <th className="py-3 px-4 text-end font-bold">Paisa Nikala (Drawings)</th>
                                        <th className="py-3 px-4 text-end font-bold text-gray-900">Kul Equity (Net Baqaya)</th>
                                        <th className="py-3 px-4 text-center font-bold">Munafa Share</th>
                                        <th className="py-3 px-4 text-center font-bold">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredPartners.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-8 text-center text-gray-500 text-xs">
                                                {isUrdu ? 'کوئی پارٹنر نہیں ملا' : 'Koi partner nahi mila.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPartners.map((partner) => (
                                            <tr key={partner.id} className="hover:bg-gray-50/70 transition-colors">
                                                {/* Partner Name & Role */}
                                                <td className="py-3.5 px-4 font-semibold text-gray-900">
                                                    <div className="flex items-center gap-2">
                                                        <span>{partner.name}</span>
                                                        <span className={cn(
                                                            "px-1.5 py-0.5 rounded text-[10px] font-medium capitalize",
                                                            partner.role === 'owner'
                                                                ? "bg-purple-100 text-purple-800 border border-purple-200"
                                                                : "bg-gray-100 text-gray-600 border border-gray-200"
                                                        )}>
                                                            {partner.role === 'owner' ? 'Owner (Malik)' : 'Partner (Shareek)'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Profit % */}
                                                <td className="py-3.5 px-4 text-center font-medium text-gray-700">
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

                                                {/* Drawings (in red) */}
                                                <td className="py-3.5 px-4 text-end text-red-600 font-medium">
                                                    {partner.drawings > 0 ? formatNum(partner.drawings) : '0'}
                                                </td>

                                                {/* Net Equity */}
                                                <td className="py-3.5 px-4 text-end font-black text-sm text-gray-900">
                                                    {formatNum(partner.net_equity)}
                                                </td>

                                                {/* Draw Preview */}
                                                <td className="py-3.5 px-4 text-center text-gray-700 font-medium">
                                                    {partner.draw_preview > 0 ? (
                                                        <span className="text-emerald-700 font-semibold">
                                                            + {formatNum(partner.draw_preview)} hissa
                                                        </span>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>

                                                {/* Status */}
                                                <td className="py-3.5 px-4 text-center">
                                                    {partner.status === 'active' ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                            Active (Chalu)
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                                                            Manzoori Baqi
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 3. Guardrail Alert Banner (when capital excess attempt exists) */}
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
            </div>
        </AppLayout>
    );
}
