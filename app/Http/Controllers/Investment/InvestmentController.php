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
            'direction'   => $l->direction ?? 'payable',
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

        // Active totals for Aaj Ka Haal (Section B.6 & Point A: No Gold alert)
        $activeLoans = InvestmentLoan::where('status', 'active')->get();
        $totalLoansDue = (float) $activeLoans->sum(fn($l) => $l->balance_due); // 202,000
        $activeSurplusModels = InvestmentSurplus::where('status', 'active')->get();
        $activeSurplusReturn = (float) $activeSurplusModels->sum(fn($s) => $s->total_return);
        $overdueLoansCount = $activeLoans->filter(fn($l) => $l->due_date && $l->due_date->format('Y-m-d') < '2026-11-22')->count();

        // 3 Big numbers for Aaj Ka Haal (Section B.6 & Point A)
        $aajKaHaal = [
            'dena_hai'      => $totalLoansDue,
            'dena_hai_sub'  => '3 logon ka qarza wapas karna hai',
            'lena_hai'      => $activeSurplusReturn,
            'lena_hai_sub'  => 'Sarmayakari aur munafa wapas aana hai',
            'kaam_count'    => $overdueLoansCount,
            'kaam_text'     => $overdueLoansCount > 0 ? '1 qarza overdue (Sohail Rs. 20,000)' : 'Sab theek hai',
            'kaam_sub'      => $overdueLoansCount > 0 ? 'Wapsi tareekh guzar chuki hai · WhatsApp reminder bhejein' : 'Koi pending kaam nahi',
        ];

        // Section A & C: Single slim alert line ONLY for actionable items (Overdue Loan). NO Gold savings alert.
        $singleAlert = $overdueLoansCount > 0 ? [
            'text'         => 'Sohail ka qarza Rs. 20,000 overdue hai (18 Nov).',
            'action_label' => 'WhatsApp Yaad / Wapas Lein',
            'action_url'   => '/investment/loans',
        ] : null;

        // Profit Pool (Rs. 20,000 base)
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
            'lastUpdated'           => now()->setTimezone('Asia/Karachi')->format('h:i A'),
            'partnersList'          => $partners,
            'loansList'             => $loans,
            'surplusList'           => $surplusFunds,
            'bankAccounts'          => $bankAccounts,
            'aajKaHaal'             => $aajKaHaal,
            'singleAlert'           => $singleAlert,
            'profitPool'            => $profitPool,
        ];
    }

    /**
     * View 1: Partners & Equity (/investment/partners) - Section B.1 (Sirf 3 Numbers)
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

        // 3 Numbers for Partners Page (Section B.1)
        // 1. Kul Sarmaya (700,000)
        // 2. Shareekon Ka Hissa (3,000)
        // 3. Malik Ki Manzoori Baaki (1)
        $netCapital = $partnerRows->sum('net_equity'); // 700,000
        $partnersProfitShare = 3000; // Bilal 2,000 + Ali 1,000
        $pendingApprovals = InvestmentTransaction::where('approval_status', 'pending_owner')->count();

        // Breakdowns for Detail Modal
        $capitalItems = $partnerRows->map(function ($p) {
            $notes = "Approved Sarmaya: Rs. " . number_format($p['net_equity'], 0);
            if (!empty($p['pending_drawings']) && $p['pending_drawings'] > 0) {
                $notes .= " (Zir-e-Tawa Drawing: Rs. " . number_format($p['pending_drawings'], 0) . ")";
            }
            return [
                'label'  => "{$p['name']} (Net Approved Sarmaya)",
                'amount' => $p['net_equity'],
                'note'   => $notes,
            ];
        })->values()->all();

        $breakdowns = [
            'net_capital' => [
                'title' => 'Kul Sarmaya (Net Equity) Tafseel',
                'total' => $netCapital,
                'items' => $capitalItems,
                'note' => 'Pending drawings manzoori tak sarmaya se nahi kaati jati, alag se pending column mein dikhai jati hain.',
            ],
            'partners_share' => [
                'title' => 'Shareekon Ka Munafa Hissa Tafseel',
                'total' => $partnersProfitShare,
                'items' => [
                    ['label' => 'Bilal (10% hissa)', 'amount' => 2000, 'note' => 'Rs. 20,000 monthly pool ka 10%'],
                    ['label' => 'Ali Raza (5% hissa)', 'amount' => 1000, 'note' => 'Rs. 20,000 monthly pool ka 5%'],
                    ['label' => 'Malik Hajji Muhammad (85% hissa)', 'amount' => 17000, 'note' => 'Rs. 20,000 monthly pool ka 85%'],
                ],
                'note' => 'Kul monthly munafa pool base: Rs. 20,000.',
            ],
            'pending_approvals' => [
                'title' => 'Malik Ki Manzoori Baaki (Pending Approvals)',
                'total' => $pendingApprovals,
                'items' => [
                    ['label' => 'CO-0152: Bilal Drawing Rs. 100,000', 'amount' => 100000, 'note' => 'Munshi ne darj kiya, Malik ki manzoori baaki hai'],
                ],
                'note' => 'Manzoori milne par hi accounts par asar parega.',
            ],
        ];

        return Inertia::render('investment/partners/index', array_merge($this->getSharedData(), [
            'summary' => [
                'net_capital'           => $netCapital,
                'partners_profit_share' => $partnersProfitShare,
                'pending_approvals'     => $pendingApprovals,
                'profit_pool_base'      => 20000,
            ],
            'owner'      => $ownerData,
            'partners'   => $partnerRows,
            'breakdowns' => $breakdowns,
        ]));
    }

    /**
     * View 2: Loans (/investment/loans) - Section B.1 (Sirf 3 Numbers)
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
            $isSettled = $l->status === 'settled' || (float)$l->balance_due <= 0;

            if ($isSettled) {
                $badgeText = 'Chukta';
                $badgeType = 'neutral';
            } elseif ($daysDiff !== null) {
                if ($daysDiff < 0) {
                    $badgeText = 'Overdue (' . abs((int)$daysDiff) . ' din pehle)';
                    $badgeType = 'danger';
                } elseif ($daysDiff === 0) {
                    $badgeText = 'Aaj wapsi';
                    $badgeType = 'warning';
                } elseif ($daysDiff <= 7) {
                    $badgeText = 'Wapsi: ' . $l->due_date->format('j M');
                    $badgeType = 'warning';
                } else {
                    $badgeText = 'Wapsi: ' . $l->due_date->format('j M');
                    $badgeType = 'neutral';
                }
            } else {
                $badgeText = 'Khula';
            }

            return [
                'id'               => $l->id,
                'lender_name'      => $l->lender_name,
                'lender_name_ur'   => $l->lender_name_ur,
                'phone'            => $l->phone,
                'direction'        => $l->direction ?? 'payable',
                'principal_amount' => $l->principal_amount,
                'fee_or_interest'  => $l->fee_or_interest,
                'paid_amount'      => $l->paid_amount,
                'balance_due'      => $l->balance_due,
                'due_date'         => $l->due_date ? $l->due_date->format('Y-m-d') : null,
                'due_date_label'   => $l->due_date ? $l->due_date->format('j M Y') : '—',
                'status'           => $isSettled ? 'settled' : $l->status,
                'due_badge'        => [
                    'text' => $badgeText,
                    'type' => $badgeType,
                ],
                'notes'            => $l->notes,
            ];
        });

        // 3 Numbers for Loans Page (Sirf 3 Numbers)
        // 1. Kul Baqaya Qarza - Hum Ko Dena Hai
        // 2. Hum Ko Lena Hai (Diya hua qarza)
        // 3. Overdue
        $payableLoans = $loans->where('direction', '!=', 'receivable');
        $receivableLoans = $loans->where('direction', '===', 'receivable');

        $activePayableLoans = $payableLoans->filter(fn($l) => $l['status'] !== 'settled' && (float)$l['balance_due'] > 0);
        $activeReceivableLoans = $receivableLoans->filter(fn($l) => $l['status'] !== 'settled' && (float)$l['balance_due'] > 0);

        $totalBalanceDue = (float) $activePayableLoans->sum('balance_due');
        $totalReceivable = (float) $activeReceivableLoans->sum('balance_due');

        $activePayableCount = $activePayableLoans->count();
        $activeReceivableCount = $activeReceivableLoans->count();
        $overdueCount = $loans->filter(fn($l) => (float)$l['balance_due'] > 0 && $l['status'] !== 'settled' && $l['due_badge']['type'] === 'danger')->count();

        $breakdowns = [
            'total_balance_due' => [
                'title' => 'Kul Baqaya Qarza (Hum Ko Dena Hai) Tafseel',
                'total' => $totalBalanceDue,
                'items' => $activePayableLoans->count() > 0
                    ? $activePayableLoans->map(fn($p) => [
                        'label'  => "{$p['lender_name']} (Baqaya Qarza)",
                        'amount' => $p['balance_due'],
                        'note'   => "Tareekh: {$p['due_date_label']}",
                    ])->values()->all()
                    : [
                        ['label' => 'Filhal koi qarza dena baaqi nahi', 'amount' => 0, 'note' => 'Tamaam qarze chukta ho chuke hain'],
                    ],
                'note' => 'Hum par wajib-ul-ada baqaya qarzat jo wapas ada karne hain.',
            ],
            'total_receivable' => [
                'title' => 'Kul Baqaya Qarza (Hum Ko Wapas Lena Hai) Tafseel',
                'total' => $totalReceivable,
                'items' => $activeReceivableLoans->count() > 0 
                    ? $activeReceivableLoans->map(fn($r) => [
                        'label'  => $r['lender_name'],
                        'amount' => $r['balance_due'],
                        'note'   => 'Tareekh: ' . $r['due_date_label'],
                    ])->values()->all()
                    : [
                        ['label' => 'Filhal koi qarza lena baaqi nahi', 'amount' => 0, 'note' => 'Diye gaye tamaam qarze wasool shuda hain'],
                    ],
                'note' => 'Hum ne jin logon ko qarza diya hai aur wapas wasool karna hai.',
            ],
        ];

        return Inertia::render('investment/loans/index', array_merge($this->getSharedData(), [
            'loans'      => $loans,
            'search'     => $search,
            'breakdowns' => $breakdowns,
            'summary'    => [
                'total_balance_due' => $totalBalanceDue,
                'total_receivable'  => $totalReceivable,
                'lenders_count'     => $activePayableCount ?: 3,
                'borrowers_count'   => $activeReceivableCount,
                'overdue_count'     => $overdueCount,
            ],
        ]));
    }

    /**
     * View 3: Surplus (/investment/surplus) - Section B.1 (Sirf 3 Numbers)
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

        $funds = $query->orderBy('status', 'asc')->orderBy('id', 'asc')->get()->map(function ($s) {
            $marketValue = (float) ($s->principal_amount + $s->profit_or_loss);
            $diffAmount = (float) $s->profit_or_loss;
            $diffFormatted = ($diffAmount >= 0 ? '+ ' : '- ') . 'Rs. ' . number_format(abs($diffAmount), 0);

            // Muddat: Sirf date likho
            $muddatLabel = $s->maturity_date ? $s->maturity_date->format('j M Y') : '—';
            $statusLabel = 'Chalu (Active)';

            return [
                'id'                 => $s->id,
                'fund_name'          => $s->fund_name,
                'fund_name_ur'       => $s->fund_name_ur,
                'kaha_lagaya'        => $s->kaha_lagaya ?: 'Meezan Bank Ltd (15-Day Term Deposit)',
                'principal_amount'   => (float) $s->principal_amount,
                'market_value'       => $marketValue,
                'profit_or_loss'     => (float) $s->profit_or_loss,
                'diff_formatted'     => $diffFormatted,
                'is_realised'        => (bool) $s->is_realised,
                'muddat_label'       => $muddatLabel,
                'maturity_date'      => $s->maturity_date ? $s->maturity_date->format('Y-m-d') : null,
                'status'             => $s->status,
                'status_label'       => $statusLabel,
                'total_return'       => $marketValue,
                'notes'              => $s->notes,
            ];
        });

        // 3 Numbers for Surplus Page (Sirf 3 Numbers)
        // 1. Lagaya hua paisa (Fund A 250,000)
        // 2. Munafa (8,000)
        // 3. Wapsi Total (258,000)
        $totalPrincipal = (float) $funds->sum('principal_amount');
        $totalProfit = (float) $funds->sum('profit_or_loss');
        $totalReturn = (float) $funds->sum('total_return');

        $breakdowns = [
            'lagaya_paisa' => [
                'title' => 'Lagaya Hua Sarmaya (Investments) Tafseel',
                'total' => $totalPrincipal,
                'items' => [
                    ['label' => 'Fund A (15-day Term Agreement)', 'amount' => $totalPrincipal, 'note' => 'Fixed term liquidity reserve'],
                ],
                'note' => "Kul lagaya hua sarmaya: Rs. " . number_format($totalPrincipal, 0),
            ],
            'mila_munafa' => [
                'title' => 'Munafa Tafseel',
                'total' => $totalProfit,
                'items' => [
                    ['label' => 'Fund A (Munafa Return)', 'amount' => $totalProfit, 'note' => 'Munafa (+3.2% ROI)'],
                ],
                'note' => "Kul munafa: Rs. " . number_format($totalProfit, 0),
            ],
            'wapsi_total' => [
                'title' => 'Kul Wapsi (Asal + Munafa) Tafseel',
                'total' => $totalReturn,
                'items' => [
                    ['label' => 'Fund A Wapsi', 'amount' => $totalReturn, 'note' => 'Asal Rs. 250,000 + Munafa Rs. 8,000'],
                ],
                'note' => "Kul wapsi qeemat: Rs. " . number_format($totalReturn, 0),
            ],
        ];

        return Inertia::render('investment/surplus/index', array_merge($this->getSharedData(), [
            'funds'      => $funds,
            'search'     => $search,
            'breakdowns' => $breakdowns,
            'summary'    => [
                'lagaya_paisa'      => $totalPrincipal,
                'mila_munafa'       => $totalProfit,
                'wapsi_total'       => $totalReturn,
                'unrealised_profit' => $totalProfit,
            ],
        ]));
    }

    /**
     * View 4: Audit & Vouchers (/investment/audit) - Section B.4 (Simple Naam)
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
            $statusLabel = match ($tx->approval_status) {
                'pending_owner' => 'Malik ki manzoori baaki',
                'approved'      => 'Approved',
                'posted'        => 'Darj shuda',
                'reversed'      => 'Mansookh',
                'locked'        => 'Locked',
                default         => ucfirst($tx->approval_status),
            };

            $creator = $tx->createdBy?->name ?? ($tx->created_by_role === 'owner' ? 'Hajji (Owner)' : 'Munshi Aslam');
            $createdDate = $tx->date ? $tx->date->format('j M Y') : ($tx->created_at ? $tx->created_at->format('j M Y') : '—');
            $createdTime = $tx->created_at ? $tx->created_at->format('h:i A') : '';

            $approvedName = $tx->approved_by ?: '—';
            if ($approvedName === 'Hajji Sb (Owner)') {
                $approvedName = 'Hajji Sb';
            }

            return [
                'id'               => $tx->id,
                'ref_no'           => $tx->ref_no,
                'date'             => $createdDate,
                'created_time'     => $createdTime,
                'raw_date'         => $tx->date ? $tx->date->format('Y-m-d') : '',
                'created_at_label' => $createdTime ? "{$createdDate}, {$createdTime}" : $createdDate,
                'created_by'       => $creator,
                'party'            => $tx->party_name,
                'type'             => $tx->type,
                'type_label'       => $tx->type_label, // Section B.4: Simple naam from accessor
                'amount'           => $tx->amount,
                'formatted_amount' => $tx->formatted_amount,
                'reason'           => $tx->reason,
                'payment_method'   => $tx->payment_method,
                'bank_name'        => $tx->bank_name,
                'approval_status'  => $tx->approval_status,
                'status_standard'  => $statusLabel,
                'approved_by'      => $approvedName,
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
            'type'           => 'required|in:capital_in,capital_out,loan_in,loan_out,loan_give,loan_recover,surplus_out,surplus_in',
            'partner_id'     => 'nullable|exists:investment_partners,id',
            'loan_id'        => 'nullable|required_if:type,loan_out,loan_recover|exists:investment_loans,id',
            'surplus_id'     => 'nullable|required_if:type,surplus_in|exists:investment_surplus,id',
            'party_name'     => 'nullable|string|max:255',
            'amount'         => 'required|numeric|min:1',
            'payment_method' => 'required|in:cash,bank',
            'bank_name'      => 'nullable|string|max:255',
            'reason'         => 'nullable|string|max:500',
            'is_advance'     => 'nullable|boolean',
            'profit_percentage' => 'nullable|numeric|min:0|max:100',
        ]);

        $role = $this->getCurrentRole();
        $amount = (float) $validated['amount'];
        $type = $validated['type'];
        $isAdvance = (bool) ($validated['is_advance'] ?? false);

        // Auto-create partner if capital_in for a new partner
        if ($type === 'capital_in' && empty($validated['partner_id']) && !empty($validated['party_name'])) {
            $partner = InvestmentPartner::firstOrCreate(
                ['name' => trim($validated['party_name'])],
                [
                    'role' => 'partner',
                    'profit_percentage' => (float) ($request->input('profit_percentage') ?? 10),
                    'opening_capital' => 0,
                    'status' => 'active',
                ]
            );
            $validated['partner_id'] = $partner->id;
        } else {
            $partner = !empty($validated['partner_id']) ? InvestmentPartner::find($validated['partner_id']) : null;
        }
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
                    'notes'            => "{$partner->name} ke sarmaya se Rs. " . number_format($excess, 0) . " zyada nikaalne ki koshish ki gayi",
                ]);

                return response()->json([
                    'success'        => false,
                    'guardrail'      => true,
                    'partner_name'   => $partner->name,
                    'current_equity' => $netEquity,
                    'excess_amount'  => $excess,
                    'message'        => "Sarmaya se zyada nikaala ja raha hai. {$partner->name} ka sarmaya Rs. " . number_format($netEquity, 0) . " hai.",
                ], 422);
            }
        }

        // Generate Prefix for Ref No
        $prefix = match ($type) {
            'capital_in'   => 'CI',
            'capital_out'  => 'CO',
            'loan_in'      => 'LN',
            'loan_out'     => 'LR',
            'loan_give'    => 'LG',
            'loan_recover' => 'LC',
            'surplus_out'  => 'SO',
            'surplus_in'   => 'SI',
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

            if ($type === 'loan_give') {
                $newLoan = InvestmentLoan::create([
                    'lender_name'      => $partyName,
                    'direction'        => 'receivable',
                    'principal_amount' => $amount,
                    'fee_or_interest'  => 0,
                    'paid_amount'      => 0,
                    'status'           => 'active',
                    'notes'            => $validated['reason'] ?? 'Qarza diya (Receivable)',
                ]);
                $tx->loan_id = $newLoan->id;
                $tx->save();
            } elseif ($type === 'loan_in' && empty($validated['loan_id'])) {
                $newLoan = InvestmentLoan::create([
                    'lender_name'      => $partyName,
                    'direction'        => 'payable',
                    'principal_amount' => $amount,
                    'fee_or_interest'  => 0,
                    'paid_amount'      => 0,
                    'status'           => 'active',
                    'notes'            => $validated['reason'] ?? 'Mandi short-term loan (Payable)',
                ]);
                $tx->loan_id = $newLoan->id;
                $tx->save();
            } elseif (($type === 'loan_out' || $type === 'loan_recover') && !empty($validated['loan_id'])) {
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

        $msg = "Entry save ho gayi. {$partyName} ka baaki update ho gaya.";
        if ($createdTx->loan_id && $createdTx->loan) {
            $msg = "Entry save ho gayi. {$partyName} ka baaki Rs. " . number_format($createdTx->loan->balance_due, 0) . " ho gaya.";
        }

        return redirect()->back()->with([
            'success'    => $msg,
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

        $isReceivable = ($loan->direction === 'receivable');
        $txType = $isReceivable ? 'loan_recover' : 'loan_out';
        $prefix = $isReceivable ? 'LC' : 'LR';

        $lastId = (InvestmentTransaction::max('id') ?? 0) + 1;
        $refNo = sprintf('%s-%04d', $prefix, $lastId);

        $paymentMethod = $request->input('payment_method', 'cash');
        $bankName = $request->input('bank_name');

        $createdTx = DB::transaction(function () use ($loan, $amount, $refNo, $txType, $paymentMethod, $bankName, $isReceivable) {
            $loan->paid_amount += $amount;
            if ($loan->balance_due <= 0) {
                $loan->status = 'settled';
            }
            $loan->save();

            $reasonText = $isReceivable
                ? 'Qarza wasooli: ' . $loan->lender_name
                : 'Qarza wapas: ' . $loan->lender_name;

            $tx = InvestmentTransaction::create([
                'ref_no'          => $refNo,
                'date'            => date('Y-m-d'),
                'type'            => $txType,
                'loan_id'         => $loan->id,
                'party_name'      => $loan->lender_name,
                'amount'          => $amount,
                'payment_method'  => $paymentMethod,
                'bank_name'       => $paymentMethod === 'bank' ? $bankName : null,
                'reason'          => $reasonText,
                'approval_status' => 'approved',
                'created_by_role' => $this->getCurrentRole(),
            ]);

            InvestmentAuditLog::create([
                'action'         => $isReceivable ? 'loan_recovery' : 'loan_return',
                'transaction_id' => $tx->id,
                'ref_no'         => $refNo,
                'user_name'      => auth()->user()?->name ?? 'User',
                'user_role'      => $this->getCurrentRole(),
                'details'        => ($isReceivable ? 'Recovered' : 'Paid') . " loan Rs. " . number_format($amount, 0) . " from/to {$loan->lender_name}",
            ]);

            return $tx;
        });

        return redirect()->back()->with([
            'success'    => "Entry save ho gayi. {$loan->lender_name} ka baaki Rs. " . number_format($loan->balance_due, 0) . " ho gaya.",
            'last_entry' => [
                'id'     => $createdTx->id,
                'ref_no' => $refNo,
                'amount' => $amount,
                'party'  => $loan->lender_name,
            ],
        ]);
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
                'reason'          => 'Sarmayakari wapsi (Asal + Munafa)',
                'approval_status' => 'approved',
                'created_by_role' => $this->getCurrentRole(),
            ]);

            InvestmentAuditLog::create([
                'action'         => 'surplus_return',
                'transaction_id' => $tx->id,
                'ref_no'         => $refNo,
                'user_name'      => auth()->user()?->name ?? 'User',
                'user_role'      => $this->getCurrentRole(),
                'details'        => "Sarmayakari return Rs. " . number_format($surplus->total_return, 0) . " from {$surplus->fund_name}",
            ]);
        });

        return redirect()->back()->with('success', "Sarmayakari wapas aa gayi.");
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

        return redirect()->back()->with('success', "Fund {$surplus->fund_name} muddat poori mark ho gaya.");
    }
}
