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
        Schema::create('investment_partners', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('name_ur')->nullable();
            $table->enum('role', ['partner', 'owner'])->default('partner');
            $table->string('phone')->nullable();
            $table->decimal('profit_percentage', 5, 2)->default(0);
            $table->decimal('opening_capital', 14, 2)->default(0);
            $table->enum('status', ['active', 'pending_approval', 'inactive'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('investment_loans', function (Blueprint $table) {
            $table->id();
            $table->string('lender_name');
            $table->string('lender_name_ur')->nullable();
            $table->string('phone')->nullable();
            $table->decimal('principal_amount', 14, 2)->default(0);
            $table->decimal('fee_or_interest', 14, 2)->default(0);
            $table->decimal('paid_amount', 14, 2)->default(0);
            $table->date('due_date')->nullable();
            $table->enum('status', ['active', 'settled', 'overdue'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('investment_surplus', function (Blueprint $table) {
            $table->id();
            $table->string('fund_name');
            $table->string('fund_name_ur')->nullable();
            $table->decimal('principal_amount', 14, 2)->default(0);
            $table->decimal('profit_or_loss', 14, 2)->default(0);
            $table->string('roi_rate')->nullable();
            $table->boolean('is_realised')->default(false);
            $table->date('maturity_date')->nullable();
            $table->enum('status', ['active', 'matured', 'reversed'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('investment_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('ref_no')->unique();
            $table->date('date');
            $table->enum('type', [
                'capital_in',
                'capital_out',
                'loan_in',
                'loan_out',
                'surplus_out',
                'surplus_in'
            ]);
            $table->foreignId('partner_id')->nullable()->constrained('investment_partners')->nullOnDelete();
            $table->foreignId('loan_id')->nullable()->constrained('investment_loans')->nullOnDelete();
            $table->foreignId('surplus_id')->nullable()->constrained('investment_surplus')->nullOnDelete();
            $table->string('party_name');
            $table->decimal('amount', 14, 2);
            $table->enum('payment_method', ['cash', 'bank'])->default('cash');
            $table->string('bank_name')->nullable();
            $table->string('reason')->nullable();
            $table->boolean('is_advance')->default(false);
            $table->decimal('advance_amount', 14, 2)->default(0);
            $table->enum('approval_status', ['approved', 'pending_owner', 'reversed', 'posted'])->default('posted');
            $table->string('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->enum('created_by_role', ['owner', 'munshi'])->default('munshi');
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_reversed')->default(false);
            $table->string('reversal_reason')->nullable();
            $table->string('reversal_ref_no')->nullable();
            $table->timestamps();
        });

        Schema::create('investment_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('action');
            $table->foreignId('transaction_id')->nullable()->constrained('investment_transactions')->nullOnDelete();
            $table->string('ref_no')->nullable();
            $table->string('user_name');
            $table->string('user_role');
            $table->text('details')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('investment_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->nullable()->constrained('investment_partners')->nullOnDelete();
            $table->string('partner_name');
            $table->decimal('attempted_amount', 14, 2);
            $table->decimal('excess_amount', 14, 2);
            $table->boolean('resolved')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('investment_alerts');
        Schema::dropIfExists('investment_audit_logs');
        Schema::dropIfExists('investment_transactions');
        Schema::dropIfExists('investment_surplus');
        Schema::dropIfExists('investment_loans');
        Schema::dropIfExists('investment_partners');
    }
};
