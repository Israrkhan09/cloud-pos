<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->string('shelf_life')->nullable()->after('default_bardana');
            $table->integer('shelf_life_days')->nullable()->after('shelf_life');
            $table->decimal('discount_rate', 10, 2)->nullable()->after('default_rate');
            $table->dateTime('expiry_at')->nullable()->after('shelf_life_days');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropColumn(['shelf_life', 'shelf_life_days', 'discount_rate', 'expiry_at']);
        });
    }
};
