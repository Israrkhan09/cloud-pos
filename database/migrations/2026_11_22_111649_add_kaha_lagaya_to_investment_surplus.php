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
        Schema::table('investment_surplus', function (Blueprint $table) {
            $table->string('kaha_lagaya')->nullable()->after('fund_name_ur');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('investment_surplus', function (Blueprint $table) {
            $table->dropColumn('kaha_lagaya');
        });
    }
};
