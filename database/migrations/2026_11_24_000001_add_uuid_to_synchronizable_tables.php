<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Synchronizable domain tables in order of dependency.
     */
    protected array $tables = [
        // Primary Mandi Subsystem
        'areas',
        'merchants',
        'farmers',
        'farmer_marks',
        'items',
        'amroza_sales',
        'merchant_receipts',
        'farmer_bills',
        'investment_partners',
        'investment_loans',
        'investment_surplus',
        'investment_transactions',
        'investment_audit_logs',
        'investment_alerts',

        // Cash Book / Expenses
        'expenses',

        // Retail POS Subsystem
        'customers',
        'employees',
        'suppliers',
        'categories',
        'brands',
        'attributes',
        'products',
        'purchases',
        'purchase_details',
        'purchase_payments',
        'sales',
        'sale_details',
        'sale_payments',
        'currencies',
        'purchase_returns',
        'purchse_return_details',
        'sale_returns',
        'sale_return_details',
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        foreach ($this->tables as $tableName) {
            if (!Schema::hasTable($tableName)) {
                continue;
            }

            // 1. Add uuid column as nullable if it doesn't exist
            if (!Schema::hasColumn($tableName, 'uuid')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->uuid('uuid')->nullable()->after('id');
                });
            }

            // 2. Populate UUIDs for existing records safely
            $existing = DB::table($tableName)
                ->whereNull('uuid')
                ->orWhere('uuid', '')
                ->select('id')
                ->get();

            foreach ($existing as $row) {
                DB::table($tableName)
                    ->where('id', $row->id)
                    ->update([
                        'uuid' => (string) Str::uuid(),
                    ]);
            }

            // 3. Add unique index if not already present
            $indexes = Schema::getIndexes($tableName);
            $hasUuidIndex = collect($indexes)->contains(function ($index) {
                return in_array('uuid', $index['columns']);
            });

            if (!$hasUuidIndex) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->unique('uuid');
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        foreach ($this->tables as $tableName) {
            if (!Schema::hasTable($tableName) || !Schema::hasColumn($tableName, 'uuid')) {
                continue;
            }

            // Drop unique index safely first to prevent SQLite index-dangling constraint errors
            try {
                if (DB::getDriverName() === 'sqlite') {
                    DB::statement("DROP INDEX IF EXISTS \"{$tableName}_uuid_unique\"");
                } else {
                    Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                        $table->dropUnique($tableName . '_uuid_unique');
                    });
                }
            } catch (\Throwable $e) {
                // Continue if index already dropped
            }

            Schema::table($tableName, function (Blueprint $table) {
                $table->dropColumn('uuid');
            });
        }
    }
};
