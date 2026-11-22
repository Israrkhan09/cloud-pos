import React from 'react';
import { Link } from '@inertiajs/react';
import Icon from '@/components/ui/icon';

interface AajKaHaalData {
    dena_hai: number;
    dena_hai_sub?: string;
    lena_hai: number;
    lena_hai_sub?: string;
    kaam_count?: number;
    kaam_text?: string;
    kaam_sub?: string;
}

interface AajKaHaalProps {
    data: AajKaHaalData;
    isUrdu?: boolean;
}

export default function AajKaHaal({ data, isUrdu = false }: AajKaHaalProps) {
    const formatRs = (val: number) => 'Rs. ' + Number(val || 0).toLocaleString('en-US');

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <div className="flex items-center gap-2">
                    <Icon name="CalendarBlank" className="size-5 text-[#14532d]" />
                    <h3 className="text-sm font-bold text-[#1F2937] uppercase tracking-wide">
                        {isUrdu ? 'آج کا حال (اہم کاروباری پوزیشن)' : 'Aaj Ka Haal (Karobari Position)'}
                    </h3>
                </div>
                <span className="text-xs font-semibold text-[#4B5563]">
                    {isUrdu ? 'کلک کر کے تفصیل دیکھیں' : 'Click kar ke tafseel dekhein'}
                </span>
            </div>

            {/* Exactly 3 big, bold, high-contrast cards (Section B.6) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Card 1: Hum ko dena hai */}
                <Link
                    href="/investment/loans"
                    prefetch
                    className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 hover:bg-rose-50/60 hover:border-rose-300 transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#374151] uppercase tracking-wider">
                            {isUrdu ? 'ہم کو دینا ہے' : 'Hum Ko Dena Hai'}
                        </span>
                        <Icon name="ArrowUpRight" className="size-4 text-[#4B5563] group-hover:text-rose-700 transition-colors" />
                    </div>
                    <div className="mt-2.5">
                        <span className="text-2xl font-black text-[#1F2937] group-hover:text-rose-700 block">
                            {formatRs(data.dena_hai)}
                        </span>
                        <span className="text-xs font-medium text-[#4B5563] block mt-1">
                            {data.dena_hai_sub || '3 logon ka qarza wapas karna hai'}
                        </span>
                    </div>
                </Link>

                {/* Card 2: Hum ko lena hai */}
                <Link
                    href="/investment/surplus"
                    prefetch
                    className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 hover:bg-emerald-50/60 hover:border-emerald-300 transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#374151] uppercase tracking-wider">
                            {isUrdu ? 'ہم کو لینا ہے' : 'Hum Ko Lena Hai'}
                        </span>
                        <Icon name="ArrowDownLeft" className="size-4 text-[#4B5563] group-hover:text-emerald-700 transition-colors" />
                    </div>
                    <div className="mt-2.5">
                        <span className="text-2xl font-black text-[#1F2937] group-hover:text-[#14532d] block">
                            {formatRs(data.lena_hai)}
                        </span>
                        <span className="text-xs font-medium text-[#4B5563] block mt-1">
                            {data.lena_hai_sub || 'Faltu paisa aur munafa wapas aana hai'}
                        </span>
                    </div>
                </Link>

                {/* Card 3: Aaj ka kaam */}
                <Link
                    href="/investment/loans"
                    prefetch
                    className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 hover:bg-amber-50/60 hover:border-amber-300 transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#374151] uppercase tracking-wider">
                            {isUrdu ? 'آج کا کام' : 'Aaj Ka Kaam'}
                        </span>
                        <Icon name="WarningCircle" className="size-4 text-amber-700" />
                    </div>
                    <div className="mt-2.5">
                        <span className="text-lg font-black text-[#1F2937] group-hover:text-amber-800 block">
                            {data.kaam_text || '1 qarza overdue, 1 fund muddat poori'}
                        </span>
                        <span className="text-xs font-medium text-[#4B5563] block mt-1">
                            {data.kaam_sub || 'Sohail baqaya Rs. 20,000 · Gold Savings'}
                        </span>
                    </div>
                </Link>
            </div>
        </div>
    );
}
