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
            <DialogContent className="max-w-md w-full p-6 bg-white font-sans text-[#1F2937] shadow-xl border border-gray-200 rounded-2xl">
                {/* Header */}
                <DialogHeader className="border-b border-gray-200 pb-3.5 space-y-2">
                    <DialogTitle className="text-base font-bold text-[#1F2937] flex items-center gap-2.5">
                        <span className="p-1.5 rounded-lg bg-emerald-100 text-[#14532d]">
                            <Icon name="Calculator" className="size-4" />
                        </span>
                        <span>{data.title}</span>
                    </DialogTitle>
                    {data.total !== undefined && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                            <span className="text-xs font-bold text-[#374151]">
                                Kul Total Rakam:
                            </span>
                            <span className="text-lg font-black text-[#14532d]">
                                {formatRs(data.total)}
                            </span>
                        </div>
                    )}
                </DialogHeader>

                {/* Body Content */}
                <div className="py-3 space-y-3">
                    <span className="text-xs font-bold text-[#374151] tracking-wide uppercase block">
                        Details (Statement Breakdown):
                    </span>

                    {/* Breakdown Items List */}
                    <div className="space-y-2.5">
                        {data.items.map((item, idx) => (
                            <div
                                key={idx}
                                className="p-3.5 bg-gray-50/70 border border-gray-200 rounded-xl space-y-1 hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-bold text-[#1F2937]">
                                        {item.label}
                                    </span>
                                    {item.amount !== undefined && (
                                        <span className="text-sm font-black text-[#14532d] shrink-0">
                                            {formatRs(item.amount)}
                                        </span>
                                    )}
                                </div>
                                {item.note && (
                                    <p className="text-xs font-medium text-[#374151] leading-relaxed">
                                        {item.note}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Note / Explainer Callout */}
                    {data.note && (
                        <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs flex items-start gap-2.5 mt-2">
                            <Icon name="Info" className="size-4 text-blue-700 shrink-0 mt-0.5" />
                            <p className="text-xs font-medium text-[#1F2937] leading-relaxed">
                                {data.note}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="pt-2 flex justify-end border-t border-gray-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-[38px] px-5 py-2 text-xs font-bold text-white bg-[#14532d] hover:bg-[#166534] rounded-lg shadow-xs transition-colors cursor-pointer"
                    >
                        Band Karein
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
