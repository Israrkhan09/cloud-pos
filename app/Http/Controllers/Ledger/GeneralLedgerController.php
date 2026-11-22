<?php

namespace App\Http\Controllers\Ledger;

use App\Http\Controllers\Controller;
use App\Models\AmrozaSale;
use App\Models\Expense;
use App\Models\MerchantReceipt;
use Illuminate\Http\Request;
use Inertia\Inertia;

class GeneralLedgerController extends Controller
{
    public function index(Request $request)
    {
        $date = $request->query('date', date('Y-m-d'));

        // Prior cash calculations for Sabqa Cash
        $priorCashSales = (float) AmrozaSale::where('date', '<', $date)
            ->where(function ($q) {
                $q->where('payment_type', 'naqdi')
                  ->orWhere('payment_type', 'split');
            })
            ->sum(\DB::raw("CASE WHEN payment_type = 'split' THEN COALESCE(cash_received, 0) ELSE gross_amount END"));

        $priorWasooli = (float) MerchantReceipt::where('date', '<', $date)
            ->where('type', 'recovery')
            ->where(function ($q) {
                $q->whereNull('payment_method')
                  ->orWhere('payment_method', 'cash')
                  ->orWhere('payment_method', '');
            })
            ->sum('amount');

        $priorExpenses = (float) Expense::where('date', '<', $date)->sum('amount');

        $sabqaCash = max(0, $priorCashSales + $priorWasooli - $priorExpenses);

        $dayMonth = date('d/m', strtotime($date));
        $rows = [];
        $runningBalance = 0;

        // 1. Sabqa Cash (Opening Cash)
        $runningBalance += $sabqaCash;
        $rows[] = [
            'id'     => 'sabqa',
            'date'   => $dayMonth,
            'name'   => 'Sabqa Cash',
            'detail' => 'Galla Baqaya (Opening Balance)',
            'jama'   => $sabqaCash,
            'banam'  => 0,
            'baqaya' => round($runningBalance, 2),
        ];

        // 2. Itemized Cash Sales of the day
        $cashSales = AmrozaSale::where('date', $date)
            ->where(function ($q) {
                $q->where('payment_type', 'naqdi')
                  ->orWhere('payment_type', 'split');
            })
            ->with(['merchant', 'item'])
            ->orderBy('id', 'asc')
            ->get();

        foreach ($cashSales as $sale) {
            $cashAmt = $sale->payment_type === 'split' ? (float) $sale->cash_received : (float) $sale->gross_amount;
            if ($cashAmt <= 0) continue;

            $runningBalance += $cashAmt;
            $mName = $sale->merchant ? ($sale->merchant->name_en ?: ($sale->merchant->name ?: $sale->merchant->name_ur)) : 'Naqad Customer';
            $iName = $sale->item ? ($sale->item->name_en ?: ($sale->item->name ?: $sale->item->name_ur)) : 'Maal';
            $iName = trim(preg_replace('/\s*\(.*?\)\s*/', '', $iName));
            $unit = $sale->item && $sale->item->unit ? strtolower($sale->item->unit) : 'bori';

            $rows[] = [
                'id'     => 'sale_' . $sale->id,
                'date'   => $dayMonth,
                'name'   => $mName,
                'detail' => "Naqad Sale - {$iName} ({$sale->nag} {$unit} @ Rs. " . number_format($sale->rate) . ")",
                'jama'   => $cashAmt,
                'banam'  => 0,
                'baqaya' => round($runningBalance, 2),
            ];
        }

        // 3. Itemized Wasooli Receipts of the day (Cash wasooli)
        $receipts = MerchantReceipt::where('date', $date)
            ->where('type', 'recovery')
            ->where(function ($q) {
                $q->whereNull('payment_method')
                  ->orWhere('payment_method', 'cash')
                  ->orWhere('payment_method', '');
            })
            ->with('merchant')
            ->orderBy('id', 'asc')
            ->get();

        foreach ($receipts as $rcpt) {
            $rcptAmt = (float) $rcpt->amount;
            if ($rcptAmt <= 0) continue;

            $runningBalance += $rcptAmt;
            $mName = $rcpt->merchant ? ($rcpt->merchant->name_en ?: ($rcpt->merchant->name ?: $rcpt->merchant->name_ur)) : 'Khata Wasooli';

            $rows[] = [
                'id'     => 'rcpt_' . $rcpt->id,
                'date'   => $dayMonth,
                'name'   => $mName,
                'detail' => "Wasooli / Recovery Parchi #{$rcpt->id}" . ($rcpt->notes ? " ({$rcpt->notes})" : ''),
                'jama'   => $rcptAmt,
                'banam'  => 0,
                'baqaya' => round($runningBalance, 2),
            ];
        }

        // 4. Expenses / Banam
        $expenses = Expense::where('date', $date)
            ->orderBy('id', 'asc')
            ->get();

        foreach ($expenses as $exp) {
            $expAmt = (float) $exp->amount;
            $runningBalance -= $expAmt;

            $rows[] = [
                'id'     => 'exp_' . $exp->id,
                'date'   => $dayMonth,
                'name'   => $exp->title,
                'detail' => $exp->description ?: 'Dukaan / Mandi Kharcha',
                'jama'   => 0,
                'banam'  => $expAmt,
                'baqaya' => round($runningBalance, 2),
            ];
        }

        $totalJama = array_sum(array_column($rows, 'jama'));
        $totalBanam = array_sum(array_column($rows, 'banam'));
        $balance = $runningBalance;

        return Inertia::render('ledger/general/index', [
            'date'       => $date,
            'dayMonth'   => $dayMonth,
            'rows'       => $rows,
            'summary'    => [
                'balance'     => round($balance, 2),
                'total_jama'  => round($totalJama, 2),
                'total_banam' => round($totalBanam, 2),
                'entries'     => count($rows),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'date'        => 'required|date',
            'title'       => 'required|string|max:255',
            'amount'      => 'required|numeric|min:0.01',
            'description' => 'nullable|string|max:500',
        ]);

        Expense::create($validated);

        return redirect()->back()->with('success', 'Entry recorded successfully.');
    }
}
