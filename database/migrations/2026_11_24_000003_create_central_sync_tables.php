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
        if (!Schema::hasTable('sync_devices')) {
            Schema::create('sync_devices', function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();
                $table->string('device_id', 64)->unique();
                $table->string('device_name', 120)->nullable();
                $table->string('api_token_hash', 64)->unique();
                $table->string('hostname', 120)->nullable();
                $table->string('os', 60)->nullable();
                $table->string('app_version', 30)->nullable();
                $table->string('status', 20)->default('active')->index();
                $table->timestamp('last_seen_at')->nullable();
                $table->timestamp('last_synced_at')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('sync_events')) {
            Schema::create('sync_events', function (Blueprint $table) {
                $table->id();
                $table->uuid('event_uuid')->unique();
                $table->string('device_id', 64)->index();
                $table->string('entity_type', 100)->index();
                $table->uuid('entity_uuid')->index();
                $table->string('operation', 20)->index();
                $table->json('payload');
                $table->string('status', 30)->default('received')->index();
                $table->text('error_message')->nullable();
                $table->timestamp('event_timestamp')->nullable();
                $table->timestamp('received_at')->nullable()->index();
                $table->timestamp('processed_at')->nullable();
                $table->timestamps();

                $table->index(['device_id', 'status'], 'sync_events_device_status_index');
                $table->index(['entity_type', 'entity_uuid'], 'sync_events_entity_index');
                $table->index(['id', 'device_id'], 'sync_events_cursor_device_index');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sync_events');
        Schema::dropIfExists('sync_devices');
    }
};
