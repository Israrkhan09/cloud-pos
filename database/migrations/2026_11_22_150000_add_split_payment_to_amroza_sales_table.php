<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('amroza_sales', function (Blueprint $table) {
            $table->decimal('cash_received', 12, 2)->nullable()->default(0)->after('payment_type');
            $table->decimal('udhaar_amount', 12, 2)->nullable()->default(0)->after('cash_received');
        });
    }

    public function down(): void
    {
        Schema::table('amroza_sales', function (Blueprint $table) {
            $table->dropColumn(['cash_received', 'udhaar_amount']);
        });
    }
};
