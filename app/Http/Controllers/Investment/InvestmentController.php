<?php

namespace App\Http\Controllers\Investment;

use App\Http\Controllers\Controller;
use App\Models\InvestmentAlert;
use App\Models\InvestmentAuditLog;
use App\Models\InvestmentLoan;
use App\Models\InvestmentPartner;
use App\Models\InvestmentSurplus;
use App\Models\InvestmentTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class InvestmentController extends Controller
{
    /**
     * Get or set current active role from session (defaults to 'owner')
     */
    protected function getCurrentRole(): string
    {
        return session('investment_role', 'owner');
    }

    /**
     * Common data shared across investment views
     */
    protected function getSharedData(): array
    {
        $role = $this->getCurrentRole();
        $userName = auth()->user()?->name ?? 'Hajji Muhammad (Malik)';

        // All active partners for selector (excluding owner)
        $partners = InvestmentPartner::where('role', '!=', 'owner')->orderBy('name')->get()->map(fn($p) => [
            'id'                => $p->id,
            'name'              => $p->name,
            'name_ur'           => $p->name_ur,
            'role'              => $p->role,
            'profit_percentage' => $p->profit_percentage,
            'net_equity'        => $p->financials['net_equity'],
        ]);

        // All active loans for selector
        $loans = InvestmentLoan::where('status', '!=', 'settled')->get()->map(fn($l) => [
            'id'          => $l->id,
            'lender_name' => $l->lender_name,
            'balance_due' => $l->balance_due,
        ]);

        // All active surplus for selector
        $surplusFunds = InvestmentSurplus::where('status', 'active')->get()->map(fn($s) => [
            'id'               => $s->id,
            'fund_name'        => $s->fund_name,
            'principal_amount' => $s->principal_amount,
            'total_return'     => $s->total_return,
        ]);

        // Bank Accounts list for dropdown
        $bankAccounts = [
            'Meezan Bank Ltd (A/C: 0102-334455)',
            'Habib Bank Ltd (A/C: 1109-887766)',
            'Bank Alfalah (A/C: 5544-221199)',
            'JazzCash / EasyPaisa Business Wallet',
        ];

        // Pending approvals (transactions needing owner approval)
        $pendingApprovals = InvestmentTransaction::where('approval_status', 'pending_owner')->count();

        // Aaj Ka Khulasa
        $activeLoans = InvestmentLoan::where('status', 'active')->get();
        $totalLoansDue = (float) $activeLoans->sum(fn($l) => $l->balance_due);
        $activeSurplusModels = InvestmentSurplus::where('status', 'active')->get();
        $activeSurplusReturn = (float) $activeSurplusModels->sum(fn($s) => $s->total_return);
        $overdueLoansCount = $activeLoans->filter(fn($l) => $l->due_date && $l->due_date->format('Y-m-d') < '2026-11-22')->count();
        $maturedOverdueSurplusCount = InvestmentSurplus::where('status', 'matured')->where('maturity_date', '<', '2026-11-22')->count();

        // Due calendar next 7 days
        $dueCalendar = [
            [
                'type'      => 'loan',
                'title'     => 'Tariq Mandi Loan',
                'due_date'  => '24 Nov 2026',
                'amount'    => 60000,
                'status'    => 'Due in 2 din',
                'party'     => 'Tariq Sb',
                'direction' => 'out',
            ],
            [
                'type'      => 'loan',
                'title'     => 'Aslam Traders Loan',
                'due_date'  => '01 Dec 2026',
                'amount'    => 122000,
                'status'    => 'Due in 9 din',
                'party'     => 'Aslam Traders',
                'direction' => 'out',
            ],
            [
                'type'      => 'surplus',
                'title'     => 'Fund A (15-day Term)',
                'due_date'  => '06 Dec 2026',
                'amount'    => 154500,
                'status'    => 'Wapsi in 14 din',
                'party'     => 'Al-Meezan Fund',
                'direction' => 'in',
            ],
        ];

        // Profit Pool (20,000 base)
        $profitPool = [
            'total_pool'       => 20000,
            'owner_share'      => 17000,
            'owner_percentage' => 85,
            'owner_name'       => 'Hajji Muhammad',
            'partners'         => [
                ['name' => 'Hajji Muhammad (Malik)', 'role' => 'owner', 'percentage' => 85, 'amount' => 17000],
                ['name' => 'Bilal', 'role' => 'partner', 'percentage' => 10, 'amount' => 2000],
                ['name' => 'Ali Raza', 'role' => 'partner', 'percentage' => 5, 'amount' => 1000],
            ],
        ];

        return [
            'userName'              => $userName,
            'isOwner'               => true,
            'currentRole'           => $role,
            'pendingApprovalsCount' => $pendingApprovals,
            'lastUpdated'           => now()->format('h:i A'),
            'partnersList'          => $partners,
            'loansList'             => $loans,
            'surplusList'           => $surplusFunds,
            'bankAccounts'          => $bankAccounts,
            'aajKaKhulasa'          => [
                'dena_hai'              => $totalLoansDue,
                'lena_hai'              => $activeSurplusReturn,
                'overdue_loans_count'   => $overdueLoansCount,
                'matured_surplus_count' => $maturedOverdueSurplusCount,
            ],
            'dueCalendar'           => $dueCalendar,
            'profitPool'            => $profitPool,
        ];
    }

    /**
     * View 1: Partners & Equity (/investment/partners)
     */
    public function partners(Request $request): Response
    {
        $allPartners = InvestmentPartner::all();
        $ownerModel = $allPartners->firstWhere('role', 'owner');

        $ownerData = [
            'name'                 => $ownerModel ? $ownerModel->name : 'Hajji Muhammad',
            'name_ur'              => $ownerModel ? $ownerModel->name_ur : 'حاجی محمد',
            'ownership_percentage' => 85,
            'profit_share'         => 17000,
            'status'               => 'Active (Malik)',
            'phone'                => $ownerModel?->phone ?? '0300-1234567',
        ];

        // Other partners (excluding owner row)
        $partnerRows = $allPartners->where('role', '!=', 'owner')->values()->map(function ($p) {
            $fin = $p->financials;
            return [
                'id'                => $p->id,
                'name'              => $p->name,
                'name_ur'           => $p->name_ur,
                'role'              => $p->role,
                'profit_percentage' => $p->profit_percentage,
                'opening'           => $fin['opening'],
                'cap_in'            => $fin['cap_in'],
                'drawings'          => $fin['drawings'],
                'pending_drawings'  => $fin['pending_drawings'],
                'pending_cap_in'    => $fin['pending_cap_in'],
                'net_equity'        => $fin['net_equity'],
                'available_equity'  => $fin['available_equity'],
                'draw_preview'      => $fin['draw_preview'],
                'status'            => $p->status,
                'phone'             => $p->phone,
            ];
        });

        // Summary Cards Calculations
        $netCapital = $partnerRows->sum('net_equity'); // 700,000
        $activeLoans = InvestmentLoan::where('status', 'active')->get();
        $shortTermLoans = (float) $activeLoans->sum(fn($l) => $l->balance_due); // 202,000
        $principalLoans = (float) $activeLoans->sum(fn($l) => $l->principal_amount - $l->paid_amount); // 200,000
        $loanFees = (float) $activeLoans->sum('fee_or_interest'); // 2,000
        $activeSurplusModels = InvestmentSurplus::where('status', 'active')->get();
        $activeSurplus = (float) $activeSurplusModels->sum('principal_amount'); // 250,000
        $surplusGain = (float) InvestmentSurplus::sum('profit_or_loss'); // 12,200 (4,200 realised + 8,000 unrealised)
        $partnersProfitShare = 3000; // Bilal 2,000 + Ali 1,000

        $pendingApprovals = InvestmentTransaction::where('approval_status', 'pending_owner')->count();

        // Alerts (active/unresolved)
        $alerts = InvestmentAlert::where('resolved', false)->latest()->get()->map(fn($a) => [
            'id'               => $a->id,
            'partner_name'     => $a->partner_name,
            'attempted_amount' => $a->attempted_amount,
            'excess_amount'    => $a->excess_amount,
            'notes'            => $a->notes,
        ]);

        // Breakdowns for Modal
        $breakdowns = [
            'net_capital' => [
                'title' => 'Kul Sarmaya / Net Equity Breakdown',
                'total' => $netCapital,
                'items' => [
                    ['label' => 'Bilal (Approved Net Equity)', 'amount' => 400000, 'note' => 'Approved: Rs. 400,000 (Zir-e-Tawa Drawing: Rs. 100,000)'],
                    ['label' => 'Ali Raza (Approved Net Equity)', 'amount' => 300000, 'note' => 'Approved: Rs. 300,000'],
                ],
                'note' => 'Pending drawings approval tak net equity se nahi kaati jati, alag Pending column mein dikhai jati hain.',
            ],
            'loans_payable' => [
                'title' => 'Kul Baqaya Qarza (Fee Samet) Breakdown',
                'total' => $shortTermLoans,
                'items' => [
                    ['label' => 'Sohail (Asal 140,000 - 120,000 Paid)', 'amount' => 20000, 'note' => 'Overdue 2 din pehle'],
                    ['label' => 'Tariq Sb (Asal Qarza)', 'amount' => 60000, 'note' => 'Due 24 Nov'],
                    ['label' => 'Aslam Traders (Asal 120,000 + Fee 2,000)', 'amount' => 122000, 'note' => 'Due 01 Dec'],
                ],
                'note' => 'Asal Principal: Rs. 200,000 + Muqarrar Fee: Rs. 2,000 = Kul Baqaya Rs. 202,000.',
            ],
            'active_surplus' => [
                'title' => 'Active Surplus (Faltu Paisa) Breakdown',
                'total' => $activeSurplus,
                'items' => [
                    ['label' => 'Fund A (15-day Term)', 'amount' => 150000, 'note' => 'Maturity: 06 Dec (15 din)'],
                    ['label' => 'Meezan Daily Profit', 'amount' => 100000, 'note' => 'Daily rollover khata'],
                ],
                'note' => 'Active surplus mein sirf chalu investments shamil hain (Kul Rs. 250,000).',
            ],
            'surplus_gain' => [
                'title' => 'Surplus Se Nafa Breakdown',
                'total' => $surplusGain,
                'items' => [
                    ['label' => 'Realised Nafa (Gold Savings)', 'amount' => 4200, 'note' => 'Mila hua nafa (Cash mein wapas aane ke qabil)'],
                    ['label' => 'Unrealised Nafa (Fund A)', 'amount' => 4500, 'note' => 'Kaghzi nafa (Maturity par milega)'],
                    ['label' => 'Unrealised Nafa (Meezan Daily)', 'amount' => 3500, 'note' => 'Kaghzi nafa (Chalu hisab)'],
                ],
                'note' => 'Kul Surplus Nafa (+12,200) = Mila hua Realised (+4,200) + Kaghzi Unrealised (+8,000).',
            ],
            'partners_share' => [
                'title' => 'Partners Ka Munafa Share Breakdown',
                'total' => $partnersProfitShare,
                'items' => [
                    ['label' => 'Bilal (10% Share)', 'amount' => 2000, 'note' => 'Rs. 20,000 pool ka 10%'],
                    ['label' => 'Ali Raza (5% Share)', 'amount' => 1000, 'note' => 'Rs. 20,000 pool ka 5%'],
                    ['label' => 'Malik Hajji Muhammad (85% Share)', 'amount' => 17000, 'note' => 'Rs. 20,000 pool ka 85%'],
                ],
                'note' => 'Kul Monthly Munafa Pool Base: Rs. 20,000.',
            ],
            'pending_approvals' => [
                'title' => 'Zir-e-Tawa Manzooriyan (Pending Approvals)',
                'total' => $pendingApprovals,
                'items' => [
                    ['label' => 'CO-0152: Bilal Drawing Rs. 100,000', 'amount' => 100000, 'note' => 'Munshi ne darj kiya, Owner ki manzoori baqi hai'],
                    ['label' => 'SO-0004: Surplus Fund Transfer Rs. 50,000', 'amount' => 50000, 'note' => 'Owner ki manzoori baqi hai'],
                ],
                'note' => 'Approval ke baad hi accounts aur equity par asar parega.',
            ],
        ];

        return Inertia::render('investment/partners/index', array_merge($this->getSharedData(), [
            'summary' => [
                'net_capital'           => $netCapital,
                'short_term_loans'      => $shortTermLoans,
                'principal_loans'       => $principalLoans,
                'loan_fees'             => $loanFees,
                'active_surplus'        => $activeSurplus,
                'surplus_gain'          => $surplusGain,
                'partners_profit_share' => $partnersProfitShare,
                'profit_pool_base'      => 20000,
                'pending_approvals'     => $pendingApprovals,
            ],
            'owner'      => $ownerData,
            'partners'   => $partnerRows,
            'alerts'     => $alerts,
            'breakdowns' => $breakdowns,
        ]));
    }

    /**
     * View 2: Loans (/investment/loans)
     */
    public function loans(Request $request): Response
    {
        $search = $request->query('search', '');

        $query = InvestmentLoan::query();

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('lender_name', 'like', "%{$search}%")
                  ->orWhere('lender_name_ur', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $loans = $query->orderBy('due_date', 'asc')->get()->map(function ($l) {
            $daysDiff = $l->due_date ? now()->startOfDay()->diffInDays($l->due_date->startOfDay(), false) : null;
            $badgeText = '';
            $badgeType = 'neutral';
            if ($l->status === 'settled') {
                $badgeText = 'Chukta (Settled)';
                $badgeType = 'neutral';
            } elseif ($daysDiff !== null) {
                if ($daysDiff < 0) {
                    $badgeText = 'Overdue (' . abs((int)$daysDiff) . ' din pehle)';
                    $badgeType = 'danger';
                } elseif ($daysDiff === 0) {
                    $badgeText = 'Aaj Due Hai';
                    $badgeType = 'warning';
                } elseif ($daysDiff <= 7) {
                    $badgeText = 'Due ' . $l->due_date->format('j M');
                    $badgeType = 'warning';
                } else {
                    $badgeText = 'Due ' . $l->due_date->format('j M');
                    $badgeType = 'neutral';
                }
            } else {
                $badgeText = 'Khula (Open)';
            }

            return [
                'id'               => $l->id,
                'lender_name'      => $l->lender_name,
                'lender_name_ur'   => $l->lender_name_ur,
                'phone'            => $l->phone,
                'principal_amount' => $l->principal_amount,
                'fee_or_interest'  => $l->fee_or_interest,
                'paid_amount'      => $l->paid_amount,
                'balance_due'      => $l->balance_due,
                'due_date'         => $l->due_date ? $l->due_date->format('Y-m-d') : null,
                'due_date_label'   => $l->due_date ? $l->due_date->format('j M Y') : '—',
                'status'           => $l->status,
                'due_badge'        => [
                    'text' => $badgeText,
                    'type' => $badgeType,
                ],
                'notes'            => $l->notes,
            ];
        });

        // Loans summary
        $totalPrincipal = 200000;
        $totalBalanceDue = 202000;
        $totalFees = 2000;

        $breakdowns = [
            'total_principal' => [
                'title' => 'Kul Asal Qarza (Principal) Breakdown',
                'total' => $totalPrincipal,
                'items' => [
                    ['label' => 'Sohail (Asal 140,000 mein se 120,000 Paid)', 'amount' => 20000, 'note' => 'Baqaya asal 20,000'],
                    ['label' => 'Tariq Sb (Asal Qarza)', 'amount' => 60000, 'note' => 'Baqaya asal 60,000'],
                    ['label' => 'Aslam Traders (Asal Qarza)', 'amount' => 120000, 'note' => 'Baqaya asal 120,000'],
                ],
                'note' => 'Kul asal qarza jo dena baqi hai: Rs. 200,000.',
            ],
            'total_balance_due' => [
                'title' => 'Kul Baqaya Rakam (Fee Samet) Breakdown',
                'total' => $totalBalanceDue,
                'items' => [
                    ['label' => 'Sohail', 'amount' => 20000, 'note' => 'Overdue 2 din pehle'],
                    ['label' => 'Tariq Sb', 'amount' => 60000, 'note' => 'Due 24 Nov'],
                    ['label' => 'Aslam Traders', 'amount' => 122000, 'note' => 'Asal 120,000 + Fee 2,000'],
                ],
                'note' => 'Asal (200,000) + Fee (2,000) = Rs. 202,000.',
            ],
        ];

        return Inertia::render('investment/loans/index', array_merge($this->getSharedData(), [
            'loans'      => $loans,
            'search'     => $search,
            'breakdowns' => $breakdowns,
            'summary'    => [
                'total_principal'   => $totalPrincipal,
                'total_balance_due' => $totalBalanceDue,
                'total_fees'        => $totalFees,
                'active_count'      => $loans->where('status', '!=', 'settled')->count(),
            ],
        ]));
    }

    /**
     * View 3: Surplus (/investment/surplus)
     */
    public function surplus(Request $request): Response
    {
        $search = $request->query('search', '');

        $query = InvestmentSurplus::query();

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('fund_name', 'like', "%{$search}%")
                  ->orWhere('fund_name_ur', 'like', "%{$search}%");
            });
        }

        $funds = $query->orderBy('status', 'asc')->orderBy('maturity_date', 'asc')->get()->map(function ($s) {
            $maturityStr = $s->maturity_date ? $s->maturity_date->format('j M') : 'Khula';
            $roiWithDate = "{$s->roi_rate} " . ($s->status === 'matured' ? "Mukammal ({$maturityStr})" : "Muddat: {$maturityStr}");

            return [
                'id'               => $s->id,
                'fund_name'        => $s->fund_name,
                'fund_name_ur'     => $s->fund_name_ur,
                'principal_amount' => $s->principal_amount,
                'profit_or_loss'   => $s->profit_or_loss,
                'roi_rate'         => $s->roi_rate,
                'is_realised'      => $s->is_realised,
                'maturity_date'    => $s->maturity_date ? $s->maturity_date->format('Y-m-d') : null,
                'roi_maturity'     => $roiWithDate,
                'status'           => $s->status,
                'total_return'     => $s->total_return,
                'notes'            => $s->notes,
            ];
        });

        // Separate active vs closed funds
        $activeFunds = $funds->where('status', 'active')->values();
        $closedFunds = $funds->where('status', 'matured')->values();

        $activePrincipal = $activeFunds->sum('principal_amount'); // 250,000
        $activeReturn = $activeFunds->sum('total_return'); // 258,000
        $unrealisedProfit = $activeFunds->sum('profit_or_loss'); // 8,000 (kaghzi)

        $closedPrincipal = $closedFunds->sum('principal_amount'); // 120,000
        $closedReturn = $closedFunds->sum('total_return'); // 124,200
        $realisedProfit = $closedFunds->where('is_realised', true)->sum('profit_or_loss'); // 4,200 (mila hua)

        // Gold Savings overdue alert: 15 Oct to 22 Nov = 38 days overdue
        $goldSavingsAlert = [
            'show'          => true,
            'fund_name'     => 'Gold Savings (3-Month Term)',
            'days_overdue'  => 38,
            'maturity_date' => '15 Oct 2026',
            'amount'        => 124200,
            'message'       => 'Matured 38 din se wapas nahi aya',
        ];

        // Active fund for wapsi details
        $activeFund = $activeFunds->first() ?? $funds->first();
        $wapsiSplit = $activeFund ? [
            'fund_name' => $activeFund['fund_name'],
            'principal' => $activeFund['principal_amount'],
            'munafa'    => $activeFund['profit_or_loss'],
            'total'     => $activeFund['total_return'],
        ] : [
            'fund_name' => 'General Surplus',
            'principal' => 0,
            'munafa'    => 0,
            'total'     => 0,
        ];

        $breakdowns = [
            'active_surplus' => [
                'title' => 'Active Faltu Paisa (Lagaya Gaya) Breakdown',
                'total' => $activePrincipal,
                'items' => [
                    ['label' => 'Fund A (15-day Term)', 'amount' => 150000, 'note' => 'Muddat: 06 Dec (15 din)'],
                    ['label' => 'Meezan Daily Profit', 'amount' => 100000, 'note' => 'Daily rollover khata'],
                ],
                'note' => 'Active funds ka principal: Rs. 250,000.',
            ],
            'realised_profit' => [
                'title' => 'Mila Hua Nafa (Realised) Breakdown',
                'total' => $realisedProfit,
                'items' => [
                    ['label' => 'Gold Savings (3-Month Term)', 'amount' => 4200, 'note' => 'Matured on 15 Oct (Cash mein wapas lene ke qabil)'],
                ],
                'note' => 'Yeh nafa mature ho chuka hai aur cash mein ada hona baqi hai.',
            ],
            'unrealised_profit' => [
                'title' => 'Aane Wala Kaghzi Nafa (Unrealised) Breakdown',
                'total' => $unrealisedProfit,
                'items' => [
                    ['label' => 'Fund A (15-day Term)', 'amount' => 4500, 'note' => 'Muddat mukammal hone par milega'],
                    ['label' => 'Meezan Daily Profit', 'amount' => 3500, 'note' => 'Chalu hisab'],
                ],
                'note' => 'Unrealised nafa cash mein nahi hota jab tak muddat mukammal na ho.',
            ],
            'active_wapsi' => [
                'title' => 'Active Kul Wapsi (Asal + Kaghzi Nafa) Breakdown',
                'total' => $activeReturn,
                'items' => [
                    ['label' => 'Fund A Wapsi', 'amount' => 154500, 'note' => 'Asal 150,000 + Nafa 4,500'],
                    ['label' => 'Meezan Daily Wapsi', 'amount' => 103500, 'note' => 'Asal 100,000 + Nafa 3,500'],
                ],
                'note' => 'Active Wapsi Total: Rs. 258,000. Is mein closed Gold Savings (124,200) shamil nahi hai.',
            ],
        ];

        return Inertia::render('investment/surplus/index', array_merge($this->getSharedData(), [
            'funds'            => $funds,
            'search'           => $search,
            'wapsiSplit'       => $wapsiSplit,
            'goldSavingsAlert' => $goldSavingsAlert,
            'breakdowns'       => $breakdowns,
            'summary'          => [
                'active_principal'  => $activePrincipal,
                'active_return'     => $activeReturn,
                'unrealised_profit' => $unrealisedProfit,
                'realised_profit'   => $realisedProfit,
                'closed_return'     => $closedReturn,
                'total_return'      => $activeReturn + $closedReturn,
            ],
        ]));
    }

    /**
     * View 4: Audit & Vouchers (/investment/audit)
     */
    public function audit(Request $request): Response
    {
        $search = $request->query('search', '');
        $filter = $request->query('filter', '');

        $query = InvestmentTransaction::with(['partner', 'loan', 'surplus', 'createdBy']);

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('ref_no', 'like', "%{$search}%")
                  ->orWhere('party_name', 'like', "%{$search}%")
                  ->orWhere('reason', 'like', "%{$search}%")
                  ->orWhere('amount', 'like', "%{$search}%");
            });
        }

        if ($filter === 'pending') {
            $query->where('approval_status', 'pending_owner');
        }

        $transactions = $query->orderBy('date', 'desc')->orderBy('id', 'desc')->get()->map(function ($tx) {
            $status = match ($tx->approval_status) {
                'pending_owner' => 'Pending Owner',
                'approved'      => 'Approved',
                'posted'        => 'Posted',
                'reversed'      => 'Reversed',
                'locked'        => 'Locked',
                default         => ucfirst($tx->approval_status),
            };

            $creator = $tx->createdBy?->name ?? ($tx->created_by_role === 'owner' ? 'Owner (Hajji Muhammad)' : 'Munshi Aslam');
            $createdTime = $tx->created_at ? $tx->created_at->format('j M Y, h:i A') : ($tx->date ? $tx->date->format('j M Y') : '—');

            return [
                'id'               => $tx->id,
                'ref_no'           => $tx->ref_no,
                'date'             => $tx->date ? $tx->date->format('j M Y') : '—',
                'raw_date'         => $tx->date ? $tx->date->format('Y-m-d') : '',
                'created_at_label' => $createdTime,
                'created_by'       => $creator,
                'party'            => $tx->party_name,
                'type'             => $tx->type,
                'type_label'       => $tx->type_label,
                'amount'           => $tx->amount,
                'formatted_amount' => $tx->formatted_amount,
                'reason'           => $tx->reason,
                'payment_method'   => $tx->payment_method,
                'bank_name'        => $tx->bank_name,
                'approval_status'  => $tx->approval_status,
                'status_standard'  => $status,
                'approved_by'      => $tx->approved_by ?: '—',
                'is_reversed'      => $tx->is_reversed,
                'reversal_reason'  => $tx->reversal_reason,
                'reversal_ref_no'  => $tx->reversal_ref_no,
                'is_advance'       => $tx->is_advance,
                'advance_amount'   => $tx->advance_amount,
            ];
        });

        return Inertia::render('investment/audit/index', array_merge($this->getSharedData(), [
            'transactions' => $transactions,
            'search'       => $search,
            'activeFilter' => $filter,
        ]));
    }

    /**
     * Store new "+ Entry" (Append-only Ledger) with Guardrail Check
     */
    public function storeEntry(Request $request)
    {
        $validated = $request->validate([
            'type'           => 'required|in:capital_in,capital_out,loan_in,loan_out,surplus_out,surplus_in',
            'partner_id'     => 'nullable|required_if:type,capital_in,capital_out|exists:investment_partners,id',
            'loan_id'        => 'nullable|required_if:type,loan_out|exists:investment_loans,id',
            'surplus_id'     => 'nullable|required_if:type,surplus_in|exists:investment_surplus,id',
            'party_name'     => 'nullable|string|max:255',
            'amount'         => 'required|numeric|min:1',
            'payment_method' => 'required|in:cash,bank',
            'bank_name'      => 'nullable|string|max:255',
            'reason'         => 'nullable|string|max:500',
            'is_advance'     => 'nullable|boolean',
        ]);

        $role = $this->getCurrentRole();
        $amount = (float) $validated['amount'];
        $type = $validated['type'];
        $isAdvance = (bool) ($validated['is_advance'] ?? false);
        $partner = !empty($validated['partner_id']) ? InvestmentPartner::find($validated['partner_id']) : null;
        $partyName = $partner ? $partner->name : ($validated['party_name'] ?? 'Counterparty');

        // SERVER-SIDE GUARDRAIL CHECK FOR CAPITAL WITHDRAWALS
        if ($type === 'capital_out' && $partner) {
            $netEquity = $partner->financials['net_equity'];
            if ($amount > $netEquity && !$isAdvance) {
                $excess = $amount - $netEquity;
                InvestmentAlert::create([
                    'partner_id'       => $partner->id,
                    'partner_name'     => $partner->name,
                    'attempted_amount' => $amount,
                    'excess_amount'    => $excess,
                    'resolved'         => false,
                    'notes'            => "{$partner->name} ke capital se Rs. " . number_format($excess, 0) . " zyada nikaalne ki koshish ki gayi (blocked, Drawings/Advance ke tor par record hona chahiye)",
                ]);

                return response()->json([
                    'success'        => false,
                    'guardrail'      => true,
                    'partner_name'   => $partner->name,
                    'current_equity' => $netEquity,
                    'excess_amount'  => $excess,
                    'message'        => "Capital se zyada nikaala ja raha hai. {$partner->name} ka capital Rs. " . number_format($netEquity, 0) . " hai. Aap Rs. " . number_format($amount, 0) . " nikaal rahe hain, yani Rs. " . number_format($excess, 0) . " zyada.",
                ], 422);
            }
        }

        // Generate Prefix for Ref No
        $prefix = match ($type) {
            'capital_in'  => 'CI',
            'capital_out' => 'CO',
            'loan_in'     => 'LN',
            'loan_out'    => 'LR',
            'surplus_out' => 'SO',
            'surplus_in'  => 'SI',
        };

        $lastId = (InvestmentTransaction::max('id') ?? 0) + 1;
        $refNo = sprintf('%s-%04d', $prefix, $lastId);

        $approvalStatus = 'approved';

        $excessAmount = 0;
        if ($type === 'capital_out' && $partner && $isAdvance) {
            $excessAmount = max(0, $amount - $partner->financials['net_equity']);
        }

        $createdTx = DB::transaction(function () use (
            $refNo, $type, $validated, $partner, $partyName, $amount, $isAdvance,
            $excessAmount, $approvalStatus, $role
        ) {
            $tx = InvestmentTransaction::create([
                'ref_no'             => $refNo,
                'date'               => date('Y-m-d'),
                'type'               => $type,
                'partner_id'         => $validated['partner_id'] ?? null,
                'loan_id'            => $validated['loan_id'] ?? null,
                'surplus_id'         => $validated['surplus_id'] ?? null,
                'party_name'         => $partyName,
                'amount'             => $amount,
                'payment_method'     => $validated['payment_method'],
                'bank_name'          => $validated['bank_name'] ?? null,
                'reason'             => $validated['reason'] ?? '',
                'is_advance'         => $isAdvance,
                'advance_amount'     => $excessAmount,
                'approval_status'    => $approvalStatus,
                'approved_by'        => 'Owner (Hajji Muhammad)',
                'approved_at'        => now(),
                'created_by_role'    => $role,
                'created_by_user_id' => auth()->id() ?? 1,
            ]);

            if ($type === 'loan_out' && !empty($validated['loan_id'])) {
                $loan = InvestmentLoan::find($validated['loan_id']);
                if ($loan) {
                    $loan->paid_amount += $amount;
                    if ($loan->balance_due <= 0) {
                        $loan->status = 'settled';
                    }
                    $loan->save();
                }
            }

            if ($type === 'surplus_in' && !empty($validated['surplus_id'])) {
                $surplus = InvestmentSurplus::find($validated['surplus_id']);
                if ($surplus) {
                    $surplus->status = 'matured';
                    $surplus->is_realised = true;
                    $surplus->save();
                }
            }

            InvestmentAuditLog::create([
                'action'         => 'create',
                'transaction_id' => $tx->id,
                'ref_no'         => $tx->ref_no,
                'user_name'      => auth()->user()?->name ?? 'Owner (Hajji Muhammad)',
                'user_role'      => $role,
                'details'        => "Entry {$refNo} ({$type}) of Rs. " . number_format($amount, 0) . " created for {$partyName}.",
            ]);

            return $tx;
        });

        return redirect()->back()->with([
            'success'    => "Entry save ho gayi. Baqaya update ho gaya.",
            'last_entry' => [
                'id'     => $createdTx->id,
                'ref_no' => $createdTx->ref_no,
                'amount' => $amount,
                'party'  => $partyName,
            ],
        ]);
    }

    /**
     * 10-Second Undo Endpoint
     */
    public function undo(Request $request, $id)
    {
        $tx = InvestmentTransaction::findOrFail($id);
        if ($tx->is_reversed) {
            return redirect()->back()->with('error', 'Yeh entry pehle se reversed hai.');
        }

        $reason = '10-second Undo action';
        $reversalRefNo = 'REV-' . substr($tx->ref_no, 3);

        DB::transaction(function () use ($tx, $reason, $reversalRefNo) {
            $tx->is_reversed = true;
            $tx->reversal_reason = $reason;
            $tx->reversal_ref_no = $reversalRefNo;
            $tx->approval_status = 'reversed';
            $tx->save();

            if ($tx->type === 'loan_out' && $tx->loan_id) {
                $loan = InvestmentLoan::find($tx->loan_id);
                if ($loan) {
                    $loan->paid_amount = max(0, $loan->paid_amount - $tx->amount);
                    if ($loan->status === 'settled') {
                        $loan->status = 'active';
                    }
                    $loan->save();
                }
            }

            $oppositeType = match ($tx->type) {
                'capital_in'  => 'capital_out',
                'capital_out' => 'capital_in',
                'loan_in'     => 'loan_out',
                'loan_out'    => 'loan_in',
                'surplus_out' => 'surplus_in',
                'surplus_in'  => 'surplus_out',
                default       => 'capital_out',
            };

            InvestmentTransaction::create([
                'ref_no'          => $reversalRefNo,
                'date'            => date('Y-m-d'),
                'type'            => $oppositeType,
                'partner_id'      => $tx->partner_id,
                'loan_id'         => $tx->loan_id,
                'surplus_id'      => $tx->surplus_id,
                'party_name'      => $tx->party_name,
                'amount'          => $tx->amount,
                'payment_method'  => $tx->payment_method,
                'bank_name'       => $tx->bank_name,
                'reason'          => "Undo of {$tx->ref_no}",
                'approval_status' => 'posted',
            ]);

            InvestmentAuditLog::create([
                'action'         => 'undo',
                'transaction_id' => $tx->id,
                'ref_no'         => $reversalRefNo,
                'user_name'      => auth()->user()?->name ?? 'Owner (Hajji Muhammad)',
                'user_role'      => 'owner',
                'details'        => "Undo entry {$tx->ref_no}",
            ]);
        });

        return redirect()->back()->with('success', "Entry {$tx->ref_no} undo (mansookh) kardi gayi.");
    }

    /**
     * Maker-Checker Approve Action
     */
    public function approve(Request $request, $id)
    {
        $tx = InvestmentTransaction::findOrFail($id);
        $tx->approval_status = 'approved';
        $tx->approved_by = auth()->user()?->name ?? 'Owner (Hajji Muhammad)';
        $tx->approved_at = now();
        $tx->save();

        InvestmentAuditLog::create([
            'action'         => 'approve',
            'transaction_id' => $tx->id,
            'ref_no'         => $tx->ref_no,
            'user_name'      => $tx->approved_by,
            'user_role'      => 'owner',
            'details'        => "Approved transaction {$tx->ref_no} (Rs. " . number_format($tx->amount, 0) . ")",
        ]);

        return redirect()->back()->with('success', "Entry {$tx->ref_no} approve ho gayi.");
    }

    /**
     * Void Action: Reversal Entry (Append-only, No Hard Delete)
     */
    public function void(Request $request, $id)
    {
        $request->validate([
            'reason' => 'required|string|min:3|max:500',
        ]);

        $tx = InvestmentTransaction::findOrFail($id);

        if ($tx->is_reversed) {
            return redirect()->back()->with('error', 'Yeh entry pehle se reversed hai.');
        }

        $reason = $request->input('reason');
        $reversalRefNo = 'REV-' . substr($tx->ref_no, 3);

        DB::transaction(function () use ($tx, $reason, $reversalRefNo) {
            $tx->is_reversed = true;
            $tx->reversal_reason = $reason;
            $tx->reversal_ref_no = $reversalRefNo;
            $tx->approval_status = 'reversed';
            $tx->save();

            if ($tx->type === 'loan_out' && $tx->loan_id) {
                $loan = InvestmentLoan::find($tx->loan_id);
                if ($loan) {
                    $loan->paid_amount = max(0, $loan->paid_amount - $tx->amount);
                    if ($loan->status === 'settled') {
                        $loan->status = 'active';
                    }
                    $loan->save();
                }
            }

            $oppositeType = match ($tx->type) {
                'capital_in'  => 'capital_out',
                'capital_out' => 'capital_in',
                'loan_in'     => 'loan_out',
                'loan_out'    => 'loan_in',
                'surplus_out' => 'surplus_in',
                'surplus_in'  => 'surplus_out',
                default       => 'capital_out',
            };

            InvestmentTransaction::create([
                'ref_no'          => $reversalRefNo,
                'date'            => date('Y-m-d'),
                'type'            => $oppositeType,
                'partner_id'      => $tx->partner_id,
                'loan_id'         => $tx->loan_id,
                'surplus_id'      => $tx->surplus_id,
                'party_name'      => $tx->party_name,
                'amount'          => $tx->amount,
                'payment_method'  => $tx->payment_method,
                'bank_name'       => $tx->bank_name,
                'reason'          => "Reversal of {$tx->ref_no}: {$reason}",
                'approval_status' => 'posted',
            ]);

            InvestmentAuditLog::create([
                'action'         => 'void',
                'transaction_id' => $tx->id,
                'ref_no'         => $reversalRefNo,
                'user_name'      => auth()->user()?->name ?? 'Owner (Hajji Muhammad)',
                'user_role'      => 'owner',
                'details'        => "Voided and reversed entry {$tx->ref_no}. Reason: {$reason}",
            ]);
        });

        return redirect()->back()->with('success', "Entry {$tx->ref_no} cancel karke reversal entry banayi gayi.");
    }

    /**
     * Loan Return Action
     */
    public function returnLoan(Request $request, $id)
    {
        $loan = InvestmentLoan::findOrFail($id);
        $amount = (float) $request->input('amount', $loan->balance_due);

        if ($amount <= 0 || $amount > $loan->balance_due) {
            return redirect()->back()->with('error', 'Darust rakam darj karein.');
        }

        $lastId = (InvestmentTransaction::max('id') ?? 0) + 1;
        $refNo = sprintf('LR-%04d', $lastId);

        DB::transaction(function () use ($loan, $amount, $refNo) {
            $loan->paid_amount += $amount;
            if ($loan->balance_due <= 0) {
                $loan->status = 'settled';
            }
            $loan->save();

            $tx = InvestmentTransaction::create([
                'ref_no'          => $refNo,
                'date'            => date('Y-m-d'),
                'type'            => 'loan_out',
                'loan_id'         => $loan->id,
                'party_name'      => $loan->lender_name,
                'amount'          => $amount,
                'payment_method'  => 'cash',
                'reason'          => 'Loan payment to ' . $loan->lender_name,
                'approval_status' => 'approved',
                'created_by_role' => $this->getCurrentRole(),
            ]);

            InvestmentAuditLog::create([
                'action'         => 'loan_return',
                'transaction_id' => $tx->id,
                'ref_no'         => $refNo,
                'user_name'      => auth()->user()?->name ?? 'User',
                'user_role'      => $this->getCurrentRole(),
                'details'        => "Paid loan Rs. " . number_format($amount, 0) . " to {$loan->lender_name}",
            ]);
        });

        return redirect()->back()->with('success', "Loan payment Rs. " . number_format($amount, 0) . " kamyabi se record ho gayi.");
    }

    /**
     * Surplus Return Action
     */
    public function returnSurplus(Request $request, $id)
    {
        $surplus = InvestmentSurplus::findOrFail($id);
        $lastId = (InvestmentTransaction::max('id') ?? 0) + 1;
        $refNo = sprintf('SI-%04d', $lastId);

        DB::transaction(function () use ($surplus, $refNo) {
            $surplus->status = 'matured';
            $surplus->is_realised = true;
            $surplus->save();

            $tx = InvestmentTransaction::create([
                'ref_no'          => $refNo,
                'date'            => date('Y-m-d'),
                'type'            => 'surplus_in',
                'surplus_id'      => $surplus->id,
                'party_name'      => $surplus->fund_name,
                'amount'          => $surplus->total_return,
                'payment_method'  => 'cash',
                'reason'          => 'Surplus return (Principal + Munafa)',
                'approval_status' => 'approved',
                'created_by_role' => $this->getCurrentRole(),
            ]);

            InvestmentAuditLog::create([
                'action'         => 'surplus_return',
                'transaction_id' => $tx->id,
                'ref_no'         => $refNo,
                'user_name'      => auth()->user()?->name ?? 'User',
                'user_role'      => $this->getCurrentRole(),
                'details'        => "Surplus return Rs. " . number_format($surplus->total_return, 0) . " from {$surplus->fund_name}",
            ]);
        });

        return redirect()->back()->with('success', "Surplus investment wapas aa gayi.");
    }

    /**
     * Mark Surplus Matured
     */
    public function matureSurplus(Request $request, $id)
    {
        $surplus = InvestmentSurplus::findOrFail($id);
        $surplus->status = 'matured';
        $surplus->is_realised = true;
        $surplus->save();

        InvestmentAuditLog::create([
            'action'    => 'surplus_mature',
            'ref_no'    => "SUR-{$surplus->id}",
            'user_name' => auth()->user()?->name ?? 'User',
            'user_role' => $this->getCurrentRole(),
            'details'   => "Marked fund {$surplus->fund_name} as matured",
        ]);

        return redirect()->back()->with('success', "Fund {$surplus->fund_name} matured mark ho gaya.");
    }

    /**
     * Switch Maker-Checker Role (Kept for compatibility)
     */
    public function switchRole(Request $request)
    {
        $role = $request->input('role', 'owner');
        session(['investment_role' => $role]);

        return redirect()->back()->with('success', "Role updated.");
    }
}
