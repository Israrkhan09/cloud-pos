<?php

namespace App\Http\Controllers\Merchants;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\Merchant;
use App\Services\AmrozaService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AmrozaController extends Controller
{
    public function __construct(
        protected AmrozaService $amrozaService
    ) {}

    public function index(Request $request)
    {
        $date = $request->query('date', date('Y-m-d'));
        $search = $request->query('search');

        $sales = $this->amrozaService->getDailySales($date, $search);
        $summary = $this->amrozaService->getDailySummary($date);

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

        $items = Item::select('id', 'code', 'name_en', 'name_ur', 'unit', 'kg_per_unit', 'opening_stock', 'current_stock', 'low_stock_alert', 'default_rate', 'default_bardana', 'status', 'shelf_life', 'expiry_at', 'lot_date', 'stock_note')
            ->orderBy('id', 'asc')
            ->get();

        // Pass all items for quick-pick buttons so active, khatam, and expired are displayed
        $topItems = $items;

        // Get recent rates per item for anomaly detection
        $recentRates = \App\Models\AmrozaSale::select('item_id', 'rate')
            ->orderBy('id', 'desc')
            ->get()
            ->unique('item_id')
            ->pluck('rate', 'item_id');

        // Pass active discount rules for dynamic Riaayat chips
        $discountRules = \App\Models\DiscountRule::where('is_active', true)
            ->orderBy('id', 'asc')
            ->get();

        return Inertia::render('merchants/amroza/index', [
            'sales' => $sales,
            'summary' => $summary,
            'merchants' => $merchants,
            'items' => $items,
            'topItems' => $topItems,
            'recentRates' => $recentRates,
            'discountRules' => $discountRules,
            'filters' => [
                'date' => $date,
                'search' => $search,
            ],
        ]);
    }

    public function store(Request $request)
    {
        if ($request->has('items') && is_array($request->items) && count($request->items) > 0) {
            $validated = $request->validate([
                'date' => 'required|date',
                'merchant_id' => 'required|exists:merchants,id',
                'payment_type' => 'nullable|in:naqdi,udhaar,bank,split',
                'cash_received' => 'nullable|numeric|min:0',
                'udhaar_amount' => 'nullable|numeric|min:0',
                'discount' => 'nullable|numeric|min:0',
                'tax' => 'nullable|numeric|min:0',
                'items' => 'required|array|min:1',
                'items.*.item_id' => 'required|exists:items,id',
                'items.*.nag' => 'required|numeric|min:0',
                'items.*.weight' => 'nullable|numeric|min:0',
                'items.*.rate' => 'required|numeric|min:0',
                'items.*.bardana' => 'nullable|numeric',
            ]);

            $date = $validated['date'];
            $merchantId = $validated['merchant_id'];
            $paymentType = $validated['payment_type'] ?? 'udhaar';
            $discount = floatval($validated['discount'] ?? 0);
            $tax = floatval($validated['tax'] ?? 0);
            $netAdjustment = $tax - $discount;

            $items = $validated['items'];
            $totalSubtotal = 0;
            foreach ($items as $it) {
                $nag = floatval($it['nag'] ?? 0);
                $weight = floatval($it['weight'] ?? 0);
                $rate = floatval($it['rate'] ?? 0);
                $totalSubtotal += ($weight > 0 ? $weight * $rate : $nag * $rate);
            }
            $grandTotal = max(0, $totalSubtotal + $netAdjustment);

            \Illuminate\Support\Facades\DB::transaction(function () use ($items, $date, $merchantId, $paymentType, $netAdjustment, $totalSubtotal, $grandTotal, $validated) {
                $remainingAdjustment = $netAdjustment;
                $remainingCash = floatval($validated['cash_received'] ?? 0);

                foreach ($items as $idx => $it) {
                    $nag = floatval($it['nag'] ?? 0);
                    $weight = floatval($it['weight'] ?? 0);
                    $rate = floatval($it['rate'] ?? 0);
                    $lineAmount = ($weight > 0 ? $weight * $rate : $nag * $rate);

                    $itemAdjustment = ($idx === count($items) - 1)
                        ? $remainingAdjustment
                        : ($totalSubtotal > 0 ? round(($lineAmount / $totalSubtotal) * $netAdjustment, 2) : 0);
                    $remainingAdjustment -= $itemAdjustment;

                    $itemGross = max(0, $lineAmount + $itemAdjustment);

                    $itemCash = 0;
                    $itemUdhaar = 0;
                    if ($paymentType === 'split') {
                        if ($idx === count($items) - 1) {
                            $itemCash = min($remainingCash, $itemGross);
                        } else {
                            $itemCash = $grandTotal > 0 ? min($remainingCash, round(($itemGross / $grandTotal) * floatval($validated['cash_received'] ?? 0), 2)) : 0;
                        }
                        $remainingCash = max(0, $remainingCash - $itemCash);
                        $itemUdhaar = max(0, $itemGross - $itemCash);
                    }

                    $saleData = [
                        'date' => $date,
                        'merchant_id' => $merchantId,
                        'item_id' => $it['item_id'],
                        'nag' => $nag,
                        'weight' => $weight,
                        'rate' => $rate,
                        'bardana' => $itemAdjustment,
                        'payment_type' => $paymentType,
                        'cash_received' => $itemCash,
                        'udhaar_amount' => $itemUdhaar,
                        'created_by' => auth()->id(),
                    ];

                    $this->amrozaService->createSale($saleData);
                }
            });

            return redirect()->back()->with('success', 'Sale recorded successfully.');
        }

        $validated = $request->validate([
            'date' => 'required|date',
            'merchant_id' => 'required|exists:merchants,id',
            'item_id' => 'required|exists:items,id',
            'nag' => 'required|numeric|min:0',
            'weight' => 'nullable|numeric|min:0',
            'rate' => 'required|numeric|min:0',
            'bardana' => 'nullable|numeric',
            'payment_type' => 'nullable|in:naqdi,udhaar,bank,split',
            'cash_received' => 'nullable|numeric|min:0',
            'udhaar_amount' => 'nullable|numeric|min:0',
        ]);

        $validated['created_by'] = auth()->id();
        $validated['weight'] = $validated['weight'] ?? 0;
        $validated['bardana'] = $validated['bardana'] ?? 0;

        $this->amrozaService->createSale($validated);

        return redirect()->back()->with('success', 'Sale recorded successfully.');
    }

    public function update(Request $request, int $id)
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'merchant_id' => 'required|exists:merchants,id',
            'item_id' => 'required|exists:items,id',
            'nag' => 'required|numeric|min:0',
            'weight' => 'nullable|numeric|min:0',
            'rate' => 'required|numeric|min:0',
            'bardana' => 'nullable|numeric',
            'payment_type' => 'nullable|in:naqdi,udhaar,bank,split',
            'cash_received' => 'nullable|numeric|min:0',
            'udhaar_amount' => 'nullable|numeric|min:0',
        ]);

        $validated['weight'] = $validated['weight'] ?? 0;
        $validated['bardana'] = $validated['bardana'] ?? 0;

        $this->amrozaService->updateSale($id, $validated);

        return redirect()->back()->with('success', 'Sale updated successfully.');
    }

    public function destroy(int $id)
    {
        $this->amrozaService->deleteSale($id);

        return redirect()->back()->with('success', 'Sale deleted successfully.');
    }

    public function amTotal(Request $request)
    {
        $date = $request->query('date', date('Y-m-d'));
        $data = $this->amrozaService->getAmTotal($date);

        return response()->json($data);
    }
}
