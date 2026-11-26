import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';
import { useTranslation } from 'react-i18next';

import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';

type LoginForm = {
    email: string;
    password: string;
    remember: boolean;
};

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function Login({ status, canResetPassword }: LoginProps) {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors, reset } = useForm<Required<LoginForm>>({
        email: '',
        password: '',
        remember: false,
    });

    // Activation Modal State
    const [isActivateOpen, setIsActivateOpen] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(false);
    const [statusError, setStatusError] = useState<string | null>(null);
    const [accountInfo, setAccountInfo] = useState<{
        status: string;
        name?: string;
        role?: string;
        businessName?: string;
        businessId?: string;
        message?: string;
    } | null>(null);

    const {
        data: activateData,
        setData: setActivateData,
        post: postActivate,
        processing: activating,
        errors: activateErrors,
        reset: resetActivate,
    } = useForm({
        email: '',
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    const handleOpenActivation = () => {
        if (data.email) {
            setActivateData('email', data.email);
        }
        setStatusError(null);
        setAccountInfo(null);
        setIsActivateOpen(true);
    };

    const checkInvitationStatus = async () => {
        if (!activateData.email) {
            setStatusError('Please enter your email address to check invitation.');
            return;
        }

        setCheckingStatus(true);
        setStatusError(null);
        setAccountInfo(null);

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch('/login/check-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({ email: activateData.email }),
            });

            const result = await res.json();
            if (!res.ok) {
                setStatusError(result.message || 'Unable to connect to central server. Please verify your connection.');
                return;
            }

            if (!result.success && result.status !== 'PENDING_PASSWORD') {
                setStatusError(result.message || 'No invitation found for this email address.');
                return;
            }

            setAccountInfo(result);
        } catch {
            setStatusError('Network error connecting to central server. Please check your connection.');
        } finally {
            setCheckingStatus(false);
        }
    };

    const submitActivation: FormEventHandler = (e) => {
        e.preventDefault();
        postActivate(route('login.activate'), {
            onSuccess: () => {
                setIsActivateOpen(false);
                resetActivate();
            },
        });
    };

    return (
        <AuthLayout
            title={t('auth.login')}
            description={t('auth.welcome_subtitle')}
        >
            <Head title={t('auth.login')} />

            <form className="flex flex-col gap-3" onSubmit={submit}>
                <div className="grid gap-3">
                    <div className="grid gap-1.5">
                        <Label htmlFor="email" className="text-xs">{t('auth.email')}</Label>
                        <Input
                            id="email"
                            type="email"
                            required
                            autoFocus
                            tabIndex={1}
                            autoComplete="email"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            placeholder="user@example.com"
                            className="text-start h-9 text-xs"
                        />
                        <InputError message={errors.email} />
                    </div>

                    <div className="grid gap-1.5">
                        <Label htmlFor="password" className="text-xs">{t('auth.password')}</Label>
                        <Input
                            id="password"
                            type="password"
                            required
                            tabIndex={2}
                            autoComplete="current-password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            placeholder="********"
                            className="text-start h-9 text-xs"
                        />
                        <InputError message={errors.password} />
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="remember"
                                name="remember"
                                checked={data.remember}
                                onClick={() => setData('remember', !data.remember)}
                                tabIndex={3}
                            />
                            <Label htmlFor="remember" className="cursor-pointer text-xs">{t('auth.remember_me')}</Label>
                        </div>
                        {canResetPassword && (
                            <TextLink href={route('password.request')} className="text-xs" tabIndex={5}>
                                {t('auth.forgot_password')}
                            </TextLink>
                        )}
                    </div>

                    <Button type="submit" className="mt-1 h-9 w-full cursor-pointer text-xs font-semibold" tabIndex={4} disabled={processing}>
                        {processing && <Icon name="Spinner" className="h-4 w-4 animate-spin me-2" />}
                        {t('auth.login')}
                    </Button>
                </div>
            </form>

            {/* First-Time Activation Option */}
            <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-muted-foreground text-[10px] tracking-wider">Cloud Staff</span>
                </div>
            </div>

            <Button
                type="button"
                variant="outline"
                className="h-9 w-full text-xs font-medium cursor-pointer border-dashed border-emerald-300 hover:bg-emerald-50 text-emerald-800"
                onClick={handleOpenActivation}
            >
                <Icon name="UserCheck" className="h-4 w-4 me-2 text-emerald-600" />
                First-Time Employee Activation
            </Button>

            {status && <div className="mt-2 text-center text-xs font-medium text-emerald-600">{status}</div>}

            {/* Activation Dialog Modal */}
            <Dialog open={isActivateOpen} onOpenChange={setIsActivateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold flex items-center gap-2">
                            <Icon name="ShieldCheck" className="h-5 w-5 text-emerald-600" />
                            Employee Station Activation
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Activate your invited staff account and set your password to begin working on this station.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Step 1: Email Lookup */}
                    <div className="grid gap-3 py-1">
                        <div className="grid gap-1.5">
                            <Label htmlFor="activate_email" className="text-xs font-medium">Invited Email Address</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="activate_email"
                                    type="email"
                                    required
                                    value={activateData.email}
                                    onChange={(e) => setActivateData('email', e.target.value)}
                                    placeholder="yourname@gmail.com"
                                    className="h-9 text-xs"
                                    disabled={checkingStatus || activating || accountInfo?.status === 'PENDING_PASSWORD'}
                                />
                                {accountInfo?.status !== 'PENDING_PASSWORD' && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="h-9 text-xs px-3 font-medium whitespace-nowrap cursor-pointer"
                                        onClick={checkInvitationStatus}
                                        disabled={checkingStatus || !activateData.email}
                                    >
                                        {checkingStatus ? (
                                            <Icon name="Spinner" className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            'Verify'
                                        )}
                                    </Button>
                                )}
                            </div>
                            <InputError message={activateErrors.email} />
                        </div>

                        {/* Error message */}
                        {statusError && (
                            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                                {statusError}
                            </div>
                        )}

                        {/* Already Active notification */}
                        {accountInfo && accountInfo.status === 'LOCAL_ACTIVE' && (
                            <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-800 border border-blue-200 space-y-1">
                                <div className="font-semibold flex items-center gap-1.5">
                                    <Icon name="CheckCircle" className="h-4 w-4 text-blue-600" />
                                    Station Account Active
                                </div>
                                <p>This account is already active on this station for <strong>{accountInfo.name}</strong>. Please sign in using your existing password in the login form.</p>
                            </div>
                        )}

                        {/* Suspended notification */}
                        {accountInfo && accountInfo.status === 'SUSPENDED' && (
                            <div className="rounded-md bg-red-50 p-3 text-xs text-red-800 border border-red-200">
                                <div className="font-semibold flex items-center gap-1.5">
                                    <Icon name="WarningCircle" className="h-4 w-4 text-red-600" />
                                    Account Deactivated
                                </div>
                                <p className="mt-1">{accountInfo.message || 'Your account has been deactivated. Please contact your administrator.'}</p>
                            </div>
                        )}

                        {/* Step 2: Password Creation when PENDING_PASSWORD */}
                        {accountInfo && accountInfo.status === 'PENDING_PASSWORD' && (
                            <form onSubmit={submitActivation} className="grid gap-3 pt-2 border-t">
                                <div className="rounded-md bg-emerald-50 p-3 border border-emerald-200 space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-emerald-900">{accountInfo.name}</span>
                                        <Badge variant="outline" className="border-emerald-500 text-emerald-800 bg-white">
                                            {accountInfo.role}
                                        </Badge>
                                    </div>
                                    <div className="text-emerald-700">
                                        Business: <span className="font-medium">{accountInfo.businessName || 'Sabzi Mandi'}</span>
                                    </div>
                                    <p className="text-[11px] text-emerald-600">
                                        Invitation verified! Set your password to complete activation and sign in immediately.
                                    </p>
                                </div>

                                <div className="grid gap-1.5">
                                    <Label htmlFor="activate_password" className="text-xs font-medium">Create Password (min. 6 characters)</Label>
                                    <Input
                                        id="activate_password"
                                        type="password"
                                        required
                                        minLength={6}
                                        value={activateData.password}
                                        onChange={(e) => setActivateData('password', e.target.value)}
                                        placeholder="••••••••"
                                        className="h-9 text-xs"
                                        autoFocus
                                    />
                                    <InputError message={activateErrors.password} />
                                </div>

                                <div className="grid gap-1.5">
                                    <Label htmlFor="activate_password_confirmation" className="text-xs font-medium">Confirm Password</Label>
                                    <Input
                                        id="activate_password_confirmation"
                                        type="password"
                                        required
                                        minLength={6}
                                        value={activateData.password_confirmation}
                                        onChange={(e) => setActivateData('password_confirmation', e.target.value)}
                                        placeholder="••••••••"
                                        className="h-9 text-xs"
                                    />
                                </div>

                                <DialogFooter className="pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setAccountInfo(null);
                                            resetActivate();
                                        }}
                                        disabled={activating}
                                        className="text-xs"
                                    >
                                        Change Email
                                    </Button>
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={activating || !activateData.password || activateData.password.length < 6}
                                        className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                    >
                                        {activating && <Icon name="Spinner" className="h-3.5 w-3.5 animate-spin me-1.5" />}
                                        Activate Station & Sign In
                                    </Button>
                                </DialogFooter>
                            </form>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </AuthLayout>
    );
}
