<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expiry_lots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->nullable()->constrained('items')->nullOnDelete();
            $table->string('item_name');
            $table->string('lot_code');
            $table->date('arrival_date');
            $table->dateTime('expiry_at');
            $table->decimal('quantity', 10, 2)->default(0);
            $table->string('unit')->default('kg');
            $table->decimal('rate', 10, 2)->default(0);
            $table->decimal('nuqsan', 12, 2)->default(0);
            $table->string('status')->default('fresh'); // expired, jaldi_bechein, fresh
            $table->decimal('discount_rate', 10, 2)->nullable();
            $table->string('action_taken')->nullable();
            $table->timestamps();
        });

        Schema::create('gifts', function (Blueprint $table) {
            $table->id();
            $table->string('voucher_no')->unique();
            $table->date('date');
            $table->string('recipient_name');
            $table->foreignId('item_id')->nullable()->constrained('items')->nullOnDelete();
            $table->foreignId('lot_id')->nullable()->constrained('expiry_lots')->nullOnDelete();
            $table->string('item_name');
            $table->decimal('quantity', 10, 2)->default(0);
            $table->string('unit')->default('kg');
            $table->decimal('rate', 10, 2)->default(0);
            $table->decimal('value', 12, 2)->default(0);
            $table->string('reason')->default('Loyalty'); // Eid, Loyalty, Muawza, Sample
            $table->string('status')->default('approved'); // approved, pending_owner
            $table->timestamps();
        });

        Schema::create('wastages', function (Blueprint $table) {
            $table->id();
            $table->string('voucher_no')->unique();
            $table->date('date');
            $table->foreignId('item_id')->nullable()->constrained('items')->nullOnDelete();
            $table->foreignId('lot_id')->nullable()->constrained('expiry_lots')->nullOnDelete();
            $table->string('item_name');
            $table->decimal('quantity', 10, 2)->default(0);
            $table->string('unit')->default('kg');
            $table->decimal('loss_amount', 12, 2)->default(0);
            $table->string('reason')->default('Kharab Maal');
            $table->string('status')->default('approved');
            $table->string('approved_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wastages');
        Schema::dropIfExists('gifts');
        Schema::dropIfExists('expiry_lots');
    }
};
