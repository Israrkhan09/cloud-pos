import React, { useEffect, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';

interface InvestmentHeaderProps {
    currentTab: 'partners' | 'loans' | 'surplus' | 'audit';
    userName?: string;
    pendingApprovalsCount?: number;
    lastUpdated?: string;
    onOpenEntry: () => void;
    isUrdu?: boolean;
}

export default function InvestmentHeader({
    currentTab,
    userName = 'Hajji Muhammad (Malik)',
    pendingApprovalsCount = 0,
    lastUpdated,
    onOpenEntry,
    isUrdu = false,
}: InvestmentHeaderProps) {
    const [currentTime, setCurrentTime] = useState<string>(
        lastUpdated || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    );

    // Keyboard shortcut: Ctrl+N for new entry
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
                e.preventDefault();
                onOpenEntry();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onOpenEntry]);

    // Polling every 25 seconds for realtime background updates without full page refresh
    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setCurrentTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
                },
            });
        }, 25000);

        return () => clearInterval(interval);
    }, []);

    const tabs = [
        {
            id: 'partners',
            href: '/investment/partners',
            title: isUrdu ? 'پارٹنرز اور ایکویٹی' : 'Partners & Equity',
        },
        {
            id: 'loans',
            href: '/investment/loans',
            title: isUrdu ? 'قرضے (Loans)' : 'Qarze (Loans)',
        },
        {
            id: 'surplus',
            href: '/investment/surplus',
            title: isUrdu ? 'سرپلس: فالتو پیسہ (Bank FD jaisa)' : 'Surplus: Faltu Paisa (Bank FD jaisa)',
        },
        {
            id: 'audit',
            href: '/investment/audit',
            title: isUrdu ? 'آڈٹ اور واؤچرز' : 'Audit & Vouchers',
        },
    ];

    const tabExplainers: Record<string, { en: string; ur: string }> = {
        partners: {
            en: 'Karobar ke shareek daron ka sarmaya, munafa hissa aur drawings ka hisab.',
            ur: 'کاروبار کے شریک داروں کا سرمایہ، منافع حصہ اور ڈرائنگز کا حساب۔',
        },
        loans: {
            en: 'Mandi ke mukhtasar muddat ke qarzay aur unki wapsi tareekhein.',
            ur: 'منڈی کے مختصر مدت کے قرضے اور ان کی واپسی کی تاریخیں۔',
        },
        surplus: {
            en: 'Faltu Paisa (Bank FD jaisa) — Faarigh raqam par munafa kamane aur wapsi ka hisab.',
            ur: 'فالتو پیسہ (بینک ایف ڈی جیسا) — فارغ رقم پر منافع کمانے اور واپسی کا حساب۔',
        },
        audit: {
            en: 'Parchi aur entry ka mukammal record jahan koi purani entry delete nahi hoti balkay reversal hoti hai.',
            ur: 'پرچی اور اینٹری کا مکمل ریکارڈ جہاں کوئی پرانی اینٹری ڈیلیٹ نہیں ہوتی بلکہ ریورسل ہوتی ہے۔',
        },
    };

    return (
        <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3.5 space-y-3 shadow-xs">
            {/* Top row: Live indicator, User Name pill, Pending Approvals badge, and Primary + Entry button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Left side: Live Pulse & Explainer */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200/80 text-[11px] font-semibold text-emerald-900 select-none">
                        <span className="size-2 rounded-full bg-emerald-600 animate-pulse" />
                        <span>Live · Last updated: {currentTime}</span>
                    </div>

                    {/* Pending Approvals clickable badge (Section D.3) */}
                    {pendingApprovalsCount > 0 && (
                        <Link
                            href="/investment/audit?filter=pending"
                            title="Pending approvals list dekhne ke liye click karein"
                            className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors flex items-center gap-1.5 cursor-pointer select-none"
                        >
                            <span className="size-2 rounded-full bg-amber-600 animate-pulse" />
                            <span>{pendingApprovalsCount} {isUrdu ? 'منظوریاں باقی' : 'Approval Baqi'}</span>
                            <Icon name="ArrowRight" className="size-3 text-amber-700" />
                        </Link>
                    )}
                </div>

                {/* Right side: Logged-in user name (No Role label or switcher) & + Nayi Entry */}
                <div className="flex items-center gap-2.5 justify-end">
                    {/* Logged-in User Name Pill (Section A.1) */}
                    <div className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200 flex items-center gap-1.5 select-none">
                        <Icon name="User" className="size-3.5 text-gray-600" />
                        <span>{userName}</span>
                    </div>

                    {/* Primary + Entry Button */}
                    <button
                        type="button"
                        onClick={onOpenEntry}
                        className="min-h-[38px] px-4 py-2 rounded-lg text-xs md:text-sm font-bold bg-[#14532d] hover:bg-[#166534] active:bg-[#0f3d21] text-white shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                    >
                        <Icon name="Plus" className="size-4 stroke-[3]" />
                        <span>{isUrdu ? 'نئی اینٹری' : 'Nayi Entry'}</span>
                        <span className="text-[11px] opacity-80 font-normal hidden sm:inline">(Ctrl N)</span>
                    </button>
                </div>
            </div>

            {/* Bottom row: Module Navigation Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                {tabs.map((tab) => {
                    const isActive = currentTab === tab.id;
                    return (
                        <Link
                            key={tab.id}
                            href={tab.href}
                            prefetch
                            className={cn(
                                "min-h-[38px] px-4 py-1.5 rounded-lg text-xs md:text-sm transition-all whitespace-nowrap flex items-center gap-1.5 border",
                                isActive
                                    ? "bg-[#14532d] text-white border-[#14532d] font-bold shadow-xs"
                                    : "bg-white text-gray-700 hover:bg-gray-100 border-gray-200 font-medium"
                            )}
                        >
                            <span>{tab.title}</span>
                        </Link>
                    );
                })}
            </div>

            {/* 1-line explainer under tabs (Section C.3) */}
            <div className="text-[11px] text-gray-600 bg-gray-50/70 border border-gray-200/60 rounded-md px-3 py-1.5 flex items-center gap-2">
                <Icon name="Info" className="size-3.5 text-gray-500 shrink-0" />
                <span>{isUrdu ? tabExplainers[currentTab]?.ur : tabExplainers[currentTab]?.en}</span>
            </div>
        </div>
    );
}
