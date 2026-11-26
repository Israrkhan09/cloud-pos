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
        // 1. Add role to users table if not exists
        if (Schema::hasTable('users') && !Schema::hasColumn('users', 'role')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('role', 50)->default('Admin')->after('email');
            });
        }

        // 2. Create pos_permissions table for scalable central-to-local permission caching
        if (!Schema::hasTable('pos_permissions')) {
            Schema::create('pos_permissions', function (Blueprint $table) {
                $table->id();
                $table->string('role', 50)->index(); // 'Admin' or 'Employee'
                $table->string('business_id', 64)->nullable()->index();
                $table->json('allowed_features');
                $table->timestamp('synced_at')->nullable();
                $table->string('version', 30)->nullable();
                $table->timestamps();

                $table->unique(['role', 'business_id'], 'uq_pos_permissions_role_biz');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pos_permissions');
        if (Schema::hasColumn('users', 'role')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('role');
            });
        }
    }
};
