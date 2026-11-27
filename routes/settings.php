<?php

use App\Http\Controllers\Settings\CurrencyController;
use App\Http\Controllers\Settings\OptionController;
use App\Http\Controllers\Users\PasswordController;
use App\Http\Controllers\Users\ProfileController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware('auth')->group(function () {

    Route::get('users/appearance', function () {
        return Inertia::render('users/appearance');
    })->name('appearance');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('settings.profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('settings.profile.update');
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('settings.profile.destroy');

    Route::get('settings/password', [PasswordController::class, 'edit'])->name('settings.password.edit');
    Route::put('settings/password', [PasswordController::class, 'update'])->name('settings.password.update');

    Route::prefix('settings')->group(function () {
        Route::resource('currency', CurrencyController::class)
            ->only(['index', 'store', 'show', 'update', 'destroy'])
            ->names('currency');

        Route::prefix('options')
            ->controller(OptionController::class)
            ->group(function () {
                Route::get('shop', 'shopInformationIndex')->name('options.shopInformation.index');
                Route::post('shop', 'shopInformationStore')->name('options.shopInformation.save');

                Route::get('email', 'emailSettingIndex')->name('options.emailSetting.index');
                Route::post('email', 'emailSettingStore')->name('options.saveEmailSetting.save');

                Route::get('invoice', 'invoiceSettingIndex')->name('options.invoiceSetting.index');
                Route::post('invoice', 'invoiceSettingStore')->name('options.saveInvoiceSetting.save');

                Route::get('payment', 'paymentSettingIndex')->name('options.paymentSetting.index');
                Route::post('payment', 'paymentSettingStore')->name('options.savePaymentSetting.save');
            });
    });
});
