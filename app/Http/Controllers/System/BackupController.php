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
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class BackupController extends Controller
{
    protected string $backupDir;

    public function __construct()
    {
        $this->backupDir = storage_path('app/backups');
        if (!file_exists($this->backupDir)) {
            @mkdir($this->backupDir, 0755, true);
        }
    }

    /**
     * Display the Backup & Restore page
     */
    public function index()
    {
        $this->checkAndRunAutoBackup();
        $this->enforceRetentionLimit(15);

        $backups = $this->getBackupsList();
        $categories = $this->getCategoriesSummary();

        return Inertia::render('system/backup/index', [
            'backups' => $backups,
            'categories' => $categories,
        ]);
    }

    /**
     * Get JSON list of backups
     */
    public function listBackups()
    {
        $backups = $this->getBackupsList();
        return response()->json([
            'success' => true,
            'backups' => $backups,
        ]);
    }

    /**
     * Create manual full backup (.db)
     */
    public function createBackup()
    {
        try {
            $now = new \DateTime();
            $timestamp = $now->format('Y-m-d\TH-i-s-v\Z');
            $filename = "mandi_backup_{$timestamp}.db";
            $destPath = $this->backupDir . DIRECTORY_SEPARATOR . $filename;
            $dbPath = database_path('database.sqlite');

            if (!file_exists($dbPath)) {
                return response()->json([
                    'success' => false,
                    'message' => 'SQLite database file not found.'
                ], 500);
            }

            // Ensure any WAL changes are checkpointed
            try {
                DB::statement('PRAGMA wal_checkpoint(PASSIVE)');
            } catch (\Throwable $e) {
                // ignore
            }

            // Backup using SQLite3 or copy
            if (class_exists(\SQLite3::class)) {
                $src = new \SQLite3($dbPath);
                $dst = new \SQLite3($destPath);
                $src->backup($dst);
                $src->close();
                $dst->close();
            } else {
                copy($dbPath, $destPath);
            }

            $this->enforceRetentionLimit(15);

            $sizeBytes = filesize($destPath);
            $sizeKb = round($sizeBytes / 1024, 1);

            return response()->json([
                'success' => true,
                'message' => "Database backup created successfully! File: {$filename}",
                'filename' => $filename,
                'size_kb' => $sizeKb,
                'created_at' => date('Y-m-d H:i:s', filemtime($destPath)),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error creating backup: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Download a specific backup file
     */
    public function downloadBackup(string $filename)
    {
        $safeFilename = basename($filename);
        $filePath = $this->backupDir . DIRECTORY_SEPARATOR . $safeFilename;

        if (!file_exists($filePath)) {
            return response()->json([
                'success' => false,
                'message' => 'Backup file not found.'
            ], 404);
        }

        return response()->download($filePath, $safeFilename, [
            'Content-Type' => 'application/x-sqlite3',
        ]);
    }

    /**
     * Full Database Backup (.db download)
     */
    public function fullDatabase()
    {
        $dbPath = database_path('database.sqlite');
        if (!file_exists($dbPath)) {
            return response()->json(['error' => 'Database file not found'], 404);
        }

        try {
            DB::statement('PRAGMA wal_checkpoint(PASSIVE)');
        } catch (\Throwable $e) {
            // ignore
        }

        $now = new \DateTime();
        $timestamp = $now->format('Y-m-d_His');
        $filename = "mandi_full_backup_{$timestamp}.db";

        return response()->download($dbPath, $filename, [
            'Content-Type' => 'application/x-sqlite3',
        ]);
    }

    /**
     * Restore database from uploaded .db file
     */
    public function restoreDatabase(Request $request)
    {
        if (!$request->hasFile('backup_file')) {
            return response()->json([
                'success' => false,
                'message' => 'Barah-e-karam backup (.db) file upload karein!'
            ], 400);
        }

        $file = $request->file('backup_file');
        $origName = $file->getClientOriginalName();
        $ext = strtolower($file->getClientOriginalExtension());

        if (!in_array($ext, ['db', 'sqlite', 'sqlite3'])) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid file format: Only .db backup files are accepted.'
            ], 400);
        }

        $uploadedPath = $file->getRealPath();

        // 1. Validate SQLite header
        $fh = fopen($uploadedPath, 'rb');
        $header = fread($fh, 16);
        fclose($fh);
        if (substr($header, 0, 15) !== "SQLite format 3") {
            return response()->json([
                'success' => false,
                'message' => 'Invalid file: Not a valid SQLite database file (Header check failed).'
            ], 400);
        }

        // 2. Validate SQLite integrity and schema
        try {
            $testDb = new \SQLite3($uploadedPath);
            $integrity = $testDb->querySingle('PRAGMA integrity_check;');
            if (strtolower((string)$integrity) !== 'ok') {
                $testDb->close();
                return response()->json([
                    'success' => false,
                    'message' => "Database file corrupted: Integrity check failed ({$integrity})."
                ], 400);
            }

            $res = $testDb->query("SELECT name FROM sqlite_master WHERE type='table'");
            $tables = [];
            while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
                $tables[] = $row['name'];
            }
            $testDb->close();

            // Must contain items or merchants or sales
            $hasKeyTable = in_array('items', $tables) || in_array('merchants', $tables) || in_array('amroza_sales', $tables) || in_array('sales', $tables);
            if (!$hasKeyTable) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid database: Required tables (items, merchants, sales) not found.'
                ], 400);
            }
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Database validation error: ' . $e->getMessage()
            ], 400);
        }

        // 3. Safety Backup of existing DB
        $dbPath = database_path('database.sqlite');
        $safetyFilename = 'pre_restore_safety_' . date('Y-m-d_His') . '.db';
        $safetyPath = $this->backupDir . DIRECTORY_SEPARATOR . $safetyFilename;

        if (file_exists($dbPath)) {
            @copy($dbPath, $safetyPath);
        }

        // 4. Overwrite existing database
        try {
            DB::disconnect();

            if (!copy($uploadedPath, $dbPath)) {
                throw new \Exception('Failed to copy restored database over database.sqlite');
            }

            // Remove existing WAL and SHM files
            @unlink($dbPath . '-wal');
            @unlink($dbPath . '-shm');

            DB::reconnect();
            DB::select('SELECT 1');

            // 5. Record restore log
            $logFile = $this->backupDir . DIRECTORY_SEPARATOR . 'restore_log.json';
            $logs = file_exists($logFile) ? json_decode(file_get_contents($logFile), true) : [];
            if (!is_array($logs)) $logs = [];
            $logs[] = [
                'filename' => $origName,
                'restored_at' => date('Y-m-d H:i:s'),
                'size_kb' => round(filesize($dbPath) / 1024, 1),
                'safety_backup' => $safetyFilename,
            ];
            @file_put_contents($logFile, json_encode($logs, JSON_PRETTY_PRINT));

            return response()->json([
                'success' => true,
                'message' => 'Database restored successfully! Refreshing page...'
            ]);
        } catch (\Throwable $e) {
            // Rollback from safety backup
            if (file_exists($safetyPath)) {
                @copy($safetyPath, $dbPath);
                @unlink($dbPath . '-wal');
                @unlink($dbPath . '-shm');
                DB::reconnect();
            }

            return response()->json([
                'success' => false,
                'message' => 'Database restore failed, previous database preserved (Rollback complete): ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Categories summary with live record counts
     */
    public function categoriesSummary()
    {
        return response()->json([
            'success' => true,
            'categories' => $this->getCategoriesSummary(),
        ]);
    }

    /**
     * Category preview data
     */
    public function categoryPreview(Request $request, string $categoryId)
    {
        $cfg = $this->getCategoryConfig($categoryId);
        if (!$cfg) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid category selected.'
            ], 404);
        }

        $data = $this->fetchCategoryRowsAndColumns($categoryId);

        return response()->json([
            'success' => true,
            'category' => [
                'id' => $cfg['id'],
                'name' => $cfg['name'],
                'description' => $cfg['description'],
                'total_records' => count($data['rows']),
                'columns' => $data['columns'],
                'rows' => $data['rows'],
            ],
        ]);
    }

    /**
     * Category Export Excel (.xlsx)
     */
    public function categoryExportExcel(string $categoryId)
    {
        $cfg = $this->getCategoryConfig($categoryId);
        if (!$cfg) {
            return response()->json(['success' => false, 'message' => 'Invalid category.'], 404);
        }

        $data = $this->fetchCategoryRowsAndColumns($categoryId);
        if (empty($data['rows'])) {
            return response()->json([
                'success' => false,
                'message' => "No records found in category ({$cfg['name']}). Cannot download empty file."
            ], 400);
        }

        $dateStr = date('Y-m-d');
        $filename = "{$cfg['filePrefix']}_{$dateStr}.xlsx";

        $sheets = [
            $cfg['name'] => $data['rows'],
        ];

        $xml = $this->generateExcelXml($sheets, $data['columns']);

        return response($xml, 200, [
            'Content-Type' => 'application/vnd.ms-excel',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    /**
     * Category Export DB (.db)
     */
    public function categoryExportDb(string $categoryId)
    {
        $cfg = $this->getCategoryConfig($categoryId);
        if (!$cfg) {
            return response()->json(['success' => false, 'message' => 'Invalid category.'], 404);
        }

        $data = $this->fetchCategoryRowsAndColumns($categoryId);
        if (empty($data['rows'])) {
            return response()->json([
                'success' => false,
                'message' => "No records found in category ({$cfg['name']}). Cannot download empty database."
            ], 400);
        }

        $dateStr = date('Y-m-d');
        $filename = "{$cfg['filePrefix']}_{$dateStr}.db";
        $tempPath = storage_path('app/temp_' . $cfg['filePrefix'] . '_' . time() . '.db');

        try {
            if (file_exists($tempPath)) @unlink($tempPath);
            $subDb = new \SQLite3($tempPath);
            $subDb->exec('PRAGMA foreign_keys = OFF;');

            $mainDb = new \SQLite3(database_path('database.sqlite'));

            foreach ($cfg['tables'] as $tableName) {
                // Check if table exists
                $schemaRow = $mainDb->querySingle("SELECT sql FROM sqlite_master WHERE type='table' AND name = '{$tableName}'", true);
                if ($schemaRow && !empty($schemaRow['sql'])) {
                    $subDb->exec($schemaRow['sql']);

                    $rowsRes = $mainDb->query("SELECT * FROM {$tableName}");
                    while ($row = $rowsRes->fetchArray(SQLITE3_ASSOC)) {
                        $keys = array_keys($row);
                        $cols = implode(', ', $keys);
                        $placeholders = implode(', ', array_fill(0, count($keys), '?'));
                        $stmt = $subDb->prepare("INSERT INTO {$tableName} ({$cols}) VALUES ({$placeholders})");
                        $i = 1;
                        foreach ($row as $val) {
                            $stmt->bindValue($i++, $val);
                        }
                        $stmt->execute();
                    }
                }
            }

            $mainDb->close();
            $subDb->close();

            return response()->download($tempPath, $filename, [
                'Content-Type' => 'application/x-sqlite3',
            ])->deleteFileAfterSend(true);
        } catch (\Throwable $e) {
            if (file_exists($tempPath)) @unlink($tempPath);
            return response()->json([
                'success' => false,
                'message' => 'Error generating SQLite database file: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Legacy getData route for backwards compatibility
     */
    public function getData(Request $request)
    {
        $category = $request->query('category', 'sales_amroza');
        // Map old category ids if needed
        $map = [
            'sales' => 'sales_amroza',
            'merchants' => 'merchants_wasooli',
            'farmers' => 'farmers_bijak',
            'products' => 'products_stock',
            'ledger' => 'ledger_expenses',
        ];
        $catId = $map[$category] ?? $category;

        return $this->categoryPreview($request, $catId);
    }

    // ==========================================
    // Internal Helper Methods
    // ==========================================

    protected function getBackupsList(): array
    {
        if (!file_exists($this->backupDir)) {
            return [];
        }

        $files = scandir($this->backupDir);
        $backups = [];

        foreach ($files as $file) {
            if ($file === '.' || $file === '..' || str_starts_with($file, 'temp_') || str_starts_with($file, 'pre_restore_safety_') || !str_ends_with($file, '.db')) {
                continue;
            }

            $filePath = $this->backupDir . DIRECTORY_SEPARATOR . $file;
            $size = filesize($filePath);
            $mtime = filemtime($filePath);

            $backups[] = [
                'filename' => $file,
                'size_bytes' => $size,
                'size_kb' => round($size / 1024, 1),
                'created_at' => date('c', $mtime),
                'formatted_time' => date('d/m/Y, h:i:s A', $mtime),
            ];
        }

        usort($backups, fn($a, $b) => strcmp($b['created_at'], $a['created_at']));

        return $backups;
    }

    protected function checkAndRunAutoBackup(): void
    {
        $backups = $this->getBackupsList();
        $autoBackups = array_filter($backups, fn($b) => str_starts_with($b['filename'], 'mandi_auto_backup_'));

        $shouldRun = false;
        if (empty($autoBackups)) {
            $shouldRun = true;
        } else {
            $latest = reset($autoBackups);
            $latestTime = strtotime($latest['created_at']);
            // If more than 6 hours (21600 seconds) ago
            if (time() - $latestTime > 21600) {
                $shouldRun = true;
            }
        }

        if ($shouldRun) {
            $now = new \DateTime();
            $timestamp = $now->format('Y-m-d\TH-i-s-v\Z');
            $filename = "mandi_auto_backup_{$timestamp}.db";
            $destPath = $this->backupDir . DIRECTORY_SEPARATOR . $filename;
            $dbPath = database_path('database.sqlite');

            if (file_exists($dbPath)) {
                if (class_exists(\SQLite3::class)) {
                    $src = new \SQLite3($dbPath);
                    $dst = new \SQLite3($destPath);
                    $src->backup($dst);
                    $src->close();
                    $dst->close();
                } else {
                    copy($dbPath, $destPath);
                }
            }
        }
    }

    protected function enforceRetentionLimit(int $limit = 15): void
    {
        $backups = $this->getBackupsList();
        if (count($backups) > $limit) {
            // Backups are sorted newest first. The ones after index ($limit - 1) are oldest.
            $toRemove = array_slice($backups, $limit);
            foreach ($toRemove as $item) {
                $p = $this->backupDir . DIRECTORY_SEPARATOR . $item['filename'];
                if (file_exists($p)) {
                    @unlink($p);
                }
            }
        }
    }

    protected function getCategoriesSummary(): array
    {
        return [
            [
                'id' => 'sales_amroza',
                'name' => 'Sales & Amroza',
                'filePrefix' => 'Sales_Amroza',
                'description' => 'Complete record of daily cash and credit sales',
                'icon' => 'Receipt',
                'record_count' => AmrozaSale::count(),
            ],
            [
                'id' => 'merchants_wasooli',
                'name' => 'Merchants & Wasooli',
                'filePrefix' => 'Merchants_Wasooli',
                'description' => 'Buyers, outstanding balances and recovery receipts',
                'icon' => 'Users',
                'record_count' => Merchant::count(),
            ],
            [
                'id' => 'farmers_bijak',
                'name' => 'Farmers & Bijak',
                'filePrefix' => 'Farmers_Bijak',
                'description' => 'Farmer records, bills, charges and commissions',
                'icon' => 'Sprout',
                'record_count' => Farmer::count() + FarmerBill::count(),
            ],
            [
                'id' => 'products_stock',
                'name' => 'Products & Stock',
                'filePrefix' => 'Products_Stock',
                'description' => 'All produce items, stock, rates and shelf life',
                'icon' => 'Boxes',
                'record_count' => Item::count(),
            ],
            [
                'id' => 'ledger_expenses',
                'name' => 'Ledger & Expenses',
                'filePrefix' => 'Ledger_Expenses',
                'description' => 'Daily business expenses, cash book and income & expense log',
                'icon' => 'BookOpen',
                'record_count' => Expense::count(),
            ],
        ];
    }

    protected function getCategoryConfig(string $categoryId): ?array
    {
        $all = [
            'sales_amroza' => [
                'id' => 'sales_amroza',
                'name' => 'Sales & Amroza',
                'filePrefix' => 'Sales_Amroza',
                'description' => 'Complete record of daily cash and credit sales',
                'tables' => ['amroza_sales'],
            ],
            'merchants_wasooli' => [
                'id' => 'merchants_wasooli',
                'name' => 'Merchants & Wasooli',
                'filePrefix' => 'Merchants_Wasooli',
                'description' => 'Buyers, outstanding balances and recovery receipts',
                'tables' => ['merchants', 'merchant_receipts'],
            ],
            'farmers_bijak' => [
                'id' => 'farmers_bijak',
                'name' => 'Farmers & Bijak',
                'filePrefix' => 'Farmers_Bijak',
                'description' => 'Farmer records, bills, charges and commissions',
                'tables' => ['farmers', 'farmer_bills'],
            ],
            'products_stock' => [
                'id' => 'products_stock',
                'name' => 'Products & Stock',
                'filePrefix' => 'Products_Stock',
                'description' => 'All produce items, stock, rates and shelf life',
                'tables' => ['items'],
            ],
            'ledger_expenses' => [
                'id' => 'ledger_expenses',
                'name' => 'Ledger & Expenses',
                'filePrefix' => 'Ledger_Expenses',
                'description' => 'Daily business expenses, cash book and income & expense log',
                'tables' => ['expenses'],
            ],
        ];

        return $all[$categoryId] ?? null;
    }

    protected function fetchCategoryRowsAndColumns(string $categoryId): array
    {
        $produceTranslations = [
            'Aloo' => 'Potato',
            'Tamatar' => 'Tomato',
            'Piyaz' => 'Onion',
            'Harri Mirch' => 'Green Chilli',
            'Band Gobhi' => 'Cabbage',
            'Lehsan' => 'Garlic',
            'Mirchi' => 'Red Chilli',
            'Bhindi' => 'Ladyfinger',
            'Adrak' => 'Ginger',
            'Kheera' => 'Cucumber',
        ];

        switch ($categoryId) {
            case 'sales_amroza':
                $columns = [
                    ['key' => 'invoice_no', 'label' => 'Invoice #'],
                    ['key' => 'date', 'label' => 'Date'],
                    ['key' => 'customer_name', 'label' => 'Customer / Buyer'],
                    ['key' => 'item_name', 'label' => 'Produce Item'],
                    ['key' => 'quantity', 'label' => 'Quantity'],
                    ['key' => 'rate', 'label' => 'Rate'],
                    ['key' => 'grand_total', 'label' => 'Total Amount'],
                    ['key' => 'paid_amount', 'label' => 'Paid'],
                    ['key' => 'remaining_amount', 'label' => 'Balance Due'],
                    ['key' => 'payment_mode', 'label' => 'Payment Method'],
                ];
                $sales = AmrozaSale::with(['merchant', 'item'])->orderBy('id', 'desc')->limit(500)->get();
                $rows = [];
                foreach ($sales as $s) {
                    $mName = $s->merchant ? ($s->merchant->name_en ?: ($s->merchant->name ?: $s->merchant->name_ur)) : 'Cash';
                    $iName = $s->item ? ($s->item->name_en ?: ($s->item->name ?: $s->item->name_ur)) : 'Item';
                    $iName = trim(preg_replace('/\s*\(.*?\)\s*/', '', $iName));
                    $iName = $produceTranslations[$iName] ?? $iName;

                    $unit = $s->item && $s->item->unit ? $s->item->unit : 'Bags';
                    if (strtolower($unit) === 'bori') $unit = 'Bags';
                    if (strtolower($unit) === 'peti') $unit = 'Boxes';

                    $dateStr = $s->date instanceof \DateTimeInterface ? $s->date->format('Y-m-d') : substr((string)$s->date, 0, 10);
                    $tot = (float)($s->gross_amount ?? ($s->nag * $s->rate));
                    $paid = (float)($s->cash_received ?? ($s->payment_type === 'cash' || $s->payment_type === 'naqdi' ? $tot : 0));
                    $rem = (float)($s->udhaar_amount ?? max(0, $tot - $paid));

                    $rawMode = strtoupper($s->payment_type ?: 'CREDIT');
                    $mode = match($rawMode) {
                        'UDHAAR' => 'CREDIT',
                        'NAQDI', 'CASH' => 'CASH',
                        'SPLIT' => 'SPLIT',
                        'BANK' => 'BANK',
                        default => $rawMode,
                    };

                    $rows[] = [
                        'invoice_no' => 'INV-' . $s->id,
                        'date' => $dateStr,
                        'customer_name' => $mName,
                        'item_name' => $iName,
                        'quantity' => ((int)$s->nag) . ' ' . $unit,
                        'rate' => (float)$s->rate,
                        'grand_total' => $tot,
                        'paid_amount' => $paid,
                        'remaining_amount' => $rem,
                        'payment_mode' => $mode,
                    ];
                }
                return ['columns' => $columns, 'rows' => $rows];

            case 'merchants_wasooli':
                $columns = [
                    ['key' => 'code', 'label' => 'Code'],
                    ['key' => 'name', 'label' => 'Customer / Buyer'],
                    ['key' => 'phone', 'label' => 'Phone'],
                    ['key' => 'city', 'label' => 'City / Area'],
                    ['key' => 'credit_limit', 'label' => 'Credit Limit'],
                    ['key' => 'opening_balance', 'label' => 'Opening Balance'],
                    ['key' => 'current_balance', 'label' => 'Outstanding Balance'],
                    ['key' => 'status', 'label' => 'Status'],
                ];
                $merchants = Merchant::orderBy('code', 'asc')->get();
                $rows = [];
                foreach ($merchants as $m) {
                    $rows[] = [
                        'code' => '#' . $m->code,
                        'name' => $m->name_en ?: ($m->name ?: $m->name_ur),
                        'phone' => $m->phone ?: '—',
                        'city' => $m->city ?: 'Market',
                        'credit_limit' => (float)($m->credit_limit ?? 0),
                        'opening_balance' => (float)($m->opening_balance ?? 0),
                        'current_balance' => (float)($m->current_balance ?? 0),
                        'status' => ucfirst($m->status ?: 'Active'),
                    ];
                }
                return ['columns' => $columns, 'rows' => $rows];

            case 'farmers_bijak':
                $columns = [
                    ['key' => 'entry_no', 'label' => 'Consignment #'],
                    ['key' => 'farmer_name', 'label' => 'Farmer Name'],
                    ['key' => 'date', 'label' => 'Date'],
                    ['key' => 'gross_sale', 'label' => 'Gross Sales'],
                    ['key' => 'commission', 'label' => 'Commission'],
                    ['key' => 'mazdoori', 'label' => 'Labor'],
                    ['key' => 'net_payable', 'label' => 'Net Payable'],
                    ['key' => 'paid_amount', 'label' => 'Paid Amount'],
                    ['key' => 'remaining', 'label' => 'Remaining Balance'],
                ];
                $bills = FarmerBill::with('farmer')->orderBy('id', 'desc')->get();
                $rows = [];
                foreach ($bills as $b) {
                    $fName = $b->farmer ? ($b->farmer->name_en ?: ($b->farmer->name ?: $b->farmer->name_ur)) : 'Farmer';
                    $rows[] = [
                        'entry_no' => 'BJK-' . ($b->bill_number ?: $b->id),
                        'farmer_name' => $fName,
                        'date' => substr((string)$b->bill_date, 0, 10),
                        'gross_sale' => (float)($b->total_gross ?? $b->gross_amount ?? 0),
                        'commission' => (float)($b->commission_amount ?? 0),
                        'mazdoori' => (float)($b->mazdoori_amount ?? 0),
                        'net_payable' => (float)($b->net_payable ?? $b->net_amount ?? 0),
                        'paid_amount' => (float)($b->paid_amount ?? 0),
                        'remaining' => (float)($b->remaining_balance ?? 0),
                    ];
                }
                return ['columns' => $columns, 'rows' => $rows];

            case 'products_stock':
                $columns = [
                    ['key' => 'code', 'label' => 'Item Code'],
                    ['key' => 'name', 'label' => 'Produce Item'],
                    ['key' => 'unit', 'label' => 'Unit'],
                    ['key' => 'purchase_rate', 'label' => 'Purchase Rate'],
                    ['key' => 'sale_rate', 'label' => 'Selling Rate'],
                    ['key' => 'stock_quantity', 'label' => 'Stock Quantity'],
                    ['key' => 'shelf_life', 'label' => 'Shelf Life'],
                    ['key' => 'status', 'label' => 'Status'],
                ];
                $items = Item::orderBy('id', 'asc')->get();
                $rows = [];
                foreach ($items as $it) {
                    $rawName = $it->name_en ?: ($it->name ?: $it->name_ur);
                    $itName = trim(preg_replace('/\s*\(.*?\)\s*/', '', $rawName));
                    $itName = $produceTranslations[$itName] ?? $itName;

                    $unit = $it->unit ?: 'Bags';
                    if (strtolower($unit) === 'bori') $unit = 'Bags';
                    if (strtolower($unit) === 'peti') $unit = 'Boxes';

                    $shelf = $it->shelf_life ?: '4-5 days';
                    $shelf = str_replace('din', 'days', $shelf);

                    $stock = (int)($it->current_stock ?? $it->opening_stock ?? 0);
                    $rows[] = [
                        'code' => $it->code ?: ('ITM-' . $it->id),
                        'name' => $itName,
                        'unit' => $unit,
                        'purchase_rate' => (float)($it->purchase_rate ?? 50),
                        'sale_rate' => (float)($it->default_rate ?? $it->rate ?? 70),
                        'stock_quantity' => $stock,
                        'shelf_life' => $shelf,
                        'status' => $stock <= 0 ? 'Out of Stock' : ($stock < 20 ? 'Low Stock' : 'Available'),
                    ];
                }
                return ['columns' => $columns, 'rows' => $rows];

            case 'ledger_expenses':
            default:
                $columns = [
                    ['key' => 'id', 'label' => '#'],
                    ['key' => 'date', 'label' => 'Date'],
                    ['key' => 'name', 'label' => 'Expense Name'],
                    ['key' => 'note', 'label' => 'Description / Notes'],
                    ['key' => 'amount', 'label' => 'Amount'],
                ];
                $expenses = Expense::orderBy('id', 'desc')->limit(500)->get();
                $rows = [];
                foreach ($expenses as $e) {
                    $dateStr = $e->date instanceof \DateTimeInterface ? $e->date->format('Y-m-d') : substr((string)$e->date, 0, 10);
                    $rows[] = [
                        'id' => $e->id,
                        'date' => $dateStr,
                        'name' => $e->name ?: ($e->title ?: 'Expense'),
                        'note' => $e->note ?: ($e->description ?: '—'),
                        'amount' => (float)$e->amount,
                    ];
                }
                return ['columns' => $columns, 'rows' => $rows];
        }
    }

    protected function generateExcelXml(array $sheets, array $columns): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<?mso-application progid="Excel.Sheet"?>' . "\n";
        $xml .= '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' . "\n";
        $xml .= ' xmlns:o="urn:schemas-microsoft-com:office:office"' . "\n";
        $xml .= ' xmlns:x="urn:schemas-microsoft-com:office:excel"' . "\n";
        $xml .= ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"' . "\n";
        $xml .= ' xmlns:html="http://www.w3.org/TR/REC-html40">' . "\n";
        $xml .= '<Styles>' . "\n";
        $xml .= '  <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#000000"/><Interior ss:Color="#dcfce7" ss:Pattern="Solid"/></Style>' . "\n";
        $xml .= '  <Style ss:ID="Number"><NumberFormat ss:Format="#,##0.00"/></Style>' . "\n";
        $xml .= '</Styles>' . "\n";

        foreach ($sheets as $sheetName => $rows) {
            $xml .= '<Worksheet ss:Name="' . htmlspecialchars(substr($sheetName, 0, 31), ENT_XML1) . '">' . "\n";
            $xml .= ' <Table>' . "\n";

            // Headers
            $xml .= '  <Row>' . "\n";
            foreach ($columns as $col) {
                $xml .= '   <Cell ss:StyleID="Header"><Data ss:Type="String">' . htmlspecialchars((string)$col['label'], ENT_XML1) . '</Data></Cell>' . "\n";
            }
            $xml .= '  </Row>' . "\n";

            // Data
            foreach ($rows as $row) {
                $xml .= '  <Row>' . "\n";
                foreach ($columns as $col) {
                    $val = $row[$col['key']] ?? '';
                    if (is_numeric($val) && !str_starts_with((string)$val, '0') && !str_contains((string)$col['key'], 'phone')) {
                        $xml .= '   <Cell ss:StyleID="Number"><Data ss:Type="Number">' . (float)$val . '</Data></Cell>' . "\n";
                    } else {
                        $xml .= '   <Cell><Data ss:Type="String">' . htmlspecialchars((string)$val, ENT_XML1) . '</Data></Cell>' . "\n";
                    }
                }
                $xml .= '  </Row>' . "\n";
            }

            $xml .= ' </Table>' . "\n";
            $xml .= '</Worksheet>' . "\n";
        }

        $xml .= '</Workbook>';
        return $xml;
    }
}
