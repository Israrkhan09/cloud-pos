<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\AmrozaSale;
use App\Models\Customer;
use App\Models\Merchant;
use App\Models\MerchantReceipt;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Merchant::where('status', 'active');
        $query->where(function ($q) {
            $q->where(function ($sub) {
                $sub->where('customer_type', '!=', 'naqdi')
                    ->orWhereNull('customer_type');
            })->where(function ($sub) {
                $sub->where('name_en', 'not like', '%Naqdi%')
                    ->where('name_ur', 'not like', '%نقدی%')
                    ->orWhereNull('name_en');
            });
        });

        $search = $request->query('search', $request->query('qry'));
        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('name_en', 'like', "%{$search}%")
                  ->orWhere('name_ur', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('city', 'like', "%{$search}%");
            });
        }

        $onlyBaqaya = filter_var($request->query('only_baqaya', false), FILTER_VALIDATE_BOOLEAN);
        if ($onlyBaqaya) {
            $query->where('current_balance', '>', 0);
        }

        $merchants = $query->orderBy('id', 'asc')->get();

        $customers = $merchants->map(function ($m) {
            return [
                'id' => $m->id,
                'code' => $m->code,
                'name' => $m->name_en ?: ($m->name ?: $m->name_ur),
                'description' => $m->description ?: '',
                'phone' => $m->phone ?: '—',
                'city' => $m->city ?: '—',
                'customer_type' => $m->customer_type ?: 'Shopkeeper',
                'credit_limit' => (float) ($m->credit_limit ?? 0),
                'current_balance' => (float) ($m->current_balance ?? 0),
                'opening_balance' => (float) ($m->opening_balance ?? 0),
                'notes' => $m->notes ?: '',
                'status' => $m->status,
            ];
        });

        return Inertia::render('customer/index', [
            'customers' => $customers,
            'filters' => [
                'search' => $search ?? '',
                'only_baqaya' => $onlyBaqaya,
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'city' => 'nullable|string|max:100',
            'customer_type' => 'nullable|string|max:100',
            'credit_limit' => 'nullable|numeric|min:0',
            'opening_balance' => 'nullable|numeric',
            'notes' => 'nullable|string|max:500',
        ]);

        $maxCode = (int) (Merchant::max('code') ?? 0);
        $nextCode = $maxCode + 1;
        $openBal = (float) ($validated['opening_balance'] ?? 0);
        $businessId = app(\App\Services\TenantContext::class)->getBusinessId();

        Merchant::create([
            'business_id' => $businessId,
            'code' => $nextCode,
            'name_en' => $validated['name'],
            'name_ur' => $validated['name'],
            'phone' => $validated['phone'] ?? null,
            'city' => $validated['city'] ?? null,
            'customer_type' => $validated['customer_type'] ?? null,
            'credit_limit' => (float) ($validated['credit_limit'] ?? 0),
            'opening_balance' => $openBal,
            'current_balance' => $openBal,
            'notes' => $validated['notes'] ?? null,
            'status' => 'active',
            'created_by' => auth()->id(),
        ]);

        try {
            Customer::create([
                'business_id' => $businessId,
                'name' => $validated['name'],
                'phone' => $validated['phone'] ?? null,
                'address' => $validated['city'] ?? null,
                'status' => 'active',
            ]);
        } catch (\Throwable $e) {
            // Ignore legacy table conflicts
        }

        return redirect()->back()->with('success', 'Customer added successfully.');
    }

    public function update(Request $request, int $id): RedirectResponse
    {
        $merchant = Merchant::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'city' => 'nullable|string|max:100',
            'customer_type' => 'nullable|string|max:100',
            'credit_limit' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:500',
        ]);

        $merchant->update([
            'name_en' => $validated['name'],
            'name_ur' => $validated['name'],
            'phone' => $validated['phone'] ?? null,
            'city' => $validated['city'] ?? null,
            'customer_type' => $validated['customer_type'] ?? null,
            'credit_limit' => (float) ($validated['credit_limit'] ?? 0),
            'notes' => $validated['notes'] ?? null,
        ]);

        return redirect()->back()->with('success', 'Gahak ki maloomat update ho gayi.');
    }

    public function destroy(int $id): RedirectResponse
    {
        $merchant = Merchant::findOrFail($id);
        $merchant->delete();
        return redirect()->back()->with('success', 'Gahak delete ho gaya.');
    }

    public function khata(int $id)
    {
        $merchant = Merchant::findOrFail($id);

        $sales = AmrozaSale::where('merchant_id', $merchant->id)
            ->where(function ($q) {
                $q->where('payment_type', 'udhaar')
                  ->orWhereNull('payment_type')
                  ->orWhere('payment_type', 'split');
            })
            ->latest('date')
            ->take(30)
            ->get();

        $receipts = MerchantReceipt::where('merchant_id', $merchant->id)
            ->where('type', 'recovery')
            ->latest('date')
            ->take(30)
            ->get();

        $entries = [];

        foreach ($sales as $s) {
            $amount = $s->payment_type === 'split' ? (float) $s->udhaar_amount : (float) $s->gross_amount;
            $entries[] = [
                'date' => $s->date instanceof \DateTimeInterface ? $s->date->format('Y-m-d') : substr((string) $s->date, 0, 10),
                'description' => 'Sale (Credit Invoice #' . $s->id . ')',
                'debit' => $amount,
                'credit' => 0,
                'timestamp' => strtotime((string) $s->date . ' 12:00:00'),
            ];
        }

        foreach ($receipts as $r) {
            $entries[] = [
                'date' => $r->date instanceof \DateTimeInterface ? $r->date->format('Y-m-d') : substr((string) $r->date, 0, 10),
                'description' => $r->note ?: 'Recovery Receipt #' . (5000 + $r->id),
                'debit' => 0,
                'credit' => (float) $r->amount,
                'timestamp' => strtotime((string) $r->date . ' 13:00:00'),
            ];
        }

        usort($entries, function ($a, $b) {
            return $a['timestamp'] <=> $b['timestamp'];
        });

        $running = (float) $merchant->opening_balance;
        $ledgerEntries = [];

        if (abs($running) > 0.01) {
            $ledgerEntries[] = [
                'date' => substr((string) $merchant->created_at, 0, 10),
                'description' => 'Purana / Sabqa Baqaya (Opening Balance)',
                'debit' => $running > 0 ? $running : 0,
                'credit' => $running < 0 ? abs($running) : 0,
                'balance' => $running,
            ];
        }

        foreach ($entries as $e) {
            $running = round($running + $e['debit'] - $e['credit'], 2);
            $ledgerEntries[] = [
                'date' => $e['date'],
                'description' => $e['description'],
                'debit' => $e['debit'],
                'credit' => $e['credit'],
                'balance' => $running,
            ];
        }

        $recentEntries = array_slice($ledgerEntries, -20);

        return response()->json([
            'merchant' => [
                'id' => $merchant->id,
                'name' => $merchant->name_en ?: ($merchant->name ?: $merchant->name_ur),
                'phone' => $merchant->phone ?: '—',
                'city' => $merchant->city ?: '—',
                'customer_type' => $merchant->customer_type ?: 'Shopkeeper',
                'credit_limit' => (float) ($merchant->credit_limit ?? 0),
                'current_balance' => (float) ($merchant->current_balance ?? 0),
            ],
            'entries' => array_reverse($recentEntries),
        ]);
    }
}
