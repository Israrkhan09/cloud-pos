<?php

namespace App\Services;

use App\Models\AmrozaSale;
use App\Models\Merchant;
use Illuminate\Support\Facades\DB;

class AmrozaService
{
    /**
     * Get all sales for a date with merchant and item relations
     */
    public function getDailySales(string $date, ?string $search = null)
    {
        $query = AmrozaSale::with(['merchant', 'item'])
            ->where('date', $date)
            ->orderBy('id', 'desc');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->whereHas('merchant', function ($mq) use ($search) {
                    $mq->where('name_ur', 'like', "%{$search}%")
                       ->orWhere('name_en', 'like', "%{$search}%")
                       ->orWhere('code', 'like', "%{$search}%");
                })->orWhereHas('item', function ($iq) use ($search) {
                    $iq->where('name_ur', 'like', "%{$search}%")
                       ->orWhere('name_en', 'like', "%{$search}%")
                       ->orWhere('code', 'like', "%{$search}%");
                });
            });
        }

        return $query->get();
    }

    /**
     * Create an Amroza sale entry
     */
    public function createSale(array $data): AmrozaSale
    {
        return DB::transaction(function () use ($data) {
            $sale = AmrozaSale::create($data);
            $this->recalculateMerchantBalance($sale->merchant_id);

            // Deduct stock
            if (!empty($sale->item_id)) {
                $item = \App\Models\Item::find($sale->item_id);
                if ($item && $item->current_stock !== null) {
                    $item->decrement('current_stock', (int) $sale->nag);
                    if ($item->current_stock <= 0) {
                        $item->update(['status' => 'khatam', 'current_stock' => 0]);
                    }
                }
            }

            return $sale;
        });
    }

    /**
     * Update an Amroza sale entry
     */
    public function updateSale(int $id, array $data): AmrozaSale
    {
        return DB::transaction(function () use ($id, $data) {
            $sale = AmrozaSale::findOrFail($id);
            $oldMerchantId = $sale->merchant_id;
            $oldNag = (int) $sale->nag;
            $oldItemId = $sale->item_id;

            $sale->update($data);

            $this->recalculateMerchantBalance($sale->merchant_id);
            if ($oldMerchantId !== $sale->merchant_id) {
                $this->recalculateMerchantBalance($oldMerchantId);
            }

            // Adjust stock
            $newItemId = $sale->item_id;
            $newNag = (int) $sale->nag;

            if ($oldItemId === $newItemId) {
                $diff = $newNag - $oldNag;
                if ($diff !== 0) {
                    $item = \App\Models\Item::find($newItemId);
                    if ($item && $item->current_stock !== null) {
                        $item->decrement('current_stock', $diff);
                        if ($item->current_stock <= 0) {
                            $item->update(['status' => 'khatam', 'current_stock' => 0]);
                        } elseif ($item->status === 'khatam' && $item->current_stock > 0) {
                            $item->update(['status' => 'active']);
                        }
                    }
                }
            } else {
                // Revert old item stock
                $oldItem = \App\Models\Item::find($oldItemId);
                if ($oldItem && $oldItem->current_stock !== null) {
                    $oldItem->increment('current_stock', $oldNag);
                }
                // Deduct new item stock
                $newItem = \App\Models\Item::find($newItemId);
                if ($newItem && $newItem->current_stock !== null) {
                    $newItem->decrement('current_stock', $newNag);
                }
            }

            return $sale;
        });
    }

    /**
     * Delete an Amroza sale entry
     */
    public function deleteSale(int $id): bool
    {
        return DB::transaction(function () use ($id) {
            $sale = AmrozaSale::findOrFail($id);
            $merchantId = $sale->merchant_id;
            $itemId = $sale->item_id;
            $nag = (int) $sale->nag;

            $res = $sale->delete();
            $this->recalculateMerchantBalance($merchantId);

            // Revert stock
            if (!empty($itemId)) {
                $item = \App\Models\Item::find($itemId);
                if ($item && $item->current_stock !== null) {
                    $item->increment('current_stock', $nag);
                    if ($item->status === 'khatam' && $item->current_stock > 0) {
                        $item->update(['status' => 'active']);
                    }
                }
            }

            return $res;
        });
    }

    /**
     * Get live summary for footer
     * Sample: 281200 total, cash 137329, credit 143871
     */
    public function getDailySummary(string $date): array
    {
        $sales = AmrozaSale::with('merchant')->where('date', $date)->get();

        $totalRecords = $sales->count();
        $totalGross = 0;
        $totalNag = 0;
        $cashNag = 0;
        $cashAmount = 0;
        $creditNag = 0;
        $creditAmount = 0;
        $bankNag = 0;
        $bankAmount = 0;

        foreach ($sales as $sale) {
            $gross = floatval($sale->gross_amount);
            $nag = intval($sale->nag);
            $totalGross += $gross;
            $totalNag += $nag;

            $isNaqdi = $sale->payment_type === 'naqdi';
            $isBank = $sale->payment_type === 'bank';
            $isSplit = $sale->payment_type === 'split';

            if ($isBank) {
                $bankNag += $nag;
                $bankAmount += $gross;
            } elseif ($isNaqdi) {
                $cashNag += $nag;
                $cashAmount += $gross;
            } elseif ($isSplit) {
                $cashPortion = floatval($sale->cash_received ?? 0);
                $udhaarPortion = floatval($sale->udhaar_amount ?? ($gross - $cashPortion));
                $cashAmount += $cashPortion;
                $creditAmount += $udhaarPortion;
                $splitRatio = $gross > 0 ? ($cashPortion / $gross) : 0.5;
                $cNag = (int) round($nag * $splitRatio);
                $cashNag += $cNag;
                $creditNag += ($nag - $cNag);
            } else {
                $creditNag += $nag;
                $creditAmount += $gross;
            }
        }

        return [
            'total_records' => $totalRecords,
            'total_gross' => round($totalGross, 2),
            'total_nag' => $totalNag,
            'cash_nag' => $cashNag,
            'cash_amount' => round($cashAmount, 2),
            'credit_nag' => $creditNag,
            'credit_amount' => round($creditAmount, 2),
            'bank_nag' => $bankNag,
            'bank_amount' => round($bankAmount, 2),
        ];
    }

    /**
     * Am Total popup: Totals grouped by merchant and item for the date
     */
    public function getAmTotal(string $date): array
    {
        $sales = AmrozaSale::with(['merchant', 'item'])
            ->where('date', $date)
            ->get();

        $byMerchant = [];
        $byItem = [];

        foreach ($sales as $sale) {
            $mId = $sale->merchant_id;
            $mCode = $sale->merchant ? $sale->merchant->code : '-';
            $mName = $sale->merchant ? $sale->merchant->name : 'Unknown';

            if (!isset($byMerchant[$mId])) {
                $byMerchant[$mId] = [
                    'code' => $mCode,
                    'name' => $mName,
                    'name_ur' => $sale->merchant ? $sale->merchant->name_ur : '',
                    'name_en' => $sale->merchant ? $sale->merchant->name_en : '',
                    'nag' => 0,
                    'weight' => 0,
                    'gross' => 0,
                ];
            }
            $byMerchant[$mId]['nag'] += intval($sale->nag);
            $byMerchant[$mId]['weight'] += floatval($sale->weight);
            $byMerchant[$mId]['gross'] += floatval($sale->gross_amount);

            $iId = $sale->item_id;
            $iCode = $sale->item ? $sale->item->code : '-';
            $iName = $sale->item ? $sale->item->name : 'Unknown';

            if (!isset($byItem[$iId])) {
                $byItem[$iId] = [
                    'code' => $iCode,
                    'name' => $iName,
                    'name_ur' => $sale->item ? $sale->item->name_ur : '',
                    'name_en' => $sale->item ? $sale->item->name_en : '',
                    'nag' => 0,
                    'weight' => 0,
                    'gross' => 0,
                ];
            }
            $byItem[$iId]['nag'] += intval($sale->nag);
            $byItem[$iId]['weight'] += floatval($sale->weight);
            $byItem[$iId]['gross'] += floatval($sale->gross_amount);
        }

        return [
            'by_merchant' => array_values($byMerchant),
            'by_item' => array_values($byItem),
            'summary' => $this->getDailySummary($date),
        ];
    }

    /**
     * Recalculate merchant's current balance
     * Only Udhaar sales increase merchant balance (dukaan baqaya).
     * Cash and Bank sales do not affect dukaan baqaya.
     */
    public function recalculateMerchantBalance(int $merchantId): void
    {
        $merchant = Merchant::find($merchantId);
        if (!$merchant) return;

        $totalSales = $merchant->sales()
            ->where(function ($q) {
                $q->where('payment_type', 'udhaar')
                  ->orWhereNull('payment_type');
            })
            ->sum('gross_amount');
        $splitSales = $merchant->sales()
            ->where('payment_type', 'split')
            ->sum('udhaar_amount');
        $totalReceipts = $merchant->receipts()->sum('amount');
        $merchant->current_balance = round(($merchant->opening_balance ?? 0) + $totalSales + $splitSales - $totalReceipts, 2);
        $merchant->save();
    }
}
