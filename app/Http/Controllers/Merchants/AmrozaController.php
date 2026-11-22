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
            ->where('code', '!=', 1)
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

        return Inertia::render('merchants/amroza/index', [
            'sales' => $sales,
            'summary' => $summary,
            'merchants' => $merchants,
            'items' => $items,
            'topItems' => $topItems,
            'recentRates' => $recentRates,
            'filters' => [
                'date' => $date,
                'search' => $search,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'merchant_id' => 'required|exists:merchants,id',
            'item_id' => 'required|exists:items,id',
            'nag' => 'required|numeric|min:0',
            'weight' => 'nullable|numeric|min:0',
            'rate' => 'required|numeric|min:0',
            'bardana' => 'nullable|numeric|min:0',
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
            'bardana' => 'nullable|numeric|min:0',
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
