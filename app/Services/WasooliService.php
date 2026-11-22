<?php

namespace App\Services;

use App\Models\AmrozaSale;
use App\Models\Merchant;
use App\Models\MerchantReceipt;
use Illuminate\Support\Facades\DB;

class WasooliService
{
    /**
     * Get Wasooli recovery sheet for a date
     * One row per merchant with balance or activity
     */
    public function getWasooliSheet(string $date, ?string $search = null): array
    {
        $query = Merchant::where('status', 'active')->where('code', '!=', 1);

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name_ur', 'like', "%{$search}%")
                  ->orWhere('name_en', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }

        $allMerchants = $query->orderBy('code', 'asc')->get();

        $rows = [];
        $totalSabiqa = 0;
        $totalAmroza = 0;
        $totalWasooli = 0;
        $totalBaqaya = 0;

        foreach ($allMerchants as $merchant) {
            // Sabiqa: previous balance before this date (only Udhaar sales)
            $sabiqa = $merchant->getSabiqaBalance($date);

            // Amroza: today's Udhaar sales on this date (Cash and Bank do not appear in Wasooli)
            $amrozaUdhaar = floatval(
                AmrozaSale::where('merchant_id', $merchant->id)
                    ->where('date', $date)
                    ->where(function ($q) {
                        $q->where('payment_type', 'udhaar')
                          ->orWhereNull('payment_type');
                    })
                    ->sum('gross_amount')
            );
            $amrozaSplit = floatval(
                AmrozaSale::where('merchant_id', $merchant->id)
                    ->where('date', $date)
                    ->where('payment_type', 'split')
                    ->sum('udhaar_amount')
            );
            $amroza = round($amrozaUdhaar + $amrozaSplit, 2);

            // Wasooli: recovery payment on this date
            $receipt = MerchantReceipt::where('merchant_id', $merchant->id)
                ->where('date', $date)
                ->where('type', 'recovery')
                ->latest()
                ->first();

            $wasooli = floatval(
                MerchantReceipt::where('merchant_id', $merchant->id)
                    ->where('date', $date)
                    ->where('type', 'recovery')
                    ->sum('amount')
            );

            // Total Baqaya = Sabiqa + Amroza - Wasooli
            $baqaya = round($sabiqa + $amroza - $wasooli, 2);

            // If no search filter, show merchants that have a balance or activity
            $hasActivity = (abs($sabiqa) > 0.001 || $amroza > 0 || $wasooli > 0);

            if ($search || $hasActivity) {
                $rows[] = [
                    'merchant_id' => $merchant->id,
                    'code' => $merchant->code,
                    'name' => $merchant->name,
                    'name_ur' => $merchant->name_ur,
                    'name_en' => $merchant->name_en,
                    'phone' => $merchant->phone,
                    'sabiqa' => $sabiqa,
                    'amroza' => $amroza,
                    'wasooli' => $wasooli,
                    'receipt_id' => $receipt ? $receipt->id : null,
                    'total_baqaya' => $baqaya,
                ];

                $totalSabiqa += $sabiqa;
                $totalAmroza += $amroza;
                $totalWasooli += $wasooli;
                $totalBaqaya += $baqaya;
            }
        }

        return [
            'rows' => $rows,
            'totals' => [
                'total_sabiqa' => round($totalSabiqa, 2),
                'total_amroza' => round($totalAmroza, 2),
                'total_wasooli' => round($totalWasooli, 2),
                'total_baqaya' => round($totalBaqaya, 2),
            ],
        ];
    }

    /**
     * Save/update Wasooli recovery receipt
     */
    public function saveWasooliReceipt(int $merchantId, string $date, float $amount, ?string $note = null): MerchantReceipt
    {
        return DB::transaction(function () use ($merchantId, $date, $amount, $note) {
            $receipt = MerchantReceipt::create([
                'merchant_id' => $merchantId,
                'date' => $date,
                'type' => 'recovery',
                'amount' => $amount,
                'note' => $note,
                'created_by' => auth()->id(),
            ]);

            // Update merchant balance
            app(AmrozaService::class)->recalculateMerchantBalance($merchantId);

            return $receipt;
        });
    }
}
