import { NavGroup, NavItem } from "@/types";

export const jkcSidebarNav: NavGroup[] = [
    {
        id: "home",
        title: "nav.home",
        icon: "HouseIcon",
        isGroup: true,
        items: [
            {
                title: "nav.dashboard",
                url: "/dashboard",
                icon: "HouseIcon",
            },
        ],
        includeRoutes: ["dashboard"]
    },
    {
        id: "daily_kaam",
        title: "nav.daily_kaam",
        icon: "LightningIcon",
        isGroup: true,
        items: [
            {
                title: "nav.nayi_sale",
                url: "/amroza",
                icon: "TagIcon",
            },
            {
                title: "nav.wasooli",
                url: "/wasooli",
                icon: "HandCoinsIcon",
            },
            {
                title: "nav.farmer_bill_bijak",
                url: "/bijak",
                icon: "ReceiptXIcon",
            },
        ],
        includeRoutes: [
            "amroza",
            "wasooli",
            "bijak"
        ]
    },
    {
        id: "banking",
        title: "nav.banking",
        icon: "BankIcon",
        isGroup: true,
        items: [
            {
                title: "nav.bank_accounts",
                url: "/banking/accounts",
                icon: "BankIcon",
            },
            {
                title: "nav.deposit_transfer",
                url: "/banking/transfers",
                icon: "ArrowsLeftRightIcon",
            },
            {
                title: "nav.cheques",
                url: "/banking/cheques",
                icon: "CheckSquareOffsetIcon",
            },
        ],
        includeRoutes: [
            "banking"
        ]
    },
    {
        id: "investment",
        title: "nav.investment_capital",
        icon: "CoinsIcon",
        isGroup: true,
        items: [
            {
                title: "nav.investment_capital",
                url: "/investment/partners",
                icon: "CoinsIcon",
            },
        ],
        includeRoutes: [
            "investment"
        ]
    },
    {
        id: "khata",
        title: "nav.khata",
        icon: "BookOpenIcon",
        isGroup: true,
        items: [
            {
                title: "nav.merchant_khata",
                url: "/merchant-khata",
                icon: "UsersIcon",
            },
            {
                title: "nav.farmer_khata",
                url: "/khata",
                icon: "UserCircleIcon",
            },
            {
                title: "nav.general_ledger",
                url: "/general-ledger",
                icon: "BookBookmarkIcon",
            },
        ],
        includeRoutes: [
            "merchant-wasooli",
            "merchant-amroza",
            "amroza-detail",
            "wasooli-detail",
            "amroza-wasooli",
            "khata",
            "general-ledger"
        ]
    },
    {
        id: "reports",
        title: "nav.reports",
        icon: "ChartBarIcon",
        isGroup: true,
        items: [
            {
                title: "nav.reports",
                url: "/reports",
                icon: "ChartBarIcon",
            },
        ],
        includeRoutes: ["reports.index", "reports.data"]
    },
    {
        id: "expiry_gifts",
        title: "nav.expiry_gifts",
        icon: "GiftIcon",
        isGroup: true,
        items: [
            {
                title: "nav.expiry_gifts",
                url: "/expiry-gifts",
                icon: "GiftIcon",
            },
        ],
        includeRoutes: ["expiry_gifts", "expiry-gifts"]
    },
    {
        id: "setup",
        title: "nav.setup",
        icon: "GearSixIcon",
        isGroup: true,
        items: [
            {
                title: "nav.merchants_farmers",
                url: "/masters/merchants",
                icon: "UsersThreeIcon",
            },
            {
                title: "nav.products_areas",
                url: "/masters/items",
                icon: "PackageIcon",
            },
        ],
        includeRoutes: [
            "masters"
        ]
    },
    {
        id: "system",
        title: "nav.system",
        icon: "WrenchIcon",
        isGroup: true,
        items: [
            {
                title: "nav.settings",
                url: "/settings/currency",
                icon: "GearIcon",
            },
            {
                title: "nav.backup",
                url: "/backup",
                icon: "CloudArrowUpIcon",
            },
        ],
        includeRoutes: [
            "settings",
            "backup"
        ]
    }
];

const legacySidebarNav: NavGroup[] = [
    {
        id: "legacy_pos",
        title: "Legacy POS",
        icon: "CashRegisterIcon",
        isGroup: true,
        items: [
            { title: "POS", icon: "CashRegisterIcon", url: "/pos" },
            { title: "Purchases", icon: "CoinsIcon", url: "/purchases" },
            { title: "Sales", icon: "TagIcon", url: "/sales" },
            { title: "Expenses", icon: "ReceiptXIcon", url: "/expenses" },
            { title: "Products", icon: "PackageIcon", url: "/products" },
            { title: "Categories", icon: "FolderIcon", url: "/categories" },
            { title: "Customers", icon: "UsersIcon", url: "/customers" },
            { title: "Employees", icon: "IdentificationBadgeIcon", url: "/employees" },
        ],
        includeRoutes: ["pos", "purchases", "sales", "expenses", "products", "categories", "customers", "employees"]
    }
];

const footerNav: NavItem[] = [
    {
        title: "nav.support",
        url: "/help",
        icon: "QuestionIcon",
    },
    {
        title: "nav.live_chat",
        url: "/live-chat",
        icon: "ChatsIcon"
    }
];

export const getNavigationItems = (showLegacyPos = false) => {
    return {
        sideNav: showLegacyPos ? [...jkcSidebarNav, ...legacySidebarNav] : [...jkcSidebarNav],
        footerNav: [...footerNav],
    };
};

export const navigationItems = getNavigationItems(false);
