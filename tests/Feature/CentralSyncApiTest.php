<?php

namespace Tests\Feature;

use App\Models\AmrozaSale;
use App\Models\Item;
use App\Models\Merchant;
use App\Models\SyncDevice;
use App\Models\SyncEvent;
use App\Models\SyncOutbox;
use App\Services\AmrozaService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Str;
use Tests\TestCase;

class CentralSyncApiTest extends TestCase
{
    use RefreshDatabase;

    protected function registerTestDevice(string $deviceId = 'POS-TEST-DEVICE-01', ?string $regKey = null): array
    {
        $headers = [];
        if ($regKey !== null) {
            $headers['X-Sync-Registration-Key'] = $regKey;
        }

        $response = $this->postJson('/api/v1/sync/register', [
            'device_id'   => $deviceId,
            'device_name' => 'Counter 1 POS',
            'hostname'    => 'MANDI-PC-01',
            'os'          => 'Windows',
            'app_version' => '1.0.0',
        ], $headers);

        return [$response, $response->json('data.api_token')];
    }

    public function test_device_registration_issues_token_stores_hash_and_rotates_with_valid_token(): void
    {
        [$response, $token] = $this->registerTestDevice('POS-UNIT-0001');

        $response->assertStatus(201)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'device_uuid',
                    'device_id',
                    'device_name',
                    'status',
                    'api_token',
                    'created',
                ],
            ])
            ->assertJson([
                'success' => true,
                'data'    => [
                    'device_id' => 'POS-UNIT-0001',
                    'status'    => 'active',
                    'created'   => true,
                ],
            ]);

        $this->assertNotEmpty($token);
        $this->assertArrayNotHasKey('api_token_hash', $response->json('data'));

        $device = SyncDevice::where('device_id', 'POS-UNIT-0001')->first();
        $this->assertNotNull($device);
        $this->assertSame(hash('sha256', $token), $device->api_token_hash);
        $this->assertTrue($device->verifyToken($token));

        // Unauthorized re-registration without valid token must be rejected
        $this->postJson('/api/v1/sync/register', [
            'device_id' => 'POS-UNIT-0001',
        ])->assertStatus(401)
            ->assertJson(['success' => false, 'error' => 'device_already_registered']);

        // Rotation with valid bearer token succeeds and issues a new token
        $rotateResponse = $this->postJson('/api/v1/sync/register', [
            'device_id'   => 'POS-UNIT-0001',
            'device_name' => 'Counter 1 Updated',
        ], [
            'Authorization' => 'Bearer ' . $token,
        ]);

        $rotateResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'device_id'   => 'POS-UNIT-0001',
                    'device_name' => 'Counter 1 Updated',
                    'created'     => false,
                ],
            ]);

        $newToken = $rotateResponse->json('data.api_token');
        $this->assertNotSame($token, $newToken);
        $this->assertTrue($device->fresh()->verifyToken($newToken));
        $this->assertFalse($device->fresh()->verifyToken($token));
    }

    public function test_device_registration_enforces_registration_key_when_configured(): void
    {
        Config::set('sync.registration_key', 'test-secret-key-2026');

        // Missing key
        $this->postJson('/api/v1/sync/register', [
            'device_id' => 'POS-KEY-TEST-01',
        ])->assertStatus(401)
            ->assertJson(['success' => false, 'error' => 'invalid_registration_key']);

        // Wrong key
        $this->postJson('/api/v1/sync/register', [
            'device_id' => 'POS-KEY-TEST-01',
        ], [
            'X-Sync-Registration-Key' => 'wrong-key',
        ])->assertStatus(401)
            ->assertJson(['success' => false, 'error' => 'invalid_registration_key']);

        // Correct key
        [$res, $token] = $this->registerTestDevice('POS-KEY-TEST-01', 'test-secret-key-2026');
        $res->assertStatus(201);
        $this->assertNotEmpty($token);
    }

    public function test_invalid_device_credentials_and_inactive_devices_are_rejected(): void
    {
        [$res, $token] = $this->registerTestDevice('POS-AUTH-0001');
        $res->assertStatus(201);

        // Missing credentials
        $this->getJson('/api/v1/sync/status')
            ->assertStatus(401)
            ->assertJson(['success' => false, 'error' => 'unauthenticated_device']);

        // Unregistered device ID
        $this->getJson('/api/v1/sync/status', [
            'Authorization' => 'Bearer ' . $token,
            'X-Device-Id'   => 'POS-UNKNOWN-999',
        ])->assertStatus(401)
            ->assertJson(['success' => false, 'error' => 'invalid_device_credentials']);

        // Wrong token
        $this->getJson('/api/v1/sync/status', [
            'Authorization' => 'Bearer wrong-token',
            'X-Device-Id'   => 'POS-AUTH-0001',
        ])->assertStatus(401)
            ->assertJson(['success' => false, 'error' => 'invalid_device_credentials']);

        // Mismatched header and payload device_id
        $this->postJson('/api/v1/sync/push', [
            'device_id' => 'POS-SPOOFED-999',
            'events'    => [],
        ], [
            'Authorization' => 'Bearer ' . $token,
            'X-Device-Id'   => 'POS-AUTH-0001',
        ])->assertStatus(403)
            ->assertJson(['success' => false, 'error' => 'device_id_mismatch']);

        // Revoked device
        SyncDevice::where('device_id', 'POS-AUTH-0001')->update(['status' => SyncDevice::STATUS_REVOKED]);

        $this->getJson('/api/v1/sync/status', [
            'Authorization' => 'Bearer ' . $token,
            'X-Device-Id'   => 'POS-AUTH-0001',
        ])->assertStatus(403)
            ->assertJson(['success' => false, 'error' => 'device_inactive']);
    }

    public function test_push_validates_event_uuids_entity_types_operations_and_renders_json(): void
    {
        [, $token] = $this->registerTestDevice('POS-VAL-0001');

        // Send WITHOUT Accept: application/json header to confirm api/* always returns JSON
        $res = $this->post('/api/v1/sync/push', [
            'events' => [
                [
                    'event_uuid'  => 'not-a-uuid',
                    'entity_type' => 'User', // Disallowed system model
                    'entity_uuid' => 'also-invalid',
                    'operation'   => 'truncate', // Invalid operation
                    'payload'     => 'not-an-array',
                ],
            ],
        ], [
            'Authorization' => 'Bearer ' . $token,
            'X-Device-Id'   => 'POS-VAL-0001',
        ]);

        $res->assertStatus(422)
            ->assertJsonStructure([
                'message',
                'errors' => [
                    'events.0.event_uuid',
                    'events.0.entity_type',
                    'events.0.entity_uuid',
                    'events.0.operation',
                    'events.0.payload',
                ],
            ]);

        // Empty events array rejected
        $this->postJson('/api/v1/sync/push', [
            'events' => [],
        ], [
            'Authorization' => 'Bearer ' . $token,
            'X-Device-Id'   => 'POS-VAL-0001',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['events']);
    }

    public function test_push_is_idempotent_and_protects_against_duplicate_event_uuids(): void
    {
        [, $token] = $this->registerTestDevice('POS-IDEM-0001');
        $headers = [
            'Authorization' => 'Bearer ' . $token,
            'X-Device-Id'   => 'POS-IDEM-0001',
        ];

        $eventUuid1 = (string) Str::uuid();
        $eventUuid2 = (string) Str::uuid();
        $eventUuid3 = (string) Str::uuid();
        $entityUuid1 = (string) Str::uuid();
        $entityUuid2 = (string) Str::uuid();

        $batch = [
            'events' => [
                [
                    'event_uuid'  => $eventUuid1,
                    'entity_type' => 'Merchant',
                    'entity_uuid' => $entityUuid1,
                    'operation'   => 'create',
                    'timestamp'   => '2026-11-22T12:00:00Z',
                    'payload'     => [
                        'attributes' => ['name_en' => 'Haji Gul', 'code' => 101],
                    ],
                ],
                [
                    'event_uuid'  => $eventUuid2,
                    'entity_type' => 'AmrozaSale',
                    'entity_uuid' => $entityUuid2,
                    'operation'   => 'create',
                    'timestamp'   => '2026-11-22T12:05:00Z',
                    'payload'     => [
                        'attributes'    => ['nag' => 10, 'rate' => 500, 'gross_amount' => 5000],
                        'relationships' => ['merchant_uuid' => $entityUuid1],
                    ],
                ],
            ],
        ];

        // 1. Initial submission
        $first = $this->postJson('/api/v1/sync/push', $batch, $headers);
        $first->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'received_count'           => 2,
                    'duplicate_count'          => 0,
                    'accepted_event_uuids'     => [$eventUuid1, $eventUuid2],
                    'duplicate_event_uuids'    => [],
                    'acknowledged_event_uuids' => [$eventUuid1, $eventUuid2],
                ],
            ]);
        $this->assertSame(2, SyncEvent::count());

        // 2. Retry identical batch (idempotent response, zero new rows)
        $retry = $this->postJson('/api/v1/sync/push', $batch, $headers);
        $retry->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'received_count'           => 0,
                    'duplicate_count'          => 2,
                    'accepted_event_uuids'     => [],
                    'duplicate_event_uuids'    => [$eventUuid1, $eventUuid2],
                    'acknowledged_event_uuids' => [$eventUuid1, $eventUuid2],
                ],
            ]);
        $this->assertSame(2, SyncEvent::count());

        // 3. Mixed batch with one duplicate + one new event repeated twice in the same payload
        $mixed = $this->postJson('/api/v1/sync/push', [
            'events' => [
                [
                    'event_uuid'  => $eventUuid1,
                    'entity_type' => 'Merchant',
                    'entity_uuid' => $entityUuid1,
                    'operation'   => 'create',
                    'payload'     => ['attributes' => ['name_en' => 'Haji Gul']],
                ],
                [
                    'event_uuid'  => $eventUuid3,
                    'entity_type' => 'Item',
                    'entity_uuid' => (string) Str::uuid(),
                    'operation'   => 'create',
                    'payload'     => ['attributes' => ['name_en' => 'Onion']],
                ],
                [
                    'event_uuid'  => $eventUuid3,
                    'entity_type' => 'Item',
                    'entity_uuid' => (string) Str::uuid(),
                    'operation'   => 'create',
                    'payload'     => ['attributes' => ['name_en' => 'Onion']],
                ],
            ],
        ], $headers);

        $mixed->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'received_count'        => 1,
                    'duplicate_count'       => 2,
                    'accepted_event_uuids'  => [$eventUuid3],
                    'duplicate_event_uuids' => [$eventUuid1, $eventUuid3],
                ],
            ]);
        $this->assertSame(3, SyncEvent::count());
    }

    public function test_database_unique_constraints_prevent_duplicate_event_uuid_and_device_id(): void
    {
        $this->registerTestDevice('POS-DB-0001');

        $this->expectException(UniqueConstraintViolationException::class);
        SyncDevice::create([
            'uuid'           => (string) Str::uuid(),
            'device_id'      => 'POS-DB-0001',
            'api_token_hash' => hash('sha256', 'another-token'),
        ]);
    }

    public function test_database_unique_constraint_prevents_duplicate_sync_event_uuid(): void
    {
        $this->registerTestDevice('POS-DB-0002');
        $eventUuid = (string) Str::uuid();

        SyncEvent::create([
            'event_uuid'  => $eventUuid,
            'device_id'   => 'POS-DB-0002',
            'entity_type' => 'Item',
            'entity_uuid' => (string) Str::uuid(),
            'operation'   => 'create',
            'payload'     => ['attributes' => ['name_en' => 'Potato']],
            'status'      => SyncEvent::STATUS_RECEIVED,
            'received_at' => now(),
        ]);

        $this->expectException(UniqueConstraintViolationException::class);
        SyncEvent::create([
            'event_uuid'  => $eventUuid,
            'device_id'   => 'POS-DB-0002',
            'entity_type' => 'Item',
            'entity_uuid' => (string) Str::uuid(),
            'operation'   => 'create',
            'payload'     => ['attributes' => ['name_en' => 'Duplicate']],
            'status'      => SyncEvent::STATUS_RECEIVED,
            'received_at' => now(),
        ]);
    }

    public function test_status_and_pull_endpoints_return_structured_cursor_responses(): void
    {
        [, $tokenA] = $this->registerTestDevice('POS-PULL-A');
        [, $tokenB] = $this->registerTestDevice('POS-PULL-B');

        $ev1 = (string) Str::uuid();
        $ev2 = (string) Str::uuid();
        $evB = (string) Str::uuid();

        // Device A pushes 2 events
        $this->postJson('/api/v1/sync/push', [
            'events' => [
                [
                    'event_uuid'  => $ev1,
                    'entity_type' => 'Area',
                    'entity_uuid' => (string) Str::uuid(),
                    'operation'   => 'create',
                    'payload'     => ['attributes' => ['name_en' => 'Malir']],
                ],
                [
                    'event_uuid'  => $ev2,
                    'entity_type' => 'Area',
                    'entity_uuid' => (string) Str::uuid(),
                    'operation'   => 'create',
                    'payload'     => ['attributes' => ['name_en' => 'Mirpurkhas']],
                ],
            ],
        ], [
            'Authorization' => 'Bearer ' . $tokenA,
            'X-Device-Id'   => 'POS-PULL-A',
        ])->assertStatus(200);

        // Device B pushes 1 event
        $this->postJson('/api/v1/sync/push', [
            'events' => [
                [
                    'event_uuid'  => $evB,
                    'entity_type' => 'Area',
                    'entity_uuid' => (string) Str::uuid(),
                    'operation'   => 'create',
                    'payload'     => ['attributes' => ['name_en' => 'Quetta']],
                ],
            ],
        ], [
            'Authorization' => 'Bearer ' . $tokenB,
            'X-Device-Id'   => 'POS-PULL-B',
        ])->assertStatus(200);

        // Status for Device A
        $this->getJson('/api/v1/sync/status', [
            'Authorization' => 'Bearer ' . $tokenA,
            'X-Device-Id'   => 'POS-PULL-A',
        ])->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'device_id' => 'POS-PULL-A',
                    'status'    => 'active',
                    'events'    => [
                        'total'     => 2,
                    ],
                ],
            ]);

        // Device B pulls with limit=1 (excludes Device B's own event)
        $pullPage1 = $this->getJson('/api/v1/sync/pull?since_cursor=0&limit=1', [
            'Authorization' => 'Bearer ' . $tokenB,
            'X-Device-Id'   => 'POS-PULL-B',
        ]);
        $pullPage1->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'has_more' => true,
                ],
            ]);
        $this->assertCount(1, $pullPage1->json('data.events'));
        $this->assertSame($ev1, $pullPage1->json('data.events.0.event_uuid'));

        $cursor1 = $pullPage1->json('data.next_cursor');

        // Device B pulls next page
        $pullPage2 = $this->getJson("/api/v1/sync/pull?since_cursor={$cursor1}&limit=10", [
            'Authorization' => 'Bearer ' . $tokenB,
            'X-Device-Id'   => 'POS-PULL-B',
        ]);
        $pullPage2->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data'    => [
                    'has_more' => false,
                ],
            ]);
        $this->assertCount(1, $pullPage2->json('data.events'));
        $this->assertSame($ev2, $pullPage2->json('data.events.0.event_uuid'));
    }

    public function test_central_sync_endpoints_do_not_pollute_local_outbox_and_pos_remains_offline_capable(): void
    {
        $outboxBefore = SyncOutbox::count();

        [, $token] = $this->registerTestDevice('POS-ISOLATION-01');
        $this->postJson('/api/v1/sync/push', [
            'events' => [
                [
                    'event_uuid'  => (string) Str::uuid(),
                    'entity_type' => 'Merchant',
                    'entity_uuid' => (string) Str::uuid(),
                    'operation'   => 'create',
                    'payload'     => ['attributes' => ['name_en' => 'Remote Merchant']],
                ],
            ],
        ], [
            'Authorization' => 'Bearer ' . $token,
            'X-Device-Id'   => 'POS-ISOLATION-01',
        ])->assertStatus(200);

        // Central sync operations must never queue into local sync_outbox
        $this->assertSame($outboxBefore, SyncOutbox::count());

        // Local POS operations still work offline without touching central sync tables
        $eventsBefore = SyncEvent::count();
        $merchant = Merchant::create(['name_en' => 'Local Offline Merchant', 'opening_balance' => 500]);
        $item = Item::create(['name_en' => 'Local Potato', 'unit' => 'Nag', 'opening_stock' => 20, 'current_stock' => 20]);

        $sale = app(AmrozaService::class)->createSale([
            'date'        => '2026-11-22',
            'merchant_id' => $merchant->id,
            'item_id'     => $item->id,
            'nag'         => 3,
            'rate'        => 1000,
        ]);

        $this->assertInstanceOf(AmrozaSale::class, $sale);
        $this->assertSame(3000.0, (float) $sale->gross_amount);
        $this->assertSame(3500.0, (float) $merchant->fresh()->current_balance);
        $this->assertSame(17, (int) $item->fresh()->current_stock);
        $this->assertSame($eventsBefore, SyncEvent::count());
        $this->assertGreaterThan($outboxBefore, SyncOutbox::count());
    }
}
