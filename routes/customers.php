<?php

use App\Http\Controllers\Customer\CustomerController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])
    ->group(function () {
        Route::get('customers/{id}/khata', [CustomerController::class, 'khata'])
            ->name('customers.khata');
        Route::resource('customers', CustomerController::class)
            ->names('customers');
        Route::get('search-customer', [CustomerController::class, 'search'])
            ->name('search.customer');
    });
