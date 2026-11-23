<?php

namespace App\Http\Controllers\Search;

use App\Http\Controllers\Controller;
use App\Models\Farmer;
use App\Models\Merchant;
use Illuminate\Http\Request;

class GlobalSearchController extends Controller
{
    protected array $pages = [
        ['title' => "Today's Sales (Amroza)", 'title_ur' => 'آج کی بکری (امروزہ)', 'url' => '/amroza', 'category' => 'Daily Kaam'],
        ['title' => 'Wasooli (Recovery)', 'title_ur' => 'وصولی', 'url' => '/wasooli', 'category' => 'Daily Kaam'],
        ['title' => 'Maal aur Stock (Products)', 'title_ur' => 'مال اور اسٹاک', 'url' => '/masters/items', 'category' => 'Daily Kaam'],
        ['title' => 'Gahak (Customers)', 'title_ur' => 'گاہک (کسٹمرز)', 'url' => '/customers', 'category' => 'Daily Kaam'],
        ['title' => 'Farmers (Kisan)', 'title_ur' => 'کسان (زمیندار)', 'url' => '/farmers', 'category' => 'Daily Kaam'],
        ['title' => 'Bank Accounts', 'title_ur' => 'بینک کھاتہ و کیش گلہ', 'url' => '/banking/accounts', 'category' => 'Banking'],
        ['title' => 'Deposit / Transfer', 'title_ur' => 'ڈپازٹ / ٹرانسفر', 'url' => '/banking/transfers', 'category' => 'Banking'],
        ['title' => 'Cheques', 'title_ur' => 'چیکس', 'url' => '/banking/cheques', 'category' => 'Banking'],
        ['title' => 'Investment & Capital', 'title_ur' => 'سرمایہ و قرضہ', 'url' => '/investment/partners', 'category' => 'Investment'],
        ['title' => 'Gahak Khata (Customer Ledger)', 'title_ur' => 'گاہک کھاتہ', 'url' => '/merchant-khata', 'category' => 'Khata'],
        ['title' => 'Farmer Khata (Kisan Mandi)', 'title_ur' => 'کسان کھاتہ', 'url' => '/farmer-khata', 'category' => 'Khata'],
        ['title' => 'Mandi Rapoort (Reports)', 'title_ur' => 'منڈی رپورٹ', 'url' => '/reports', 'category' => 'Reports'],
        ['title' => 'Expiry & Gifts', 'title_ur' => 'ایکسپائری اور تحائف', 'url' => '/expiry-gifts', 'category' => 'Inventory'],
        ['title' => 'Discount Rules', 'title_ur' => 'ڈسکاؤنٹ رولز', 'url' => '/discount-rules', 'category' => 'Discount'],
        ['title' => 'Database Backup aur Restore', 'title_ur' => 'ڈیٹابیس بیک اپ', 'url' => '/backup', 'category' => 'System'],
        ['title' => 'Dashboard', 'title_ur' => 'ڈیش بورڈ', 'url' => '/dashboard', 'category' => 'Main'],
    ];

    public function search(Request $request)
    {
        $q = trim((string) $request->input('q', ''));

        // Match pages
        $matchingPages = [];
        if ($q !== '') {
            $matchingPages = array_values(array_filter($this->pages, function ($page) use ($q) {
                return stripos($page['title'], $q) !== false
                    || stripos($page['title_ur'], $q) !== false
                    || stripos($page['url'], $q) !== false
                    || stripos($page['category'], $q) !== false;
            }));
        } else {
            $matchingPages = array_slice($this->pages, 0, 6);
        }

        // Match merchants
        $merchantQuery = Merchant::query();
        if ($q !== '') {
            $merchantQuery->where(function ($sub) use ($q) {
                $sub->where('name_en', 'like', "%{$q}%")
                    ->orWhere('name_ur', 'like', "%{$q}%")
                    ->orWhere('phone', 'like', "%{$q}%")
                    ->orWhere('code', 'like', "%{$q}%");
            });
        }
        $merchants = $merchantQuery->orderBy('name_en', 'asc')->take(8)->get(['id', 'code', 'name_en', 'name_ur', 'phone', 'city', 'current_balance']);

        // Match farmers
        $farmerQuery = Farmer::with('area');
        if ($q !== '') {
            $farmerQuery->where(function ($sub) use ($q) {
                $sub->where('name_en', 'like', "%{$q}%")
                    ->orWhere('name_ur', 'like', "%{$q}%")
                    ->orWhere('phone', 'like', "%{$q}%")
                    ->orWhere('code', 'like', "%{$q}%");
            });
        }
        $farmers = $farmerQuery->orderBy('name_en', 'asc')->take(8)->get(['id', 'code', 'name_en', 'name_ur', 'phone', 'area_id', 'current_balance']);

        return response()->json([
            'success' => true,
            'pages' => $matchingPages,
            'merchants' => $merchants->map(function ($m) {
                return [
                    'id' => $m->id,
                    'code' => $m->code,
                    'name' => $m->name_en ?: $m->name_ur,
                    'phone' => $m->phone,
                    'city' => $m->city,
                    'balance' => $m->current_balance,
                    'url' => "/merchant-khata?merchant_id={$m->id}",
                ];
            }),
            'farmers' => $farmers->map(function ($f) {
                return [
                    'id' => $f->id,
                    'code' => $f->code,
                    'name' => $f->name_en ?: $f->name_ur,
                    'phone' => $f->phone,
                    'area' => $f->area ? ($f->area->name_en ?: $f->area->name_ur) : null,
                    'balance' => $f->current_balance,
                    'url' => "/farmer-khata?farmer_id={$f->id}",
                ];
            }),
        ]);
    }
}
