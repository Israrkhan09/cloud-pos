<?php

use App\Http\Controllers\Api\SyncController;
use App\Http\Middleware\VerifySyncDevice;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/sync')->name('api.sync.')->group(function () {
    Route::post('register', [SyncController::class, 'register'])->name('register');

    Route::middleware([VerifySyncDevice::class])->group(function () {
        Route::post('push', [SyncController::class, 'push'])->name('push');
        Route::get('status', [SyncController::class, 'status'])->name('status');
        Route::match(['get', 'post'], 'pull', [SyncController::class, 'pull'])->name('pull');
    });
});
