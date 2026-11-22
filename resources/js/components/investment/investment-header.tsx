import React, { useEffect, useRef } from 'react';
import { Link, router } from '@inertiajs/react';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface InvestmentHeaderProps {
    currentTab: 'partners' | 'loans' | 'surplus' | 'audit';
    currentRole: 'munshi' | 'owner';
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onOpenEntry: () => void;
    isUrdu?: boolean;
}

export default function InvestmentHeader({
    currentTab,
    currentRole,
    searchTerm,
    onSearchChange,
    onOpenEntry,
    isUrdu = false,
}: InvestmentHeaderProps) {
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Keyboard shortcuts: Ctrl+N for new entry, Ctrl+K or '/' for search focus
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Ctrl+N or Cmd+N
            if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
                e.preventDefault();
                onOpenEntry();
            }
            // Check for Ctrl+K or Cmd+K
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            // '/' shortcut when not inside an input/textarea
            if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onOpenEntry]);

    const handleToggleRole = () => {
        const newRole = currentRole === 'munshi' ? 'owner' : 'munshi';
        router.post('/investment/role', { role: newRole }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success(
                    newRole === 'owner'
                        ? (isUrdu ? 'آپ اب بطور اونر لاگ ان ہیں' : 'Role: Owner shuru ho gaya (Mukammal manzoori ki ijazat)')
                        : (isUrdu ? 'آپ اب بطور منشی لاگ ان ہیں' : 'Role: Munshi shuru ho gaya (Mehdood ijazat)')
                );
            },
        });
    };

    const tabs = [
        {
            id: 'partners',
            href: '/investment/partners',
            title: isUrdu ? 'پارٹنرز اور ایکویٹی' : 'Partners & Equity',
            icon: 'Users',
        },
        {
            id: 'loans',
            href: '/investment/loans',
            title: isUrdu ? 'قرضے (Loans)' : 'Qarze (Loans)',
            icon: 'HandCoins',
        },
        {
            id: 'surplus',
            href: '/investment/surplus',
            title: isUrdu ? 'سرپلس (Surplus)' : 'Surplus (Faltu Paisa)',
            icon: 'ChartLineUp',
        },
        {
            id: 'audit',
            href: '/investment/audit',
            title: isUrdu ? 'آڈٹ اور واؤچرز' : 'Audit & Vouchers',
            icon: 'Receipt',
        },
    ];

    return (
        <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3.5 space-y-3 shadow-xs">
            {/* Top row: Search bar & Primary Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search input with Ctrl+K shortcut indicator */}
                <div className="relative flex-1 max-w-md">
                    <Icon
                        name="MagnifyingGlass"
                        className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none"
                    />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={
                            isUrdu
                                ? 'پارٹنر، قرضہ، فنڈ یا اینٹری تلاش کریں (Ctrl K)'
                                : 'Partner, dene wala, fund ya entry dhoondein (Ctrl K)'
                        }
                        className="w-full h-10 ps-9 pe-16 text-sm bg-gray-50 hover:bg-gray-100/70 focus:bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532d] focus:border-transparent transition-all"
                    />
                    <span className="absolute end-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[11px] font-medium text-gray-400 bg-gray-200/70 rounded border border-gray-300/50 pointer-events-none">
                        Ctrl K
                    </span>
                </div>

                {/* Right side: Role Switcher & + Entry button */}
                <div className="flex items-center gap-2.5 justify-end">
                    {/* Role indicator & toggle badge */}
                    <button
                        type="button"
                        onClick={handleToggleRole}
                        title="Role tabdeel karne ke liye click karein (Munshi / Owner)"
                        className={cn(
                            "min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer select-none",
                            currentRole === 'owner'
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                                : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                        )}
                    >
                        <span className={cn(
                            "size-2 rounded-full",
                            currentRole === 'owner' ? "bg-emerald-600 animate-pulse" : "bg-amber-600"
                        )} />
                        <span>
                            {currentRole === 'owner'
                                ? (isUrdu ? 'رول: اونر (مکمل اختیارات)' : 'Role: Owner (Mukammal)')
                                : (isUrdu ? 'رول: منشی (محدود)' : 'Role: Munshi (Mehdood)')}
                        </span>
                        <Icon name="ArrowsLeftRight" className="size-3.5 opacity-70" />
                    </button>

                    {/* Primary + Entry Button */}
                    <button
                        type="button"
                        onClick={onOpenEntry}
                        className="min-h-[40px] px-4 py-2 rounded-lg text-sm font-bold bg-[#14532d] hover:bg-[#166534] active:bg-[#0f3d21] text-white shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
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
                                "min-h-[38px] px-4 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 border",
                                isActive
                                    ? "bg-[#14532d] text-white border-[#14532d] font-semibold shadow-xs"
                                    : "bg-white text-gray-700 hover:bg-gray-100 border-gray-200"
                            )}
                        >
                            <span>{tab.title}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
