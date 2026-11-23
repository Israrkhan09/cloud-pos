<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            if (!Schema::hasColumn('items', 'code')) {
                $table->string('code', 50)->nullable()->after('id');
            }
            if (!Schema::hasColumn('items', 'purchase_rate')) {
                $table->decimal('purchase_rate', 10, 2)->nullable()->after('default_rate');
            }
        });

        // Populate initial codes & purchase rates for existing items if empty
        $presets = [
            1 => ['code' => 'ALO-01', 'purchase_rate' => 520],
            2 => ['code' => 'PYZ-01', 'purchase_rate' => 1350],
            3 => ['code' => 'TMT-01', 'purchase_rate' => 850],
            4 => ['code' => 'HMR-01', 'purchase_rate' => 1900],
            5 => ['code' => 'BND-01', 'purchase_rate' => 45],
            6 => ['code' => 'LHS-01', 'purchase_rate' => 3900],
            7 => ['code' => 'MRC-01', 'purchase_rate' => 850],
            8 => ['code' => 'BHN-01', 'purchase_rate' => 120],
        ];

        foreach ($presets as $id => $data) {
            DB::table('items')->where('id', $id)->update([
                'code' => $data['code'],
                'purchase_rate' => $data['purchase_rate'],
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            if (Schema::hasColumn('items', 'purchase_rate')) {
                $table->dropColumn('purchase_rate');
            }
            if (Schema::hasColumn('items', 'code')) {
                $table->dropColumn('code');
            }
        });
    }
};
