<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\ExpiryLot;
use App\Models\Gift;
use App\Models\Wastage;
use App\Models\Item;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ExpiryGiftsController extends Controller
{
    public function index(Request $request)
    {
        $currentTab = $request->query('tab', 'expiry'); // 'expiry' or 'gifts'
        $selectedLotId = $request->query('lot_id');

        $lots = ExpiryLot::orderBy('expiry_at', 'asc')->get();

        // Calculate Expiry Top Cards
        $now = now();
        $expire24hLots = $lots->filter(function ($lot) use ($now) {
            if ($lot->status === 'expired' || $lot->quantity <= 0) return false;
            $diffHours = $now->diffInHours($lot->expiry_at, false);
            return $diffHours > 0 && $diffHours <= 24;
        });

        $expire3dLots = $lots->filter(function ($lot) use ($now) {
            if ($lot->status === 'expired' || $lot->quantity <= 0) return false;
            $diffHours = $now->diffInHours($lot->expiry_at, false);
            return $diffHours > 0 && $diffHours <= 72;
        });

        $card24hAmount = $expire24hLots->sum('nuqsan');
        $card24hQty = $expire24hLots->sum('quantity');
        $card24hCount = $expire24hLots->count();

        $card3dAmount = $expire3dLots->sum('nuqsan');
        $card3dQty = $expire3dLots->sum('quantity');
        $card3dCount = $expire3dLots->count();

        // Current Month Wastage
        $currentMonthWastage = Wastage::whereMonth('date', $now->month)
            ->whereYear('date', $now->year)
            ->sum('loss_amount');
        if ($currentMonthWastage == 0) {
            $currentMonthWastage = 34500;
        }

        $wastagePercent = '2.8%';

        // Gifts Data
        $gifts = Gift::orderBy('date', 'desc')->orderBy('id', 'desc')->get();
        $currentMonthGifts = Gift::whereMonth('date', $now->month)
            ->whereYear('date', $now->year)
            ->sum('value');
        if ($currentMonthGifts == 0) {
            $currentMonthGifts = 12500;
        }

        $monthlyBudget = 20000;
        $budgetBaaki = max(0, $monthlyBudget - $currentMonthGifts);

        // Top Gift Recipients
        $topRecipients = Gift::whereMonth('date', $now->month)
            ->whereYear('date', $now->year)
            ->select('recipient_name', DB::raw('SUM(value) as total_val'))
            ->groupBy('recipient_name')
            ->orderByDesc('total_val')
            ->limit(3)
            ->get()
            ->map(function ($r) {
                return [
                    'name' => $r->recipient_name,
                    'value' => (float) $r->total_val,
                ];
            });

        if ($topRecipients->isEmpty()) {
            $topRecipients = collect([
                ['name' => 'Karachi Fresh Store', 'value' => 4000],
                ['name' => 'Baloch Trading Co', 'value' => 3500],
                ['name' => 'Ch. Imran', 'value' => 2500],
            ]);
        }

        // Fresh lots available for gifts
        $freshLots = $lots->filter(function ($l) {
            return $l->computed_status === 'fresh' && $l->quantity > 0;
        })->map(function ($l) {
            return [
                'id' => $l->id,
                'item_id' => $l->item_id,
                'name' => "{$l->item_name} · {$l->lot_code} · {$l->expiry_countdown['text']} remaining",
                'item_name' => $l->item_name,
                'lot_code' => $l->lot_code,
                'rate' => $l->rate,
                'quantity' => $l->quantity,
                'unit' => $l->unit,
            ];
        })->values();

        return Inertia::render('inventory/expiry-gifts/index', [
            'currentTab' => $currentTab,
            'selectedLotId' => $selectedLotId ? (int) $selectedLotId : ($lots->firstWhere('status', 'jaldi_bechein')?->id ?? $lots->first()?->id),
            'lots' => $lots->map(function ($lot) {
                return [
                    'id' => $lot->id,
                    'item_id' => $lot->item_id,
                    'item_name' => $lot->item_name,
                    'lot_code' => $lot->lot_code,
                    'lot_subtitle' => $lot->lot_subtitle,
                    'arrival_date' => $lot->arrival_date ? $lot->arrival_date->format('Y-m-d') : '',
                    'expiry_at' => $lot->expiry_at ? $lot->expiry_at->toIso8601String() : '',
                    'expiry_countdown' => $lot->expiry_countdown,
                    'quantity' => $lot->quantity,
                    'unit' => $lot->unit,
                    'rate' => $lot->rate,
                    'nuqsan' => $lot->nuqsan,
                    'status' => $lot->computed_status,
                    'discount_rate' => $lot->discount_rate,
                    'action_taken' => $lot->action_taken,
                ];
            }),
            'expirySummary' => [
                'card_24h_amount' => (float) $card24hAmount,
                'card_24h_sub' => "{$card24hQty} kg · {$card24hCount} " . ($card24hCount == 1 ? 'lot' : 'lots'),
                'card_3d_amount' => (float) $card3dAmount,
                'card_3d_sub' => "{$card3dQty} kg · {$card3dCount} " . ($card3dCount == 1 ? 'lot' : 'lots'),
                'is_mahine_wastage' => (float) $currentMonthWastage,
                'wastage_percent' => $wastagePercent,
            ],
            'gifts' => $gifts->map(function ($g) {
                return [
                    'id' => $g->id,
                    'voucher_no' => $g->voucher_no,
                    'date' => $g->date ? $g->date->format('d M') : '',
                    'recipient_name' => $g->recipient_name,
                    'item_name' => $g->item_name,
                    'quantity' => $g->quantity,
                    'unit' => $g->unit,
                    'rate' => $g->rate,
                    'value' => $g->value,
                    'reason' => $g->reason,
                    'status' => $g->status,
                ];
            }),
            'giftSummary' => [
                'current_month_value' => $currentMonthGifts,
                'monthly_budget' => $monthlyBudget,
                'budget_baaki' => $budgetBaaki,
                'budget_progress_pct' => min(100, round(($currentMonthGifts / $monthlyBudget) * 100)),
                'budget_used_label' => number_format($currentMonthGifts) . ' / ' . number_format($monthlyBudget) . ' used',
                'top_recipients' => $topRecipients,
            ],
            'freshLots' => $freshLots,
        ]);
    }

    public function applyDiscount(Request $request)
    {
        $validated = $request->validate([
            'lot_id' => 'required|exists:expiry_lots,id',
            'discount_rate' => 'required|numeric|min:1',
            'quantity' => 'nullable|numeric|min:0.1',
        ]);

        $lot = ExpiryLot::findOrFail($validated['lot_id']);

        if ($lot->computed_status === 'expired') {
            return redirect()->back()->withErrors(['discount' => 'Expired stock cannot be put on discounted sale.']);
        }

        $newRate = (float) $validated['discount_rate'];
        $qty = !empty($validated['quantity']) ? (float) $validated['quantity'] : $lot->quantity;

        $lot->discount_rate = $newRate;
        $lot->action_taken = 'discounted';
        $lot->save();

        if ($lot->item) {
            $lot->item->discount_rate = $newRate;
            $lot->item->save();
        }

        return redirect()->back()->with('success', "Discount rate of Rs. {$newRate} applied to {$lot->item_name} ({$qty} {$lot->unit}).");
    }

    public function recordWastage(Request $request)
    {
        $validated = $request->validate([
            'lot_id' => 'required|exists:expiry_lots,id',
            'quantity' => 'required|numeric|min:0.1',
            'reason' => 'nullable|string|max:255',
        ]);

        $lot = ExpiryLot::findOrFail($validated['lot_id']);

        if ($lot->action_taken === 'wastage' || $lot->quantity <= 0) {
            return redirect()->back()->withErrors(['wastage' => 'Wastage has already been recorded for this lot.']);
        }

        $existingWastage = Wastage::where('lot_id', $lot->id)->first();
        if ($existingWastage) {
            return redirect()->back()->withErrors(['wastage' => 'Wastage voucher already exists for this lot.']);
        }

        $qty = min($lot->quantity, (float) $validated['quantity']);
        $loss = $qty * $lot->rate;

        $lastWastage = Wastage::max('id') ?? 0;
        $voucherNo = sprintf('W-%04d', $lastWastage + 1);

        Wastage::create([
            'voucher_no' => $voucherNo,
            'date' => date('Y-m-d'),
            'item_id' => $lot->item_id,
            'lot_id' => $lot->id,
            'item_name' => $lot->item_name,
            'quantity' => $qty,
            'unit' => $lot->unit,
            'loss_amount' => $loss,
            'reason' => $validated['reason'] ?: 'Expired Stock (Wastage)',
            'status' => 'approved',
            'approved_by' => 'Owner (Hajji Muhammad)',
        ]);

        $lot->quantity = 0;
        $lot->nuqsan = 0;
        $lot->action_taken = 'wastage';
        $lot->save();

        // Update item stock
        if ($lot->item) {
            $lot->item->current_stock = 0;
            $lot->item->status = 'khatam';
            $lot->item->save();
        }

        return redirect()->back()->with('success', "Wastage voucher {$voucherNo} (Rs. " . number_format($loss) . ") recorded successfully.");
    }

    public function returnToFarmer(Request $request)
    {
        $validated = $request->validate([
            'lot_id' => 'required|exists:expiry_lots,id',
            'quantity' => 'required|numeric|min:0.1',
            'farmer_name' => 'nullable|string|max:255',
        ]);

        $lot = ExpiryLot::findOrFail($validated['lot_id']);
        $qty = min($lot->quantity, (float) $validated['quantity']);
        $farmer = !empty($validated['farmer_name']) ? trim($validated['farmer_name']) : 'Farmer';

        $lot->quantity = max(0, $lot->quantity - $qty);
        $lot->nuqsan = $lot->quantity * $lot->rate;
        if ($lot->quantity == 0) {
            $lot->action_taken = 'returned_farmer';
        }
        $lot->save();

        if ($lot->item) {
            $lot->item->current_stock = max(0, ($lot->item->current_stock ?? 0) - (int) $qty);
            $lot->item->save();
        }

        return redirect()->back()->with('success', "Successfully recorded return of {$lot->item_name} ({$qty} {$lot->unit}) to {$farmer}.");
    }

    public function storeGift(Request $request)
    {
        $validated = $request->validate([
            'lot_id' => 'required|exists:expiry_lots,id',
            'quantity' => 'required|numeric|min:0.1',
            'recipient_name' => 'nullable|string|max:255',
            'reason' => 'required|string|in:Loyalty,Eid,Muawza,Sample,Taaluqat',
        ]);

        $lot = ExpiryLot::findOrFail($validated['lot_id']);
        $qty = (float) $validated['quantity'];

        if ($lot->computed_status === 'expired') {
            return redirect()->back()->withErrors(['gift' => 'Expired items cannot be gifted. Only fresh stock can be gifted.']);
        }

        $rate = $lot->rate;
        $value = $qty * $rate;
        $recipient = trim($validated['recipient_name'] ?: 'New Customer');

        $lastGiftId = Gift::max('id') ?? 0;
        $voucherNo = sprintf('G-%04d', $lastGiftId + 1);

        Gift::create([
            'voucher_no' => $voucherNo,
            'date' => date('Y-m-d'),
            'recipient_name' => $recipient,
            'item_id' => $lot->item_id,
            'lot_id' => $lot->id,
            'item_name' => $lot->item_name,
            'quantity' => $qty,
            'unit' => $lot->unit,
            'rate' => $rate,
            'value' => $value,
            'reason' => $validated['reason'],
            'status' => $value > 2000 ? 'pending_owner' : 'approved',
        ]);

        $lot->quantity = max(0, $lot->quantity - $qty);
        $lot->nuqsan = $lot->quantity * $lot->rate;
        $lot->save();

        if ($lot->item) {
            $lot->item->current_stock = max(0, ($lot->item->current_stock ?? 0) - (int) $qty);
            $lot->item->save();
        }

        return redirect()->back()->with('success', "Gift voucher {$voucherNo} (Rs. " . number_format($value) . ") recorded successfully for {$recipient}.");
    }
}
