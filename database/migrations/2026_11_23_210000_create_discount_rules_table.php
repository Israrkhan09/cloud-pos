<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('discount_rules')) {
            Schema::create('discount_rules', function (Blueprint $table) {
                $table->id();
                $table->string('rule_name');
                $table->string('discount_type'); // 'percentage' or 'fixed'
                $table->decimal('discount_value', 10, 2);
                $table->decimal('min_order_amount', 12, 2)->default(5000);
                $table->boolean('is_active')->default(true);
                $table->text('description')->nullable();
                $table->timestamps();
            });

            // Seed standard initial Mandi Bismillah discount rules
            DB::table('discount_rules')->insert([
                [
                    'rule_name' => 'Thok Discount 2%',
                    'discount_type' => 'percentage',
                    'discount_value' => 2.0,
                    'min_order_amount' => 10000,
                    'is_active' => true,
                    'description' => '10,000 se ooper bill par 2 feesad riaayat',
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'rule_name' => 'Bara Khareedar Discount Rs 250',
                    'discount_type' => 'fixed',
                    'discount_value' => 250.0,
                    'min_order_amount' => 15000,
                    'is_active' => true,
                    'description' => '15,000 se ooper par 250 rupay fixed kam',
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'rule_name' => 'Special Mandi Discount Rs 500',
                    'discount_type' => 'fixed',
                    'discount_value' => 500.0,
                    'min_order_amount' => 30000,
                    'is_active' => true,
                    'description' => '30,000 se baray bill par 500 rupay',
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'rule_name' => 'Special Customer discount',
                    'discount_type' => 'percentage',
                    'discount_value' => 3.0,
                    'min_order_amount' => 10000,
                    'is_active' => true,
                    'description' => '10000 se uper par 3 feesad discount',
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('discount_rules');
    }
};
