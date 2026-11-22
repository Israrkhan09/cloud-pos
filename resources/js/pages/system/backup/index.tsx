import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import MandiPageHeader from '@/components/app/mandi-page-header';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface CategoryItem {
    id: string;
    title: string;
    title_ur: string;
    description: string;
    icon: string;
    count: number;
}

interface BackupDataResponse {
    category: string;
    title: string;
    title_ur: string;
    columns: string[];
    rows: any[];
    total_count: number;
}

interface Props {
    categories: CategoryItem[];
}

export default function BackupIndex({ categories }: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    const [activeCategory, setActiveCategory] = useState<CategoryItem | null>(null);
    const [backupData, setBackupData] = useState<BackupDataResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'سسٹم' : 'System', href: '#' },
        { title: isUrdu ? 'بیک اپ' : 'Backup', href: '/backup' },
    ];

    async function fetchCategoryData(cat: CategoryItem) {
        setLoading(true);
        try {
            const res = await fetch(`/backup/data?category=${cat.id}`);
            if (!res.ok) throw new Error('Failed to fetch backup data');
            const data: BackupDataResponse = await res.json();
            setBackupData(data);
            return data;
        } catch (err) {
            toast.error(isUrdu ? 'ڈیٹا لوڈ نہیں ہو سکا' : 'Could not load category data');
            return null;
        } finally {
            setLoading(false);
        }
    }

    async function handlePreview(cat: CategoryItem) {
        setActiveCategory(cat);
        setSearchQuery('');
        setPreviewOpen(true);
        await fetchCategoryData(cat);
    }

    async function handleExportExcel(cat: CategoryItem) {
        const data = await fetchCategoryData(cat);
        if (!data || !data.rows || data.rows.length === 0) {
            toast.error(isUrdu ? 'کوئی ڈیٹا موجود نہیں ہے' : 'No data available to export');
            return;
        }

        let csv = '\uFEFF' + data.columns.join(',') + '\n';
        data.rows.forEach(r => {
            const rowVals = data.columns.map((_, i) => {
                const val = r[`col${i + 1}`] ?? '';
                return `"${String(val).replace(/"/g, '""')}"`;
            });
            csv += rowVals.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const catName = cat.title.replace(/\s+/g, '_');
        link.setAttribute('download', `${catName}_Backup_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(isUrdu ? `${cat.title} ایکسل بیک اپ ڈاؤنلوڈ ہو گیا` : `${cat.title} Excel downloaded`);
    }

    async function handlePrintPdf(cat: CategoryItem) {
        setActiveCategory(cat);
        const data = await fetchCategoryData(cat);
        if (data) {
            setPreviewOpen(true);
            setTimeout(() => {
                window.print();
            }, 300);
        }
    }

    // Filter rows based on search
    const filteredRows = backupData?.rows.filter(r => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return Object.values(r).some(v => String(v).toLowerCase().includes(q));
    }) || [];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'ڈیٹا بیک اپ' : 'Data Backup'} />

            <div className="-mt-4 -mx-4 -mb-8 pb-28 bg-[#f4f6f4] min-h-screen font-sans text-[#1a211c] print:hidden" dir={isUrdu ? 'rtl' : 'ltr'}>
                {/* 1. Header Banner */}
                <MandiPageHeader
                    title={isUrdu ? 'ڈیٹا بیک اپ و برآمد' : 'Data Backup & Export'}
                    subtitle={isUrdu ? 'کیٹیگری وار ڈیٹا پریویو، ایکسل اور پی ڈی ایف ڈاؤنلوڈ' : 'Category-wise data preview, Excel and PDF export'}
                    isUrdu={isUrdu}
                >
                    <a
                        href="/backup/full"
                        download
                        className="h-9 px-4 rounded-xl text-xs md:text-sm font-bold bg-white text-emerald-900 hover:bg-emerald-50 shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                    >
                        <Icon name="CloudArrowDown" className="size-4 text-emerald-800" weight="bold" />
                        <span>{isUrdu ? 'مکمل ڈیٹا بیس بیک اپ (JSON)' : 'Full Database Backup (JSON)'}</span>
                    </a>
                </MandiPageHeader>

                {/* 2. Content Area */}
                <div className="max-w-7xl mx-auto px-3 md:px-6 -mt-6 md:-mt-8 space-y-4">
                    <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs p-4">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <div>
                                <h2 className="text-sm md:text-base font-extrabold text-gray-900">
                                    {isUrdu ? 'کیٹیگری وار بیک اپ' : 'Category-wise Data Backup'}
                                </h2>
                                <p className="text-xs text-gray-500">
                                    {isUrdu ? 'ہر کیٹیگری کا ڈیٹا الگ سے پریویو کریں یا ایکسل اور پی ڈی ایف میں ڈاؤنلوڈ کریں' : 'Preview each category separately or download as Excel / PDF'}
                                </p>
                            </div>
                            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                                {categories.length} Categories
                            </span>
                        </div>

                        {/* Categories List */}
                        <div className="divide-y divide-gray-100 mt-2">
                            {categories.map(cat => (
                                <div
                                    key={cat.id}
                                    className="py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-gray-50/60 rounded-lg px-2 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-800">
                                            <Icon name={cat.icon} className="size-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-extrabold text-sm text-gray-900">
                                                    {isUrdu ? cat.title_ur : cat.title}
                                                </h3>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-bold border">
                                                    {cat.count} records
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {cat.description}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Buttons: Preview, Excel, PDF */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handlePreview(cat)}
                                            className="h-8 px-3.5 rounded-lg border border-emerald-700 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
                                        >
                                            <Icon name="Eye" className="size-3.5" />
                                            <span>Preview</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleExportExcel(cat)}
                                            className="h-8 px-3.5 rounded-lg border border-emerald-700 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
                                        >
                                            <Icon name="Table" className="size-3.5" />
                                            <span>Excel</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handlePrintPdf(cat)}
                                            className="h-8 px-3.5 rounded-lg border border-emerald-700 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
                                        >
                                            <Icon name="FilePdf" className="size-3.5" />
                                            <span>PDF</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-5xl p-5 bg-white text-black font-sans max-h-[90vh] overflow-y-auto" dir={isUrdu ? 'rtl' : 'ltr'}>
                    <DialogHeader className="border-b pb-3 mb-3 print:hidden">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <DialogTitle className="text-base font-extrabold text-gray-900">
                                    {isUrdu ? (backupData?.title_ur || activeCategory?.title_ur) : (backupData?.title || activeCategory?.title)}
                                </DialogTitle>
                                <p className="text-xs text-gray-500">
                                    Showing {filteredRows.length} of {backupData?.total_count ?? 0} records
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search in records..."
                                    className="h-8 px-3 border rounded-lg text-xs w-48 outline-none focus:border-emerald-600"
                                />

                                {activeCategory && (
                                    <Button
                                        size="sm"
                                        onClick={() => handleExportExcel(activeCategory)}
                                        className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1 font-bold"
                                    >
                                        <Icon name="Table" className="size-3.5" />
                                        <span>Excel</span>
                                    </Button>
                                )}

                                <Button
                                    size="sm"
                                    onClick={() => window.print()}
                                    className="h-8 text-xs bg-black text-white hover:bg-gray-800 flex items-center gap-1 font-bold"
                                >
                                    <Icon name="Printer" className="size-3.5" />
                                    <span>Print / PDF</span>
                                </Button>
                            </div>
                        </div>
                    </DialogHeader>

                    {loading ? (
                        <div className="py-20 text-center text-gray-500 text-sm">
                            Loading backup data...
                        </div>
                    ) : backupData ? (
                        <div className="space-y-4">
                            {/* Company Letterhead for Printing */}
                            <div className="text-center border-b pb-3">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <div className="w-6 h-6 rounded bg-[#166534] text-white flex items-center justify-center font-bold text-xs">V</div>
                                    <h2 className="font-extrabold text-base uppercase tracking-wide text-gray-900">
                                        Vegetable POS · Backup Report
                                    </h2>
                                </div>
                                <div className="flex justify-between items-center text-xs font-semibold pt-1 text-gray-700">
                                    <span>{backupData.title}</span>
                                    <span>Export Date: {new Date().toISOString().split('T')[0]}</span>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="border rounded-xl overflow-hidden shadow-2xs">
                                <div className="overflow-x-auto max-h-[60vh]">
                                    <table className="w-full text-xs font-sans">
                                        <thead className="bg-[#14532d] text-white font-bold sticky top-0">
                                            <tr>
                                                {backupData.columns.map((c, i) => (
                                                    <th key={i} className="px-3 py-2.5 text-start whitespace-nowrap">{c}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={backupData.columns.length} className="p-8 text-center text-gray-400 text-xs">
                                                        No records found
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredRows.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        {backupData.columns.map((_, colIdx) => (
                                                            <td key={colIdx} className="px-3 py-2 text-gray-900 whitespace-nowrap">
                                                                {row[`col${colIdx + 1}`] ?? '—'}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
