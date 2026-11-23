import React, { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/layouts/app-layout';
import MandiPageHeader from '@/components/app/mandi-page-header';
import { type BreadcrumbItem } from '@/types';
import Icon from '@/components/ui/icon';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface BackupItem {
    filename: string;
    size_bytes: number;
    size_kb: number;
    created_at: string;
    formatted_time?: string;
}

interface CategoryItem {
    id: string;
    name: string;
    filePrefix: string;
    description: string;
    icon: string;
    record_count: number;
}

interface CategoryPreviewData {
    id: string;
    name: string;
    description: string;
    total_records: number;
    columns: Array<{ key: string; label: string }>;
    rows: Array<Record<string, any>>;
}

interface Props {
    backups?: BackupItem[];
    categories?: CategoryItem[];
}

export default function BackupIndex({ backups: initialBackups = [], categories: initialCategories = [] }: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';

    // State for backups list
    const [backupsList, setBackupsList] = useState<BackupItem[]>(initialBackups);
    const [loadingBackups, setLoadingBackups] = useState(false);
    const [creatingBackup, setCreatingBackup] = useState(false);

    // State for Restore
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [restoring, setRestoring] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);

    // Notifications banner
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string>('');

    // State for Category Data
    const [categoryList, setCategoryList] = useState<CategoryItem[]>(initialCategories);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [activeActions, setActiveActions] = useState<Record<string, boolean>>({});

    // Modal Preview State
    const [previewCategory, setPreviewCategory] = useState<CategoryItem | null>(null);
    const [previewData, setPreviewData] = useState<CategoryPreviewData | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'بیک اپ' : 'Backup', href: '/backup' },
    ];

    // Fetch Backups from server
    async function fetchBackups() {
        setLoadingBackups(true);
        try {
            const res = await fetch('/backup/list');
            if (!res.ok) throw new Error('Failed to fetch backup list');
            const data = await res.json();
            if (data.success && Array.isArray(data.backups)) {
                setBackupsList(data.backups);
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Backups list load nahi ho saki.');
        } finally {
            setLoadingBackups(false);
        }
    }

    // Fetch Categories Summary
    async function fetchCategories() {
        setLoadingCategories(true);
        try {
            const res = await fetch('/backup/categories/summary');
            if (!res.ok) throw new Error('Failed to fetch categories summary');
            const data = await res.json();
            if (data.success && Array.isArray(data.categories)) {
                setCategoryList(data.categories);
            }
        } catch (err: any) {
            console.error('Categories error:', err);
        } finally {
            setLoadingCategories(false);
        }
    }

    // Helper for action loading state
    const isActionLoading = (catId: string, action: string) => !!activeActions[`${catId}_${action}`];
    const setActionLoading = (catId: string, action: string, loading: boolean) => {
        setActiveActions(prev => ({ ...prev, [`${catId}_${action}`]: loading }));
    };

    // 1. Create Manual Full Backup
    async function handleCreateBackup() {
        if (creatingBackup) return;
        setCreatingBackup(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content;
            const res = await fetch('/backup/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken || '',
                    'Accept': 'application/json',
                },
            });
            const data = await res.json();

            if (data.success) {
                setSuccessMessage(data.message);
                toast.success(data.message);
                // Refresh list without full page reload
                await fetchBackups();
            } else {
                setErrorMessage(data.message || 'Backup banane mein masla pesh aaya.');
                toast.error(data.message || 'Backup banane mein masla pesh aaya.');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Network error: Backup fail ho gaya.');
            toast.error('Network error: Backup fail ho gaya.');
        } finally {
            setCreatingBackup(false);
        }
    }

    // 2. Download server backup file (.db)
    function handleDownloadServerBackup(filename: string) {
        setErrorMessage('');
        try {
            window.location.href = `/backup/download/${encodeURIComponent(filename)}`;
            setSuccessMessage(`Backup file (${filename}) download ho rahi hai.`);
        } catch (err: any) {
            setErrorMessage('Download fail ho gaya: ' + err.message);
        }
    }

    // 3. Full Database Backup (.db) from header button
    function handleFullDbDownload() {
        setErrorMessage('');
        try {
            window.location.href = '/backup/full';
            setSuccessMessage('Full Database (.db) download shuru ho gaya.');
        } catch (err: any) {
            setErrorMessage('Download fail ho gaya: ' + err.message);
        }
    }

    // 4. File input change with .db check
    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        setErrorMessage('');
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const name = file.name.toLowerCase();
            if (!name.endsWith('.db') && !name.endsWith('.sqlite') && !name.endsWith('.sqlite3')) {
                setErrorMessage('Sirf .db backup file muntakhib karein! Dusri files qabool nahi hain.');
                setSelectedFile(null);
                e.target.value = '';
                return;
            }
            setSelectedFile(file);
        }
    }

    // 5. Trigger Restore Confirmation
    function handleRestoreClick(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedFile) {
            setErrorMessage('Barah-e-karam pehle backup file (.db) muntakhib karein!');
            return;
        }
        setErrorMessage('');
        setConfirmModalOpen(true);
    }

    // 6. Execute Restore after confirmation
    async function executeRestore() {
        if (!selectedFile || restoring) return;
        setConfirmModalOpen(false);
        setRestoring(true);
        setErrorMessage('');
        setSuccessMessage('');

        const formData = new FormData();
        formData.append('backup_file', selectedFile);

        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content;
            const res = await fetch('/backup/restore', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken || '',
                    'Accept': 'application/json',
                },
                body: formData,
            });

            const data = await res.json();
            if (data.success) {
                setSuccessMessage(data.message);
                toast.success(data.message);
                setSelectedFile(null);
                await fetchBackups();
                await fetchCategories();
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                setErrorMessage(data.message || 'Database restore fail ho gaya.');
                toast.error(data.message || 'Database restore fail ho gaya.');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Restore mein masla: Server connection toot gaya.');
            toast.error('Restore fail ho gaya.');
        } finally {
            setRestoring(false);
        }
    }

    // 7. Preview Category Data Modal
    async function handlePreviewCategory(cat: CategoryItem) {
        if (isActionLoading(cat.id, 'preview')) return;
        setActionLoading(cat.id, 'preview', true);
        setErrorMessage('');
        setPreviewCategory(cat);
        setPreviewData(null);
        setLoadingPreview(true);

        try {
            const res = await fetch(`/backup/categories/${cat.id}/preview`);
            if (!res.ok) throw new Error('Failed to load category preview');
            const data = await res.json();
            if (data.success && data.category) {
                setPreviewData(data.category);
            } else {
                throw new Error(data.message || 'Preview load nahi ho saki');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Preview load karne mein masla aya.');
            toast.error('Preview load fail');
        } finally {
            setLoadingPreview(false);
            setActionLoading(cat.id, 'preview', false);
        }
    }

    // 8. Download Category Data (Excel or DB)
    async function handleDownloadCategoryData(cat: CategoryItem, type: 'excel' | 'db') {
        const actionKey = `${cat.id}_${type}`;
        if (activeActions[actionKey]) return; // Prevent double clicks

        if (cat.record_count === 0) {
            setErrorMessage(`Is category (${cat.name}) mein koi record nahi hai, khali file download nahi ki ja sakti.`);
            toast.error(`Is category (${cat.name}) mein koi record nahi hai.`);
            return;
        }

        setActionLoading(cat.id, type, true);
        setErrorMessage('');
        setSuccessMessage('');

        const dateStr = new Date().toISOString().split('T')[0];
        const ext = type === 'excel' ? 'xlsx' : 'db';
        const expectedFilename = `${cat.filePrefix}_${dateStr}.${ext}`;

        try {
            const endpoint = `/backup/categories/${cat.id}/${type === 'excel' ? 'export-excel' : 'export-db'}`;
            const res = await fetch(endpoint);

            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                throw new Error(errData?.message || `${type.toUpperCase()} file download fail ho gayi.`);
            }

            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = expectedFilename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(blobUrl);

            const downloadMsg = `${cat.name} ka ${type.toUpperCase()} file (${expectedFilename}) kamyabi se download ho gaya!`;
            setSuccessMessage(downloadMsg);
            toast.success(downloadMsg);
        } catch (err: any) {
            setErrorMessage(err.message || 'Download mein masla pesh aaya.');
            toast.error(err.message || 'Download fail');
        } finally {
            setActionLoading(cat.id, type, false);
        }
    }

    // Helper for category icon
    const getPhosphorCategoryIcon = (icon: string) => {
        switch (icon) {
            case 'Receipt':
            case 'Tag':
                return 'Receipt';
            case 'Users':
                return 'Users';
            case 'Sprout':
            case 'Tractor':
                return 'Plant';
            case 'Boxes':
            case 'Package':
                return 'Package';
            case 'BookOpen':
            case 'BookBookmark':
            default:
                return 'BookBookmark';
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'ڈیٹا بیس بیک اپ اور بحالی' : 'Database Backup aur Restore - Vegetable POS'} />

            <div className={`-mt-4 -mx-4 -mb-4 pb-28 bg-[#eef2ee] min-h-full space-y-4 ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>
                {/* 1. Green Header Section */}
                <MandiPageHeader
                    title={isUrdu ? t('backup_mandi.title') : 'Database Backup aur Restore'}
                    subtitle={isUrdu ? t('backup_mandi.subtitle') : 'SQLite database ka mehfooz backup, timestamped files download aur restore ki sahulat'}
                    isUrdu={isUrdu}
                >
                    {/* Full Database Backup (.db) Button */}
                    <button
                        type="button"
                        onClick={handleFullDbDownload}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-50 text-[#14532d] border border-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
                    >
                        <Icon name="Database" className="size-4 text-[#14532d]" weight="bold" />
                        <span>{isUrdu ? t('backup_mandi.full_db_backup') : 'Full Database Backup (DB)'}</span>
                    </button>

                    {/* Abhi Naya Backup Banayein Button */}
                    <button
                        type="button"
                        onClick={handleCreateBackup}
                        disabled={creatingBackup}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-emerald-50 text-[#14532d] border border-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                        <Icon
                            name={creatingBackup ? "SpinnerGap" : "CloudArrowUp"}
                            className={`size-4 text-[#14532d] ${creatingBackup ? 'animate-spin' : ''}`}
                            weight="bold"
                        />
                        <span>{creatingBackup ? (isUrdu ? t('backup_mandi.backup_in_progress') : 'Backup Ban Raha Hai...') : (isUrdu ? t('backup_mandi.new_backup') : 'Abhi Naya Backup Banayein')}</span>
                    </button>
                </MandiPageHeader>

                <div className="w-full px-4 md:px-6 -mt-6 md:-mt-8 space-y-5">

                {/* 2. Status Messages */}
                {errorMessage && (
                    <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-red-700 dark:text-red-400 text-xs sm:text-sm flex items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-2">
                            <Icon name="WarningCircle" className="size-5 shrink-0 text-red-600" weight="fill" />
                            <span className="font-medium">{errorMessage}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setErrorMessage('')}
                            className="text-red-500 hover:text-red-700 cursor-pointer"
                        >
                            <Icon name="X" className="size-4" weight="bold" />
                        </button>
                    </div>
                )}

                {successMessage && (
                    <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm flex items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-2">
                            <Icon name="CheckCircle" className="size-5 shrink-0 text-emerald-700 dark:text-emerald-400" weight="fill" />
                            <span className="font-semibold">{successMessage}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSuccessMessage('')}
                            className="text-emerald-600 hover:text-emerald-800 cursor-pointer"
                        >
                            <Icon name="X" className="size-4" weight="bold" />
                        </button>
                    </div>
                )}

                {/* 3. Auto-backup info card */}
                <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-4 flex items-start gap-3.5 text-xs sm:text-sm shadow-2xs">
                    <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 shrink-0 mt-0.5">
                        <Icon name="ShieldCheck" className="size-5" weight="bold" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="font-bold text-emerald-950 dark:text-emerald-200 text-sm">
                            {isUrdu ? 'خودکار (Automatic) بیک اپ نظام فعال ہے' : 'Khud-kaar (Automatic) Backup Nizam Fa-aal Hai'}
                        </h4>
                        <p className="text-emerald-900/90 dark:text-emerald-300/90 leading-relaxed text-xs sm:text-[13px]">
                            {isUrdu
                                ? 'آپ کا POS سسٹم ہر 6 گھنٹے بعد SQLite ڈیٹا بیس کا مکمل اسنیپ شاٹ بیک اپ بناتا ہے اور آخری 15 بیک اپ محفوظ رکھتا ہے۔ کسی بھی وقت آپ خود بیک اپ بنا کر اپنے کمپیوٹر یا USB ڈرائیو پر ڈاؤن لوڈ کر سکتے ہیں۔'
                                : 'Aap ka POS system har 6 ghante baad SQLite database ka mukammal snapshot backup banata hai aur aakhri 15 backups mehfooz rakhta hai. Kisi bhi waqt aap manual backup create karke apne computer ya USB drive par download kar sakte hain.'}
                        </p>
                    </div>
                </div>

                {/* 4. Middle Grid: Left = Backups List, Right = Restore Option */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Left Card: Server Par Mojood Backups List (8 cols) */}
                    <div className="lg:col-span-8 bg-white dark:bg-card border border-emerald-200/80 dark:border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
                        <div className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-gray-800">
                            <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white">
                                {isUrdu ? 'سرور پر موجود بیک اپ لسٹ' : 'Server Par Mojood Backups List'}
                            </h3>
                            <button
                                type="button"
                                onClick={fetchBackups}
                                disabled={loadingBackups}
                                className="text-emerald-800 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-emerald-300 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                <Icon
                                    name="ArrowClockwise"
                                    className={`size-3.5 ${loadingBackups ? 'animate-spin' : ''}`}
                                    weight="bold"
                                />
                                <span>{isUrdu ? 'تازہ کریں' : 'Taaza Karein'}</span>
                            </button>
                        </div>

                        <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">
                            <table className="w-full text-start text-xs sm:text-[13px]">
                                <thead className="bg-emerald-50/70 dark:bg-muted text-gray-800 dark:text-gray-200 border-b border-emerald-100 dark:border-border font-bold">
                                    <tr>
                                        <th className="py-2.5 px-3.5 text-start">{isUrdu ? 'فائل کا نام' : 'File Ka Naam'}</th>
                                        <th className="py-2.5 px-3.5 text-start">{isUrdu ? 'سائز' : 'Size'}</th>
                                        <th className="py-2.5 px-3.5 text-start">{isUrdu ? 'بنانے کا وقت' : 'Banane Ka Waqt'}</th>
                                        <th className="py-2.5 px-3.5 text-center">{isUrdu ? 'ڈاؤن لوڈ' : 'Download'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {backupsList.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-gray-400 dark:text-gray-500 text-xs">
                                                {isUrdu
                                                    ? 'ابھی کوئی بیک اپ فائل سرور پر موجود نہیں ہے۔ اوپر دیے گئے بٹن سے بیک اپ بنائیں۔'
                                                    : 'Abhi koi backup file server par mojood nahi hai. Upar diye gaye button se backup banayein.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        backupsList.map((b) => (
                                            <tr key={b.filename} className="hover:bg-gray-50/80 dark:hover:bg-muted/40 transition">
                                                <td className="py-2.5 px-3.5 font-mono font-bold text-emerald-900 dark:text-emerald-400">
                                                    {b.filename}
                                                </td>
                                                <td className="py-2.5 px-3.5 text-gray-600 dark:text-gray-400 whitespace-nowrap font-mono">
                                                    {b.size_kb} KB
                                                </td>
                                                <td className="py-2.5 px-3.5 text-gray-600 dark:text-gray-400 whitespace-nowrap font-mono">
                                                    {b.formatted_time || new Date(b.created_at).toLocaleString('ur-PK')}
                                                </td>
                                                <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDownloadServerBackup(b.filename)}
                                                        className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-3 py-1 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
                                                    >
                                                        <Icon name="DownloadSimple" className="size-3.5" weight="bold" />
                                                        <span>{isUrdu ? 'ڈاؤن لوڈ' : 'Download'}</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right Card: Database Restore Karein (4 cols) */}
                    <div className="lg:col-span-4 bg-white dark:bg-card border border-emerald-200/90 dark:border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
                        <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">
                            {isUrdu ? 'ڈیٹا بیس بحال کریں (Restore)' : 'Database Restore Karein'}
                        </h3>

                        {/* Ihtiyaat Warning Box */}
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-3 rounded-xl text-amber-900 dark:text-amber-300 text-xs space-y-1 shadow-2xs">
                            <div className="flex items-center gap-1.5 font-bold text-amber-950 dark:text-amber-200">
                                <Icon name="Warning" className="size-4 text-amber-600 shrink-0" weight="fill" />
                                <span>{isUrdu ? 'احتیاط:' : 'Ihtiyaat:'}</span>
                            </div>
                            <p className="leading-relaxed">
                                {isUrdu
                                    ? 'بحال کرنے سے آپ کی پرانی ڈیٹا بیس فائل تبدیل ہو جائے گی۔ سسٹم حفاظت کے لیے پہلے موجودہ ڈیٹا بیس کا سیفٹی بیک اپ خود بنا لے گا۔'
                                    : 'Restore karne se aap ki purani database file tabdeel ho jayegi. System hifazat ke liye pehle mojooda database ka safety backup khud bana lega.'}
                            </p>
                        </div>

                        <form onSubmit={handleRestoreClick} className="space-y-3.5 text-xs sm:text-sm">
                            <div>
                                <label className="block font-bold text-gray-900 dark:text-gray-100 mb-1.5 text-xs sm:text-[13px]">
                                    {isUrdu ? 'بیک اپ فائل (.db) منتخب کریں:' : 'Backup File (.db) Muntakhib Karein:'}
                                </label>
                                <input
                                    type="file"
                                    accept=".db,.sqlite,.sqlite3"
                                    onChange={handleFileChange}
                                    className="w-full text-xs text-gray-600 dark:text-gray-300 file:mr-2.5 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 dark:file:bg-emerald-950/40 file:text-emerald-800 dark:file:text-emerald-300 hover:file:bg-emerald-100 cursor-pointer border border-gray-200 dark:border-gray-700 rounded-xl p-1"
                                />
                                {selectedFile && (
                                    <div className="mt-1.5 text-[11px] text-emerald-800 dark:text-emerald-400 font-mono font-medium">
                                        {isUrdu ? 'منتخب شدہ: ' : 'Muntakhib: '}{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={restoring || !selectedFile}
                                className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Icon
                                    name={restoring ? "SpinnerGap" : "UploadSimple"}
                                    className={`size-4 ${restoring ? 'animate-spin' : ''}`}
                                    weight="bold"
                                />
                                <span>{restoring ? (isUrdu ? 'بحال ہو رہا ہے...' : 'Restore Ho Raha Hai...') : (isUrdu ? 'ڈیٹا بیس بحال کریں' : 'Database Restore Karein')}</span>
                            </button>
                        </form>
                    </div>
                </div>

                {/* 5. Category-wise Data Backup Section (Full width, bottom) */}
                <div className="w-full bg-white dark:bg-card border border-emerald-200/80 dark:border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
                    {/* Section Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 gap-2">
                        <div>
                            <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-white">
                                {isUrdu ? 'کیٹیگری وار ڈیٹا بیک اپ' : 'Category-wise Data Backup'}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                {isUrdu ? 'ہر کیٹیگری الگ سے پریویو کریں، پھر ایکسل یا DB فائل ڈاؤن لوڈ کریں' : 'Har category alag se preview karein, phir Excel ya DB file download karein'}
                            </p>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                            <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                                {categoryList.length} {isUrdu ? 'کیٹیگریز' : 'Categories'}
                            </span>
                            <button
                                type="button"
                                onClick={fetchCategories}
                                disabled={loadingCategories}
                                className="text-gray-500 hover:text-emerald-800 dark:hover:text-emerald-300 p-1 rounded-lg transition cursor-pointer"
                                title={isUrdu ? 'کیٹیگری کی تعداد تازہ کریں' : 'Category counts taaza karein'}
                            >
                                <Icon
                                    name="ArrowClockwise"
                                    className={`size-4 ${loadingCategories ? 'animate-spin text-emerald-700' : ''}`}
                                    weight="bold"
                                />
                            </button>
                        </div>
                    </div>

                    {/* Categories List (5 Categories in exact order) */}
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {categoryList.map((cat) => {
                            const previewLoading = isActionLoading(cat.id, 'preview');
                            const excelLoading = isActionLoading(cat.id, 'excel');
                            const dbLoading = isActionLoading(cat.id, 'db');

                            return (
                                <div
                                    key={cat.id}
                                    className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-emerald-50/20 dark:hover:bg-muted/30 px-2 rounded-xl transition"
                                >
                                    {/* Left: Icon, Name, Records badge, Description */}
                                    <div className="flex items-start sm:items-center gap-3.5">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900 shrink-0 shadow-2xs">
                                            <Icon
                                                name={getPhosphorCategoryIcon(cat.icon) as any}
                                                className="size-5"
                                                weight="bold"
                                            />
                                        </div>

                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-bold text-sm sm:text-base text-gray-900 dark:text-white">
                                                    {cat.name}
                                                </span>
                                                <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-muted px-2.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 font-mono">
                                                    {cat.record_count} {isUrdu ? 'ریکارڈز' : 'records'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                {cat.description}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Right: 3 Buttons (Preview, Excel, DB) */}
                                    <div className="flex items-center gap-2 self-start md:self-auto">
                                        {/* Button 1: Preview */}
                                        <button
                                            type="button"
                                            onClick={() => handlePreviewCategory(cat)}
                                            disabled={previewLoading || excelLoading || dbLoading}
                                            className="border border-emerald-300 dark:border-emerald-800 bg-white hover:bg-emerald-50 dark:bg-card dark:hover:bg-muted text-emerald-900 dark:text-emerald-300 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-2xs"
                                        >
                                            <Icon
                                                name={previewLoading ? "SpinnerGap" : "Eye"}
                                                className={`size-3.5 ${previewLoading ? 'animate-spin' : ''}`}
                                                weight="bold"
                                            />
                                            <span>{isUrdu ? 'پریویو' : 'Preview'}</span>
                                        </button>

                                        {/* Button 2: Excel */}
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadCategoryData(cat, 'excel')}
                                            disabled={excelLoading || previewLoading || dbLoading}
                                            className="border border-emerald-300 dark:border-emerald-800 bg-white hover:bg-emerald-50 dark:bg-card dark:hover:bg-muted text-emerald-900 dark:text-emerald-300 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-2xs"
                                        >
                                            <Icon
                                                name={excelLoading ? "SpinnerGap" : "FileXls"}
                                                className={`size-3.5 ${excelLoading ? 'animate-spin text-emerald-700' : 'text-emerald-700 dark:text-emerald-400'}`}
                                                weight="bold"
                                            />
                                            <span>Excel</span>
                                        </button>

                                        {/* Button 3: DB */}
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadCategoryData(cat, 'db')}
                                            disabled={dbLoading || previewLoading || excelLoading}
                                            className="border border-emerald-300 dark:border-emerald-800 bg-white hover:bg-emerald-50 dark:bg-card dark:hover:bg-muted text-emerald-900 dark:text-emerald-300 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-2xs"
                                        >
                                            <Icon
                                                name={dbLoading ? "SpinnerGap" : "Database"}
                                                className={`size-3.5 ${dbLoading ? 'animate-spin text-emerald-700' : 'text-emerald-700 dark:text-emerald-400'}`}
                                                weight="bold"
                                            />
                                            <span>DB</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                </div>

                {/* 6. Confirmation Modal for Database Restore */}
                <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
                    <DialogContent className={`max-w-md p-6 bg-white dark:bg-card rounded-2xl border border-red-300 dark:border-red-900 shadow-2xl ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>
                        <DialogHeader>
                            <div className="flex items-center gap-2.5 text-red-600 mb-2">
                                <Icon name="WarningCircle" className="size-6 text-red-600" weight="fill" />
                                <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">
                                    {isUrdu ? 'بحالی کی تصدیق (Confirmation)' : 'Restore Ki Tasdeeq (Confirmation)'}
                                </DialogTitle>
                            </div>
                        </DialogHeader>

                        <div className="space-y-3 text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            <p className="font-bold text-red-700 dark:text-red-400">
                                {isUrdu ? 'کیا آپ واقعی بحال کرنا چاہتے ہیں؟ موجودہ ڈیٹا بدل جائے گا۔' : 'Kya aap waqai restore karna chahte hain? Maujooda data badal jayega.'}
                            </p>
                            <p className="text-gray-500 text-xs">
                                {isUrdu ? 'منتخب فائل: ' : 'Muntakhib file: '}<strong className="font-mono text-gray-800 dark:text-gray-200">{selectedFile?.name}</strong>
                            </p>
                            <p className="text-xs text-gray-500 bg-gray-50 dark:bg-muted p-2.5 rounded-xl border border-gray-200 dark:border-gray-700">
                                {isUrdu ? 'سسٹم حفاظت کے لیے پہلے موجودہ ڈیٹا بیس کا سیفٹی بیک اپ خودکار طریقے سے بنا لے گا۔' : 'System hifazat ke liye pehle maujooda database ka safety backup automatically bana lega.'}
                            </p>
                        </div>

                        <div className="flex justify-end items-center gap-2.5 mt-5">
                            <button
                                type="button"
                                onClick={() => setConfirmModalOpen(false)}
                                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-muted font-bold text-xs cursor-pointer"
                            >
                                {isUrdu ? 'منسوخ (Cancel)' : 'Mansookh (Cancel)'}
                            </button>
                            <button
                                type="button"
                                onClick={executeRestore}
                                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs cursor-pointer shadow-xs"
                            >
                                {isUrdu ? 'ہاں، بحال کریں' : 'Haan, Restore Karein'}
                            </button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* 7. Category Preview Table Modal */}
                {previewCategory && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto">
                        <div className={`bg-white dark:bg-card rounded-2xl max-w-5xl w-full border border-emerald-300 dark:border-border overflow-hidden shadow-2xl my-6 flex flex-col max-h-[90vh] ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>
                            {/* Modal Header */}
                            <div className="bg-[#14532d] px-5 py-3.5 text-white flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-2.5">
                                    <div className="size-8 rounded-lg bg-emerald-800 flex items-center justify-center">
                                        <Icon
                                            name={getPhosphorCategoryIcon(previewCategory.icon) as any}
                                            className="size-4 text-white"
                                            weight="bold"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm">{isUrdu ? 'پریویو: ' : 'Preview: '}{previewCategory.name}</h3>
                                        <p className="text-[11px] text-emerald-100">
                                            {isUrdu ? 'ڈیٹا بیس سے لائیو ڈیٹا ' : 'Database se live data '}({previewData ? previewData.rows.length : '...'} {isUrdu ? 'ریکارڈز' : 'records'})
                                        </p>
                                    </div>
                                </div>

                                {/* Action Buttons in Modal Header */}
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleDownloadCategoryData(previewCategory, 'excel')}
                                        disabled={
                                            isActionLoading(previewCategory.id, 'excel') ||
                                            (previewData && previewData.rows.length === 0)
                                        }
                                        className="bg-white hover:bg-emerald-50 text-emerald-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition disabled:opacity-50 shadow-2xs cursor-pointer"
                                        title={isUrdu ? 'ایکسل فائل ڈاؤن لوڈ کریں' : 'Excel file download karein'}
                                    >
                                        <Icon name="FileXls" className="size-3.5 text-emerald-800" weight="bold" />
                                        <span>Excel (.xlsx)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleDownloadCategoryData(previewCategory, 'db')}
                                        disabled={
                                            isActionLoading(previewCategory.id, 'db') ||
                                            (previewData && previewData.rows.length === 0)
                                        }
                                        className="bg-white hover:bg-emerald-50 text-emerald-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition disabled:opacity-50 shadow-2xs cursor-pointer"
                                        title={isUrdu ? 'SQLite ڈیٹا بیس فائل ڈاؤن لوڈ کریں' : 'SQLite database file download karein'}
                                    >
                                        <Icon name="Database" className="size-3.5 text-emerald-800" weight="bold" />
                                        <span>DB (.db)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setPreviewCategory(null)}
                                        className="text-white hover:bg-emerald-800 p-1.5 rounded-lg transition cursor-pointer"
                                    >
                                        <Icon name="X" className="size-5" weight="bold" />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="p-4 overflow-y-auto flex-1">
                                {loadingPreview ? (
                                    <div className="py-16 text-center text-xs text-gray-500 space-y-2">
                                        <Icon name="SpinnerGap" className="size-6 animate-spin text-emerald-700 mx-auto" />
                                        <p className="font-bold">{isUrdu ? 'ڈیٹا بیس سے ڈیٹا لوڈ ہو رہا ہے...' : 'Database se data load ho raha hai...'}</p>
                                    </div>
                                ) : !previewData || previewData.rows.length === 0 ? (
                                    <div className="py-16 text-center text-xs text-gray-500 space-y-2 bg-gray-50 dark:bg-muted/40 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8">
                                        <Icon name="WarningCircle" className="size-8 text-amber-600 mx-auto" weight="fill" />
                                        <p className="font-bold text-sm text-gray-900 dark:text-white">
                                            {isUrdu ? 'اس کیٹیگری میں کوئی ریکارڈ نہیں' : 'Is category mein koi record nahi'}
                                        </p>
                                        <p className="text-gray-400">
                                            {isUrdu
                                                ? 'ڈیٹا بیس میں اس کیٹیگری سے متعلق کوئی ڈیٹا موجود نہیں ہے، اس لیے فائل ڈاؤن لوڈ نہیں ہو سکتی۔'
                                                : 'Database mein is category se mutaliq koi data mojood nahi hai, is liye file download nahi ho sakti.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto border border-emerald-200 dark:border-border rounded-xl">
                                        <table className="w-full text-start text-xs">
                                            <thead className="bg-emerald-50 dark:bg-muted text-gray-900 dark:text-gray-100 border-b border-emerald-200 dark:border-border font-bold sticky top-0">
                                                <tr>
                                                    {previewData.columns.map((col) => (
                                                        <th key={col.key} className="py-2.5 px-3 whitespace-nowrap text-start">
                                                            {col.label}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                {previewData.rows.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-muted/50 transition">
                                                        {previewData.columns.map((col) => {
                                                            const val = row[col.key];
                                                            const isMoney =
                                                                typeof val === 'number' &&
                                                                (col.key.includes('total') ||
                                                                    col.key.includes('amount') ||
                                                                    col.key.includes('rate') ||
                                                                    col.key.includes('balance') ||
                                                                    col.key.includes('subtotal') ||
                                                                    col.key.includes('debit') ||
                                                                    col.key.includes('credit') ||
                                                                    col.key.includes('limit') ||
                                                                    col.key.includes('payable') ||
                                                                    col.key.includes('commission') ||
                                                                    col.key.includes('remaining'));

                                                            return (
                                                                <td
                                                                    key={col.key}
                                                                    className={`py-2 px-3 whitespace-nowrap ${
                                                                        isMoney
                                                                            ? 'font-mono font-bold text-gray-900 dark:text-white'
                                                                            : 'text-gray-700 dark:text-gray-300'
                                                                    }`}
                                                                >
                                                                    {isMoney
                                                                        ? `Rs. ${Number(val).toLocaleString()}`
                                                                        : val !== null && val !== undefined
                                                                        ? String(val)
                                                                        : '—'}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="bg-gray-50 dark:bg-muted/40 px-5 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center text-xs shrink-0">
                                <span className="text-gray-600 dark:text-gray-400 font-medium">
                                    {isUrdu ? 'کل ریکارڈز: ' : 'Kul Records: '}<strong className="text-gray-900 dark:text-white font-mono">{previewData?.rows?.length || 0}</strong>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPreviewCategory(null)}
                                    className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold rounded-lg transition cursor-pointer"
                                >
                                    {isUrdu ? 'بند کریں' : 'Band Karein'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
