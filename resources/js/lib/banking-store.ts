export interface BankAccount {
    id: number | string;
    name: string;
    account_number: string;
    type: string;
    rawType?: string;
    opening_balance: number;
    current_balance: number;
    status: 'Active' | 'Inactive';
}

export interface TransferEntry {
    id: number | string;
    title: string;
    subtext: string;
    amount: number;
    date?: string;
    bankName?: string;
    type?: 'deposit' | 'withdraw' | 'transfer';
}

export interface ChequeItem {
    id: number;
    date: string;
    party: string;
    party_sub: string;
    cheque_no: string;
    bank: string;
    amount: number;
    status: 'Pending' | 'Cleared' | 'Bounced';
}

export const EVENT_BANKING_UPDATED = 'pos_banking_updated';

// Notify all listeners on storage change
export function notifyBankingChange() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVENT_BANKING_UPDATED));
    }
}

/**
 * Resolve active business_id from DOM, in-memory state, or window context.
 */
export function getActiveBusinessId(): string | null {
    if (typeof window === 'undefined') return null;

    if ((window as any).__ACTIVE_BUSINESS_ID__) {
        return (window as any).__ACTIVE_BUSINESS_ID__;
    }

    const meta = document.querySelector('meta[name="business-id"]');
    if (meta) {
        const content = meta.getAttribute('content');
        if (content && content.trim() !== '') {
            (window as any).__ACTIVE_BUSINESS_ID__ = content.trim();
            return content.trim();
        }
    }

    const appEl = document.getElementById('app');
    if (appEl && appEl.dataset.page) {
        try {
            const page = JSON.parse(appEl.dataset.page);
            const bizId = page.props?.business?.id || page.props?.auth?.user?.business_id;
            if (bizId) {
                (window as any).__ACTIVE_BUSINESS_ID__ = bizId;
                return bizId;
            }
        } catch {}
    }

    return null;
}

/**
 * Compute tenant-qualified localStorage key
 */
function getTenantKey(baseKey: string, businessId?: string | null): string {
    const biz = businessId || getActiveBusinessId() || 'biz-test-business';
    return `pos_${biz}_${baseKey}`;
}

/**
 * Check if the target business is the protected demo account
 */
function isDemoBusiness(businessId?: string | null): boolean {
    const biz = businessId || getActiveBusinessId();
    return !biz || biz === 'biz-test-business';
}

// Protected default demo accounts strictly for test@test.com
const DEMO_ACCOUNTS: BankAccount[] = [
    {
        id: 1,
        name: 'Meezan Bank Mandi Branch',
        account_number: 'PK36MEZN00112233445566',
        type: 'Bank Account',
        opening_balance: 299700,
        current_balance: 299700,
        status: 'Active',
    },
    {
        id: 2,
        name: 'HBL Aadhat Current Account',
        account_number: 'PK12HABB00998877665544',
        type: 'Bank Account',
        opening_balance: 142000,
        current_balance: 142000,
        status: 'Active',
    },
    {
        id: 3,
        name: 'Easypaisa / JazzCash Counter',
        account_number: '0300-1234567',
        type: 'Wallet',
        opening_balance: 21500,
        current_balance: 21500,
        status: 'Active',
    },
    {
        id: 4,
        name: 'EasyPaisa Israr',
        account_number: '03194080600',
        type: 'Wallet',
        opening_balance: 105000,
        current_balance: 105000,
        status: 'Active',
    },
];

// Protected default demo transfers strictly for test@test.com
const DEMO_TRANSFERS: TransferEntry[] = [
    {
        id: 1,
        title: 'Cash Deposit → EasyPaisa israr',
        subtext: '2026-11-23 · Slip SLP-20388',
        amount: 5000,
        date: '2026-11-23',
        bankName: 'EasyPaisa israr',
        type: 'deposit',
    },
    {
        id: 2,
        title: 'Cash Deposit → Meezan Bank Mandi Branch',
        subtext: '2026-11-22 · Slip SLP-20312',
        amount: 35000,
        date: '2026-11-22',
        bankName: 'Meezan Bank Mandi Branch',
        type: 'deposit',
    },
    {
        id: 3,
        title: 'Bank → Cash (HBL Aadhat Current Account)',
        subtext: '2026-11-21 · Cheque withdrawal',
        amount: 20000,
        date: '2026-11-21',
        bankName: 'HBL Aadhat Current Account',
        type: 'withdraw',
    },
];

// Protected default demo cheques strictly for test@test.com
const DEMO_CHEQUES: ChequeItem[] = [
    {
        id: 1,
        date: '20 Nov',
        party: 'Raza Fruit Corner',
        party_sub: 'Mila (merchant)',
        cheque_no: '00418273',
        bank: 'UBL',
        amount: 80000,
        status: 'Bounced',
    },
    {
        id: 2,
        date: '25 Nov',
        party: 'Haji Aslam Traders',
        party_sub: 'Mila (merchant)',
        cheque_no: '00551902',
        bank: 'Meezan',
        amount: 35000,
        status: 'Pending',
    },
    {
        id: 3,
        date: '27 Nov',
        party: 'Al-Madina Sabzi Shop',
        party_sub: 'Mila (merchant)',
        cheque_no: '00227761',
        bank: 'HBL',
        amount: 60000,
        status: 'Pending',
    },
    {
        id: 4,
        date: '30 Nov',
        party: 'Ch. Imran (kisan)',
        party_sub: 'Diya (farmer payout)',
        cheque_no: '00093340',
        bank: 'HBL Mandi A/C',
        amount: 40000,
        status: 'Pending',
    },
    {
        id: 5,
        date: '18 Nov',
        party: 'Bilal Brothers',
        party_sub: 'Mila (merchant)',
        cheque_no: '00774410',
        bank: 'Alfalah',
        amount: 45000,
        status: 'Cleared',
    },
];

// Get stored bank accounts
export function getStoredBankAccounts(businessId?: string | null): BankAccount[] {
    if (typeof window === 'undefined') return [];
    const key = getTenantKey('bank_accounts', businessId);
    const isDemo = isDemoBusiness(businessId);

    try {
        // 1. Check tenant-isolated key first
        const saved = localStorage.getItem(key);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }

        // 2. If protected demo business, safely migrate from legacy key
        if (isDemo) {
            const legacySaved = localStorage.getItem('pos_bank_accounts');
            if (legacySaved) {
                const parsed = JSON.parse(legacySaved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    try { localStorage.setItem(key, legacySaved); } catch {}
                    return parsed;
                }
            }
            return [...DEMO_ACCOUNTS];
        }
    } catch {
        // ignore
    }

    // For any real/new tenant: strictly start with empty accounts
    return [];
}

// Save stored bank accounts
export function saveStoredBankAccounts(accounts: BankAccount[], businessId?: string | null): void {
    if (typeof window === 'undefined') return;
    const key = getTenantKey('bank_accounts', businessId);
    const isDemo = isDemoBusiness(businessId);

    try {
        localStorage.setItem(key, JSON.stringify(accounts));
        // Also keep legacy key synced for demo business backward compatibility
        if (isDemo) {
            localStorage.setItem('pos_bank_accounts', JSON.stringify(accounts));
        }
        notifyBankingChange();
    } catch {
        // ignore
    }
}

// Update balance of a specific account by delta (+ or -)
export function updateAccountBalance(accountName: string, deltaAmount: number, businessId?: string | null): BankAccount[] {
    const accounts = getStoredBankAccounts(businessId);
    const updated = accounts.map((acc) => {
        if (acc.name.trim().toLowerCase() === accountName.trim().toLowerCase()) {
            const currentBal = Number(acc.current_balance) || 0;
            return {
                ...acc,
                current_balance: Math.max(0, currentBal + deltaAmount),
            };
        }
        return acc;
    });

    saveStoredBankAccounts(updated, businessId);
    return updated;
}

// Get stored transfer entries
export function getStoredTransfers(businessId?: string | null): TransferEntry[] {
    if (typeof window === 'undefined') return [];
    const key = getTenantKey('bank_transfers', businessId);
    const isDemo = isDemoBusiness(businessId);

    try {
        const saved = localStorage.getItem(key);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }

        if (isDemo) {
            const legacySaved = localStorage.getItem('pos_bank_transfers');
            if (legacySaved) {
                const parsed = JSON.parse(legacySaved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    try { localStorage.setItem(key, legacySaved); } catch {}
                    return parsed;
                }
            }
            return [...DEMO_TRANSFERS];
        }
    } catch {
        // ignore
    }

    return [];
}

// Add a new transfer entry
export function addStoredTransfer(entry: TransferEntry, businessId?: string | null): void {
    if (typeof window === 'undefined') return;
    const key = getTenantKey('bank_transfers', businessId);
    const isDemo = isDemoBusiness(businessId);

    try {
        const current = getStoredTransfers(businessId);
        const updated = [entry, ...current];
        localStorage.setItem(key, JSON.stringify(updated));
        if (isDemo) {
            localStorage.setItem('pos_bank_transfers', JSON.stringify(updated));
        }
        notifyBankingChange();
    } catch {
        // ignore
    }
}

// Get stored cheques
export function getStoredCheques(businessId?: string | null): ChequeItem[] {
    if (typeof window === 'undefined') return [];
    const key = getTenantKey('bank_cheques', businessId);
    const isDemo = isDemoBusiness(businessId);

    try {
        const saved = localStorage.getItem(key);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }

        if (isDemo) {
            const legacySaved = localStorage.getItem('pos_bank_cheques');
            if (legacySaved) {
                const parsed = JSON.parse(legacySaved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    try { localStorage.setItem(key, legacySaved); } catch {}
                    return parsed;
                }
            }
            return [...DEMO_CHEQUES];
        }
    } catch {
        // ignore
    }

    return [];
}

// Save stored cheques
export function saveStoredCheques(cheques: ChequeItem[], businessId?: string | null): void {
    if (typeof window === 'undefined') return;
    const key = getTenantKey('bank_cheques', businessId);
    const isDemo = isDemoBusiness(businessId);

    try {
        localStorage.setItem(key, JSON.stringify(cheques));
        if (isDemo) {
            localStorage.setItem('pos_bank_cheques', JSON.stringify(cheques));
        }
        notifyBankingChange();
    } catch {
        // ignore
    }
}
