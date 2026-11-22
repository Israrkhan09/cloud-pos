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

const STORAGE_KEY_ACCOUNTS = 'pos_bank_accounts';
const STORAGE_KEY_TRANSFERS = 'pos_bank_transfers';
const STORAGE_KEY_CHEQUES = 'pos_bank_cheques';

export const EVENT_BANKING_UPDATED = 'pos_banking_updated';

// Notify all listeners on storage change
export function notifyBankingChange() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVENT_BANKING_UPDATED));
    }
}

// Get stored bank accounts
export function getStoredBankAccounts(): BankAccount[] {
    if (typeof window === 'undefined') return [];
    try {
        const saved = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch {
        // ignore
    }
    // Default initial accounts if none stored
    return [
        {
            id: 1,
            name: 'Meezan Bank',
            account_number: 'PK00MEZN001234567890',
            type: 'Bank Account',
            opening_balance: 500000,
            current_balance: 500000,
            status: 'Active',
        },
        {
            id: 2,
            name: 'HBL Mandi A/C',
            account_number: 'PK00HABB009876543210',
            type: 'Bank Account',
            opening_balance: 250000,
            current_balance: 250000,
            status: 'Active',
        },
        {
            id: 3,
            name: 'EasyPaisa Isra',
            account_number: '03001234567',
            type: 'Wallet',
            opening_balance: 10000,
            current_balance: 10000,
            status: 'Active',
        },
    ];
}

// Save stored bank accounts
export function saveStoredBankAccounts(accounts: BankAccount[]): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
        notifyBankingChange();
    } catch {
        // ignore
    }
}

// Update balance of a specific account by delta (+ or -)
export function updateAccountBalance(accountName: string, deltaAmount: number): BankAccount[] {
    const accounts = getStoredBankAccounts();
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

    saveStoredBankAccounts(updated);
    return updated;
}

// Get stored transfer entries
export function getStoredTransfers(): TransferEntry[] {
    if (typeof window === 'undefined') return [];
    try {
        const saved = localStorage.getItem(STORAGE_KEY_TRANSFERS);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch {
        // ignore
    }

    // Default initial mock entries if none exist
    return [
        {
            id: 1,
            title: 'Cash Deposit → HBL Mandi A/C',
            subtext: '19 Nov · Slip SLP-20388',
            amount: 50000,
            date: '19 Nov 2026',
            bankName: 'HBL Mandi A/C',
            type: 'deposit',
        },
        {
            id: 2,
            title: 'Bank → Cash (Meezan)',
            subtext: '17 Nov · Cheque withdrawal',
            amount: 20000,
            date: '17 Nov 2026',
            bankName: 'Meezan Business',
            type: 'withdraw',
        },
        {
            id: 3,
            title: 'Cash Deposit → Meezan Business',
            subtext: '15 Nov · Slip SLP-20312',
            amount: 35000,
            date: '15 Nov 2026',
            bankName: 'Meezan Business',
            type: 'deposit',
        },
    ];
}

// Add a new transfer entry
export function addStoredTransfer(entry: TransferEntry): void {
    if (typeof window === 'undefined') return;
    try {
        const current = getStoredTransfers();
        const updated = [entry, ...current];
        localStorage.setItem(STORAGE_KEY_TRANSFERS, JSON.stringify(updated));
        notifyBankingChange();
    } catch {
        // ignore
    }
}

// Get stored cheques
export function getStoredCheques(): ChequeItem[] {
    if (typeof window === 'undefined') return [];
    try {
        const saved = localStorage.getItem(STORAGE_KEY_CHEQUES);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
    } catch {
        // ignore
    }

    return [
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
}

// Save stored cheques
export function saveStoredCheques(cheques: ChequeItem[]): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY_CHEQUES, JSON.stringify(cheques));
        notifyBankingChange();
    } catch {
        // ignore
    }
}
