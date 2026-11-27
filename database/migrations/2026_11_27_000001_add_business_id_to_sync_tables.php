<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('sync_devices') && !Schema::hasColumn('sync_devices', 'business_id')) {
            Schema::table('sync_devices', function (Blueprint $table) {
                $table->string('business_id', 64)->nullable()->index()->after('device_id');
            });
        }

        if (Schema::hasTable('sync_events') && !Schema::hasColumn('sync_events', 'business_id')) {
            Schema::table('sync_events', function (Blueprint $table) {
                $table->string('business_id', 64)->nullable()->index()->after('device_id');
            });
        }

        // Backfill any existing devices/events safely to Test Business if empty
        if (Schema::hasTable('sync_devices') && Schema::hasColumn('sync_devices', 'business_id')) {
            DB::table('sync_devices')
                ->whereNull('business_id')
                ->orWhere('business_id', '')
                ->update(['business_id' => 'biz-test-business']);
        }

        if (Schema::hasTable('sync_events') && Schema::hasColumn('sync_events', 'business_id')) {
            DB::table('sync_events')
                ->whereNull('business_id')
                ->orWhere('business_id', '')
                ->update(['business_id' => 'biz-test-business']);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('sync_devices') && Schema::hasColumn('sync_devices', 'business_id')) {
            Schema::table('sync_devices', function (Blueprint $table) {
                $table->dropColumn('business_id');
            });
        }

        if (Schema::hasTable('sync_events') && Schema::hasColumn('sync_events', 'business_id')) {
            Schema::table('sync_events', function (Blueprint $table) {
                $table->dropColumn('business_id');
            });
        }
    }
};
