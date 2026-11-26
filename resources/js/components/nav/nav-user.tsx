import { usePage, Link } from '@inertiajs/react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import { useIsMobile } from '@/hooks/use-mobile';
import { type SharedData } from '@/types';
import Icon from '@/components/ui/icon';

export function NavUser() {
    const { auth, business } = usePage<SharedData & { business?: { name?: string } }>().props;

    return (
        <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-1">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground px-2 py-1.5 h-12 w-full flex items-center justify-between rounded-lg focus:ring-0 cursor-pointer"
                        >
                            <UserInfo user={auth.user} showEmail={true} />
                            <Icon name="CaretUpDown" className="size-4 shrink-0 text-muted-foreground ms-auto group-data-[collapsible=icon]:hidden" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-64 rounded-lg p-1.5 shadow-lg"
                        align="end"
                        sideOffset={6}
                        side="right"
                    >
                        {business?.name && (
                            <div className="px-2 py-1.5 mb-1 text-xs font-semibold text-emerald-800 bg-emerald-50 rounded-md border border-emerald-100 flex items-center gap-1.5">
                                <Icon name="Storefront" className="size-3.5 text-emerald-700 shrink-0" />
                                <span className="truncate">{business.name}</span>
                            </div>
                        )}
                        <UserMenuContent user={auth.user} />
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
