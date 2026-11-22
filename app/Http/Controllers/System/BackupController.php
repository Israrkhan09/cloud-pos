<?php

namespace App\Http\Controllers\System;

use App\Http\Controllers\Controller;
use App\Models\AmrozaSale;
use App\Models\Merchant;
use App\Models\MerchantReceipt;
use App\Models\Farmer;
use App\Models\FarmerBill;
use App\Models\Item;
use App\Models\Expense;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BackupController extends Controller
{
    /**
     * Display the Backup page
     */
    public function index()
    {
        $categories = [
            [
                'id' => 'sales',
                'title' => 'Sales & Amroza',
                'title_ur' => 'سیل اور امروزہ ریکارڈ',
                'description' => 'Rozana ki naqad aur udhaar sale ka mukammal record',
                'icon' => 'Tag',
                'count' => AmrozaSale::count(),
            ],
            [
                'id' => 'merchants',
                'title' => 'Merchants & Wasooli',
                'title_ur' => 'خریدار اور وصولی کھاتہ',
                'description' => 'Kharidaar (buyers), baqaya jaat aur wasooli receipts',
                'icon' => 'Users',
                'count' => Merchant::count(),
            ],
            [
                'id' => 'farmers',
                'title' => 'Farmers & Bijak',
                'title_ur' => 'زمیندار اور کسان بلز',
                'description' => 'Farmers masters, bills (bijak), charges aur commissions',
                'icon' => 'Tractor',
                'count' => Farmer::count(),
            ],
            [
                'id' => 'products',
                'title' => 'Products & Stock',
                'title_ur' => 'پروڈکٹس اور اسٹاک ڈیٹا',
                'description' => 'Tamaam sabzi اجناس، اسٹاک tadaad، rates aur shelf life',
                'icon' => 'Package',
                'count' => Item::count(),
            ],
            [
                'id' => 'ledger',
                'title' => 'Ledger & Expenses',
                'title_ur' => 'روکڑ اور روزانہ اخراجات',
                'description' => 'Dukaan ke rozana khorcha, cash book aur aamad o kharch',
                'icon' => 'BookBookmark',
                'count' => Expense::count(),
            ],
        ];

        return Inertia::render('system/backup/index', [
            'categories' => $categories,
        ]);
    }

    /**
     * Get preview data for a category
     */
    public function getData(Request $request)
    {
        $category = $request->query('category', 'sales');

        $response = [
            'category' => $category,
            'title' => '',
            'title_ur' => '',
            'columns' => [],
            'rows' => [],
            'total_count' => 0,
        ];

        switch ($category) {
            case 'sales':
                $response['title'] = 'Sales & Amroza Backup';
                $response['title_ur'] = 'سیل اور امروزہ بیک اپ';
                $sales = AmrozaSale::with(['merchant', 'item'])->orderBy('date', 'desc')->limit(500)->get();
                $rows = [];
                foreach ($sales as $idx => $s) {
                    $mName = $s->merchant ? ($s->merchant->name_en ?: ($s->merchant->name ?: $s->merchant->name_ur)) : 'Naqad';
                    $iName = $s->item ? ($s->item->name_en ?: ($s->item->name ?: $s->item->name_ur)) : 'Item';
                    $iName = trim(preg_replace('/\s*\(.*?\)\s*/', '', $iName));
                    $unit = $s->item && $s->item->unit ? $s->item->unit : 'Bori';
                    $dateStr = $s->date instanceof \DateTimeInterface ? $s->date->format('Y-m-d') : substr((string)$s->date, 0, 10);
                    $rows[] = [
                        'col1' => $idx + 1,
                        'col2' => $dateStr,
                        'col3' => $mName,
                        'col4' => $iName,
                        'col5' => (int)$s->nag . ' ' . $unit,
                        'col6' => 'Rs. ' . number_format($s->rate),
                        'col7' => 'Rs. ' . number_format($s->gross_amount),
                        'col8' => ucfirst($s->payment_type ?: 'Udhaar'),
                    ];
                }
                $response['columns'] = ['#', 'Date', 'Buyer / Merchant', 'Product', 'Quantity', 'Rate', 'Total Amount', 'Payment Type'];
                $response['rows'] = $rows;
                $response['total_count'] = AmrozaSale::count();
                break;

            case 'merchants':
                $response['title'] = 'Merchants (Buyers) Backup';
                $response['title_ur'] = 'خریدار کھاتہ بیک اپ';
                $merchants = Merchant::orderBy('code', 'asc')->get();
                $rows = [];
                foreach ($merchants as $idx => $m) {
                    $mName = $m->name_en ?: ($m->name ?: $m->name_ur);
                    $rows[] = [
                        'col1' => $idx + 1,
                        'col2' => '#' . $m->code,
                        'col3' => $mName,
                        'col4' => $m->phone ?: '—',
                        'col5' => 'Rs. ' . number_format($m->opening_balance),
                        'col6' => 'Rs. ' . number_format($m->current_balance),
                        'col7' => ucfirst($m->status ?: 'Active'),
                    ];
                }
                $response['columns'] = ['#', 'Code', 'Merchant Name', 'Phone', 'Opening Balance', 'Current Baqaya', 'Status'];
                $response['rows'] = $rows;
                $response['total_count'] = count($merchants);
                break;

            case 'farmers':
                $response['title'] = 'Farmers (Growers) Backup';
                $response['title_ur'] = 'زمیندار و کسان بیک اپ';
                $farmers = Farmer::with('area')->orderBy('code', 'asc')->get();
                $rows = [];
                foreach ($farmers as $idx => $f) {
                    $fName = $f->name_en ?: ($f->name ?: $f->name_ur);
                    $areaName = $f->area ? ($f->area->name_en ?: $f->area->name_ur) : '—';
                    $rows[] = [
                        'col1' => $idx + 1,
                        'col2' => '#' . $f->code,
                        'col3' => $fName,
                        'col4' => $areaName,
                        'col5' => $f->phone ?: '—',
                        'col6' => 'Rs. ' . number_format($f->opening_balance),
                        'col7' => 'Rs. ' . number_format($f->current_balance),
                        'col8' => ucfirst($f->status ?: 'Active'),
                    ];
                }
                $response['columns'] = ['#', 'Code', 'Farmer Name', 'Area (Ilaqa)', 'Phone', 'Opening Balance', 'Current Baqaya', 'Status'];
                $response['rows'] = $rows;
                $response['total_count'] = count($farmers);
                break;

            case 'products':
                $response['title'] = 'Products & Inventory Backup';
                $response['title_ur'] = 'پروڈکٹس اور اسٹاک بیک اپ';
                $items = Item::orderBy('id', 'asc')->get();
                $rows = [];
                foreach ($items as $idx => $it) {
                    $rawName = $it->name_en ?: ($it->name ?: $it->name_ur);
                    $itName = trim(preg_replace('/\s*\(.*?\)\s*/', '', $rawName));
                    $stock = (int) ($it->current_stock ?? $it->opening_stock ?? 0);
                    $rows[] = [
                        'col1' => $idx + 1,
                        'col2' => '#' . $it->id,
                        'col3' => $itName,
                        'col4' => $it->unit ?: 'Bori',
                        'col5' => $stock,
                        'col6' => 'Rs. ' . number_format($it->default_rate ?? 0),
                        'col7' => $it->shelf_life ?: '4-5 din',
                        'col8' => $stock <= 0 ? 'Khatam' : ($stock < 20 ? 'Kam Stock' : 'Theek'),
                    ];
                }
                $response['columns'] = ['#', 'Code', 'Product Name', 'Unit', 'Current Stock', 'Rate', 'Shelf Life', 'Status'];
                $response['rows'] = $rows;
                $response['total_count'] = count($items);
                break;

            case 'ledger':
            default:
                $response['title'] = 'Ledger & Expenses Backup';
                $response['title_ur'] = 'روکڑ اور اخراجات بیک اپ';
                $expenses = Expense::orderBy('date', 'desc')->limit(500)->get();
                $rows = [];
                foreach ($expenses as $idx => $e) {
                    $dateStr = $e->date instanceof \DateTimeInterface ? $e->date->format('Y-m-d') : substr((string)$e->date, 0, 10);
                    $rows[] = [
                        'col1' => $idx + 1,
                        'col2' => $dateStr,
                        'col3' => $e->name ?: ($e->title ?: 'Expense'),
                        'col4' => $e->note ?: ($e->description ?: '—'),
                        'col5' => 'Rs. ' . number_format($e->amount),
                    ];
                }
                $response['columns'] = ['#', 'Date', 'Expense Category / Name', 'Description', 'Amount'];
                $response['rows'] = $rows;
                $response['total_count'] = Expense::count();
                break;
        }

        return response()->json($response);
    }

    /**
     * Download full database JSON backup
     */
    public function fullDatabase()
    {
        $data = [
            'app' => 'Vegetable POS',
            'exported_at' => date('Y-m-d H:i:s'),
            'sales' => AmrozaSale::with(['merchant', 'item'])->get(),
            'merchants' => Merchant::all(),
            'merchant_receipts' => MerchantReceipt::all(),
            'farmers' => Farmer::with('area')->get(),
            'farmer_bills' => FarmerBill::all(),
            'products' => Item::all(),
            'expenses' => Expense::all(),
        ];

        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        $fileName = 'Vegetable_POS_Full_Backup_' . date('Y-m-d_His') . '.json';

        return response($json, 200, [
            'Content-Type' => 'application/json',
            'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
        ]);
    }
}
