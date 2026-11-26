import AppLogoIcon from '@/components/app/app-logo-icon';
import { usePage } from '@inertiajs/react';

export default function AppLogo() {
    const { business } = (usePage().props as any) || {};

    return (
        <div className="flex items-center gap-2.5 w-full overflow-hidden py-1">
            <AppLogoIcon className="size-[34px] aspect-square shrink-0 rounded-lg shadow-xs" />
            <div className="flex-1 text-start overflow-hidden leading-tight group-data-[collapsible=icon]:hidden">
                <span className="block truncate font-black text-sm text-[#14532d] tracking-tight">
                    {business?.name || 'Vegetable POS'}
                </span>
                {business?.mandi_location && (
                    <span className="block truncate text-[10px] text-muted-foreground font-medium">
                        {business.mandi_location}
                    </span>
                )}
            </div>
        </div>
    );
}
