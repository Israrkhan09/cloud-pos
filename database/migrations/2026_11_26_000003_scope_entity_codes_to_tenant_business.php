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
        $driver = DB::getDriverName();

        if ($driver === 'sqlite' || $driver === 'pgsql') {
            // Drop global unique indexes
            DB::statement('DROP INDEX IF EXISTS merchants_code_unique');
            DB::statement('DROP INDEX IF EXISTS farmers_code_unique');
            DB::statement('DROP INDEX IF EXISTS employees_code_unique');
            DB::statement('DROP INDEX IF EXISTS customers_code_unique');
            DB::statement('DROP INDEX IF EXISTS customers_phone_unique');
            DB::statement('DROP INDEX IF EXISTS customers_email_unique');
            DB::statement('DROP INDEX IF EXISTS customers_whatsapp_unique');

            // Create composite unique indexes scoped by business_id
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS merchants_business_id_code_unique ON merchants (business_id, code)');
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS farmers_business_id_code_unique ON farmers (business_id, code)');
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS employees_business_id_code_unique ON employees (business_id, code)');
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS customers_business_id_code_unique ON customers (business_id, code)');
        } else {
            Schema::table('merchants', function (Blueprint $table) {
                $table->dropUnique('merchants_code_unique');
                $table->unique(['business_id', 'code'], 'merchants_business_id_code_unique');
            });

            Schema::table('farmers', function (Blueprint $table) {
                $table->dropUnique('farmers_code_unique');
                $table->unique(['business_id', 'code'], 'farmers_business_id_code_unique');
            });

            Schema::table('employees', function (Blueprint $table) {
                $table->dropUnique('employees_code_unique');
                $table->unique(['business_id', 'code'], 'employees_business_id_code_unique');
            });

            Schema::table('customers', function (Blueprint $table) {
                $table->dropUnique('customers_code_unique');
                $table->dropUnique('customers_phone_unique');
                $table->dropUnique('customers_email_unique');
                $table->dropUnique('customers_whatsapp_unique');
                $table->unique(['business_id', 'code'], 'customers_business_id_code_unique');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'sqlite' || $driver === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS merchants_business_id_code_unique');
            DB::statement('DROP INDEX IF EXISTS farmers_business_id_code_unique');
            DB::statement('DROP INDEX IF EXISTS employees_business_id_code_unique');
            DB::statement('DROP INDEX IF EXISTS customers_business_id_code_unique');

            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS merchants_code_unique ON merchants (code)');
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS farmers_code_unique ON farmers (code)');
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS employees_code_unique ON employees (code)');
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS customers_code_unique ON customers (code)');
        } else {
            Schema::table('merchants', function (Blueprint $table) {
                $table->dropUnique('merchants_business_id_code_unique');
                $table->unique('code', 'merchants_code_unique');
            });

            Schema::table('farmers', function (Blueprint $table) {
                $table->dropUnique('farmers_business_id_code_unique');
                $table->unique('code', 'farmers_code_unique');
            });

            Schema::table('employees', function (Blueprint $table) {
                $table->dropUnique('employees_business_id_code_unique');
                $table->unique('code', 'employees_code_unique');
            });

            Schema::table('customers', function (Blueprint $table) {
                $table->dropUnique('customers_business_id_code_unique');
                $table->unique('code', 'customers_code_unique');
            });
        }
    }
};
