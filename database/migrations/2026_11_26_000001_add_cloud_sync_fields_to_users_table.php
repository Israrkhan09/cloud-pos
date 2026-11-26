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
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (!Schema::hasColumn('users', 'cloud_user_id')) {
                    $table->string('cloud_user_id', 64)->nullable()->index()->after('id');
                }
                if (!Schema::hasColumn('users', 'business_id')) {
                    $table->string('business_id', 64)->nullable()->index()->after('cloud_user_id');
                }
                if (!Schema::hasColumn('users', 'status')) {
                    $table->string('status', 50)->default('Active')->after('role');
                }
                if (!Schema::hasColumn('users', 'last_synced_at')) {
                    $table->timestamp('last_synced_at')->nullable()->after('status');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                $columnsToDrop = [];
                if (Schema::hasColumn('users', 'cloud_user_id')) {
                    $columnsToDrop[] = 'cloud_user_id';
                }
                if (Schema::hasColumn('users', 'business_id')) {
                    $columnsToDrop[] = 'business_id';
                }
                if (Schema::hasColumn('users', 'status')) {
                    $columnsToDrop[] = 'status';
                }
                if (Schema::hasColumn('users', 'last_synced_at')) {
                    $columnsToDrop[] = 'last_synced_at';
                }
                if (!empty($columnsToDrop)) {
                    $table->dropColumn($columnsToDrop);
                }
            });
        }
    }
};
