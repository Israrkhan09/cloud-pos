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
use Illuminate\Http\Request;
use Inertia\Inertia;

class MerchantReportController extends Controller
{
    /**
     * Reports Index
     */
    public function index()
    {
        return Inertia::render('reports/index');
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
                $response['columns'] = ['#', 'Item', 'Nag Becha', 'Sale Rate', 'Total Sale', 'Kisan Cost', 'Munafa / Nuqsan'];
                $response['rows'] = $rows;
                $response['totals'] = [
                    'Total Sale: Rs. ' . number_format($totSale),
                    'Total Cost: Rs. ' . number_format($totCost),
                    'Net Munafa: Rs. ' . number_format($totProfit),
                ];
                break;

            case 'udhaar_report':
                $response['title'] = 'Udhaar Report';
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
                $response['columns'] = ['#', 'Code', 'Merchant Name', 'Phone', 'Sabiqa', 'Current Udhaar Baqaya', 'Status'];
                $response['rows'] = $rows;
                $response['totals'] = ['Total Udhaar Baqaya: Rs. ' . number_format($totBaqaya)];
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
                    $status = $stock <= 0 ? 'Khatam' : ($stock < 20 ? 'Kam Stock' : 'Theek');
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
                $response['title'] = 'Kisan Hisaab Report';
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
                $response['columns'] = ['#', 'Code', 'Kisan Name', 'Area', 'Phone', 'Sabiqa', 'Dena Baqi'];
                $response['rows'] = $rows;
                $response['totals'] = ['Total Kisan Baqaya (Dena Baqi): Rs. ' . number_format($totDena)];
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
                $response['title'] = 'Wasooli (Recovery) Report';
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
                $response['title'] = 'Wasooli Tafseel (Recovery Detail)';
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
                $response['title'] = 'Amroza / Wasooli Combined Sheet';
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
                $response['columns'] = ['Date', 'Amroza (Sale)', 'Wasooli (Recovery)', 'Net Diff'];
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
    public function merchantKhata(Request $request)
    {
        $merchants = Merchant::where('status', 'active')->where('code', '!=', 1)->orderBy('code', 'asc')->get();

        $selectedMerchantId = (int) $request->query('merchant_id', $merchants->first()?->id ?? 0);
        $selectedMerchant = Merchant::where('code', '!=', 1)
            ->where(function ($q) use ($selectedMerchantId) {
                $q->where('id', $selectedMerchantId)->orWhere('code', $selectedMerchantId);
            })
            ->first() ?? $merchants->first();

        $fromDate = $request->query('from_date', date('Y-m-01'));
        $toDate = $request->query('to_date', date('Y-m-d'));

        if (!$selectedMerchant) {
            return Inertia::render('merchants/khata/index', [
                'merchants' => [],
                'selectedMerchantId' => 0,
                'selectedMerchant' => null,
                'summary' => ['baqaya' => 0, 'sabqa' => 0, 'total_sale' => 0, 'total_wasooli' => 0],
                'rows' => [],
                'filters' => ['from_date' => $fromDate, 'to_date' => $toDate],
            ]);
        }

        // Prior sales and receipts before fromDate (Only Udhaar sales affect ledger)
        $priorSales = (float) AmrozaSale::where('merchant_id', $selectedMerchant->id)
            ->where('date', '<', $fromDate)
            ->where(function ($q) {
                $q->where('payment_type', 'udhaar')
                  ->orWhereNull('payment_type');
            })
            ->sum('gross_amount');
        $priorWasooli = (float) MerchantReceipt::where('merchant_id', $selectedMerchant->id)
            ->where('date', '<', $fromDate)
            ->sum('amount');
        $openingBal = (float) $selectedMerchant->opening_balance;
        $runningSabqa = round($openingBal + $priorSales - $priorWasooli, 2);
        $initialSabqa = $runningSabqa;

        // Sales and receipts in date range (Include all sales and receipts for complete ledger)
        $sales = AmrozaSale::where('merchant_id', $selectedMerchant->id)
            ->whereBetween('date', [$fromDate, $toDate])
            ->get();
        $receipts = MerchantReceipt::where('merchant_id', $selectedMerchant->id)
            ->whereBetween('date', [$fromDate, $toDate])
            ->get();

        // Get unique sorted dates
        $dateStrings = [];
        foreach ($sales as $s) {
            $dateStrings[] = $s->date instanceof \DateTimeInterface ? $s->date->format('Y-m-d') : substr((string)$s->date, 0, 10);
        }
        foreach ($receipts as $r) {
            $dateStrings[] = $r->date instanceof \DateTimeInterface ? $r->date->format('Y-m-d') : substr((string)$r->date, 0, 10);
        }
        $dates = array_values(array_unique($dateStrings));
        sort($dates);

        $rows = [];
        $totalSale = 0;
        $totalWasooli = 0;

        foreach ($dates as $d) {
            $daySale = 0;
            $dayCashBankSettled = 0;
            foreach ($sales as $s) {
                $sd = $s->date instanceof \DateTimeInterface ? $s->date->format('Y-m-d') : substr((string)$s->date, 0, 10);
                if ($sd === $d) {
                    $daySale += (float) $s->gross_amount;
                    if (in_array($s->payment_type, ['naqdi', 'bank'])) {
                        $dayCashBankSettled += (float) $s->gross_amount;
                    }
                }
            }

            $dayWasooli = 0;
            foreach ($receipts as $r) {
                $rd = $r->date instanceof \DateTimeInterface ? $r->date->format('Y-m-d') : substr((string)$r->date, 0, 10);
                if ($rd === $d) {
                    $dayWasooli += (float) $r->amount;
                }
            }

            // Total deduction includes recovery wasooli receipts plus immediate settlement for cash/bank sales
            $effectiveWasooli = $dayWasooli + $dayCashBankSettled;
            $dayBaqaya = round($runningSabqa + $daySale - $effectiveWasooli, 2);

            $rows[] = [
                'date' => date('d-m-Y', strtotime($d)),
                'raw_date' => $d,
                'sabqa' => $runningSabqa,
                'sale' => $daySale,
                'wasooli' => $effectiveWasooli,
                'recovery_wasooli' => $dayWasooli,
                'cash_bank_sale' => $dayCashBankSettled,
                'baqaya' => $dayBaqaya,
            ];

            $totalSale += $daySale;
            $totalWasooli += $effectiveWasooli;
            $runningSabqa = $dayBaqaya;
        }

        $finalBaqaya = $runningSabqa;

        return Inertia::render('merchants/khata/index', [
            'merchants' => $merchants,
            'selectedMerchantId' => $selectedMerchant->id,
            'selectedMerchant' => $selectedMerchant,
            'summary' => [
                'baqaya' => $finalBaqaya,
                'sabqa' => $initialSabqa,
                'total_sale' => round($totalSale, 2),
                'total_wasooli' => round($totalWasooli, 2),
            ],
            'rows' => $rows,
            'filters' => [
                'from_date' => $fromDate,
                'to_date' => $toDate,
            ],
        ]);
    }
}
