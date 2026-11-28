<?php

namespace App\Http\Controllers\Discount;

use App\Http\Controllers\Controller;
use App\Models\DiscountRule;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DiscountRuleController extends Controller
{
    public function index(Request $request)
    {
        $rules = DiscountRule::orderBy('id', 'asc')->get();

        if (!$request->header('X-Inertia') && ($request->wantsJson() || $request->is('api/*'))) {
            return response()->json([
                'success' => true,
                'rules' => $rules,
            ]);
        }

        return Inertia::render('discount-rules/index', [
            'rules' => $rules,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'rule_name' => 'required|string|max:255',
            'discount_type' => 'required|in:percentage,fixed',
            'discount_value' => 'required|numeric|min:0',
            'min_order_amount' => 'nullable|numeric|min:0',
            'description' => 'nullable|string|max:1000',
        ]);

        $rule = DiscountRule::create([
            'rule_name' => $validated['rule_name'],
            'discount_type' => $validated['discount_type'],
            'discount_value' => $validated['discount_value'],
            'min_order_amount' => $validated['min_order_amount'] ?? 5000,
            'description' => $validated['description'] ?? null,
            'is_active' => true,
        ]);

        if ($request->wantsJson() || $request->ajax()) {
            return response()->json([
                'success' => true,
                'message' => 'Discount rule added successfully!',
                'rule' => $rule,
            ]);
        }

        return redirect()->back()->with('success', 'Discount rule added successfully!');
    }

    public function toggle(Request $request, $id)
    {
        $rule = DiscountRule::findOrFail($id);
        $rule->is_active = !$rule->is_active;
        $rule->save();

        $statusText = $rule->is_active ? 'Active' : 'Inactive';

        if ($request->wantsJson() || $request->ajax()) {
            return response()->json([
                'success' => true,
                'message' => "Discount rule is now {$statusText}.",
                'rule' => $rule,
            ]);
        }

        return redirect()->back()->with('success', "Discount rule is now {$statusText}.");
    }

    public function destroy(Request $request, $id)
    {
        $rule = DiscountRule::findOrFail($id);
        $rule->delete();

        if ($request->wantsJson() || $request->ajax()) {
            return response()->json([
                'success' => true,
                'message' => 'Discount rule deleted successfully.',
            ]);
        }

        return redirect()->back()->with('success', 'Discount rule deleted successfully.');
    }
}
