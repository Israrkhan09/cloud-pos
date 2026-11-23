import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
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
    DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface DiscountRule {
    id: number;
    rule_name: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    min_order_amount: number;
    is_active: boolean;
    description: string | null;
    created_at?: string;
    updated_at?: string;
}

interface Props {
    rules: DiscountRule[];
}

export default function DiscountRulesIndex({ rules: initialRules = [] }: Props) {
    const { t, i18n } = useTranslation();
    const isUrdu = i18n.language === 'ur';
    const [rules, setRules] = useState<DiscountRule[]>(initialRules);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Form data
    const [formData, setFormData] = useState({
        rule_name: '',
        discount_type: 'percentage' as 'percentage' | 'fixed',
        discount_value: '',
        min_order_amount: '5000',
        description: '',
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isUrdu ? 'ڈیش بورڈ' : 'Dashboard', href: '/dashboard' },
        { title: isUrdu ? 'ڈسکاؤنٹ رولز' : 'Discount Rules', href: '/discount-rules' },
    ];

    const formatRs = (val: number | string) => {
        const num = Number(val) || 0;
        return `Rs ${num.toLocaleString('en-PK')}`;
    };

    const handleOpenModal = () => {
        setFormData({
            rule_name: '',
            discount_type: 'percentage',
            discount_value: '',
            min_order_amount: '5000',
            description: '',
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.rule_name.trim() || !formData.discount_value) return;

        setSubmitting(true);
        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const res = await fetch('/discount-rules', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({
                    rule_name: formData.rule_name.trim(),
                    discount_type: formData.discount_type,
                    discount_value: parseFloat(formData.discount_value),
                    min_order_amount: parseFloat(formData.min_order_amount) || 0,
                    description: formData.description.trim() || null,
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                const msg = isUrdu ? 'ڈسکاؤنٹ رول کامیابی سے شامل کر لیا گیا!' : 'Discount rule kamyabi se shamil kar lia gaya!';
                setSuccessMessage(msg);
                toast.success(msg);
                setIsModalOpen(false);

                // Refresh rules list
                if (data.rule) {
                    setRules((prev) => [...prev, data.rule]);
                } else {
                    router.reload({ only: ['rules'] });
                }
            } else {
                toast.error(data.message || 'Error saving rule');
            }
        } catch (err: any) {
            toast.error(err.message || 'Network error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggle = async (id: number) => {
        setSubmitting(true);
        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const res = await fetch(`/discount-rules/${id}/toggle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setRules((prev) =>
                    prev.map((r) => (r.id === id ? { ...r, is_active: !r.is_active } : r))
                );
                toast.success(data.message || (isUrdu ? 'اسٹیٹس تبدیل کر دیا گیا' : 'Status tabdeel kar diya gaya'));
            } else {
                toast.error(data.message || 'Error toggling rule status');
            }
        } catch (err: any) {
            toast.error(err.message || 'Network error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm(isUrdu ? 'کیا آپ واقعی اس ڈسکاؤنٹ رول کو ڈیلیٹ کرنا چاہتے ہیں؟' : 'Kya aap waqai is discount rule ko delete karna chahte hain?')) {
            return;
        }

        setSubmitting(true);
        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const res = await fetch(`/discount-rules/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setRules((prev) => prev.filter((r) => r.id !== id));
                toast.success(data.message || (isUrdu ? 'رول حذف ہو گیا' : 'Rule delete ho gaya'));
            } else {
                toast.error(data.message || 'Error deleting rule');
            }
        } catch (err: any) {
            toast.error(err.message || 'Network error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isUrdu ? 'ڈسکاؤنٹ رولز اور ادائیگی کا تصفیہ' : 'Discount Rules & Payment Settlement - Vegetable POS'} />

            <div className={`-mt-4 -mx-4 -mb-4 pb-28 bg-[#eef2ee] min-h-full space-y-4 ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>
                {/* 1. Green Header Section */}
                <MandiPageHeader
                    title={
                        <span className="flex items-center gap-2">
                            <Icon name="Percent" className="size-5 text-white" weight="bold" />
                            <span>{isUrdu ? t('discount_rules_section.title') : 'Discount Rules & Payment Settlement'}</span>
                        </span>
                    }
                    subtitle={isUrdu ? t('discount_rules_section.subtitle') : 'Thok gahakon aur baray bill par khususi riaayat (percentage ya fixed rupay) ke qawaneen'}
                    isUrdu={isUrdu}
                >
                    <button
                        type="button"
                        onClick={handleOpenModal}
                        disabled={submitting}
                        className="h-9 px-4 rounded-xl text-xs md:text-sm font-semibold bg-white text-emerald-900 hover:bg-emerald-50 shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <span>+ {isUrdu ? t('discount_rules_section.new_rule') : 'Naya Discount Rule'}</span>
                    </button>
                </MandiPageHeader>

                <div className="w-full px-4 md:px-6 -mt-6 md:-mt-8 space-y-5">
                    {/* Success Banner */}
                {successMessage && (
                    <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-center justify-between font-semibold">
                        <div className="flex items-center gap-2">
                            <Icon name="CheckCircle" className="size-4 text-emerald-700" weight="bold" />
                            <span>{successMessage}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSuccessMessage(null)}
                            className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
                        >
                            <Icon name="X" className="size-3.5" />
                        </button>
                    </div>
                )}

                {/* 2. Rules Responsive Grid (3 per row) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rules.map((rule) => {
                        const isPct = rule.discount_type === 'percentage';
                        return (
                            <div
                                key={rule.id}
                                className={`bg-white border rounded-2xl p-4 shadow-2xs transition flex flex-col justify-between ${
                                    rule.is_active
                                        ? 'border-emerald-300 shadow-xs'
                                        : 'border-gray-200 opacity-60 bg-gray-50/50'
                                }`}
                            >
                                <div>
                                    <div className="flex justify-between items-start">
                                        <span
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${
                                                rule.is_active
                                                    ? 'bg-emerald-100 text-emerald-900'
                                                    : 'bg-gray-100 text-gray-600'
                                            }`}
                                        >
                                            {rule.is_active
                                                ? (isUrdu ? 'فعال (ACTIVE)' : 'FA-AAL (ACTIVE)')
                                                : (isUrdu ? 'غیر فعال' : 'GHAIR FA-AAL')}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(rule.id)}
                                            disabled={submitting}
                                            className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors disabled:opacity-40 cursor-pointer"
                                            title={isUrdu ? 'رول حذف کریں' : 'Rule delete karein'}
                                        >
                                            <Icon name="Trash" className="size-4" weight="bold" />
                                        </button>
                                    </div>

                                    <h3 className="font-bold text-gray-900 text-sm mt-2.5">
                                        {rule.rule_name}
                                    </h3>

                                    <div className="text-xl font-bold text-[#14532d] mt-1 font-mono">
                                        {isPct
                                            ? (isUrdu ? `${rule.discount_value}% رعایت` : `${rule.discount_value}% Riaayat`)
                                            : (isUrdu ? `Rs ${Number(rule.discount_value).toLocaleString('en-PK')} کم` : `Rs ${Number(rule.discount_value).toLocaleString('en-PK')} Kam`)}
                                    </div>

                                    <p className="text-[11px] text-gray-600 mt-1">
                                        {isUrdu ? 'کم از کم آرڈر: ' : 'Kam az kam order: '}
                                        <span className="font-bold text-gray-900 font-mono">
                                            {formatRs(rule.min_order_amount)}
                                        </span>
                                    </p>

                                    {rule.description && (
                                        <p className="text-[11px] text-gray-500 mt-1">
                                            {rule.description}
                                        </p>
                                    )}
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center text-xs">
                                    <span className="text-gray-500 text-[11px]">
                                        {isUrdu ? 'فاسٹ پی او ایس بلنگ میں دستیاب' : 'Fast POS Billing mein Dastiyab'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleToggle(rule.id)}
                                        disabled={submitting}
                                        className={`font-bold px-3 py-1 rounded-lg text-xs transition cursor-pointer disabled:opacity-50 ${
                                            rule.is_active
                                                ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                                                : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                                        }`}
                                    >
                                        {rule.is_active
                                            ? (isUrdu ? 'بند کریں' : 'Band Karein')
                                            : (isUrdu ? 'فعال کریں' : 'Fa-aal Karein')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {rules.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">
                            {isUrdu ? 'کوئی ڈسکاؤنٹ رول موجود نہیں ہے۔ نیا رول شامل کرنے کے لیے اوپر دیے گئے بٹن پر کلک کریں۔' : 'Koi discount rule mojood nahi hai. Naya rule shamil karne ke liye upar diye gaye button par click karein.'}
                        </div>
                    )}
                </div>
                </div>

                {/* 3. Add Rule Modal */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className={`max-w-md p-0 overflow-hidden rounded-2xl border border-emerald-300 ${isUrdu ? 'font-urdu' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>
                        <div className="bg-[#14532d] px-4 py-3 text-white flex justify-between items-center">
                            <h2 className="font-bold text-sm">{isUrdu ? 'نیا ڈسکاؤنٹ رول شامل کریں' : 'Naya Discount Rule Shamil Karein'}</h2>
                        </div>

                        <form onSubmit={handleSave} className="p-4 space-y-3.5 text-xs">
                            {/* 1. Rule Ka Naam * */}
                            <div>
                                <label className="block font-bold text-gray-900 mb-1">
                                    {isUrdu ? 'رول کا نام *' : 'Rule Ka Naam *'}
                                </label>
                                <input
                                    type="text"
                                    value={formData.rule_name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, rule_name: e.target.value })
                                    }
                                    placeholder={isUrdu ? 'مثلاً: تھوک خریدار 3%' : 'Maslan: Thok Khareedar 3%'}
                                    className="w-full p-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                                    required
                                />
                            </div>

                            {/* 2 & 3. Riaayat Qism & Discount Value * */}
                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <label className="block font-bold text-gray-900 mb-1">
                                        {isUrdu ? 'رعایت کی قسم' : 'Riaayat Qism'}
                                    </label>
                                    <select
                                        value={formData.discount_type}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                discount_type: e.target.value as 'percentage' | 'fixed',
                                            })
                                        }
                                        className="w-full p-2 border border-gray-300 rounded-lg text-xs text-gray-900 font-semibold focus:outline-none focus:border-emerald-600 bg-white cursor-pointer"
                                    >
                                        <option value="percentage">{isUrdu ? 'فیصد (Percentage %)' : 'Feesad (Percentage %)'}</option>
                                        <option value="fixed">{isUrdu ? 'روپے (Fixed Rs)' : 'Rupay (Fixed Rs)'}</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-gray-900 mb-1">
                                        {isUrdu ? 'ڈسکاؤنٹ ویلیو *' : 'Discount Value *'}
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={formData.discount_value}
                                        onChange={(e) =>
                                            setFormData({ ...formData, discount_value: e.target.value })
                                        }
                                        placeholder={isUrdu ? 'مثلاً: 3 (یعنی 3%) یا 200' : 'Maslan: 3 (yaani 3%) ya 200'}
                                        className="w-full p-2 border border-emerald-400 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:border-emerald-600 font-mono"
                                        required
                                    />
                                </div>
                            </div>

                            {/* 4. Kam az kam Order Raqam (Rs) */}
                            <div>
                                <label className="block font-bold text-gray-900 mb-1">
                                    {isUrdu ? 'کم از کم آرڈر رقم (Rs)' : 'Kam az kam Order Raqam (Rs)'}
                                </label>
                                <input
                                    type="number"
                                    value={formData.min_order_amount}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            min_order_amount: e.target.value,
                                        })
                                    }
                                    placeholder="5000"
                                    className="w-full p-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-emerald-600 font-mono"
                                />
                            </div>

                            {/* 5. Wazaahat (Description) */}
                            <div>
                                <label className="block font-bold text-gray-900 mb-1">
                                    {isUrdu ? 'وضاحت (تفصیل)' : 'Wazaahat (Description)'}
                                </label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({ ...formData, description: e.target.value })
                                    }
                                    placeholder={isUrdu ? 'اس رول کی وضاحت...' : 'Is rule ki wazaahat...'}
                                    className="w-full p-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={submitting}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg text-xs transition cursor-pointer disabled:opacity-50"
                                >
                                    {isUrdu ? 'منسوخ' : 'Mansookh'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 bg-[#14532d] hover:bg-[#0f3d21] text-white font-bold rounded-lg text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
                                >
                                    {submitting ? (isUrdu ? 'محفوظ ہو رہا ہے...' : 'Save ho raha hai...') : (isUrdu ? 'محفوظ کریں' : 'Save Karein')}
                                </button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
