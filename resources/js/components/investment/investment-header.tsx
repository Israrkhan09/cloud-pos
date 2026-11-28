import React, { useEffect } from 'react';
import { Link } from '@inertiajs/react';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';

interface SingleAlert {
    text: string;
    action_label: string;
    action_url: string;
}

interface InvestmentHeaderProps {
    currentTab: 'partners' | 'loans' | 'surplus' | 'audit';
    userName?: string;
    pendingApprovalsCount?: number;
    singleAlert?: SingleAlert | null;
    onOpenEntry: () => void;
    isUrdu?: boolean;
}

export default function InvestmentHeader({
    currentTab,
    userName = 'Hajji Muhammad',
    pendingApprovalsCount = 0,
    singleAlert,
    onOpenEntry,
    isUrdu = false,
}: InvestmentHeaderProps) {
    // Keyboard shortcut: Ctrl+N for new entry (disabled on audit page)
    useEffect(() => {
        if (currentTab === 'audit') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
                e.preventDefault();
                onOpenEntry();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onOpenEntry, currentTab]);

    // Short clean tab names (Section B.5)
    const tabs = [
        {
            id: 'partners',
            href: '/investment/partners',
            title: isUrdu ? 'پارٹنرز (حصہ دار)' : 'Partners',
        },
        {
            id: 'loans',
            href: '/investment/loans',
            title: isUrdu ? 'قرضہ (Loans)' : 'Loans',
        },
        {
            id: 'surplus',
            href: '/investment/surplus',
            title: isUrdu ? 'سرمایہ کاری (Investments)' : 'Investments',
        },
        {
            id: 'audit',
            href: '/investment/audit',
            title: isUrdu ? 'ریکارڈ (Audit)' : 'Audit Log',
        },
    ];

    return (
        <div className="bg-[#14532d] px-4 md:px-6 pt-3.5 pb-4 text-white shadow-sm print:hidden space-y-3">
            {/* Top row: Heading, Pending Approvals badge (if any), and ONE main action button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Left side: Page Title Heading matching POS standard */}
                <div className="flex items-center gap-3 flex-wrap min-h-[36px]">
                    <div>
                        <h1 className="text-lg md:text-xl font-bold text-white tracking-tight leading-tight flex items-center gap-2">
                            {isUrdu ? 'سرمایہ و قرضہ لیجر' : 'Investment & Capital Ledger'}
                        </h1>
                        <p className="text-emerald-100/80 text-xs font-medium mt-0.5">
                            {isUrdu ? 'سرمایہ، قرضہ اور سرمایہ کاری کھاتہ' : 'Capital, Loans and Investment Management'}
                        </p>
                    </div>

                    {pendingApprovalsCount > 0 && (
                        <Link
                            href="/investment/audit?filter=pending"
                            title="Click to view pending approvals"
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-[#1F2937] border border-amber-300 hover:bg-amber-100 transition-colors flex items-center gap-2 cursor-pointer select-none self-center"
                        >
                            <span className="size-2 rounded-full bg-amber-600 animate-pulse" />
                            <span>{pendingApprovalsCount} {isUrdu ? 'منظوریاں باقی' : 'Pending Approvals'}</span>
                            <Icon name="ArrowRight" className="size-3 text-[#374151]" />
                        </Link>
                    )}
                </div>

                {/* Right side: ONE main action button (Hidden on Record / Audit page) */}
                {currentTab !== 'audit' && (
                    <div className="flex items-center gap-3 justify-end">
                        <button
                            type="button"
                            onClick={onOpenEntry}
                            className="min-h-[36px] px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-white text-[#14532d] hover:bg-emerald-50 border border-white shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                        >
                            <Icon name="Plus" className="size-4 stroke-[3] text-[#14532d]" />
                            <span>{isUrdu ? 'نئی اینٹری' : 'New Entry'}</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Bottom row: Short clean Navigation Tabs (Section B.5) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                {tabs.map((tab) => {
                    const isActive = currentTab === tab.id;
                    return (
                        <Link
                            key={tab.id}
                            href={tab.href}
                            prefetch
                            className={cn(
                                "min-h-[34px] px-4 py-1.5 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-1.5 border",
                                isActive
                                    ? "bg-[#0d3b1e] text-white border-2 border-white font-bold shadow-xs"
                                    : "bg-white text-[#14532d] hover:bg-emerald-50 border border-white font-semibold shadow-2xs"
                            )}
                        >
                            <span>{tab.title}</span>
                        </Link>
                    );
                })}
            </div>

            {/* Section B.3: Single slim alert line if any alert exists */}
            {singleAlert && (
                <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg bg-rose-50 border border-rose-300 text-sm text-[#1F2937]">
                    <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-rose-600 shrink-0" />
                        <span className="font-semibold">{singleAlert.text}</span>
                    </div>
                    <Link
                        href={singleAlert.action_url}
                        className="font-bold text-rose-700 hover:text-rose-900 underline text-xs shrink-0 cursor-pointer"
                    >
                        {singleAlert.action_label}
                    </Link>
                </div>
            )}
        </div>
    );
}
