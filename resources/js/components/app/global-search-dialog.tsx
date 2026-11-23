import React, { useState, useEffect, useRef } from 'react';
import { router } from '@inertiajs/react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { useTranslation } from 'react-i18next';

interface SearchItem {
    id?: number;
    code?: number | string;
    name: string;
    phone?: string;
    city?: string;
    area?: string;
    balance?: number;
    url: string;
}

interface PageItem {
    title: string;
    title_ur: string;
    url: string;
    category: string;
}

interface GlobalSearchDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [pages, setPages] = useState<PageItem[]>([]);
    const [merchants, setMerchants] = useState<SearchItem[]>([]);
    const [farmers, setFarmers] = useState<SearchItem[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch results on query change (with debounce)
    useEffect(() => {
        if (!open) {
            setQuery('');
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/global-search?q=${encodeURIComponent(query)}`, {
                    headers: { 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (data.success) {
                    setPages(data.pages || []);
                    setMerchants(data.merchants || []);
                    setFarmers(data.farmers || []);
                    setSelectedIndex(0);
                }
            } catch (err) {
                console.error('Error searching:', err);
            } finally {
                setLoading(false);
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [query, open]);

    // Focus input on open
    useEffect(() => {
        if (open) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [open]);

    // Flatten all items for keyboard navigation
    const allItems: { type: string; title: string; subtitle?: string; url: string }[] = [
        ...pages.map(p => ({
            type: 'page',
            title: isUrdu ? p.title_ur : p.title,
            subtitle: p.category,
            url: p.url,
        })),
        ...merchants.map(m => ({
            type: 'merchant',
            title: `${m.name} ${m.code ? `(#${m.code})` : ''}`,
            subtitle: `${m.phone || ''} ${m.city ? `· ${m.city}` : ''} ${m.balance !== undefined ? `· Rs ${Number(m.balance).toLocaleString()}` : ''}`.trim(),
            url: m.url,
        })),
        ...farmers.map(f => ({
            type: 'farmer',
            title: `${f.name} ${f.code ? `(#${f.code})` : ''}`,
            subtitle: `${f.phone || ''} ${f.area ? `· ${f.area}` : ''} ${f.balance !== undefined ? `· Rs ${Number(f.balance).toLocaleString()}` : ''}`.trim(),
            url: f.url,
        })),
    ];

    const handleSelect = (url: string) => {
        onOpenChange(false);
        router.visit(url);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < allItems.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : allItems.length - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (allItems[selectedIndex]) {
                handleSelect(allItems[selectedIndex].url);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl p-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                {/* Search Header Bar */}
                <div className="flex items-center gap-2 pl-4 pr-12 py-3 border-b border-gray-200 bg-gray-50/70">
                    <Icon name="MagnifyingGlass" className="size-5 text-[#14532d] shrink-0" weight="bold" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isUrdu ? 'مرچنٹ، کسان یا صفحہ تلاش کریں...' : 'Search merchant, farmer or page...'}
                        className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded cursor-pointer shrink-0"
                        >
                            <Icon name="X" className="size-4" />
                        </button>
                    )}
                    <kbd className="hidden sm:inline-block border border-gray-200 bg-white rounded px-1.5 py-0.5 text-[10px] font-mono text-gray-500 shadow-2xs shrink-0">
                        ESC
                    </kbd>
                </div>

                {/* Results List */}
                <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-gray-100 text-xs">
                    {loading && (
                        <div className="py-6 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
                            <Icon name="SpinnerGap" className="size-4 animate-spin text-emerald-700" />
                            <span>{isUrdu ? 'تلاش جاری ہے...' : 'Searching...'}</span>
                        </div>
                    )}

                    {!loading && allItems.length === 0 && (
                        <div className="py-8 text-center text-gray-400">
                            {isUrdu ? 'کوئی نتیجہ نہیں ملا' : 'No results found'}
                        </div>
                    )}

                    {/* Pages Group */}
                    {pages.length > 0 && (
                        <div className="py-2">
                            <div className="px-3 py-1 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                {isUrdu ? 'صفحات (Pages)' : 'Pages'}
                            </div>
                            <div className="space-y-0.5 mt-1">
                                {pages.map(page => {
                                    const itemIdx = allItems.findIndex(i => i.url === page.url);
                                    const isSelected = itemIdx === selectedIndex;
                                    return (
                                        <button
                                            key={page.url}
                                            type="button"
                                            onClick={() => handleSelect(page.url)}
                                            className={`w-full px-3 py-2 rounded-xl text-start flex items-center justify-between transition-colors cursor-pointer ${
                                                isSelected
                                                    ? 'bg-emerald-50 text-emerald-950 font-bold'
                                                    : 'hover:bg-gray-50 text-gray-800'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-6 h-6 rounded-lg bg-emerald-100/60 text-emerald-800 flex items-center justify-center shrink-0">
                                                    <Icon name="FileText" className="size-3.5" weight="bold" />
                                                </div>
                                                <span>{isUrdu ? page.title_ur : page.title}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-400 font-medium">
                                                {page.category}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Merchants Group */}
                    {merchants.length > 0 && (
                        <div className="py-2">
                            <div className="px-3 py-1 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                {isUrdu ? 'گاہک / مرچنٹ (Customers)' : 'Gahak / Customers'}
                            </div>
                            <div className="space-y-0.5 mt-1">
                                {merchants.map(merchant => {
                                    const itemIdx = allItems.findIndex(i => i.url === merchant.url);
                                    const isSelected = itemIdx === selectedIndex;
                                    return (
                                        <button
                                            key={merchant.url}
                                            type="button"
                                            onClick={() => handleSelect(merchant.url)}
                                            className={`w-full px-3 py-2 rounded-xl text-start flex items-center justify-between transition-colors cursor-pointer ${
                                                isSelected
                                                    ? 'bg-emerald-50 text-emerald-950 font-bold'
                                                    : 'hover:bg-gray-50 text-gray-800'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 truncate">
                                                <div className="w-6 h-6 rounded-lg bg-blue-100/60 text-blue-800 flex items-center justify-center shrink-0">
                                                    <Icon name="Users" className="size-3.5" weight="bold" />
                                                </div>
                                                <div className="truncate">
                                                    <span className="font-bold text-gray-900 block truncate">
                                                        {merchant.name} {merchant.code ? <span className="font-mono text-gray-500 font-normal">(#{merchant.code})</span> : null}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 block">
                                                        {merchant.phone} {merchant.city ? `· ${merchant.city}` : ''}
                                                    </span>
                                                </div>
                                            </div>
                                            {merchant.balance !== undefined && (
                                                <span className={`text-[11px] font-bold shrink-0 ${Number(merchant.balance) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                                    Rs {Number(merchant.balance).toLocaleString()}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Farmers Group */}
                    {farmers.length > 0 && (
                        <div className="py-2">
                            <div className="px-3 py-1 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                {isUrdu ? 'کسان / زمیندار (Farmers)' : 'Farmers (Kisan)'}
                            </div>
                            <div className="space-y-0.5 mt-1">
                                {farmers.map(farmer => {
                                    const itemIdx = allItems.findIndex(i => i.url === farmer.url);
                                    const isSelected = itemIdx === selectedIndex;
                                    return (
                                        <button
                                            key={farmer.url}
                                            type="button"
                                            onClick={() => handleSelect(farmer.url)}
                                            className={`w-full px-3 py-2 rounded-xl text-start flex items-center justify-between transition-colors cursor-pointer ${
                                                isSelected
                                                    ? 'bg-emerald-50 text-emerald-950 font-bold'
                                                    : 'hover:bg-gray-50 text-gray-800'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 truncate">
                                                <div className="w-6 h-6 rounded-lg bg-amber-100/60 text-amber-800 flex items-center justify-center shrink-0">
                                                    <Icon name="Tractor" className="size-3.5" weight="bold" />
                                                </div>
                                                <div className="truncate">
                                                    <span className="font-bold text-gray-900 block truncate">
                                                        {farmer.name} {farmer.code ? <span className="font-mono text-gray-500 font-normal">(#{farmer.code})</span> : null}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 block">
                                                        {farmer.phone} {farmer.area ? `· ${farmer.area}` : ''}
                                                    </span>
                                                </div>
                                            </div>
                                            {farmer.balance !== undefined && (
                                                <span className="text-[11px] font-bold text-gray-800 shrink-0">
                                                    Rs {Number(farmer.balance).toLocaleString()}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer hints */}
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-[10px] text-gray-400">
                    <div className="flex items-center gap-3">
                        <span>Navigate: <kbd className="font-mono font-bold">↑</kbd> <kbd className="font-mono font-bold">↓</kbd></span>
                        <span>Select: <kbd className="font-mono font-bold">Enter</kbd></span>
                    </div>
                    <span>Vegetable POS Quick Search</span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
