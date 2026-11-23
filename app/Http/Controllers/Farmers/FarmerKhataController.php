<?php

namespace App\Http\Controllers\Farmers;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use App\Models\FarmerBill;
use App\Models\Item;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class FarmerKhataController extends Controller
{
    /**
     * Backward-compatible legacy mark-wise khata index
     */
    public function index(Request $request)
    {
        return redirect()->route('farmers.khata_page');
    }

    /**
     * Mandi Bismillah style Farmer Khata Page (/farmer-khata)
     */
    public function farmerKhataPage(Request $request)
    {
        $selectedFarmerId = $request->query('farmer_id', 'all');

        // All active farmers
        $farmers = Farmer::where('status', 'active')
            ->with('area')
            ->orderBy('code', 'asc')
            ->get()
            ->map(function ($f) {
                return [
                    'id' => $f->id,
                    'code' => $f->code ? "#{$f->code}" : "#{$f->id}",
                    'name' => $f->name_en ?: ($f->name ?: $f->name_ur),
                    'phone' => $f->phone ?: '',
                    'area' => $f->area ? ($f->area->name_en ?: $f->area->name_ur) : '—',
                    'balance' => (float) ($f->current_balance ?? 0),
                    'opening_balance' => (float) ($f->opening_balance ?? 0),
                ];
            });

        // 4 Live Summary Cards
        $totalBalanceDue = (float) Farmer::where('status', 'active')->where('current_balance', '>', 0)->sum('current_balance');
        $totalNags = (int) FarmerBill::sum('nag');
        $totalEntries = (int) FarmerBill::count();
        $totalCommission = (float) FarmerBill::sum('commission_amount');
        $totalPaid = (float) FarmerBill::sum('paid_amount');
        $totalGross = (float) FarmerBill::sum('gross_amount');
        $totalNet = (float) FarmerBill::sum('net_amount');

        $kisanSummary = [
            'total_balance_due' => round($totalBalanceDue, 2),
            'total_nags' => $totalNags,
            'total_entries' => $totalEntries,
            'total_commission' => round($totalCommission, 2),
            'total_paid' => round($totalPaid, 2),
            'total_gross' => round($totalGross, 2),
            'total_net' => round($totalNet, 2),
        ];

        // Query bills
        $billsQuery = FarmerBill::with(['farmer.area', 'item'])
            ->orderBy('date', 'desc')
            ->orderBy('id', 'desc');

        if ($selectedFarmerId !== 'all' && is_numeric($selectedFarmerId)) {
            $billsQuery->where('farmer_id', (int) $selectedFarmerId);
        }

        $bills = $billsQuery->get();

        $entries = $bills->map(function ($b) {
            $farmerName = $b->farmer ? ($b->farmer->name_en ?: $b->farmer->name_ur) : 'Kisan';
            $itemName = $b->item ? ($b->item->name_en ?: $b->item->name_ur) : 'Sabzi';
            $dateStr = $b->date instanceof \DateTimeInterface ? $b->date->format('Y-m-d') : substr((string) $b->date, 0, 10);
            $gross = (float) $b->gross_amount;
            $comm = (float) $b->commission_amount;
            $net = (float) $b->net_amount;
            $paid = (float) ($b->paid_amount ?? 0);
            $remaining = max(0, round($net - $paid, 2));

            return [
                'id' => $b->id,
                'entry_no' => 'BJ-' . str_pad($b->id, 4, '0', STR_PAD_LEFT),
                'kisan_id' => $b->farmer_id,
                'kisan_name' => $farmerName,
                'kisan_phone' => $b->farmer?->phone ?: '',
                'kisan_area' => $b->farmer && $b->farmer->area ? ($b->farmer->area->name_en ?: $b->farmer->area->name_ur) : '',
                'entry_date' => $dateStr,
                'item_name' => $itemName,
                'nag_quantity' => (int) $b->nag,
                'gross_sale' => $gross,
                'commission_percent' => (float) $b->commission_pct,
                'commission_amount' => $comm,
                'net_payable' => $net,
                'paid_amount' => $paid,
                'remaining_balance' => $remaining,
                'truck_no' => $b->truck_no ?: '—',
                'rate' => (float) $b->rate,
                'kiraya' => (float) ($b->kiraya ?? 0),
                'mazdoori' => (float) ($b->mazdoori ?? 0),
                'market_fee' => (float) ($b->market_fee ?? 0),
                'status' => $remaining == 0 ? 'ada' : ($paid > 0 ? 'juzwi' : 'baqi'),
            ];
        });

        // Selected Farmer object
        $selectedFarmer = $selectedFarmerId !== 'all' ? $farmers->firstWhere('id', (int) $selectedFarmerId) : null;

        $accounts = [
            ['id' => 1, 'account_name' => 'Naqad Galla (Cash Counter)'],
            ['id' => 2, 'account_name' => 'Meezan Bank Mandi Branch'],
            ['id' => 3, 'account_name' => 'EasyPaisa Israr'],
            ['id' => 4, 'account_name' => 'JazzCash Israr'],
            ['id' => 5, 'account_name' => 'HBL Aadhat Current Account'],
        ];

        return Inertia::render('farmers/khata-mandi/index', [
            'farmers' => $farmers,
            'entries' => $entries,
            'kisanSummary' => $kisanSummary,
            'selectedFarmerId' => $selectedFarmerId,
            'selectedFarmer' => $selectedFarmer,
            'accounts' => $accounts,
        ]);
    }

    /**
     * Record payment to farmer (Ada Karein)
     */
    public function recordPayment(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'bill_id' => 'required|exists:farmer_bills,id',
            'amount' => 'required|numeric|min:0.01',
            'account' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:500',
        ]);

        $bill = FarmerBill::findOrFail($validated['bill_id']);
        $payAmount = (float) $validated['amount'];

        $currentRemaining = max(0, (float) $bill->net_amount - (float) ($bill->paid_amount ?? 0));
        if ($payAmount > $currentRemaining) {
            $payAmount = $currentRemaining;
        }

        $bill->increment('paid_amount', $payAmount);

        // Deduct from farmer current_balance
        if ($bill->farmer_id) {
            $farmer = Farmer::find($bill->farmer_id);
            if ($farmer) {
                $farmer->decrement('current_balance', $payAmount);
            }
        }

        return redirect()->back()->with('success', 'Kisan ko baqaya raqam kamyabi se ada kar di gayi!');
    }

    /**
     * Get single parchi for preview/modal
     */
    public function getParchi(int $id)
    {
        $bill = FarmerBill::with(['farmer.area', 'item'])->findOrFail($id);

        $farmer = $bill->farmer;
        $farmerName = $farmer ? ($farmer->name_en ?: $farmer->name_ur) : 'Kisan';
        $areaName = $farmer && $farmer->area ? ($farmer->area->name_en ?: $farmer->area->name_ur) : '—';
        $itemName = $bill->item ? ($bill->item->name_en ?: $bill->item->name_ur) : 'Sabzi';
        $dateStr = $bill->date instanceof \DateTimeInterface ? $bill->date->format('Y-m-d') : substr((string) $bill->date, 0, 10);

        return response()->json([
            'success' => true,
            'entry' => [
                'id' => $bill->id,
                'entry_no' => 'BJ-' . str_pad($bill->id, 4, '0', STR_PAD_LEFT),
                'kisan_name' => $farmerName,
                'kisan_phone' => $farmer?->phone ?: '—',
                'kisan_area' => $areaName,
                'entry_date' => $dateStr,
                'item_name' => $itemName,
                'nag_quantity' => (int) $bill->nag,
                'rate' => (float) $bill->rate,
                'gross_sale' => (float) $bill->gross_amount,
                'commission_percent' => (float) $bill->commission_pct,
                'commission_amount' => (float) $bill->commission_amount,
                'kiraya_deduction' => (float) ($bill->kiraya ?? 0),
                'mazdoori' => (float) ($bill->mazdoori ?? 0),
                'chungi_tax' => (float) ($bill->market_fee ?? 0),
                'net_payable' => (float) $bill->net_amount,
                'paid_amount' => (float) ($bill->paid_amount ?? 0),
                'remaining_balance' => max(0, (float) $bill->net_amount - (float) ($bill->paid_amount ?? 0)),
                'truck_no' => $bill->truck_no ?: '—',
                'notes' => $bill->note ?: '',
            ],
        ]);
    }
}
