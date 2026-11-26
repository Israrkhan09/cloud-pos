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
        if (!Schema::hasTable('sync_outbox')) {
            Schema::create('sync_outbox', function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();
                $table->string('device_id', 64)->index();
                $table->string('entity_type', 100)->index();
                $table->uuid('entity_uuid')->index();
                $table->string('operation', 20)->index(); // 'create', 'update', 'delete'
                $table->json('payload');
                $table->string('status', 30)->default('pending')->index(); // 'pending', 'processing', 'synced', 'failed'
                $table->unsignedInteger('attempts')->default(0);
                $table->text('last_error')->nullable();
                $table->timestamp('synced_at')->nullable()->index();
                $table->timestamps();

                // Compound indexes for high-speed queue operations
                $table->index(['status', 'id'], 'sync_outbox_status_id_index');
                $table->index(['entity_type', 'entity_uuid'], 'sync_outbox_entity_index');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sync_outbox');
    }
};
