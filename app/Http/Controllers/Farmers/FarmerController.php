<?php

namespace App\Http\Controllers\Farmers;

use App\Http\Controllers\Controller;
use App\Models\Area;
use App\Models\Farmer;
use App\Models\FarmerBill;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FarmerController extends Controller
{
    /**
     * Farmers Management list
     */
    public function index(Request $request): Response
    {
        $query = Farmer::with('area')->where('status', 'active');

        $search = $request->query('search', $request->query('qry'));
        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('name_en', 'like', "%{$search}%")
                  ->orWhere('name_ur', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%")
                  ->orWhereHas('area', function ($sub) use ($search) {
                      $sub->where('name_en', 'like', "%{$search}%")
                          ->orWhere('name_ur', 'like', "%{$search}%");
                  });
            });
        }

        $onlyBaqaya = filter_var($request->query('only_baqaya', false), FILTER_VALIDATE_BOOLEAN);
        if ($onlyBaqaya) {
            $query->where('current_balance', '>', 0);
        }

        $farmersList = $query->orderBy('code', 'asc')->get();

        $farmers = $farmersList->map(function ($f) {
            $areaName = $f->area ? ($f->area->name_en ?: $f->area->name_ur) : '—';
            return [
                'id' => $f->id,
                'code' => $f->code ? "#{$f->code}" : "#{$f->id}",
                'raw_code' => $f->code ?: $f->id,
                'name' => $f->name_en ?: ($f->name ?: $f->name_ur),
                'description' => 'Mandi Kisan / Bopari',
                'phone' => $f->phone ?: '—',
                'area' => $areaName,
                'area_id' => $f->area_id,
                'opening_balance' => (float) ($f->opening_balance ?? 0),
                'current_balance' => (float) ($f->current_balance ?? 0),
                'status' => $f->status ?: 'active',
            ];
        });

        $areas = Area::orderBy('name_en', 'asc')->get()->map(function ($a) {
            return [
                'id' => $a->id,
                'name' => $a->name_en ?: $a->name_ur,
            ];
        });

        return Inertia::render('farmers/index', [
            'farmers' => $farmers,
            'areas' => $areas,
            'filters' => [
                'search' => $search ?? '',
                'only_baqaya' => $onlyBaqaya,
            ],
        ]);
    }

    /**
     * Create new farmer
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'area' => 'nullable|string|max:100',
            'area_id' => 'nullable|integer',
            'opening_balance' => 'nullable|numeric',
            'notes' => 'nullable|string|max:500',
        ]);

        $areaId = $validated['area_id'] ?? null;
        if (!$areaId && !empty($validated['area'])) {
            $area = Area::firstOrCreate(
                ['name_en' => $validated['area']],
                ['name_ur' => $validated['area'], 'status' => 'active']
            );
            $areaId = $area->id;
        }

        $maxCode = (int) (Farmer::max('code') ?? 0);
        $nextCode = $maxCode > 0 ? $maxCode + 1 : 101;
        $openBal = (float) ($validated['opening_balance'] ?? 0);

        Farmer::create([
            'code' => $nextCode,
            'name_en' => $validated['name'],
            'name_ur' => $validated['name'],
            'phone' => $validated['phone'] ?? null,
            'area_id' => $areaId,
            'opening_balance' => $openBal,
            'current_balance' => $openBal,
            'status' => 'active',
            'created_by' => auth()->id(),
        ]);

        return redirect()->back()->with('success', 'Naya kisan kamyabi se shamil ho gaya.');
    }

    /**
     * Update farmer details
     */
    public function update(Request $request, int $id): RedirectResponse
    {
        $farmer = Farmer::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'area' => 'nullable|string|max:100',
            'area_id' => 'nullable|integer',
            'notes' => 'nullable|string|max:500',
        ]);

        $areaId = $validated['area_id'] ?? null;
        if (!$areaId && !empty($validated['area'])) {
            $area = Area::firstOrCreate(
                ['name_en' => $validated['area']],
                ['name_ur' => $validated['area'], 'status' => 'active']
            );
            $areaId = $area->id;
        }

        $farmer->update([
            'name_en' => $validated['name'],
            'name_ur' => $validated['name'],
            'phone' => $validated['phone'] ?? null,
            'area_id' => $areaId,
        ]);

        return redirect()->back()->with('success', 'Kisan ki maloomat update ho gayi.');
    }

    /**
     * Farmer Khata Statement (for Khata Dekhein modal)
     */
    public function khata(int $id)
    {
        $farmer = Farmer::with('area')->findOrFail($id);

        $bills = FarmerBill::where('farmer_id', $farmer->id)
            ->with('item')
            ->orderBy('date', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        $running = (float) ($farmer->opening_balance ?? 0);
        $entries = [];

        if (abs($running) > 0.01) {
            $entries[] = [
                'date' => substr((string) ($farmer->created_at ?? date('Y-m-d')), 0, 10),
                'description' => 'Sabiqa / Purana Baqaya (Opening Balance)',
                'debit' => 0,
                'credit' => $running,
                'balance' => $running,
            ];
        }

        foreach ($bills as $b) {
            $dateStr = $b->date instanceof \DateTimeInterface ? $b->date->format('Y-m-d') : substr((string) $b->date, 0, 10);
            $itemName = $b->item ? ($b->item->name_en ?: $b->item->name_ur) : 'Sabzi';
            $net = (float) $b->net_amount;

            $running = round($running + $net, 2);

            $entries[] = [
                'date' => $dateStr,
                'description' => "Mandi Bijak #BJ-{$b->id} ({$itemName} - {$b->nag} Nag)",
                'debit' => 0,
                'credit' => $net,
                'balance' => $running,
            ];
        }

        $recentEntries = array_slice($entries, -30);

        return response()->json([
            'farmer' => [
                'id' => $farmer->id,
                'name' => $farmer->name_en ?: ($farmer->name ?: $farmer->name_ur),
                'phone' => $farmer->phone ?: '—',
                'area' => $farmer->area ? ($farmer->area->name_en ?: $farmer->area->name_ur) : '—',
                'current_balance' => (float) ($farmer->current_balance ?? 0),
            ],
            'entries' => array_reverse($recentEntries),
        ]);
    }
}
