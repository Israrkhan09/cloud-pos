<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('merchants', function (Blueprint $table) {
            if (!Schema::hasColumn('merchants', 'city')) {
                $table->string('city')->nullable()->after('phone');
            }
            if (!Schema::hasColumn('merchants', 'customer_type')) {
                $table->string('customer_type')->nullable()->after('city');
            }
            if (!Schema::hasColumn('merchants', 'credit_limit')) {
                $table->decimal('credit_limit', 14, 2)->default(0)->after('customer_type');
            }
            if (!Schema::hasColumn('merchants', 'description')) {
                $table->string('description')->nullable()->after('credit_limit');
            }
            if (!Schema::hasColumn('merchants', 'notes')) {
                $table->text('notes')->nullable()->after('description');
            }
        });

        // Initialize default metadata for existing merchants if empty
        DB::table('merchants')->where('id', 2)->update([
            'city' => 'Model Town Market',
            'customer_type' => 'Dukandar',
            'credit_limit' => 200000,
            'description' => 'Purana qabil-e-eetimad dukandar',
        ]);
        DB::table('merchants')->where('id', 3)->update([
            'city' => 'Defence Chowk',
            'customer_type' => 'Wholesaler',
            'credit_limit' => 100000,
            'description' => 'Thok purchase',
        ]);
        DB::table('merchants')->where('id', 4)->update([
            'city' => 'Purani Sabzi Mandi',
            'customer_type' => 'Dukandar',
            'credit_limit' => 50000,
            'description' => 'Haftawar wasooli hisaab',
        ]);
        DB::table('merchants')->where('id', 5)->update([
            'city' => 'GT Road Bypass',
            'customer_type' => 'Hotel',
            'credit_limit' => 100000,
            'description' => 'Rozana sabzi ki delivery',
        ]);
        DB::table('merchants')->where('id', 6)->update([
            'city' => 'Site Karachi',
            'customer_type' => 'Dukandar',
            'credit_limit' => 50000,
            'description' => 'Mandi Dukandar',
        ]);
        DB::table('merchants')->where('id', 7)->update([
            'city' => 'Sangarh',
            'customer_type' => 'Mashakhor',
            'credit_limit' => 250000,
            'description' => 'Mashakhor (Mandi Buyer)',
        ]);
    }

    public function down(): void
    {
        Schema::table('merchants', function (Blueprint $table) {
            $table->dropColumn(['city', 'customer_type', 'credit_limit', 'description', 'notes']);
        });
    }
};
