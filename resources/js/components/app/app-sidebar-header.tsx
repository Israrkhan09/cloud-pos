import React, { useState, useEffect } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { LanguageToggle } from '@/components/app/language-toggle';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { GlobalSearchDialog } from '@/components/app/global-search-dialog';
import { usePage, router } from '@inertiajs/react';

export function AppSidebarHeader({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItemType[] }) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';
    const [searchOpen, setSearchOpen] = useState(false);
    const { auth, business } = usePage().props as any;

    // Global shortcut Ctrl+K / Cmd+K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                setSearchOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleLogout = () => {
        router.post(route('logout'));
    };

    return (
        <header className="sticky top-0 z-20 bg-[#eef2ee]/95 backdrop-blur-md border-b border-[#d8e0d8] flex h-14 shrink-0 items-center gap-3 px-4 md:px-6">
            <div className="flex items-center justify-between w-full gap-3">
                {/* Left: Sidebar toggle + Global search */}
                <div className="flex items-center gap-3 min-w-0">
                    <SidebarTrigger className="-ms-1 rtl-flip text-[#68736b] hover:text-[#1a211c] hover:bg-[#e2e8e2] rounded-lg p-2 cursor-pointer" />
                    
                    <button
                        type="button"
                        onClick={() => setSearchOpen(true)}
                        className="hidden sm:flex items-center gap-2 px-3 py-1.5 border border-[#d8e0d8] bg-white hover:border-[#14532d] rounded-lg text-xs text-[#68736b] hover:text-[#1a211c] w-64 md:w-80 shadow-2xs transition-colors cursor-pointer text-start"
                    >
                        <MagnifyingGlassIcon className="size-4 shrink-0 text-[#68736b]" />
                        <span className="flex-1 truncate">
                            {isUrdu ? 'مرچنٹ، کسان یا صفحہ تلاش کریں...' : 'Search merchant, farmer or page...'}
                        </span>
                        <kbd className="border border-[#d8e0d8] bg-[#f6f7f6] rounded px-1.5 py-0.5 text-[10px] font-mono text-[#68736b]">
                            Ctrl K
                        </kbd>
                    </button>
                </div>

                {/* Right: Business Badge + User Info + Language toggle + Notifications + Direct Logout */}
                <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                    {/* Active Business Badge */}
                    {business?.name && (
                        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 shadow-2xs">
                            <Icon name="Storefront" className="size-3.5 text-emerald-700" />
                            <span className="truncate max-w-[160px]">{business.name}</span>
                        </div>
                    )}

                    {/* Authenticated User Badge */}
                    {auth?.user && (
                        <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-[#d8e0d8] text-xs text-[#2e3831] shadow-2xs">
                            <span className="font-semibold truncate max-w-[120px]">{auth.user.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f0f4f0] text-emerald-800 font-mono font-medium">
                                {auth.role || auth.user.role || 'User'}
                            </span>
                        </div>
                    )}

                    {/* Language toggle */}
                    <LanguageToggle />

                    {/* Notifications with red indicator dot */}
                    <Button variant="ghost" size="icon" className="relative size-8 text-[#68736b] hover:text-[#1a211c] hover:bg-[#e2e8e2] rounded-lg cursor-pointer" title="Notifications">
                        <Icon name="Bell" className="size-4.5" />
                        <span className="absolute top-1.5 end-1.5 size-2 rounded-full bg-[#b42318] ring-2 ring-white" />
                    </Button>

                    {/* Highly Visible Dedicated Logout Button */}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleLogout}
                        className="h-8 gap-1.5 border-rose-300 text-rose-700 bg-white hover:bg-rose-50 hover:text-rose-800 hover:border-rose-400 font-medium text-xs px-2.5 cursor-pointer shadow-2xs transition-colors"
                        title={isUrdu ? 'لاگ آؤٹ کریں' : 'Logout'}
                    >
                        <Icon name="SignOut" className="size-4 text-rose-600" />
                        <span className="hidden sm:inline">{isUrdu ? 'لاگ آؤٹ' : 'Logout'}</span>
                    </Button>
                </div>
            </div>

            {/* Global Search Dialog Modal */}
            <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
        </header>
    );
}
