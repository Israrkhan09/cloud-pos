<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tables requiring multi-tenant business isolation.
     */
    protected array $tenantTables = [
        'amroza_sales',
        'areas',
        'attributes',
        'brands',
        'categories',
        'currencies',
        'customers',
        'discount_rules',
        'employees',
        'expenses',
        'expiry_lots',
        'farmer_bills',
        'farmer_marks',
        'farmers',
        'gifts',
        'investment_alerts',
        'investment_audit_logs',
        'investment_loans',
        'investment_partners',
        'investment_surplus',
        'investment_transactions',
        'items',
        'merchant_receipts',
        'merchants',
        'products',
        'purchases',
        'purchase_details',
        'purchase_payments',
        'purchase_returns',
        'purchse_return_details',
        'sales',
        'sale_details',
        'sale_payments',
        'sale_returns',
        'sale_return_details',
        'suppliers',
        'sync_outbox',
        'wastages',
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Create businesses table if not exists
        if (!Schema::hasTable('businesses')) {
            Schema::create('businesses', function (Blueprint $table) {
                $table->string('id', 64)->primary();
                $table->string('name', 255)->default('Sabzi Mandi Station');
                $table->string('owner_name', 255)->nullable();
                $table->string('email', 255)->nullable();
                $table->string('phone', 50)->nullable();
                $table->string('city', 100)->nullable();
                $table->string('mandi_location', 255)->nullable();
                $table->text('address')->nullable();
                $table->string('status', 50)->default('Active');
                $table->timestamps();
            });
        }

        // 2. Seed initial businesses
        $initialBusinesses = [
            [
                'id'             => 'biz-test-business',
                'name'           => 'Test Business',
                'owner_name'     => 'Test Owner',
                'email'          => 'test@test.com',
                'city'           => 'Lahore',
                'mandi_location' => 'Lahore Wholesale Mandi',
                'status'         => 'Active',
            ],
            [
                'id'             => 'biz-mwwelxma-b9b93a',
                'name'           => 'Kashmir Sabzi Mandi',
                'owner_name'     => 'Chaudhry Ali',
                'email'          => 'anushakamran20@gmail.com',
                'city'           => 'Kashmir',
                'mandi_location' => 'Kashmir Sabzi Mandi',
                'status'         => 'Active',
            ],
            [
                'id'             => 'biz-mwv1lmd6-e2d6bb',
                'name'           => 'Karachi Sabzi Mandi',
                'owner_name'     => 'Chaudhry Ahmed',
                'email'          => 'scriptsensetech@gmail.com',
                'city'           => 'Karachi',
                'mandi_location' => 'Karachi Wholesale Mandi',
                'status'         => 'Active',
            ],
        ];

        foreach ($initialBusinesses as $biz) {
            $exists = DB::table('businesses')->where('id', $biz['id'])->exists();
            if (!$exists) {
                DB::table('businesses')->insert(array_merge($biz, [
                    'created_at' => now(),
                    'updated_at' => now(),
                ]));
            }
        }

        // 3. Add business_id column and index to each tenant table safely
        foreach ($this->tenantTables as $table) {
            if (Schema::hasTable($table) && !Schema::hasColumn($table, 'business_id')) {
                Schema::table($table, function (Blueprint $tableBlueprint) {
                    $tableBlueprint->string('business_id', 64)->nullable()->index();
                });
            }
        }

        // 4. Assign test user to Test Business
        DB::table('users')
            ->where('email', 'test@test.com')
            ->where(function ($q) {
                $q->whereNull('business_id')->orWhere('business_id', '');
            })
            ->update([
                'business_id' => 'biz-test-business',
                'updated_at'  => now(),
            ]);

        // 5. Backfill all existing business records to Test Business (biz-test-business)
        // This guarantees zero data loss and preserves all historical test data
        foreach ($this->tenantTables as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'business_id')) {
                DB::table($table)
                    ->whereNull('business_id')
                    ->orWhere('business_id', '')
                    ->update(['business_id' => 'biz-test-business']);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        foreach ($this->tenantTables as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'business_id')) {
                Schema::table($table, function (Blueprint $tableBlueprint) {
                    $tableBlueprint->dropColumn('business_id');
                });
            }
        }

        Schema::dropIfExists('businesses');
    }
};
