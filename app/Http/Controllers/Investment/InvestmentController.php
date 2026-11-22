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
     * Get or set current active role from session (defaults to 'munshi')
     */
    protected function getCurrentRole(): string
    {
        return session('investment_role', 'munshi');
    }

    /**
     * Common data shared across investment views
     */
    protected function getSharedData(): array
    {
        $role = $this->getCurrentRole();

        // All active partners for selector
        $partners = InvestmentPartner::orderBy('name')->get()->map(fn($p) => [
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

        return [
            'currentRole'  => $role,
            'partnersList' => $partners,
            'loansList'    => $loans,
            'surplusList'  => $surplusFunds,
            'bankAccounts' => $bankAccounts,
        ];
    }

    /**
     * View 1: Partners & Equity (/investment/partners)
     */
    public function partners(Request $request): Response
    {
        $partners = InvestmentPartner::all();

        $partnerRows = $partners->map(function ($p) {
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
                'net_equity'        => $fin['net_equity'],
                'draw_preview'      => $fin['draw_preview'],
                'status'            => $p->status,
                'phone'             => $p->phone,
            ];
        });

        // Summary Cards Calculations
        $netCapital = $partnerRows->sum('net_equity');
        $shortTermLoans = (float) InvestmentLoan::where('status', 'active')->sum(DB::raw('principal_amount - paid_amount'));
        $loanFees = (float) InvestmentLoan::where('status', 'active')->sum('fee_or_interest');
        $activeSurplus = (float) InvestmentSurplus::where('status', 'active')->sum('principal_amount');
        $netGain = (float) InvestmentSurplus::sum('profit_or_loss');

        // Pending approvals (transactions needing owner + pending partners)
        $pendingTxCount = InvestmentTransaction::where('approval_status', 'pending_owner')->count();
        $pendingPartnerCount = InvestmentPartner::where('status', 'pending_approval')->count();
        $pendingApprovals = $pendingTxCount + $pendingPartnerCount;

        // Alerts (active/unresolved)
        $alerts = InvestmentAlert::where('resolved', false)->latest()->get()->map(fn($a) => [
            'id'               => $a->id,
            'partner_name'     => $a->partner_name,
            'attempted_amount' => $a->attempted_amount,
            'excess_amount'    => $a->excess_amount,
            'notes'            => $a->notes,
        ]);

        return Inertia::render('investment/partners/index', array_merge($this->getSharedData(), [
            'summary' => [
                'net_capital'        => $netCapital,
                'short_term_loans'   => $shortTermLoans,
                'loan_fees'          => $loanFees,
                'active_surplus'     => $activeSurplus,
                'net_investment_gain'=> $netGain,
                'pending_approvals'  => $pendingApprovals,
            ],
            'partners' => $partnerRows,
            'alerts'   => $alerts,
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
                'due_badge'        => $l->due_badge,
                'notes'            => $l->notes,
            ];
        });

        // Loans summary
        $totalPrincipal = $loans->sum('principal_amount');
        $totalBalanceDue = $loans->sum('balance_due');
        $totalFees = $loans->sum('fee_or_interest');

        return Inertia::render('investment/loans/index', array_merge($this->getSharedData(), [
            'loans' => $loans,
            'search' => $search,
            'summary' => [
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

        // Wapsi split calculations for primary active fund (or top active fund)
        $activeFund = $funds->firstWhere('status', 'active') ?? $funds->first();
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

        return Inertia::render('investment/surplus/index', array_merge($this->getSharedData(), [
            'funds'      => $funds,
            'search'     => $search,
            'wapsiSplit' => $wapsiSplit,
        ]));
    }

    /**
     * View 4: Audit & Vouchers (/investment/audit)
     */
    public function audit(Request $request): Response
    {
        $search = $request->query('search', '');

        $query = InvestmentTransaction::with(['partner', 'loan', 'surplus']);

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('ref_no', 'like', "%{$search}%")
                  ->orWhere('party_name', 'like', "%{$search}%")
                  ->orWhere('reason', 'like', "%{$search}%")
                  ->orWhere('amount', 'like', "%{$search}%");
            });
        }

        $transactions = $query->orderBy('date', 'desc')->orderBy('id', 'desc')->get()->map(function ($tx) {
            return [
                'id'              => $tx->id,
                'ref_no'          => $tx->ref_no,
                'date'            => $tx->date ? $tx->date->format('j M') : '—',
                'raw_date'        => $tx->date ? $tx->date->format('Y-m-d') : '',
                'party'           => $tx->party_name,
                'type'            => $tx->type,
                'type_label'      => $tx->type_label,
                'amount'          => $tx->amount,
                'formatted_amount'=> $tx->formatted_amount,
                'reason'          => $tx->reason,
                'payment_method'  => $tx->payment_method,
                'bank_name'       => $tx->bank_name,
                'approval_status' => $tx->approval_status,
                'approved_by'     => $tx->approved_by,
                'is_reversed'     => $tx->is_reversed,
                'reversal_reason' => $tx->reversal_reason,
                'reversal_ref_no' => $tx->reversal_ref_no,
                'is_advance'      => $tx->is_advance,
                'advance_amount'  => $tx->advance_amount,
            ];
        });

        return Inertia::render('investment/audit/index', array_merge($this->getSharedData(), [
            'transactions' => $transactions,
            'search'       => $search,
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
                // Log alert
                InvestmentAlert::create([
                    'partner_id'       => $partner->id,
                    'partner_name'     => $partner->name,
                    'attempted_amount' => $amount,
                    'excess_amount'    => $excess,
                    'resolved'         => false,
                    'notes'            => "{$partner->name} ke capital se Rs. " . number_format($excess, 0) . " zyada nikaalne ki koshish ki gayi (blocked, Drawings/Advance ke tor par record hona chahiye)",
                ]);

                return response()->json([
                    'success'       => false,
                    'guardrail'     => true,
                    'partner_name'  => $partner->name,
                    'current_equity'=> $netEquity,
                    'excess_amount' => $excess,
                    'message'       => "Capital se zyada nikaala ja raha hai. {$partner->name} ka capital Rs. " . number_format($netEquity, 0) . " hai. Aap Rs. " . number_format($amount, 0) . " nikaal rahe hain, yani Rs. " . number_format($excess, 0) . " zyada.",
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

        // Determine Approval Status based on Maker-Checker
        // Any entry created by Munshi requires Owner approval
        if ($role === 'munshi') {
            $approvalStatus = 'pending_owner';
        } elseif ($role === 'owner') {
            $approvalStatus = 'approved';
        } else {
            $approvalStatus = 'posted';
        }

        $excessAmount = 0;
        if ($type === 'capital_out' && $partner && $isAdvance) {
            $excessAmount = max(0, $amount - $partner->financials['net_equity']);
        }

        DB::transaction(function () use (
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
                'approved_by'        => $approvalStatus === 'approved' ? 'Owner' : null,
                'approved_at'        => $approvalStatus === 'approved' ? now() : null,
                'created_by_role'    => $role,
                'created_by_user_id' => auth()->id() ?? 1,
            ]);

            // If loan return, update loan paid amount
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

            // If surplus return, mark surplus matured or update
            if ($type === 'surplus_in' && !empty($validated['surplus_id'])) {
                $surplus = InvestmentSurplus::find($validated['surplus_id']);
                if ($surplus) {
                    $surplus->status = 'matured';
                    $surplus->is_realised = true;
                    $surplus->save();
                }
            }

            // Audit Log
            InvestmentAuditLog::create([
                'action'         => 'create',
                'transaction_id' => $tx->id,
                'ref_no'         => $tx->ref_no,
                'user_name'      => auth()->user()?->name ?? ($role === 'owner' ? 'Owner (Hajji Sb)' : 'Munshi Aslam'),
                'user_role'      => $role,
                'details'        => "Entry {$refNo} ({$type}) of Rs. " . number_format($amount, 0) . " created for {$partyName}. Status: {$approvalStatus}",
            ]);
        });

        return redirect()->back()->with('success', 'Nayi entry kamyabi se record ho gayi.');
    }

    /**
     * Maker-Checker Approve Action (Owner Only)
     */
    public function approve(Request $request, $id)
    {
        $role = $this->getCurrentRole();
        if ($role !== 'owner') {
            return redirect()->back()->with('error', 'Sirf Owner entry approve kar sakta hai.');
        }

        $tx = InvestmentTransaction::findOrFail($id);
        $tx->approval_status = 'approved';
        $tx->approved_by = auth()->user()?->name ?? 'Owner (Hajji Sb)';
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

        $role = $this->getCurrentRole();
        $tx = InvestmentTransaction::findOrFail($id);

        if ($tx->is_reversed) {
            return redirect()->back()->with('error', 'Yeh entry pehle se reversed hai.');
        }

        $reason = $request->input('reason');
        $reversalRefNo = 'REV-' . substr($tx->ref_no, 3);

        DB::transaction(function () use ($tx, $reason, $reversalRefNo, $role) {
            // Mark original as reversed
            $tx->is_reversed = true;
            $tx->reversal_reason = $reason;
            $tx->reversal_ref_no = $reversalRefNo;
            $tx->approval_status = 'reversed';
            $tx->save();

            // Reverse loan paid amount if it was loan return
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

            // Create an append-only reversal transaction
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

            // Reversal Audit Log
            InvestmentAuditLog::create([
                'action'         => 'void',
                'transaction_id' => $tx->id,
                'ref_no'         => $reversalRefNo,
                'user_name'      => auth()->user()?->name ?? ($role === 'owner' ? 'Owner (Hajji Sb)' : 'Munshi Aslam'),
                'user_role'      => $role,
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
     * Switch Maker-Checker Role (Owner / Munshi)
     */
    public function switchRole(Request $request)
    {
        $role = $request->input('role', 'munshi');
        if (!in_array($role, ['owner', 'munshi'])) {
            $role = 'munshi';
        }
        session(['investment_role' => $role]);

        return redirect()->back()->with('success', "Role switched to " . ucfirst($role));
    }
}
