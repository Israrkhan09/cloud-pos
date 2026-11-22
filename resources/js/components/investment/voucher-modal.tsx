import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

export interface VoucherData {
    ref_no: string;
    date: string;
    party: string;
    type: string;
    type_label: string;
    amount: number;
    payment_method: string;
    bank_name?: string | null;
    reason?: string | null;
    approval_status: string;
    approved_by?: string | null;
    is_advance?: boolean;
    advance_amount?: number;
}

interface VoucherModalProps {
    isOpen: boolean;
    onClose: () => void;
    voucher: VoucherData | null;
    isUrdu?: boolean;
}

export default function VoucherModal({
    isOpen,
    onClose,
    voucher,
    isUrdu = false,
}: VoucherModalProps) {
    const [whatsappPhone, setWhatsappPhone] = useState('');

    if (!voucher) return null;

    const formattedAmount = 'Rs. ' + Number(voucher.amount || 0).toLocaleString('en-US');

    const handlePrint = () => {
        window.print();
    };

    const handleWhatsAppShare = () => {
        const textMsg = encodeURIComponent(
            `*VEGETABLE POS - INVESTMENT VOUCHER*\n` +
            `Ref: ${voucher.ref_no}\n` +
            `Date: ${voucher.date}\n` +
            `Party: ${voucher.party}\n` +
            `Type: ${voucher.type_label}\n` +
            `Amount: ${formattedAmount}\n` +
            `Payment: ${voucher.payment_method.toUpperCase()}${voucher.bank_name ? ` (${voucher.bank_name})` : ''}\n` +
            `Status: ${voucher.approval_status.replace('_', ' ').toUpperCase()}\n` +
            (voucher.reason ? `Note: ${voucher.reason}\n` : '') +
            `\nGenerated from Vegetable POS.`
        );

        const cleanPhone = whatsappPhone.replace(/\D/g, '');
        const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${textMsg}` : `https://wa.me/?text=${textMsg}`;
        window.open(url, '_blank');
        toast.success(isUrdu ? 'واٹس ایپ شیئر کھول دیا گیا' : 'WhatsApp window opened.');
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg w-full p-0 overflow-hidden font-sans bg-white text-[#1a211c]">
                {/* Screen Header */}
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div>
                        <DialogTitle className="text-base font-bold text-gray-900">
                            {isUrdu ? 'انویسٹمنٹ واؤچر' : 'Investment Parchi (Voucher)'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-gray-500">
                            Parchi No: {voucher.ref_no}
                        </DialogDescription>
                    </div>
                </div>

                {/* Voucher Printable Canvas */}
                <div id="printable-voucher" className="p-6 space-y-5 bg-white">
                    {/* Header */}
                    <div className="border-b-2 border-[#14532d] pb-3 flex items-start justify-between">
                        <div>
                            <h2 className="text-lg font-black text-[#14532d] tracking-tight">VEGETABLE POS</h2>
                            <p className="text-xs text-gray-500">Investment & Capital Khata</p>
                        </div>
                        <div className="text-end">
                            <span className="text-xs font-mono font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded border border-gray-300">
                                {voucher.ref_no}
                            </span>
                            <p className="text-xs text-gray-500 mt-1">{voucher.date}</p>
                        </div>
                    </div>

                    {/* Voucher Details Grid */}
                    <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                            <span className="text-gray-500 block">Party / Khata:</span>
                            <span className="font-bold text-sm text-gray-900">{voucher.party}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 block">Andraaj ki Qisam (Type):</span>
                            <span className="font-bold text-sm text-gray-900">{voucher.type_label}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 block">Adaigi ka Zariya (Payment):</span>
                            <span className="font-semibold text-gray-800">
                                {voucher.payment_method === 'cash' ? 'CASH (GALLA)' : 'BANK ACCOUNT'}
                                {voucher.bank_name && ` — ${voucher.bank_name}`}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-500 block">Manzoori Status:</span>
                            <span className="font-semibold text-emerald-700 capitalize">
                                {voucher.approval_status === 'approved' ? 'Manzoor Shuda (Owner)' : voucher.approval_status === 'pending_owner' ? 'Owner Manzoori Baqi' : voucher.approval_status === 'reversed' ? 'Mansookh' : 'Darj Shuda'}
                            </span>
                        </div>
                    </div>

                    {/* Amount Banner */}
                    <div className="p-4 bg-[#ecf5ee] border border-emerald-300 rounded-xl flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-950 uppercase">Kul Rakam (Total):</span>
                        <span className="text-xl font-black text-[#14532d]">{formattedAmount}</span>
                    </div>

                    {voucher.reason && (
                        <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <span className="font-semibold text-gray-800 block mb-0.5">Note / Wajah:</span>
                            <p>{voucher.reason}</p>
                        </div>
                    )}

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-6 pt-6 text-center text-xs text-gray-500">
                        <div className="border-t border-gray-300 pt-2">
                            <span>Prepared By (Munshi ke Dastakhat)</span>
                        </div>
                        <div className="border-t border-gray-300 pt-2">
                            <span>Authorised Signature (Owner ke Dastakhat)</span>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    {/* Optional phone input for WhatsApp */}
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={whatsappPhone}
                            onChange={(e) => setWhatsappPhone(e.target.value)}
                            placeholder="WhatsApp No (e.g. 03001234567)"
                            className="w-full h-9 px-3 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#14532d]"
                        />
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                        <button
                            type="button"
                            onClick={handleWhatsAppShare}
                            className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            <Icon name="WhatsappLogo" className="size-4" />
                            <span>WhatsApp Par Bhejein</span>
                        </button>

                        <button
                            type="button"
                            onClick={handlePrint}
                            className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold text-white bg-[#14532d] hover:bg-[#166534] rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            <Icon name="Printer" className="size-4" />
                            <span>Parchi Print Karein</span>
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
