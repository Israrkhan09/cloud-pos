<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Device Registration Key & Server URL
    |--------------------------------------------------------------------------
    |
    | Optional shared secret required when registering a POS desktop device
    | with the central sync server. Set via SYNC_REGISTRATION_KEY in .env.
    |
    */
    'registration_key' => env('SYNC_REGISTRATION_KEY'),

    'server_url' => env('SYNC_SERVER_URL', 'https://api.sudoleads.com'),

    'device_token' => env('SYNC_DEVICE_TOKEN'),

    /*
    |--------------------------------------------------------------------------
    | Centralized API Endpoint Routes
    |--------------------------------------------------------------------------
    |
    | Central backend routes for synchronization, permissions, and POS employee
    | authentication/activation against the central PostgreSQL database.
    |
    */
    'endpoints' => [
        'pull' => '/api/v1/sync/pull',
        'push' => '/api/v1/sync/push',
        'register' => '/api/v1/sync/register',
        'permissions' => '/api/v1/sync/permissions',
        'pos_check_status' => '/api/pos/auth/check-status',
        'pos_activate' => '/api/pos/auth/activate',
        'pos_login' => '/api/pos/auth/login',
    ],

    /*
    |--------------------------------------------------------------------------
    | Batch Limits & Network Resilience
    |--------------------------------------------------------------------------
    */
    'max_batch_size' => (int) env('SYNC_MAX_BATCH_SIZE', 100),

    'timeout_seconds' => (int) env('SYNC_TIMEOUT_SECONDS', 30),

    'retry_attempts' => (int) env('SYNC_RETRY_ATTEMPTS', 3),

    'retry_backoff_ms' => (int) env('SYNC_RETRY_BACKOFF_MS', 500),

    /*
    |--------------------------------------------------------------------------
    | Processing Options
    |--------------------------------------------------------------------------
    |
    | When auto_process_on_push is enabled, the central server will immediately
    | materialize received sync_events into domain business tables inside
    | database transactions upon push ingestion.
    |
    */
    'auto_process_on_push' => (bool) env('SYNC_AUTO_PROCESS_ON_PUSH', true),

    /*
    |--------------------------------------------------------------------------
    | Allowed Sync Operations & Entity Types
    |--------------------------------------------------------------------------
    */
    'allowed_operations' => [
        'create',
        'update',
        'delete',
    ],

    'allowed_entity_types' => [
        'Area',
        'Merchant',
        'Farmer',
        'FarmerMark',
        'Item',
        'AmrozaSale',
        'MerchantReceipt',
        'FarmerBill',
        'InvestmentPartner',
        'InvestmentLoan',
        'InvestmentSurplus',
        'InvestmentTransaction',
        'InvestmentAuditLog',
        'InvestmentAlert',
        'Expense',
        'Customer',
        'Employee',
        'Supplier',
        'Category',
        'Brand',
        'Attribute',
        'Product',
        'Purchase',
        'PurchaseDetail',
        'PurchasePayment',
        'Sale',
        'SaleDetail',
        'SalePayment',
        'Currency',
        'PurchaseReturn',
        'PurchseReturnDetail',
        'SaleReturn',
        'SaleReturnDetail',
    ],
];
