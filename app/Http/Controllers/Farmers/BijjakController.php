<?php

namespace App\Http\Controllers\Farmers;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use App\Models\FarmerBill;
use App\Models\Item;
use Illuminate\Http\Request;
use Inertia\Inertia;

class BijjakController extends Controller
{
    public function index(Request $request)
    {
        $date = $request->query('date', date('Y-m-d'));

        // Load farmers with their area and marks
        $farmers = Farmer::where('status', 'active')
            ->with([
                'area:id,name_en,name_ur',
                'marks' => function ($q) {
                    $q->orderBy('code', 'asc');
                }
            ])
            ->select('id', 'code', 'name_en', 'name_ur', 'phone', 'area_id', 'current_balance')
            ->orderBy('code', 'asc')
            ->get();

        // Load active items
        $items = Item::where('status', 'active')
            ->select('id', 'name_en', 'name_ur', 'unit', 'default_rate', 'default_bardana')
            ->orderBy('name_en', 'asc')
            ->get();

        // Load bills for selected date
        $bills = FarmerBill::with([
            'farmer:id,code,name_en,name_ur',
            'farmerMark:id,code,name_en,name_ur',
            'item:id,name_en,name_ur,unit',
        ])
            ->whereDate('date', $date)
            ->orderBy('id', 'desc')
            ->get();

        // Daily summary
        $summary = [
            'total_bills'      => $bills->count(),
            'total_nag'        => $bills->sum('nag'),
            'total_gross'      => $bills->sum('gross_amount'),
            'total_commission' => $bills->sum('commission_amount'),
            'total_bardana'    => $bills->sum('bardana_amount'),
            'total_net'        => $bills->sum('net_amount'),
        ];

        return Inertia::render('farmers/bijak/index', [
            'farmers'    => $farmers,
            'items'      => $items,
            'bills'      => $bills,
            'summary'    => $summary,
            'filters'    => ['date' => $date],
            'saved_bill' => session('saved_bill'),
        ]);
    }

    public function store(Request $request)
    {
        if ($request->has('items') && is_array($request->input('items'))) {
            $validated = $request->validate([
                'date'            => 'nullable|date',
                'farmer_id'       => 'required|exists:farmers,id',
                'farmer_mark_id'  => 'nullable|exists:farmer_marks,id',
                'truck_no'        => 'nullable|string|max:100',
                'items'           => 'required|array|min:1',
                'items.*.item_id' => 'required|exists:items,id',
                'items.*.nag'     => 'required|numeric|min:0',
                'items.*.weight'  => 'nullable|numeric|min:0',
                'items.*.rate'    => 'required|numeric|min:0',
                'commission_pct'  => 'required|numeric|min:0|max:100',
                'mazdoori_rate'   => 'nullable|numeric|min:0',
                'mazdoori'        => 'nullable|numeric|min:0',
                'kiraya'          => 'nullable|numeric|min:0',
                'market_fee_pct'  => 'nullable|numeric|min:0|max:100',
                'market_fee'      => 'nullable|numeric|min:0',
                'note'            => 'nullable|string|max:500',
            ]);

            $date          = $validated['date'] ?? date('Y-m-d');
            $commPct       = (float) $validated['commission_pct'];
            $kiraya        = (float) ($validated['kiraya'] ?? 0);
            $mazdooriRate  = isset($validated['mazdoori_rate']) ? (float)$validated['mazdoori_rate'] : 0;
            $marketFeePct  = isset($validated['market_fee_pct']) ? (float)$validated['market_fee_pct'] : 0;

            $itemsData = $validated['items'];
            $totalGross = 0;
            $totalNag = 0;
            $totalWeight = 0;

            foreach ($itemsData as $it) {
                $n = (float) $it['nag'];
                $w = (float) ($it['weight'] ?? 0);
                $r = (float) $it['rate'];
                $g = $w > 0 ? round($w * $r, 2) : round($n * $r, 2);
                $totalGross += $g;
                $totalNag += $n;
                $totalWeight += $w;
            }

            $totalCommission = round($totalGross * $commPct / 100, 2);
            $totalMazdoori   = isset($validated['mazdoori']) && $validated['mazdoori'] !== '' 
                ? (float) $validated['mazdoori'] 
                : round($totalNag * $mazdooriRate, 2);
            $totalMarketFee  = isset($validated['market_fee']) && $validated['market_fee'] !== ''
                ? (float) $validated['market_fee']
                : round($totalGross * $marketFeePct / 100, 2);
            $totalCharges    = round($totalCommission + $totalMazdoori + $kiraya + $totalMarketFee, 2);
            $totalNet        = round($totalGross - $totalCharges, 2);

            $createdBills = [];
            foreach ($itemsData as $idx => $it) {
                $n = (float) $it['nag'];
                $w = (float) ($it['weight'] ?? 0);
                $r = (float) $it['rate'];
                $g = $w > 0 ? round($w * $r, 2) : round($n * $r, 2);
                $itemComm = round($g * $commPct / 100, 2);
                $itemMaz = round($n * $mazdooriRate, 2);
                $itemFee = round($g * $marketFeePct / 100, 2);
                $itemKiraya = ($idx === 0) ? $kiraya : 0;
                $itemNet = round($g - $itemComm - $itemMaz - $itemFee - $itemKiraya, 2);

                $createdBills[] = FarmerBill::create([
                    'date'              => $date,
                    'farmer_id'         => $validated['farmer_id'],
                    'farmer_mark_id'    => $validated['farmer_mark_id'] ?? null,
                    'truck_no'          => $validated['truck_no'] ?? null,
                    'item_id'           => $it['item_id'],
                    'nag'               => $n,
                    'weight'            => $w,
                    'rate'              => $r,
                    'commission_pct'    => $commPct,
                    'bardana_per_nag'   => 0,
                    'gross_amount'      => $g,
                    'commission_amount' => $itemComm,
                    'bardana_amount'    => 0,
                    'kiraya'            => $itemKiraya,
                    'mazdoori'          => $itemMaz,
                    'market_fee'        => $itemFee,
                    'net_amount'        => $itemNet,
                    'note'              => $validated['note'] ?? null,
                    'created_by'        => auth()->id(),
                ]);
            }

            $firstBill = $createdBills[0];
            $farmer = Farmer::find($validated['farmer_id']);
            if ($farmer) {
                $farmer->increment('current_balance', $totalNet);
            }

            $farmerName = $farmer ? ($farmer->name_en ?: $farmer->name_ur) : 'Farmer';
            $areaName = $farmer && $farmer->area ? ($farmer->area->name_en ?: $farmer->area->name_ur) : '';
            $fullFarmerTitle = $areaName ? "{$farmerName} - {$areaName}" : $farmerName;
            $billNo = 'BJ-' . str_pad($firstBill->id, 4, '0', STR_PAD_LEFT);

            return redirect()->back()->with([
                'success'    => 'Farmer bill saved successfully.',
                'saved_bill' => [
                    'id'           => $firstBill->id,
                    'bill_no'      => $billNo,
                    'farmer_name'  => $fullFarmerTitle,
                    'net_amount'   => $totalNet,
                    'gross_amount' => $totalGross,
                    'total_nag'    => $totalNag,
                    'total_weight' => $totalWeight,
                    'total_charges'=> $totalCharges,
                    'date'         => $date,
                ],
            ]);
        }

        $validated = $request->validate([
            'date'            => 'nullable|date',
            'farmer_id'       => 'required|exists:farmers,id',
            'farmer_mark_id'  => 'nullable|exists:farmer_marks,id',
            'truck_no'        => 'nullable|string|max:100',
            'item_id'         => 'required|exists:items,id',
            'nag'             => 'required|numeric|min:0',
            'weight'          => 'nullable|numeric|min:0',
            'rate'            => 'required|numeric|min:0',
            'commission_pct'  => 'required|numeric|min:0|max:100',
            'bardana_amount'  => 'nullable|numeric|min:0',
            'kiraya'          => 'nullable|numeric|min:0',
            'mazdoori'        => 'nullable|numeric|min:0',
            'market_fee'      => 'nullable|numeric|min:0',
            'note'            => 'nullable|string|max:500',
        ]);

        $date            = $validated['date'] ?? date('Y-m-d');
        $nag             = (float) $validated['nag'];
        $weight          = (float) ($validated['weight'] ?? 0);
        $rate            = (float) $validated['rate'];
        $commPct         = (float) $validated['commission_pct'];
        $bardanaAmount   = (float) ($validated['bardana_amount'] ?? 0);
        $kiraya          = (float) ($validated['kiraya'] ?? 0);
        $mazdoori        = (float) ($validated['mazdoori'] ?? 0);
        $marketFee       = (float) ($validated['market_fee'] ?? 0);

        // Calculation: if weight > 0, gross = weight * rate, else nag * rate
        $gross           = $weight > 0 ? round($weight * $rate, 2) : round($nag * $rate, 2);
        $commission      = round($gross * $commPct / 100, 2);
        $totalExpenses   = round($bardanaAmount + $kiraya + $mazdoori + $marketFee, 2);
        $net             = round($gross - $commission - $totalExpenses, 2);

        $bill = FarmerBill::create([
            'date'              => $date,
            'farmer_id'         => $validated['farmer_id'],
            'farmer_mark_id'    => $validated['farmer_mark_id'] ?? null,
            'truck_no'          => $validated['truck_no'] ?? null,
            'item_id'           => $validated['item_id'],
            'nag'               => $nag,
            'weight'            => $weight,
            'rate'              => $rate,
            'commission_pct'    => $commPct,
            'bardana_per_nag'   => $nag > 0 ? round($bardanaAmount / $nag, 2) : 0,
            'gross_amount'      => $gross,
            'commission_amount' => $commission,
            'bardana_amount'    => $bardanaAmount,
            'kiraya'            => $kiraya,
            'mazdoori'          => $mazdoori,
            'market_fee'        => $marketFee,
            'net_amount'        => $net,
            'note'              => $validated['note'] ?? null,
            'created_by'        => auth()->id(),
        ]);

        // Update farmer balance
        $farmer = Farmer::find($validated['farmer_id']);
        if ($farmer) {
            $farmer->increment('current_balance', $net);
        }

        $farmerName = $farmer ? ($farmer->name_en ?: $farmer->name_ur) : 'Farmer';
        $areaName = $farmer && $farmer->area ? ($farmer->area->name_en ?: $farmer->area->name_ur) : '';
        $fullFarmerTitle = $areaName ? "{$farmerName} - {$areaName}" : $farmerName;

        $billNo = 'BJ-' . str_pad($bill->id, 4, '0', STR_PAD_LEFT);

        return redirect()->back()->with([
            'success'    => 'Farmer bill saved successfully.',
            'saved_bill' => [
                'id'          => $bill->id,
                'bill_no'     => $billNo,
                'farmer_name' => $fullFarmerTitle,
                'net_amount'  => $net,
                'gross_amount'=> $gross,
                'date'        => $date,
            ],
        ]);
    }

    public function destroy(int $id)
    {
        $bill = FarmerBill::findOrFail($id);
        $net = (float) $bill->net_amount;
        $farmerId = $bill->farmer_id;

        $bill->delete();

        // Revert balance
        $farmer = Farmer::find($farmerId);
        if ($farmer) {
            $farmer->decrement('current_balance', $net);
        }

        return redirect()->back()->with('success', 'Bill deleted.');
    }
}
