<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->decimal('kg_per_unit', 8, 2)->nullable()->after('unit');
            $table->integer('opening_stock')->default(0)->after('kg_per_unit');
            $table->integer('current_stock')->nullable()->after('opening_stock');
            $table->integer('low_stock_alert')->default(10)->after('current_stock');
            $table->string('lot_date', 50)->nullable()->after('low_stock_alert');
            $table->string('stock_note', 255)->nullable()->after('lot_date');
        });
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropColumn([
                'kg_per_unit',
                'opening_stock',
                'current_stock',
                'low_stock_alert',
                'lot_date',
                'stock_note',
            ]);
        });
    }
};
