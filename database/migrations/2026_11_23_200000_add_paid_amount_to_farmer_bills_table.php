<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('farmer_bills', function (Blueprint $table) {
            if (!Schema::hasColumn('farmer_bills', 'paid_amount')) {
                $table->decimal('paid_amount', 12, 2)->default(0)->after('net_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('farmer_bills', function (Blueprint $table) {
            if (Schema::hasColumn('farmer_bills', 'paid_amount')) {
                $table->dropColumn('paid_amount');
            }
        });
    }
};
