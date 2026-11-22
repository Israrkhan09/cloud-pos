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
            title: isUrdu ? 'پارٹنرز (حصہ دار)' : 'Partners (Hissedar)',
        },
        {
            id: 'loans',
            href: '/investment/loans',
            title: isUrdu ? 'قرضہ (Loans)' : 'Qarza (Loans)',
        },
        {
            id: 'surplus',
            href: '/investment/surplus',
            title: isUrdu ? 'سرمایہ کاری (Investments)' : 'Sarmayakari (Investments)',
        },
        {
            id: 'audit',
            href: '/investment/audit',
            title: isUrdu ? 'ریکارڈ (Audit)' : 'Record (Audit)',
        },
    ];

    return (
        <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3.5 space-y-3 shadow-xs">
            {/* Top row: Heading, Pending Approvals badge (if any), and ONE main action button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Left side: Page Title Heading matching POS standard */}
                <div className="flex items-center gap-3 flex-wrap min-h-[36px]">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-[#1F2937] tracking-tight leading-tight">
                            {isUrdu ? 'سرمایہ و قرضہ لیجر' : 'Investment & Capital Ledger'}
                        </h1>
                        <p className="text-xs text-[#4B5563] mt-0.5">
                            {isUrdu ? 'سرمایہ، قرضہ اور سرمایہ کاری کھاتہ' : 'Sarmaya, Qarza aur Sarmayakari Khata'}
                        </p>
                    </div>

                    {pendingApprovalsCount > 0 && (
                        <Link
                            href="/investment/audit?filter=pending"
                            title="Pending approvals list dekhne ke liye click karein"
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-[#1F2937] border border-amber-300 hover:bg-amber-100 transition-colors flex items-center gap-2 cursor-pointer select-none self-center"
                        >
                            <span className="size-2 rounded-full bg-amber-600 animate-pulse" />
                            <span>{pendingApprovalsCount} {isUrdu ? 'منظوریاں باقی' : 'Approval Baqi'}</span>
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
                            className="min-h-[40px] px-5 py-2 rounded-lg text-sm font-bold bg-[#14532d] hover:bg-[#166534] active:bg-[#0f3d21] text-white shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                        >
                            <Icon name="Plus" className="size-4 stroke-[3]" />
                            <span>{isUrdu ? 'نئی اینٹری' : 'Nayi Entry'}</span>
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
                                "min-h-[40px] px-5 py-2 rounded-lg text-sm transition-all whitespace-nowrap flex items-center gap-2 border",
                                isActive
                                    ? "bg-[#14532d] text-white border-[#14532d] font-bold shadow-xs"
                                    : "bg-white text-[#374151] hover:bg-gray-100 border-gray-200 font-semibold"
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
