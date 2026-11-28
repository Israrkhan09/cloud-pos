import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Icon from '@/components/ui/icon';
import MandiPageHeader from '@/components/app/mandi-page-header';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

interface MarkRow {
    mark_id: number;
    name_en: string;
    name_ur: string;
    nag: number;
    jama: number;
    banam: number;
}

interface FarmerOption {
    id: number;
    code: number;
    name_en: string;
    name_ur: string;
    phone?: string;
    current_balance: number;
    opening_balance: number;
}

interface Props {
    farmers: FarmerOption[];
    selectedFarmerId: number;
    selectedFarmer: FarmerOption | null;
    marksData: MarkRow[];
    summary: {
        baqaya: number;
        total_nag: number;
        total_jama: number;
        total_banam: number;
    };
    filters: {
        from_date: string;
        to_date: string;
    };
}

export default function FarmerKhataIndex({
    farmers,
    selectedFarmerId,
    selectedFarmer,
    marksData,
    summary,
    filters,
}: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [fromDate, setFromDate] = useState(filters.from_date || new Date().toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(filters.to_date || new Date().toISOString().split('T')[0]);
    const [infoOpen, setInfoOpen] = useState(false);

    // 30-second background polling for real-time updates
    React.useEffect(() => {
        const interval = setInterval(() => {
            router.reload({ preserveScroll: true, preserveState: true });
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'کھاتہ' : 'Khata', href: '#' },
        { title: isUrdu ? 'کسان کھاتہ' : 'Farmer Khata', href: '/khata' },
    ];

    function handleFilterChange(newFarmerId: number, from: string, to: string) {
        setFromDate(from);
        setToDate(to);
        router.get('/khata', {
            farmer_id: newFarmerId,
            from_date: from,
            to_date: to,
        }, {
            preserveState: true,
            replace: true,
            onSuccess: () => {
                toast.success(isUrdu ? 'کسان کھاتہ اپڈیٹ ہو گیا' : 'Farmer khata updated');
            },
        });
    }

    const isNegative = summary.baqaya < 0;
    const absBaqaya = Math.abs(summary.baqaya);
    const farmerDisplayName = selectedFarmer
        ? (isUrdu ? (selectedFarmer.name_ur || selectedFarmer.name_en) : (selectedFarmer.name_en || selectedFarmer.name_ur))
        : '';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'کسان کھاتہ' : 'Farmer Khata'} />

            {/* Screen UI - Clean Simple Style */}
            <div className="-mt-4 -mx-4 -mb-8 pb-28 bg-[#f4f6f4] min-h-screen font-sans text-[#1a211c] print:hidden" dir={isUrdu ? 'rtl' : 'ltr'}>
                
                {/* 1. Greenish Top Header Banner */}
                <MandiPageHeader
                    title={
                        <span className="flex items-center gap-2">
                            <span>Farmer Ledger</span>
                            <span className="font-nastaliq font-normal text-emerald-100 text-lg md:text-xl">کسان کھاتہ</span>
                        </span>
                    }
                    subtitle={isUrdu ? 'کسان کا جمع / بنام (فرد حساب)' : 'Farmer Account Statement'}
                    isUrdu={isUrdu}
                >
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="h-8.5 px-4 rounded-xl text-xs font-semibold bg-white text-emerald-900 hover:bg-emerald-50 shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                        <Icon name="Printer" className="size-4 text-emerald-800" />
                        <span>Print</span>
                    </button>
                </MandiPageHeader>

                {/* 2. Floating Content Area */}
                <div className="max-w-7xl mx-auto px-3 md:px-6 -mt-6 md:-mt-8 space-y-4">
                    
                    

                    {/* Filter Card: Farmer, Se, Tak */}
                    <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs p-3.5 md:p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-[#374151] mb-1">
                                    Farmer
                                </label>
                                <select
                                    value={selectedFarmerId}
                                    onChange={e => handleFilterChange(Number(e.target.value), fromDate, toDate)}
                                    className="w-full h-9 px-3 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-900 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                                >
                                    {farmers.map(f => (
                                        <option key={f.id} value={f.id}>
                                            {f.name_en || f.name_ur} (#{f.code})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[#374151] mb-1">
                                    Se
                                </label>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={e => handleFilterChange(selectedFarmerId, e.target.value, toDate)}
                                    className="w-full h-9 px-3 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-900 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[#374151] mb-1">
                                    Tak
                                </label>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={e => handleFilterChange(selectedFarmerId, fromDate, e.target.value)}
                                    className="w-full h-9 px-3 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-900 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Summary Card: Pure White Card with 4 columns divided by vertical borders */}
                    <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs p-4 md:p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 items-center divide-y md:divide-y-0 md:divide-x md:divide-gray-100">
                        {/* 1. Baqaya */}
                        <div className="space-y-0.5">
                            <span className="text-xs font-bold text-[#4B5563] block">
                                Balance
                            </span>
                            <div className="text-xl md:text-2xl font-black text-[#1F2937]">
                                {isNegative ? `- Rs. ${absBaqaya.toLocaleString()}` : `Rs. ${absBaqaya.toLocaleString()}`}
                            </div>
                            <span className="text-xs font-semibold text-[#374151] block pt-0.5 truncate">
                                {farmerDisplayName}
                            </span>
                        </div>

                        {/* 2. Total nag */}
                        <div className="md:ps-5 pt-3 md:pt-0 space-y-0.5">
                            <span className="text-xs font-bold text-[#4B5563] block">
                                Total Units / Bags
                            </span>
                            <div className="text-lg md:text-xl font-black text-[#1F2937]">
                                {summary.total_nag}
                            </div>
                        </div>

                        {/* 3. Jama */}
                        <div className="md:ps-5 pt-3 md:pt-0 space-y-0.5">
                            <span className="text-xs font-bold text-[#4B5563] block">
                                Credit
                            </span>
                            <div className="text-lg md:text-xl font-black text-[#1F2937]">
                                Rs. {Number(summary.total_jama).toLocaleString()}
                            </div>
                        </div>

                        {/* 4. Banam */}
                        <div className="md:ps-5 pt-3 md:pt-0 space-y-0.5">
                            <span className="text-xs font-bold text-[#4B5563] block">
                                Debit
                            </span>
                            <div className="text-lg md:text-xl font-black text-[#1F2937]">
                                Rs. {Number(summary.total_banam).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Table Card: Pure white, clean dark headers, simple borders */}
                    <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm font-sans">
                                <thead>
                                    <tr className="text-[#374151] border-b border-gray-200 font-bold bg-gray-50/80 text-xs md:text-sm">
                                        <th className="px-4 py-3 text-start">Mark</th>
                                        <th className="px-4 py-3 text-end">Units</th>
                                        <th className="px-4 py-3 text-end">Credit</th>
                                        <th className="px-4 py-3 text-end">Debit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {marksData.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-gray-500 font-medium text-sm">
                                                No records found for this period
                                            </td>
                                        </tr>
                                    ) : (
                                        marksData.map(m => (
                                            <tr key={m.mark_id} className="hover:bg-gray-50/60 transition-colors text-sm">
                                                <td className="px-4 py-3.5 font-bold text-[#1F2937] text-sm md:text-[15px]">
                                                    {m.name_en || m.name_ur}
                                                </td>
                                                <td className="px-4 py-3.5 text-end font-bold text-[#1F2937] text-sm md:text-[15px]">
                                                    {m.nag}
                                                </td>
                                                <td className="px-4 py-3.5 text-end font-bold text-[#1F2937] text-sm md:text-[15px]">
                                                    {m.jama > 0 ? Number(m.jama).toLocaleString() : '0'}
                                                </td>
                                                <td className="px-4 py-3.5 text-end font-bold text-[#1F2937] text-sm md:text-[15px]">
                                                    {m.banam > 0 ? Number(m.banam).toLocaleString() : '0'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-gray-900 bg-gray-50/80 font-bold text-[#1F2937] text-sm md:text-[15px]">
                                        <td className="px-4 py-3.5">Total</td>
                                        <td className="px-4 py-3.5 text-end">{summary.total_nag}</td>
                                        <td className="px-4 py-3.5 text-end">
                                            {Number(summary.total_jama).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3.5 text-end">
                                            {Number(summary.total_banam).toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Thermal 80mm Print Document */}
            <div id="printable-farmer-khata" className="hidden print:block p-4 bg-white text-black font-sans text-xs max-w-[80mm] mx-auto print-document-container" dir={isUrdu ? 'rtl' : 'ltr'}>
                {/* Header: Green V Logo + Vegetable POS */}
                <div className="text-center border-b-2 border-[#166534] pb-2 mb-3">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                        <div className="w-6 h-6 rounded bg-[#166534] flex items-center justify-center text-white font-black text-xs">V</div>
                        <h1 className="text-base font-extrabold tracking-tight text-[#166534] uppercase">
                            Vegetable POS
                        </h1>
                    </div>
                    <p className="text-[11px] font-semibold text-gray-700">
                        {isUrdu ? 'کسان کھاتہ · فرد حساب' : 'Farmer Khata · Fard Hisab'}
                    </p>
                </div>

                {/* Farmer Details */}
                <div className="border border-gray-400 rounded p-2 mb-3 text-[11px] space-y-1 bg-gray-50/50">
                    <div className="flex justify-between font-bold">
                        <span>{selectedFarmer?.name_en || selectedFarmer?.name_ur || '—'}</span>
                        <span>#{selectedFarmer?.code}</span>
                    </div>
                    {selectedFarmer?.phone && (
                        <div className="text-gray-600 text-[10px]">
                            Ph: {selectedFarmer.phone}
                        </div>
                    )}
                    <div className="text-[10px] text-gray-600 pt-0.5 border-t border-gray-200 flex justify-between">
                        <span>Period:</span>
                        <span>{fromDate} to {toDate}</span>
                    </div>
                </div>

                {/* Baqaya Box */}
                <div className="border border-black rounded p-2 mb-3 text-center bg-gray-50">
                    <span className="text-[10px] text-gray-600 uppercase font-bold block">{isUrdu ? 'بقایا' : 'Outstanding Balance'}</span>
                    <strong className="text-base font-black text-gray-900">
                        {isNegative ? `– Rs. ${absBaqaya.toLocaleString()}` : `Rs. ${absBaqaya.toLocaleString()}`}
                    </strong>
                </div>

                {/* Mark Table */}
                <table className="w-full text-[10px] border border-black border-collapse mb-3">
                    <thead>
                        <tr className="bg-gray-100 border-b border-black font-bold">
                            <th className="p-1 text-start border-e border-black">Mark</th>
                            <th className="p-1 text-end border-e border-black">Units</th>
                            <th className="p-1 text-end border-e border-black">Credit</th>
                            <th className="p-1 text-end">Debit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {marksData.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-3 text-center text-gray-500">
                                    No records
                                </td>
                            </tr>
                        ) : (
                            marksData.map(m => (
                                <tr key={m.mark_id} className="border-b border-gray-300">
                                    <td className="p-1 border-e border-black font-semibold">{m.name_en || m.name_ur}</td>
                                    <td className="p-1 text-end border-e border-black">{m.nag}</td>
                                    <td className="p-1 text-end border-e border-black">{Number(m.jama).toLocaleString()}</td>
                                    <td className="p-1 text-end">{Number(m.banam).toLocaleString()}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-black font-bold bg-gray-100">
                            <td className="p-1 border-e border-black">Total</td>
                            <td className="p-1 text-end border-e border-black">{summary.total_nag}</td>
                            <td className="p-1 text-end border-e border-black">{Number(summary.total_jama).toLocaleString()}</td>
                            <td className="p-1 text-end">{Number(summary.total_banam).toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>

                {/* Print Footer: Only "Printed on", NO signatures */}
                <div className="text-center text-[9px] text-gray-500 pt-2 border-t border-gray-300">
                    Printed on: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                </div>
            </div>

            
        </AppLayout>
    );
}
