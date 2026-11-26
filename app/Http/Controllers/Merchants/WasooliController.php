<?php

namespace App\Http\Controllers\Merchants;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\MerchantReceipt;
use App\Services\WasooliService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class WasooliController extends Controller
{
    public function __construct(
        protected WasooliService $wasooliService
    ) {}

    public function index(Request $request)
    {
        $date = $request->query('date', date('Y-m-d'));
        $search = $request->query('search');

        $sheet = $this->wasooliService->getWasooliSheet($date, $search);

        $merchants = Merchant::where('status', 'active')
            ->where(function ($q) {
                $q->where(function ($sub) {
                    $sub->where('customer_type', '!=', 'naqdi')
                        ->orWhereNull('customer_type');
                })->where(function ($sub) {
                    $sub->where('name_en', 'not like', '%Naqdi%')
                        ->where('name_ur', 'not like', '%نقدی%')
                        ->orWhereNull('name_en');
                });
            })
            ->select('id', 'code', 'name_en', 'name_ur', 'current_balance')
            ->orderBy('code', 'asc')
            ->get();

        $receipts = MerchantReceipt::with(['merchant', 'creator'])
            ->where('type', 'recovery')
            ->latest('id')
            ->take(100)
            ->get();

        return Inertia::render('merchants/wasooli/index', [
            'rows' => $sheet['rows'],
            'totals' => $sheet['totals'],
            'merchants' => $merchants,
            'receipts' => $receipts,
            'filters' => [
                'date' => $date,
                'search' => $search,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'merchant_id' => 'required|exists:merchants,id',
            'date' => 'required|date',
            'amount' => 'required|numeric|min:0.01',
            'note' => 'nullable|string|max:255',
            'payment_type' => 'nullable|string',
            'bank_account' => 'nullable|string',
            'reference' => 'nullable|string|max:100',
        ]);

        $note = $validated['note'] ?? null;
        if (!empty($validated['payment_type'])) {
            $note = ($note ? $note . ' · ' : '') . ucfirst($validated['payment_type']);
            if (!empty($validated['bank_account'])) {
                $note .= ' (' . $validated['bank_account'] . ')';
            }
        }
        if (!empty($validated['reference'])) {
            $note = ($note ? $note . ' · Ref: ' : 'Ref: ') . $validated['reference'];
        }

        $this->wasooliService->saveWasooliReceipt(
            $validated['merchant_id'],
            $validated['date'],
            floatval($validated['amount']),
            $note
        );

        return redirect()->back()->with('success', 'Recovery receipt saved.');
    }
}
