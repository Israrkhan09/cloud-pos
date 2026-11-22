import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';

export interface BreakdownItem {
    label: string;
    amount?: number;
    note?: string;
}

export interface BreakdownData {
    title: string;
    total?: number;
    items: BreakdownItem[];
    note?: string;
}

interface BreakdownModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: BreakdownData | null;
}

export default function BreakdownModal({ isOpen, onClose, data }: BreakdownModalProps) {
    if (!data) return null;

    const formatRs = (val?: number) => {
        if (val === undefined || val === null) return '—';
        return 'Rs. ' + Number(val).toLocaleString('en-US');
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md w-full p-6 bg-white font-sans text-[#1a211c]">
                <DialogHeader className="border-b border-gray-100 pb-3">
                    <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <Icon name="Calculator" className="size-5 text-[#14532d]" />
                        <span>{data.title}</span>
                    </DialogTitle>
                    {data.total !== undefined && (
                        <DialogDescription className="text-sm font-black text-[#14532d] pt-1">
                            Kul Total: {formatRs(data.total)}
                        </DialogDescription>
                    )}
                </DialogHeader>

                <div className="py-3 space-y-3">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                        Tafseel (Breakdown Hisab):
                    </span>

                    <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                        {data.items.map((item, idx) => (
                            <div key={idx} className="p-3 bg-gray-50/50 flex flex-col gap-1">
                                <div className="flex items-center justify-between text-xs font-semibold text-gray-900">
                                    <span>{item.label}</span>
                                    {item.amount !== undefined && (
                                        <span className="font-bold text-[#14532d]">{formatRs(item.amount)}</span>
                                    )}
                                </div>
                                {item.note && (
                                    <span className="text-[11px] text-gray-500">{item.note}</span>
                                )}
                            </div>
                        ))}
                    </div>

                    {data.note && (
                        <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-emerald-950 flex items-start gap-2">
                            <Icon name="Info" className="size-4 text-emerald-700 shrink-0 mt-0.5" />
                            <span>{data.note}</span>
                        </div>
                    )}
                </div>

                <div className="pt-2 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                        Band Karein
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
