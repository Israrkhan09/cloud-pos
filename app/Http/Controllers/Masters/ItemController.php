<?php

namespace App\Http\Controllers\Masters;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\FarmerMark;
use App\Models\Area;
use App\Models\Farmer;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ItemController extends Controller
{
    public function index(Request $request): Response
    {
        $tab = $request->query('tab', 'items');

        // Items
        $iQuery = Item::query();
        if ($request->filled('search') && $tab === 'items') {
            $s = $request->search;
            $iQuery->where(function ($q) use ($s) {
                $q->where('name_en', 'like', "%{$s}%")
                  ->orWhere('name_ur', 'like', "%{$s}%")
                  ->orWhere('unit', 'like', "%{$s}%");
            });
        }
        $items = $iQuery->orderBy('id', 'asc')
            ->paginate($request->per_page ?? 15, ['*'], 'items_page')
            ->withQueryString();

        // Marks
        $mQuery = FarmerMark::with('farmer');
        if ($request->filled('search') && $tab === 'marks') {
            $s = $request->search;
            $mQuery->where(function ($q) use ($s) {
                $q->where('name_en', 'like', "%{$s}%")
                  ->orWhere('name_ur', 'like', "%{$s}%")
                  ->orWhereHas('farmer', function ($fq) use ($s) {
                      $fq->where('name_en', 'like', "%{$s}%")
                         ->orWhere('name_ur', 'like', "%{$s}%");
                  });
            });
        }
        $marks = $mQuery->orderBy('farmer_id', 'asc')
            ->orderBy('code', 'asc')
            ->paginate($request->per_page ?? 15, ['*'], 'marks_page')
            ->withQueryString();

        // Areas
        $aQuery = Area::query();
        if ($request->filled('search') && $tab === 'areas') {
            $s = $request->search;
            $aQuery->where(function ($q) use ($s) {
                $q->where('name_en', 'like', "%{$s}%")
                  ->orWhere('name_ur', 'like', "%{$s}%");
            });
        }
        $areas = $aQuery->orderBy('name_ur', 'asc')
            ->paginate($request->per_page ?? 15, ['*'], 'areas_page')
            ->withQueryString();

        $farmers = Farmer::where('status', 'active')
            ->select(['id', 'code', 'name_en', 'name_ur'])
            ->orderBy('code', 'asc')
            ->get();

        return Inertia::render('masters/items/index', [
            'items' => $items,
            'marks' => $marks,
            'areas' => $areas,
            'farmers' => $farmers,
            'currentTab' => $tab,
            'filters' => $request->only(['search', 'tab']),
        ]);
    }

    public function search(Request $request)
    {
        $s = $request->get('query', '');
        return Item::query()
            ->where('status', 'active')
            ->where(function ($q) use ($s) {
                if (!empty($s)) {
                    $q->where('name_en', 'like', "%{$s}%")
                      ->orWhere('name_ur', 'like', "%{$s}%");
                }
            })
            ->orderBy('id', 'asc')
            ->take(20)
            ->get();
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name_ur'          => 'nullable|string|max:255',
            'name_en'          => 'nullable|string|max:255',
            'unit'             => 'nullable|string|max:50',
            'kg_per_unit'      => 'nullable|numeric',
            'opening_stock'    => 'nullable|integer',
            'current_stock'    => 'nullable|integer',
            'low_stock_alert'  => 'nullable|integer',
            'lot_date'         => 'nullable|string|max:50',
            'stock_note'       => 'nullable|string|max:255',
            'default_rate'     => 'nullable|numeric',
            'default_bardana'  => 'nullable|numeric',
            'shelf_life'       => 'nullable|string|max:100',
            'shelf_life_days'  => 'nullable|integer|min:1',
            'discount_rate'    => 'nullable|numeric',
            'status'           => 'nullable|string|in:active,inactive,expiring_soon,expired,low_stock,khatam',
        ]);

        if (empty($validated['name_ur']) && empty($validated['name_en'])) {
            return back()->withErrors(['name_en' => 'Item name is required.']);
        }

        if (!isset($validated['current_stock']) && isset($validated['opening_stock'])) {
            $validated['current_stock'] = $validated['opening_stock'];
        }

        // Auto compute expiry_at if shelf_life_days given
        if (!empty($validated['shelf_life_days'])) {
            $validated['expiry_at'] = now()->addDays($validated['shelf_life_days']);
        }

        Item::create($validated);

        return back()->with('success', 'Item created successfully.');
    }

    public function update(Request $request, int $id)
    {
        $item = Item::findOrFail($id);

        $validated = $request->validate([
            'name_ur'          => 'nullable|string|max:255',
            'name_en'          => 'nullable|string|max:255',
            'unit'             => 'nullable|string|max:50',
            'kg_per_unit'      => 'nullable|numeric',
            'opening_stock'    => 'nullable|integer',
            'current_stock'    => 'nullable|integer',
            'low_stock_alert'  => 'nullable|integer',
            'lot_date'         => 'nullable|string|max:50',
            'stock_note'       => 'nullable|string|max:255',
            'default_rate'     => 'nullable|numeric',
            'default_bardana'  => 'nullable|numeric',
            'shelf_life'       => 'nullable|string|max:100',
            'shelf_life_days'  => 'nullable|integer|min:1',
            'discount_rate'    => 'nullable|numeric',
            'status'           => 'required|string',
        ]);

        if (!empty($validated['shelf_life_days']) && $item->shelf_life_days !== $validated['shelf_life_days']) {
            $validated['expiry_at'] = now()->addDays($validated['shelf_life_days']);
        }

        $item->update($validated);

        return back()->with('success', 'Item updated successfully.');
    }

    public function applyDiscount(Request $request, int $id)
    {
        $item = Item::findOrFail($id);
        $discountRate = $request->input('discount_rate');
        if (!$discountRate) {
            // Default 15% discount
            $discountRate = round($item->default_rate * 0.85);
        }
        $item->discount_rate = $discountRate;
        $item->save();

        return back()->with('success', "Discount applied: Rs. {$discountRate}");
    }

    public function destroy(int $id)
    {
        try {
            $item = Item::findOrFail($id);
            $item->delete();
            return back()->with('success', 'Item deleted successfully.');
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }
}
