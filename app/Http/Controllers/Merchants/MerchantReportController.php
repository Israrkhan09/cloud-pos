<?php

namespace App\Http\Controllers\Merchants;

use App\Http\Controllers\Controller;
use App\Models\AmrozaSale;
use App\Models\Merchant;
use App\Models\MerchantReceipt;
use App\Models\Farmer;
use App\Models\FarmerMark;
use App\Models\FarmerBill;
use App\Models\Expense;
use App\Models\Item;
use App\Models\Area;
use App\Models\Wastage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class MerchantReportController extends Controller
{
    /**
     * Reports Index (Mandi Rapoort)
     */
    public function index(Request $request)
    {
        $tab = $request->query('tab', 'rozana');
        $fromDate = $request->query('from_date', date('Y-m-d'));
        $toDate = $request->query('to_date', date('Y-m-d'));
        $year = (int)$request->query('year', date('Y'));

        // 1. Rozana Sale Report Data (Filtered by from_date - to_date)
        $rozanaSales = AmrozaSale::with(['merchant', 'item'])
            ->whereDate('date', '>=', $fromDate)
            ->whereDate('date', '<=', $toDate)
            ->orderBy('id', 'desc')
            ->get();

        $rozanaRows = [];
        $totalBillsCount = $rozanaSales->count();
        $totalGross = 0;
        $totalCash = 0;
        $totalUdhaar = 0;

        foreach ($rozanaSales as $sale) {
            $gross = (float)$sale->gross_amount;
            $cash = 0;
            $udhaar = 0;

            $pType = strtolower($sale->payment_type ?? 'cash');
            if ($pType === 'split') {
                $cash = (float)($sale->cash_received ?? 0);
                $udhaar = (float)($sale->udhaar_amount ?? max(0, $gross - $cash));
            } elseif ($pType === 'udhaar') {
                $cash = 0;
                $udhaar = $gross;
            } elseif ($pType === 'bank') {
                $cash = 0;
                $udhaar = 0;
            } else { // naqdi / cash
                $cash = $gross;
                $udhaar = 0;
            }

            $totalGross += $gross;
            $totalCash += $cash;
            $totalUdhaar += $udhaar;

            $mName = $sale->merchant ? ($sale->merchant->name_en ?: ($sale->merchant->name ?: $sale->merchant->name_ur)) : 'Aam Naqad Gahak';
            $itName = $sale->item ? ($sale->item->name_en ?: $sale->item->name) : 'Sabzi';

            $displayType = 'NAQAD';
            if ($pType === 'udhaar') {
                $displayType = 'UDHAAR';
            } elseif ($pType === 'bank') {
                $displayType = 'BANK';
            } elseif ($pType === 'split') {
                $displayType = 'ADHA CASH / ADHA UDHAAR';
            }

            $rozanaRows[] = [
                'id' => $sale->id,
                'bill_no' => sprintf('INV-%04d', 1000 + $sale->id),
                'customer_name' => $mName,
                'date' => $sale->date ? date('Y-m-d', strtotime($sale->date)) : date('Y-m-d'),
                'item_count' => (int)($sale->nag ?: 1) . ' Sabzian',
                'item_name' => $itName,
                'gross_amount' => $gross,
                'cash_paid' => $cash,
                'udhaar_baqaya' => $udhaar,
                'payment_type' => $displayType,
            ];
        }

        $rozanaData = [
            'from_date' => $fromDate,
            'to_date' => $toDate,
            'bills_count' => $totalBillsCount,
            'total_gross' => $totalGross,
            'total_cash' => $totalCash,
            'total_udhaar' => $totalUdhaar,
            'rows' => $rozanaRows,
        ];

        // 2. Mahana Sale Summary Data (Filtered by Year)
        $yearSales = AmrozaSale::whereYear('date', $year)->orderBy('date', 'desc')->get();
        $monthGroups = [];
        $totalYearBills = 0;
        $totalYearGross = 0;
        $totalYearCash = 0;
        $totalYearUdhaar = 0;
        $totalYearDiscount = 0;

        foreach ($yearSales as $s) {
            $mKey = substr($s->date, 0, 7); // e.g. "2026-11"
            if (!isset($monthGroups[$mKey])) {
                $monthGroups[$mKey] = [
                    'month' => $mKey,
                    'bills_count' => 0,
                    'total_sale' => 0,
                    'cash_wasooli' => 0,
                    'udhaar_baqaya' => 0,
                    'discount' => 0,
                ];
            }

            $gross = (float)$s->gross_amount;
            $cash = 0;
            $udhaar = 0;
            $discount = (float)($s->bardana < 0 ? abs($s->bardana) : 0);

            $pType = strtolower($s->payment_type ?? 'cash');
            if ($pType === 'split') {
                $cash = (float)($s->cash_received ?? 0);
                $udhaar = (float)($s->udhaar_amount ?? max(0, $gross - $cash));
            } elseif ($pType === 'udhaar') {
                $cash = 0;
                $udhaar = $gross;
            } elseif ($pType === 'bank') {
                $cash = 0;
                $udhaar = 0;
            } else {
                $cash = $gross;
                $udhaar = 0;
            }

            $monthGroups[$mKey]['bills_count'] += 1;
            $monthGroups[$mKey]['total_sale'] += $gross;
            $monthGroups[$mKey]['cash_wasooli'] += $cash;
            $monthGroups[$mKey]['udhaar_baqaya'] += $udhaar;
            $monthGroups[$mKey]['discount'] += $discount;

            $totalYearBills += 1;
            $totalYearGross += $gross;
            $totalYearCash += $cash;
            $totalYearUdhaar += $udhaar;
            $totalYearDiscount += $discount;
        }

        krsort($monthGroups);
        $mahanaRows = array_values($monthGroups);

        $mahanaData = [
            'year' => $year,
            'rows' => $mahanaRows,
            'totals' => [
                'bills_count' => $totalYearBills,
                'total_sale' => $totalYearGross,
                'cash_wasooli' => $totalYearCash,
                'udhaar_baqaya' => $totalYearUdhaar,
                'discount' => $totalYearDiscount,
            ],
        ];

        // 3. Stock Valuation (Malyaat) Data (Live current stock from DB)
        $items = Item::orderBy('id', 'asc')->get();
        $stockRows = [];
        $totalItemsCount = $items->count();
        $totalCostValuation = 0;
        $totalSaleValuation = 0;

        foreach ($items as $it) {
            $stock = (float)($it->current_stock ?? $it->opening_stock ?? 0);
            $costRate = (float)($it->purchase_rate ?: ($it->default_rate ? round($it->default_rate * 0.8) : 50));
            $saleRate = (float)($it->default_rate ?: 100);

            $totalCost = $stock * $costRate;
            $totalSale = $stock * $saleRate;

            $totalCostValuation += $totalCost;
            $totalSaleValuation += $totalSale;

            $stockRows[] = [
                'id' => $it->id,
                'name' => $it->name_en ?: $it->name,
                'stock' => $stock,
                'unit' => $it->unit ?: 'Bori',
                'cost_rate' => $costRate,
                'total_cost' => $totalCost,
                'sale_rate' => $saleRate,
                'total_sale' => $totalSale,
            ];
        }

        $stockData = [
            'items_count' => $totalItemsCount,
            'cost_valuation' => $totalCostValuation,
            'sale_valuation' => $totalSaleValuation,
            'expected_profit' => max(0, $totalSaleValuation - $totalCostValuation),
            'rows' => $stockRows,
        ];

        // 4. Gahak Baqaya (Udhaar) Data (Only merchants with current_balance > 0)
        $merchants = Merchant::where('current_balance', '>', 0)
            ->orderByDesc('current_balance')
            ->get();

        $gahakRows = [];
        $totalMarketUdhaar = 0;

        foreach ($merchants as $m) {
            $bal = (float)$m->current_balance;
            $totalMarketUdhaar += $bal;

            $lastSale = AmrozaSale::where('merchant_id', $m->id)->latest('date')->first();
            $lastReceipt = MerchantReceipt::where('merchant_id', $m->id)->latest('date')->first();

            $gahakRows[] = [
                'id' => $m->id,
                'name' => $m->name_en ?: ($m->name ?: $m->name_ur),
                'phone' => $m->phone ?: '—',
                'area' => $m->city ?: 'Mandi',
                'credit_limit' => (float)($m->credit_limit ?: 0),
                'balance' => $bal,
                'last_sale' => $lastSale?->date ? date('Y-m-d', strtotime($lastSale->date)) : '—',
                'last_wasooli' => $lastReceipt?->date ? date('Y-m-d', strtotime($lastReceipt->date)) : '—',
            ];
        }

        $gahakData = [
            'total_market_udhaar' => $totalMarketUdhaar,
            'rows' => $gahakRows,
        ];

        // 5. Nafa-Nuqsan (Munafa P&L) Data (Filtered by from_date - to_date)
        $pnlSales = AmrozaSale::with('item')
            ->whereDate('date', '>=', $fromDate)
            ->whereDate('date', '<=', $toDate)
            ->get();

        $grossRevenue = (float)$pnlSales->sum('gross_amount');

        $cogs = 0;
        foreach ($pnlSales as $ps) {
            $qty = (float)($ps->nag ?: 1);
            $costRate = (float)($ps->item?->purchase_rate ?: ($ps->rate ? round($ps->rate * 0.8) : 50));
            $cogs += ($qty * $costRate);
        }

        $grossProfit = $grossRevenue - $cogs;

        $farmerCommission = (float)FarmerBill::whereDate('date', '>=', $fromDate)
            ->whereDate('date', '<=', $toDate)
            ->sum('commission_amount');

        if ($farmerCommission == 0 && $fromDate === date('Y-m-d')) {
            $farmerCommission = (float)FarmerBill::sum('commission_amount');
        }

        $wastageLoss = (float)Wastage::whereDate('date', '>=', $fromDate)
            ->whereDate('date', '<=', $toDate)
            ->sum('loss_amount');

        $totalDiscounts = 0;
        foreach ($pnlSales as $ps) {
            if ($ps->bardana < 0) {
                $totalDiscounts += abs((float)$ps->bardana);
            }
        }

        // Formula: Saaf Munafa = Kham Munafa + Commission − Nuqsan − Riaayat
        $netProfit = $grossProfit + $farmerCommission - $wastageLoss - $totalDiscounts;

        $pnlData = [
            'from_date' => $fromDate,
            'to_date' => $toDate,
            'gross_revenue' => $grossRevenue,
            'cogs' => $cogs,
            'gross_profit' => $grossProfit,
            'farmer_commission' => $farmerCommission,
            'wastage_loss' => $wastageLoss,
            'total_discounts' => $totalDiscounts,
            'net_profit' => $netProfit,
        ];

        return Inertia::render('reports/index', [
            'initialTab' => $tab,
            'initialFromDate' => $fromDate,
            'initialToDate' => $toDate,
            'initialYear' => $year,
            'rozanaData' => $rozanaData,
            'mahanaData' => $mahanaData,
            'stockData' => $stockData,
            'gahakData' => $gahakData,
            'pnlData' => $pnlData,
        ]);
    }

    /**
     * Merchant-wise Amroza Summary
     */
    public function merchantAmroza(Request $request)
    {
        $date = $request->query('date', date('Y-m-d'));

        $sales = AmrozaSale::with('merchant')
            ->where('date', $date)
            ->get();

        $byMerchant = [];
        $totalNag = 0;
        $totalGross = 0;

        foreach ($sales as $sale) {
            $mId = $sale->merchant_id;
            $mCode = $sale->merchant ? $sale->merchant->code : '-';
            $mName = $sale->merchant ? $sale->merchant->name : 'Unknown';

            if (!isset($byMerchant[$mId])) {
                $byMerchant[$mId] = [
                    'merchant_id' => $mId,
                    'code' => $mCode,
                    'name' => $mName,
                    'name_ur' => $sale->merchant ? $sale->merchant->name_ur : '',
                    'name_en' => $sale->merchant ? $sale->merchant->name_en : '',
                    'is_naqdi' => (int)$mCode === 1,
                    'total_nag' => 0,
                    'total_weight' => 0,
                    'total_gross' => 0,
                ];
            }

            $byMerchant[$mId]['total_nag'] += intval($sale->nag);
            $byMerchant[$mId]['total_weight'] += floatval($sale->weight);
            $byMerchant[$mId]['total_gross'] += floatval($sale->gross_amount);

            $totalNag += intval($sale->nag);
            $totalGross += floatval($sale->gross_amount);
        }

        // Sort by merchant code
        usort($byMerchant, fn($a, $b) => $a['code'] <=> $b['code']);

        return Inertia::render('merchants/reports/merchant-amroza', [
            'rows' => $byMerchant,
            'totals' => [
                'total_nag' => $totalNag,
                'total_gross' => round($totalGross, 2),
            ],
            'filters' => [
                'date' => $date,
            ],
        ]);
    }

    /**
     * Merchant-wise Wasooli Summary
     */
    public function merchantWasooli(Request $request)
    {
        $date = $request->query('date', date('Y-m-d'));

        $receipts = MerchantReceipt::with('merchant')
            ->where('date', $date)
            ->get();

        $rows = [];
        $totalWasooli = 0;

        foreach ($receipts as $receipt) {
            $amount = floatval($receipt->amount);
            $rows[] = [
                'id' => $receipt->id,
                'merchant_id' => $receipt->merchant_id,
                'code' => $receipt->merchant ? $receipt->merchant->code : '-',
                'name' => $receipt->merchant ? $receipt->merchant->name : 'Unknown',
                'name_ur' => $receipt->merchant ? $receipt->merchant->name_ur : '',
                'name_en' => $receipt->merchant ? $receipt->merchant->name_en : '',
                'amount' => $amount,
                'type' => $receipt->type,
                'note' => $receipt->note,
            ];
            $totalWasooli += $amount;
        }

        usort($rows, fn($a, $b) => $a['code'] <=> $b['code']);

        return Inertia::render('merchants/reports/merchant-wasooli', [
            'rows' => $rows,
            'totals' => [
                'total_wasooli' => round($totalWasooli, 2),
            ],
            'filters' => [
                'date' => $date,
            ],
        ]);
    }

    /**
     * Amroza Detail (Line-by-line sales)
     */
    public function amrozaDetail(Request $request)
    {
        $fromDate = $request->query('from_date', date('Y-m-d'));
        $toDate = $request->query('to_date', date('Y-m-d'));

        $sales = AmrozaSale::with(['merchant', 'item'])
            ->whereBetween('date', [$fromDate, $toDate])
            ->orderBy('date', 'desc')
            ->orderBy('id', 'desc')
            ->get();

        $totalNag = 0;
        $totalWeight = 0;
        $totalGross = 0;

        $rows = $sales->map(function ($s) use (&$totalNag, &$totalWeight, &$totalGross) {
            $totalNag += intval($s->nag);
            $totalWeight += floatval($s->weight);
            $totalGross += floatval($s->gross_amount);

            return [
                'id' => $s->id,
                'date' => $s->date->format('Y-m-d'),
                'merchant_code' => $s->merchant ? $s->merchant->code : '-',
                'merchant_name_ur' => $s->merchant ? $s->merchant->name_ur : '',
                'merchant_name_en' => $s->merchant ? $s->merchant->name_en : '',
                'is_naqdi' => $s->merchant ? ((int)$s->merchant->code === 1) : false,
                'item_name_ur' => $s->item ? $s->item->name_ur : '',
                'item_name_en' => $s->item ? $s->item->name_en : '',
                'unit' => $s->item ? $s->item->unit : '',
                'nag' => $s->nag,
                'weight' => $s->weight,
                'rate' => $s->rate,
                'bardana' => $s->bardana,
                'gross_amount' => $s->gross_amount,
            ];
        });

        return Inertia::render('merchants/reports/amroza-detail', [
            'rows' => $rows,
            'totals' => [
                'total_nag' => $totalNag,
                'total_weight' => round($totalWeight, 2),
                'total_gross' => round($totalGross, 2),
            ],
            'filters' => [
                'from_date' => $fromDate,
                'to_date' => $toDate,
            ],
        ]);
    }

    /**
     * Wasooli Detail (Line-by-line recovery)
     */
    public function wasooliDetail(Request $request)
    {
        $fromDate = $request->query('from_date', date('Y-m-d'));
        $toDate = $request->query('to_date', date('Y-m-d'));

        $receipts = MerchantReceipt::with('merchant')
            ->whereBetween('date', [$fromDate, $toDate])
            ->orderBy('date', 'desc')
            ->orderBy('id', 'desc')
            ->get();

        $totalAmount = 0;

        $rows = $receipts->map(function ($r) use (&$totalAmount) {
            $amount = floatval($r->amount);
            $totalAmount += $amount;

            return [
                'id' => $r->id,
                'date' => $r->date->format('Y-m-d'),
                'merchant_code' => $r->merchant ? $r->merchant->code : '-',
                'merchant_name_ur' => $r->merchant ? $r->merchant->name_ur : '',
                'merchant_name_en' => $r->merchant ? $r->merchant->name_en : '',
                'amount' => $amount,
                'type' => $r->type,
                'note' => $r->note,
            ];
        });

        return Inertia::render('merchants/reports/wasooli-detail', [
            'rows' => $rows,
            'totals' => [
                'total_amount' => round($totalAmount, 2),
            ],
            'filters' => [
                'from_date' => $fromDate,
                'to_date' => $toDate,
            ],
        ]);
    }

    /**
     * Amroza / Wasooli Combined Sheet (Section 9.3 & 10)
     * Shows Date, Sabiqa, Amroza, Wasooli, Baqaya
     */
    public function amrozaWasooli(Request $request)
    {
        $fromDate = $request->query('from_date', date('Y-m-d', strtotime('-6 days')));
        $toDate = $request->query('to_date', date('Y-m-d'));

        // Generate list of dates between fromDate and toDate
        $period = new \DatePeriod(
            new \DateTime($fromDate),
            new \DateInterval('P1D'),
            (new \DateTime($toDate))->modify('+1 day')
        );

        $rows = [];
        $totalSabiqa = 0;
        $totalAmroza = 0;
        $totalWasooli = 0;
        $totalBaqaya = 0;

        $merchants = Merchant::where('status', 'active')->where('code', '!=', 1)->get();
        $totalOpening = $merchants->sum('opening_balance');

        foreach ($period as $dt) {
            $dateStr = $dt->format('Y-m-d');

            // Prior sales and receipts before this date across all merchants
            $priorSales = AmrozaSale::where('date', '<', $dateStr)->sum('gross_amount');
            $priorReceipts = MerchantReceipt::where('date', '<', $dateStr)->sum('amount');
            $sabiqa = round($totalOpening + $priorSales - $priorReceipts, 2);

            // Day sales (Amroza)
            $amroza = round(AmrozaSale::where('date', $dateStr)->sum('gross_amount'), 2);

            // Day receipts (Wasooli)
            $wasooli = round(MerchantReceipt::where('date', $dateStr)->where('type', 'recovery')->sum('amount'), 2);

            // Total Baqaya = Sabiqa + Amroza - Wasooli
            $baqaya = round($sabiqa + $amroza - $wasooli, 2);

            $rows[] = [
                'date' => $dateStr,
                'sabiqa' => $sabiqa,
                'amroza' => $amroza,
                'wasooli' => $wasooli,
                'baqaya' => $baqaya,
            ];

            $totalSabiqa += $sabiqa;
            $totalAmroza += $amroza;
            $totalWasooli += $wasooli;
            $totalBaqaya += $baqaya;
        }

        return Inertia::render('merchants/reports/amroza-wasooli', [
            'rows' => $rows,
            'totals' => [
                'total_sabiqa' => round($totalSabiqa, 2),
                'total_amroza' => round($totalAmroza, 2),
                'total_wasooli' => round($totalWasooli, 2),
                'total_baqaya' => round($totalBaqaya, 2),
            ],
            'filters' => [
                'from_date' => $fromDate,
                'to_date' => $toDate,
            ],
        ]);
    }

    /**
     * JSON Data Provider for Preview & Print of all reports
     */
    public function getReportData(Request $request)
    {
        $report = $request->query('report', 'amroza_print');
        $date = $request->query('date', date('Y-m-d'));
        $fromDate = $request->query('from_date', $date);
        $toDate = $request->query('to_date', $date);

        $response = [
            'report' => $report,
            'date' => $date,
            'from_date' => $fromDate,
            'to_date' => $toDate,
            'title' => '',
            'title_ur' => '',
            'columns' => [],
            'rows' => [],
            'totals' => [],
        ];

        switch ($report) {
            case 'sale_report':
            case 'amroza_print':
            case 'amroza_parchi':
                $response['title'] = 'Sale Report';
                $response['title_ur'] = 'سیل رپورٹ (امروزہ لسٹ)';
                $sales = AmrozaSale::with(['merchant', 'item'])->where('date', $date)->orderBy('id', 'asc')->get();
                $totalNag = 0; $totalWeight = 0; $totalAmount = 0;
                $rows = [];
                foreach ($sales as $idx => $s) {
                    $totalNag += (int)$s->nag;
                    $totalWeight += (float)$s->weight;
                    $totalAmount += (float)$s->gross_amount;
                    $buyerName = $s->merchant ? ($s->merchant->name_en ?: ($s->merchant->name ?: $s->merchant->name_ur)) : 'Buyer';
                    $itemName = $s->item ? ($s->item->name_en ?: ($s->item->name ?: $s->item->name_ur)) : 'Item';
                    $itemName = trim(preg_replace('/\s*\(.*?\)\s*/', '', $itemName));
                    $unit = $s->item && $s->item->unit ? $s->item->unit : 'Bori';
                    $rows[] = [
                        'col1' => $idx + 1,
                        'col2' => '#' . ($s->merchant ? $s->merchant->code : '-'),
                        'col3' => $buyerName,
                        'col4' => $itemName,
                        'col5' => (int)$s->nag . ' ' . $unit,
                        'col6' => (float)$s->weight ?: '—',
                        'col7' => 'Rs. ' . number_format($s->rate),
                        'col8' => 'Rs. ' . number_format($s->gross_amount),
                    ];
                }
                $response['columns'] = ['#', 'Code', 'Buyer', 'Item', 'Nag', 'Weight', 'Rate', 'Total'];
                $response['rows'] = $rows;
                $response['totals'] = [
                    'Total Nag: ' . $totalNag,
                    'Grand Total: Rs. ' . number_format($totalAmount),
                ];
                break;

            case 'munafa_nuqsan':
                $response['title'] = 'Munafa / Nuqsan Report';
                $response['title_ur'] = 'منافع / نقصان رپورٹ (آئٹم وار)';
                $sales = AmrozaSale::with('item')->where('date', $date)->get();
                $grouped = [];
                foreach ($sales as $s) {
                    $iId = $s->item_id ?: 0;
                    if (!isset($grouped[$iId])) {
                        $rawItem = $s->item ? ($s->item->name_en ?: ($s->item->name ?: $s->item->name_ur)) : 'Maal';
                        $itemName = trim(preg_replace('/\s*\(.*?\)\s*/', '', $rawItem));
                        $unit = $s->item && $s->item->unit ? $s->item->unit : 'Bori';
                        // Cost rate from farmer bill or estimate from default_rate
                        $costRate = 0;
                        $fBill = FarmerBill::where('item_id', $iId)->where('date', '<=', $date)->orderBy('date', 'desc')->first();
                        if ($fBill && $fBill->rate > 0) {
                            $costRate = (float) $fBill->rate;
                        } else if ($s->item && $s->item->default_rate > 0) {
                            $costRate = round((float) $s->item->default_rate * 0.85);
                        }
                        $grouped[$iId] = [
                            'item' => $itemName,
                            'unit' => $unit,
                            'sold_nag' => 0,
                            'sale_amount' => 0,
                            'cost_rate' => $costRate,
                        ];
                    }
                    $grouped[$iId]['sold_nag'] += (int) $s->nag;
                    $grouped[$iId]['sale_amount'] += (float) $s->gross_amount;
                }
                $rows = [];
                $totSale = 0; $totCost = 0; $totProfit = 0;
                $i = 1;
                foreach ($grouped as $g) {
                    $costAmt = $g['cost_rate'] * $g['sold_nag'];
                    $profit = $g['sale_amount'] - $costAmt;
                    $totSale += $g['sale_amount'];
                    $totCost += $costAmt;
                    $totProfit += $profit;
                    $avgSaleRate = $g['sold_nag'] > 0 ? round($g['sale_amount'] / $g['sold_nag']) : 0;
                    $rows[] = [
                        'col1' => $i++,
                        'col2' => $g['item'],
                        'col3' => $g['sold_nag'] . ' ' . $g['unit'],
                        'col4' => 'Rs. ' . number_format($avgSaleRate),
                        'col5' => 'Rs. ' . number_format($g['sale_amount']),
                        'col6' => 'Rs. ' . number_format($g['cost_rate']),
                        'col7' => ($profit >= 0 ? '+ Rs. ' : '- Rs. ') . number_format(abs($profit)),
                    ];
                }
                $response['columns'] = ['#', 'Item', 'Units Sold', 'Sale Rate', 'Total Sale', 'Supplier Cost', 'Profit / Loss'];
                $response['rows'] = $rows;
                $response['totals'] = [
                    'Total Sale: Rs. ' . number_format($totSale),
                    'Total Cost: Rs. ' . number_format($totCost),
                    'Net Munafa: Rs. ' . number_format($totProfit),
                ];
                break;

            case 'udhaar_report':
                $response['title'] = 'Customer Receivables Report';
                $response['title_ur'] = 'ادھار رپورٹ (کس سے کتنا لینا)';
                $merchants = Merchant::where('status', 'active')->where('code', '!=', 1)->orderBy('code', 'asc')->get();
                $rows = [];
                $totBaqaya = 0;
                foreach ($merchants as $idx => $m) {
                    $mName = $m->name_en ?: ($m->name ?: $m->name_ur);
                    $totBaqaya += (float) $m->current_balance;
                    $rows[] = [
                        'col1' => $idx + 1,
                        'col2' => '#' . $m->code,
                        'col3' => $mName,
                        'col4' => $m->phone ?: '—',
                        'col5' => 'Rs. ' . number_format($m->opening_balance),
                        'col6' => 'Rs. ' . number_format($m->current_balance),
                        'col7' => (float)$m->current_balance > 0 ? 'Dena Hai' : 'Clear',
                    ];
                }
                $response['columns'] = ['#', 'Code', 'Customer Name', 'Phone', 'Previous Balance', 'Current Outstanding Balance', 'Status'];
                $response['rows'] = $rows;
                $response['totals'] = ['Total Outstanding Balance: Rs. ' . number_format($totBaqaya)];
                break;

            case 'stock_report':
                $response['title'] = 'Stock Report';
                $response['title_ur'] = 'اسٹاک رپورٹ (ویلیو اور کم اسٹاک)';
                $items = Item::orderBy('id', 'asc')->get();
                $rows = [];
                $totItems = count($items);
                $totStock = 0;
                $totVal = 0;
                foreach ($items as $idx => $it) {
                    $rawName = $it->name_en ?: ($it->name ?: $it->name_ur);
                    $itName = trim(preg_replace('/\s*\(.*?\)\s*/', '', $rawName));
                    $stock = (int) ($it->current_stock ?? $it->opening_stock ?? 0);
                    $rate = (float) ($it->default_rate ?? 0);
                    $val = $stock * $rate;
                    $totStock += $stock;
                    $totVal += $val;
                    $status = $stock <= 0 ? 'Out of Stock' : ($stock < 20 ? 'Low Stock' : 'Adequate');
                    $rows[] = [
                        'col1' => $idx + 1,
                        'col2' => '#' . $it->id,
                        'col3' => $itName,
                        'col4' => $it->unit ?: 'Bori',
                        'col5' => $stock,
                        'col6' => 'Rs. ' . number_format($rate),
                        'col7' => 'Rs. ' . number_format($val),
                        'col8' => $status,
                    ];
                }
                $response['columns'] = ['#', 'Code', 'Product Name', 'Unit', 'Baaki Stock', 'Rate', 'Stock Value', 'Status'];
                $response['rows'] = $rows;
                $response['totals'] = [
                    'Total Products: ' . $totItems,
                    'Total Stock: ' . $totStock,
                    'Total Stock Value: Rs. ' . number_format($totVal),
                ];
                break;

            case 'kisan_hisaab':
                $response['title'] = 'Farmer Account Report';
                $response['title_ur'] = 'کسان حساب رپورٹ (دینا باقی)';
                $farmers = Farmer::with('area')->orderBy('code', 'asc')->get();
                $rows = [];
                $totDena = 0;
                foreach ($farmers as $idx => $f) {
                    $fName = $f->name_en ?: ($f->name ?: $f->name_ur);
                    $areaName = $f->area ? ($f->area->name_en ?: $f->area->name_ur) : '—';
                    $totDena += (float) $f->current_balance;
                    $rows[] = [
                        'col1' => $idx + 1,
                        'col2' => '#' . $f->code,
                        'col3' => $fName,
                        'col4' => $areaName,
                        'col5' => $f->phone ?: '—',
                        'col6' => 'Rs. ' . number_format($f->opening_balance),
                        'col7' => 'Rs. ' . number_format($f->current_balance),
                    ];
                }
                $response['columns'] = ['#', 'Code', 'Farmer Name', 'Area', 'Phone', 'Previous Balance', 'Payable Balance'];
                $response['rows'] = $rows;
                $response['totals'] = ['Total Supplier Payable: Rs. ' . number_format($totDena)];
                break;

            case 'naqdi_print':
                $response['title'] = 'Naqdi Recovery Report';
                $response['title_ur'] = 'نقدی وصولی رپورٹ';
                $receipts = MerchantReceipt::with('merchant')->where('date', $date)->where('type', 'same_day_cash')->get();
                $totalAmt = 0;
                $rows = [];
                foreach ($receipts as $idx => $r) {
                    $totalAmt += (float)$r->amount;
                    $mName = $r->merchant ? ($r->merchant->name_en ?: ($r->merchant->name ?: $r->merchant->name_ur)) : 'Merchant';
                    $rows[] = [
                        'col1' => $idx + 1,
                        'col2' => '#' . ($r->merchant ? $r->merchant->code : '-'),
                        'col3' => $mName,
                        'col4' => 'Naqdi',
                        'col5' => $r->note ?: '—',
                        'col6' => 'Rs. ' . number_format($r->amount),
                    ];
                }
                $response['columns'] = ['#', 'Code', 'Merchant', 'Type', 'Detail', 'Amount'];
                $response['rows'] = $rows;
                $response['totals'] = ['Total Naqdi: Rs. ' . number_format($totalAmt)];
                break;

            case 'wasooli_print':
            case 'merchant_wasooli':
                $response['title'] = 'Payment Recovery Report';
                $response['title_ur'] = 'وصولی سمری رپورٹ';
                $receipts = MerchantReceipt::with('merchant')->where('date', $date)->where('type', 'recovery')->get();
                $totalAmt = 0;
                $rows = [];
                foreach ($receipts as $idx => $r) {
                    $totalAmt += (float)$r->amount;
                    $mName = $r->merchant ? ($r->merchant->name_en ?: ($r->merchant->name ?: $r->merchant->name_ur)) : 'Merchant';
                    $rows[] = [
                        'col1' => $idx + 1,
                        'col2' => '#' . ($r->merchant ? $r->merchant->code : '-'),
                        'col3' => $mName,
                        'col4' => 'Recovery',
                        'col5' => $r->note ?: '—',
                        'col6' => 'Rs. ' . number_format($r->amount),
                    ];
                }
                $response['columns'] = ['#', 'Code', 'Merchant', 'Type', 'Detail', 'Amount'];
                $response['rows'] = $rows;
                $response['totals'] = ['Total Wasooli: Rs. ' . number_format($totalAmt)];
                break;

            case 'merchant_amroza':
                $response['title'] = 'Merchant-wise Amroza Summary';
                $response['title_ur'] = 'مرچنٹ وار سیل سمری';
                $sales = AmrozaSale::with('merchant')->where('date', $date)->get();
                $grouped = [];
                $totalNag = 0; $totalAmt = 0;
                foreach ($sales as $s) {
                    $mId = $s->merchant_id;
                    if (!isset($grouped[$mId])) {
                        $mName = $s->merchant ? ($s->merchant->name_en ?: ($s->merchant->name ?: $s->merchant->name_ur)) : 'Merchant';
                        $grouped[$mId] = [
                            'code' => $s->merchant ? $s->merchant->code : '-',
                            'name' => $mName,
                            'nag' => 0,
                            'amount' => 0,
                        ];
                    }
                    $grouped[$mId]['nag'] += (int)$s->nag;
                    $grouped[$mId]['amount'] += (float)$s->gross_amount;
                    $totalNag += (int)$s->nag;
                    $totalAmt += (float)$s->gross_amount;
                }
                $rows = [];
                $i = 1;
                foreach ($grouped as $g) {
                    $rows[] = [
                        'col1' => $i++,
                        'col2' => '#' . $g['code'],
                        'col3' => $g['name'],
                        'col4' => $g['nag'],
                        'col5' => 'Rs. ' . number_format($g['amount']),
                    ];
                }
                $response['columns'] = ['#', 'Code', 'Merchant', 'Total Nag', 'Total Sale'];
                $response['rows'] = $rows;
                $response['totals'] = ['Total Nag: ' . $totalNag, 'Total Amount: Rs. ' . number_format($totalAmt)];
                break;

            case 'amroza_tafseel':
                $response['title'] = 'Amroza Tafseel (Sales Detail)';
                $response['title_ur'] = 'سیل کی پوری تفصیل';
                $sales = AmrozaSale::with(['merchant', 'item'])->whereBetween('date', [$fromDate, $toDate])->orderBy('date', 'desc')->get();
                $totalNag = 0; $totalAmt = 0;
                $rows = [];
                foreach ($sales as $idx => $s) {
                    $totalNag += (int)$s->nag;
                    $totalAmt += (float)$s->gross_amount;
                    $buyerName = $s->merchant ? ($s->merchant->name_en ?: ($s->merchant->name ?: $s->merchant->name_ur)) : 'Buyer';
                    $rawItem = $s->item ? ($s->item->name_en ?: ($s->item->name ?: $s->item->name_ur)) : 'Item';
                    $itemName = trim(preg_replace('/\s*\(.*?\)\s*/', '', $rawItem));
                    $rows[] = [
                        'col1' => $s->date instanceof \DateTimeInterface ? $s->date->format('Y-m-d') : substr((string)$s->date, 0, 10),
                        'col2' => '#' . ($s->merchant ? $s->merchant->code : '-'),
                        'col3' => $buyerName,
                        'col4' => $itemName,
                        'col5' => (int)$s->nag,
                        'col6' => (float)$s->weight ?: '—',
                        'col7' => 'Rs. ' . number_format($s->rate),
                        'col8' => 'Rs. ' . number_format($s->gross_amount),
                    ];
                }
                $response['columns'] = ['Date', 'Code', 'Buyer', 'Item', 'Nag', 'Weight', 'Rate', 'Amount'];
                $response['rows'] = $rows;
                $response['totals'] = ['Total Nag: ' . $totalNag, 'Total Amount: Rs. ' . number_format($totalAmt)];
                break;

            case 'wasooli_tafseel':
                $response['title'] = 'Recovery Detail Report';
                $response['title_ur'] = 'وصولی کی پوری تفصیل';
                $receipts = MerchantReceipt::with('merchant')->whereBetween('date', [$fromDate, $toDate])->orderBy('date', 'desc')->get();
                $totalAmt = 0;
                $rows = [];
                foreach ($receipts as $idx => $r) {
                    $totalAmt += (float)$r->amount;
                    $rows[] = [
                        'col1' => $r->date->format('Y-m-d'),
                        'col2' => '#' . ($r->merchant ? $r->merchant->code : '-'),
                        'col3' => $r->merchant ? ($r->merchant->name_ur ?: $r->merchant->name_en) : 'Merchant',
                        'col4' => $r->type === 'same_day_cash' ? 'Naqdi' : 'Recovery',
                        'col5' => $r->note ?: '—',
                        'col6' => 'Rs. ' . number_format($r->amount),
                    ];
                }
                $response['columns'] = ['Date', 'Code', 'Merchant', 'Type', 'Note', 'Amount'];
                $response['rows'] = $rows;
                $response['totals'] = ['Total Recovery: Rs. ' . number_format($totalAmt)];
                break;

            case 'amroza_wasooli':
                $response['title'] = 'Daily Sales & Recovery Combined Sheet';
                $response['title_ur'] = 'سیل اور وصولی شیٹ';
                $period = new \DatePeriod(new \DateTime($fromDate), new \DateInterval('P1D'), (new \DateTime($toDate))->modify('+1 day'));
                $rows = [];
                $totAmroza = 0; $totWasooli = 0;
                foreach ($period as $dt) {
                    $d = $dt->format('Y-m-d');
                    $am = (float)AmrozaSale::where('date', $d)->sum('gross_amount');
                    $was = (float)MerchantReceipt::where('date', $d)->where('type', 'recovery')->sum('amount');
                    $totAmroza += $am;
                    $totWasooli += $was;
                    $rows[] = [
                        'col1' => $d,
                        'col2' => 'Rs. ' . number_format($am),
                        'col3' => 'Rs. ' . number_format($was),
                        'col4' => 'Rs. ' . number_format($am - $was),
                    ];
                }
                $response['columns'] = ['Date', 'Daily Sales', 'Recoveries', 'Net Diff'];
                $response['rows'] = $rows;
                $response['totals'] = ['Total Sale: Rs. ' . number_format($totAmroza), 'Total Recovery: Rs. ' . number_format($totWasooli)];
                break;

            case 'farmer_bill':
                $response['title'] = 'Farmer Bills (Bijak)';
                $response['title_ur'] = 'کسان بلز (بیجک)';
                $bills = FarmerBill::with(['farmer', 'item'])->where('date', $date)->get();
                $totalGross = 0; $totalNet = 0;
                $rows = [];
                foreach ($bills as $idx => $b) {
                    $totalGross += (float)$b->gross_amount;
                    $totalNet += (float)$b->net_payable;
                    $farmerName = $b->farmer ? ($b->farmer->name_en ?: ($b->farmer->name ?: $b->farmer->name_ur)) : 'Farmer';
                    $rawItem = $b->item ? ($b->item->name_en ?: ($b->item->name ?: $b->item->name_ur)) : 'Item';
                    $itemName = trim(preg_replace('/\s*\(.*?\)\s*/', '', $rawItem));
                    $rows[] = [
                        'col1' => $idx + 1,
                        'col2' => '#' . ($b->farmer ? $b->farmer->code : '-'),
                        'col3' => $farmerName,
                        'col4' => $itemName,
                        'col5' => (int)$b->nag,
                        'col6' => 'Rs. ' . number_format($b->gross_amount),
                        'col7' => 'Rs. ' . number_format($b->commission_amount),
                        'col8' => 'Rs. ' . number_format($b->net_payable),
                    ];
                }
                $response['columns'] = ['#', 'Code', 'Farmer', 'Item', 'Nag', 'Gross', 'Commission', 'Net Payable'];
                $response['rows'] = $rows;
                $response['totals'] = ['Total Gross: Rs. ' . number_format($totalGross), 'Total Net Payable: Rs. ' . number_format($totalNet)];
                break;

            case 'farmer_list':
            case 'farmer_balances':
            case 'farmer_khata':
                $response['title'] = 'Farmers Balances List';
                $response['title_ur'] = 'کسان لسٹ و بقایا جات';
                $farmers = Farmer::with('area')->orderBy('code', 'asc')->get();
                $totalBal = 0;
                $rows = [];
                foreach ($farmers as $idx => $f) {
                    $totalBal += (float)$f->current_balance;
                    $fName = $f->name_en ?: ($f->name ?: $f->name_ur);
                    $areaName = $f->area ? ($f->area->name_en ?: $f->area->name_ur) : '—';
                    $rows[] = [
                        'col1' => $idx + 1,
                        'col2' => '#' . $f->code,
                        'col3' => $fName,
                        'col4' => $f->phone ?: '—',
                        'col5' => $areaName,
                        'col6' => 'Rs. ' . number_format($f->opening_balance),
                        'col7' => 'Rs. ' . number_format($f->current_balance),
                    ];
                }
                $response['columns'] = ['#', 'Code', 'Farmer Name', 'Phone', 'Area', 'Sabiqa', 'Current Baqaya'];
                $response['rows'] = $rows;
                $response['totals'] = ['Total Farmer Balance: Rs. ' . number_format($totalBal)];
                break;

            case 'farmer_marks':
                $response['title'] = 'Farmer Marks List';
                $response['title_ur'] = 'کسان مارکس و باڑیاں';
                $marks = FarmerMark::with('farmer')->orderBy('code', 'asc')->get();
                $rows = [];
                foreach ($marks as $idx => $m) {
                    $markName = $m->name_en ?: ($m->name ?: $m->name_ur);
                    $farmerName = $m->farmer ? ($m->farmer->name_en ?: ($m->farmer->name ?: $m->farmer->name_ur)) : '—';
                    $rows[] = [
                        'col1' => $idx + 1,
                        'col2' => '#' . $m->code,
                        'col3' => $markName,
                        'col4' => $farmerName,
                        'col5' => '#' . ($m->farmer ? $m->farmer->code : '-'),
                    ];
                }
                $response['columns'] = ['#', 'Mark Code', 'Mark Name', 'Farmer', 'Farmer Code'];
                $response['rows'] = $rows;
                $response['totals'] = ['Total Marks: ' . count($rows)];
                break;

            case 'general_ledger':
            case 'cash_book':
            default:
                $response['title'] = 'General Ledger / Roker';
                $response['title_ur'] = 'جنرل لیجر (روکڑ)';
                // Fetch daily transactions
                $cashSales = (float)AmrozaSale::where('date', $date)->where(function ($q) {
                    $q->where('payment_type', 'naqdi')->orWhereHas('merchant', fn($m) => $m->where('code', 1));
                })->sum('gross_amount');
                $wasooli = (float)MerchantReceipt::where('date', $date)->where('type', 'recovery')->sum('amount');
                $expenses = Expense::where('date', $date)->get();

                $rows = [
                    ['col1' => $date, 'col2' => 'Aaj ki Naqdi', 'col3' => 'Cash sales', 'col4' => 'Rs. ' . number_format($cashSales), 'col5' => '—'],
                    ['col1' => $date, 'col2' => 'Aaj ki Wasooli', 'col3' => 'Recoveries', 'col4' => 'Rs. ' . number_format($wasooli), 'col5' => '—'],
                ];
                $totJama = $cashSales + $wasooli;
                $totBanam = 0;
                foreach ($expenses as $e) {
                    $totBanam += (float)$e->amount;
                    $rows[] = [
                        'col1' => $date,
                        'col2' => $e->name,
                        'col3' => $e->note ?: 'Expense',
                        'col4' => '—',
                        'col5' => 'Rs. ' . number_format($e->amount),
                    ];
                }
                $response['columns'] = ['Date', 'Name', 'Detail', 'Jama', 'Banam'];
                $response['rows'] = $rows;
                $response['totals'] = ['Total Jama: Rs. ' . number_format($totJama), 'Total Banam: Rs. ' . number_format($totBanam), 'Net Balance: Rs. ' . number_format($totJama - $totBanam)];
                break;
        }

        return response()->json($response);
    }

    /**
     * Merchant Khata (Customer Ledger)
     */
    /**
     * Merchant Khata Roznamcha & Statement
     */
    public function merchantKhata(Request $request)
    {
        $today = date('Y-m-d');
        $activeMerchants = Merchant::where('status', 'active')->where('code', '!=', 1)->orderBy('code', 'asc')->get();

        // Top 4 Summary Cards (Live from database)
        $totalMarketReceivable = (float) $activeMerchants->where('current_balance', '>', 0)->sum('current_balance');
        $debtCustomersCount = $activeMerchants->where('current_balance', '>', 0)->count();
        $totalCustomersCount = $activeMerchants->count();

        $todayCreditSale = (float) AmrozaSale::whereDate('date', $today)
            ->where(function ($q) {
                $q->where('payment_type', 'udhaar')
                  ->orWhere('payment_type', 'split');
            })
            ->sum(DB::raw('CASE WHEN payment_type = "split" THEN udhaar_amount ELSE gross_amount END'));

        $todayRecovery = (float) MerchantReceipt::whereDate('date', $today)->sum('amount');

        $topSummary = [
            'total_receivable' => round($totalMarketReceivable, 2),
            'debt_customers_count' => $debtCustomersCount,
            'total_customers' => $totalCustomersCount,
            'today_credit_sale' => round($todayCreditSale, 2),
            'today_recovery' => round($todayRecovery, 2),
        ];

        $merchantsData = $activeMerchants->map(function ($m) {
            return [
                'id' => $m->id,
                'code' => $m->code,
                'name' => $m->name_en ?: ($m->name ?: $m->name_ur),
                'name_en' => $m->name_en,
                'name_ur' => $m->name_ur,
                'phone' => $m->phone ?: '',
                'city' => $m->city ?: 'Mandi',
                'customer_type' => $m->customer_type ?: 'Shopkeeper',
                'credit_limit' => (float)($m->credit_limit ?? 50000),
                'balance' => (float)$m->current_balance,
                'opening_balance' => (float)$m->opening_balance,
            ];
        })->values();

        $selectedMerchantId = (int) $request->query('merchant_id', $activeMerchants->first()?->id ?? 0);
        $selectedMerchant = $activeMerchants->firstWhere('id', $selectedMerchantId) 
            ?? $activeMerchants->firstWhere('code', $selectedMerchantId) 
            ?? $activeMerchants->first();

        $fromDate = $request->query('from_date', date('Y-m-01'));
        $toDate = $request->query('to_date', date('Y-m-d'));

        if (!$selectedMerchant) {
            return Inertia::render('merchants/khata/index', [
                'merchants' => [],
                'selectedMerchantId' => 0,
                'selectedMerchant' => null,
                'topSummary' => $topSummary,
                'statement' => [
                    'entries' => [],
                    'total_debit' => 0,
                    'total_credit' => 0,
                    'final_balance' => 0,
                ],
                'filters' => ['from_date' => $fromDate, 'to_date' => $toDate],
            ]);
        }

        // Prior sales and receipts before fromDate for Sabiqa Baqaya
        $priorSales = (float) AmrozaSale::where('merchant_id', $selectedMerchant->id)
            ->where('date', '<', $fromDate)
            ->where(function ($q) {
                $q->where('payment_type', 'udhaar')
                  ->orWhere('payment_type', 'split');
            })
            ->sum(DB::raw('CASE WHEN payment_type = "split" THEN udhaar_amount ELSE gross_amount END'));

        $priorWasooli = (float) MerchantReceipt::where('merchant_id', $selectedMerchant->id)
            ->where('date', '<', $fromDate)
            ->sum('amount');

        $openingBal = (float) $selectedMerchant->opening_balance;
        $runningBalance = round($openingBal + $priorSales - $priorWasooli, 2);
        $initialSabqa = $runningBalance;

        // Sales and receipts in date range
        $sales = AmrozaSale::with('item')
            ->where('merchant_id', $selectedMerchant->id)
            ->whereBetween('date', [$fromDate, $toDate])
            ->get();

        $receipts = MerchantReceipt::where('merchant_id', $selectedMerchant->id)
            ->whereBetween('date', [$fromDate, $toDate])
            ->get();

        $entries = [];

        // If prior balance exists, show Sabiqa entry
        if ($initialSabqa != 0) {
            $entries[] = [
                'id' => 'sabiqa_0',
                'entry_date' => $fromDate,
                'description' => 'Sabiqa Baqaya (Opening Balance)',
                'ref_type' => 'SABIQA',
                'entry_type' => $initialSabqa >= 0 ? 'debit' : 'credit',
                'debit' => $initialSabqa >= 0 ? $initialSabqa : 0,
                'credit' => $initialSabqa < 0 ? abs($initialSabqa) : 0,
                'amount' => abs($initialSabqa),
                'balance_after' => $runningBalance,
                'timestamp' => strtotime($fromDate) - 1,
            ];
        }

        // Add sales entries
        foreach ($sales as $s) {
            $dateStr = $s->date instanceof \DateTimeInterface ? $s->date->format('Y-m-d') : substr((string)$s->date, 0, 10);
            $gross = (float)($s->gross_amount ?? ($s->nag * $s->rate));
            $udhaarPortion = (float)($s->payment_type === 'split' ? ($s->udhaar_amount ?? 0) : ($s->payment_type === 'udhaar' ? $gross : 0));
            $cashSettled = (float)($s->payment_type === 'split' ? ($s->cash_received ?? 0) : ($s->payment_type === 'cash' || $s->payment_type === 'naqdi' ? $gross : 0));

            // In ledger, debit is sale amount and immediate cash payment is credit
            $debit = $gross;
            $credit = $cashSettled;
            $runningBalance = round($runningBalance + $debit - $credit, 2);

            $entries[] = [
                'id' => 'sale_' . $s->id,
                'entry_date' => $dateStr,
                'description' => "Sales Invoice #INV-{$s->id} (Gross: Rs " . number_format($gross, 1) . ")",
                'ref_type' => 'SALE',
                'entry_type' => 'debit',
                'debit' => $debit,
                'credit' => $credit,
                'amount' => $debit,
                'balance_after' => $runningBalance,
                'timestamp' => strtotime($dateStr) + $s->id,
            ];
        }

        // Add receipts entries
        foreach ($receipts as $r) {
            $dateStr = $r->date instanceof \DateTimeInterface ? $r->date->format('Y-m-d') : substr((string)$r->date, 0, 10);
            $credit = (float)$r->amount;
            $runningBalance = round($runningBalance - $credit, 2);
            $rcptNum = $r->receipt_no ?: $r->id;
            $mode = $r->payment_mode ? ucfirst($r->payment_mode) : 'Cash';
            $noteStr = $r->notes ? " - {$r->notes}" : '';

            $entries[] = [
                'id' => 'rcpt_' . $r->id,
                'entry_date' => $dateStr,
                'description' => "Recovery Receipt #REC-{$rcptNum} ({$mode}{$noteStr})",
                'ref_type' => 'WASOOLI',
                'entry_type' => 'credit',
                'debit' => 0,
                'credit' => $credit,
                'amount' => $credit,
                'balance_after' => $runningBalance,
                'timestamp' => strtotime($dateStr) + 50000 + $r->id,
            ];
        }

        // Sort chronologically
        usort($entries, fn($a, $b) => $a['timestamp'] <=> $b['timestamp']);

        $totalDebit = array_sum(array_column($entries, 'debit'));
        $totalCredit = array_sum(array_column($entries, 'credit'));
        $finalBalance = (float)$selectedMerchant->current_balance;

        $selectedMerchantArray = [
            'id' => $selectedMerchant->id,
            'code' => $selectedMerchant->code,
            'name' => $selectedMerchant->name_en ?: ($selectedMerchant->name ?: $selectedMerchant->name_ur),
            'name_en' => $selectedMerchant->name_en,
            'name_ur' => $selectedMerchant->name_ur,
            'phone' => $selectedMerchant->phone ?: '',
            'city' => $selectedMerchant->city ?: 'Mandi',
            'customer_type' => $selectedMerchant->customer_type ?: 'Shopkeeper',
            'credit_limit' => (float)($selectedMerchant->credit_limit ?? 50000),
            'balance' => $finalBalance,
            'opening_balance' => (float)$selectedMerchant->opening_balance,
        ];

        return Inertia::render('merchants/khata/index', [
            'merchants' => $merchantsData,
            'selectedMerchantId' => $selectedMerchant->id,
            'selectedMerchant' => $selectedMerchantArray,
            'topSummary' => $topSummary,
            'statement' => [
                'entries' => $entries,
                'total_debit' => round($totalDebit, 2),
                'total_credit' => round($totalCredit, 2),
                'final_balance' => round($finalBalance, 2),
            ],
            // Backwards-compatible fields
            'summary' => [
                'baqaya' => round($finalBalance, 2),
                'sabqa' => $initialSabqa,
                'total_sale' => round($totalDebit, 2),
                'total_wasooli' => round($totalCredit, 2),
            ],
            'rows' => $entries,
            'filters' => [
                'from_date' => $fromDate,
                'to_date' => $toDate,
            ],
        ]);
    }
}
