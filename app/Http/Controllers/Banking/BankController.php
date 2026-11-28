<?php

namespace App\Http\Controllers\Banking;

use App\Http\Controllers\Controller;
use App\Models\MerchantReceipt;
use App\Services\DashboardService;
use Inertia\Inertia;
use Inertia\Response;

class BankController extends Controller
{
    public function index(): Response
    {
        $dashboardService = new DashboardService();
        $stats = $dashboardService->getDashboardItems('today')['stats'] ?? [];
        $cashGalla = $stats['cashGalla'] ?? 0;

        // Fetch real transactions from database
        $dbTransactions = MerchantReceipt::with('merchant')
            ->latest('id')
            ->limit(25)
            ->get()
            ->map(function ($r) {
                $noteLower = strtolower($r->note ?? '');
                $isBank = str_contains($noteLower, 'bank') || str_contains($noteLower, 'online') || str_contains($noteLower, 'easypaisa') || str_contains($noteLower, 'jazzcash');
                
                $targetAccount = 'Cash / Counter';
                if ($isBank) {
                    if (str_contains($noteLower, 'easypaisa israr')) {
                        $targetAccount = 'EasyPaisa Israr';
                    } elseif (str_contains($noteLower, 'meezan')) {
                        $targetAccount = 'Meezan Bank Mandi Branch';
                    } elseif (str_contains($noteLower, 'hbl')) {
                        $targetAccount = 'HBL Aadhat Current Account';
                    } else {
                        $targetAccount = 'Bank Account';
                    }
                }

                return [
                    'id' => 'rcpt_' . $r->id,
                    'date' => $r->date ? date('Y-m-d', strtotime($r->date)) : date('Y-m-d'),
                    'type' => 'Recovery',
                    'from' => $r->merchant?->name ?? 'Customer (Recovery)',
                    'to' => $targetAccount,
                    'amount' => (float) $r->amount,
                    'description' => $r->note ?: 'Customer Recovery (Receipt #' . $r->id . ')',
                ];
            });

        return Inertia::render('banking/accounts/index', [
            'liveCashGalla' => (float) $cashGalla,
            'dbTransactions' => $dbTransactions,
        ]);
    }

    public function transfers(): Response
    {
        return Inertia::render('banking/transfers/index');
    }

    public function cheques(): Response
    {
        return Inertia::render('banking/cheques/index');
    }
}
