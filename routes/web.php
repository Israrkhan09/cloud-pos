<?php

use App\Http\Controllers\PageController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect()->route('login');
})->name('home');

Route::post('locale', function (\Illuminate\Http\Request $request) {
    $request->validate(['locale' => 'required|in:en,ur']);
    $locale = $request->input('locale');
    session(['locale' => $locale]);
    if ($user = $request->user()) {
        $user->update(['locale' => $locale]);
    }
    return response()->json(['success' => true, 'locale' => $locale]);
})->name('locale.update');

Route::middleware(['auth', 'verified'])
    ->group(function () {
        Route::get('dashboard', [PageController::class, 'dashboard'])
            ->name('dashboard');

        // Navigation aliases
        Route::get('bijak', [\App\Http\Controllers\Farmers\BijjakController::class, 'index'])->name('farmer.bijak');
        Route::post('bijak', [\App\Http\Controllers\Farmers\BijjakController::class, 'store'])->name('farmer.bijak.store');
        Route::delete('bijak/{id}', [\App\Http\Controllers\Farmers\BijjakController::class, 'destroy'])->name('farmer.bijak.destroy');

        Route::get('khata', [\App\Http\Controllers\Farmers\FarmerKhataController::class, 'index'])->name('farmer.khata');

        Route::get('general-ledger', [\App\Http\Controllers\Ledger\GeneralLedgerController::class, 'index'])->name('cash_book.general_ledger');
        Route::post('general-ledger', [\App\Http\Controllers\Ledger\GeneralLedgerController::class, 'store'])->name('cash_book.general_ledger.store');

        Route::get('reports', [\App\Http\Controllers\Merchants\MerchantReportController::class, 'index'])->name('reports.index');
        Route::get('reports/data', [\App\Http\Controllers\Merchants\MerchantReportController::class, 'getReportData'])->name('reports.data');

        Route::get('banking/accounts', [\App\Http\Controllers\Banking\BankController::class, 'index'])->name('banking.accounts');
        Route::get('banking/transfers', [\App\Http\Controllers\Banking\BankController::class, 'transfers'])->name('banking.transfers');
        Route::get('banking/cheques', [\App\Http\Controllers\Banking\BankController::class, 'cheques'])->name('banking.cheques');
        Route::get('banking/reconciliation', [\App\Http\Controllers\Banking\BankController::class, 'reconciliation'])->name('banking.reconciliation');

        // Investment / Capital Module
        Route::get('investment', fn() => redirect()->route('investment.partners'))->name('investment.index');
        Route::get('investment/partners', [\App\Http\Controllers\Investment\InvestmentController::class, 'partners'])->name('investment.partners');
        Route::get('investment/loans', [\App\Http\Controllers\Investment\InvestmentController::class, 'loans'])->name('investment.loans');
        Route::get('investment/surplus', [\App\Http\Controllers\Investment\InvestmentController::class, 'surplus'])->name('investment.surplus');
        Route::get('investment/audit', [\App\Http\Controllers\Investment\InvestmentController::class, 'audit'])->name('investment.audit');

        Route::post('investment/entry', [\App\Http\Controllers\Investment\InvestmentController::class, 'storeEntry'])->name('investment.entry');
        Route::post('investment/undo/{id}', [\App\Http\Controllers\Investment\InvestmentController::class, 'undo'])->name('investment.undo');
        Route::post('investment/approve/{id}', [\App\Http\Controllers\Investment\InvestmentController::class, 'approve'])->name('investment.approve');
        Route::post('investment/void/{id}', [\App\Http\Controllers\Investment\InvestmentController::class, 'void'])->name('investment.void');
        Route::post('investment/loans/{id}/return', [\App\Http\Controllers\Investment\InvestmentController::class, 'returnLoan'])->name('investment.loans.return');
        Route::post('investment/surplus/{id}/return', [\App\Http\Controllers\Investment\InvestmentController::class, 'returnSurplus'])->name('investment.surplus.return');
        Route::post('investment/surplus/{id}/mature', [\App\Http\Controllers\Investment\InvestmentController::class, 'matureSurplus'])->name('investment.surplus.mature');
        Route::post('investment/role', [\App\Http\Controllers\Investment\InvestmentController::class, 'switchRole'])->name('investment.role');
    });

require __DIR__ . '/auth.php';

if (config('jkc.show_legacy_pos', false)) {
    require __DIR__ . "/attributes.php";
    require __DIR__ . '/brands.php';
    require __DIR__ . '/categories.php';
    require __DIR__ . '/customers.php';
    require __DIR__ . '/employees.php';
    require __DIR__ . '/expenses.php';
    require __DIR__ . '/products.php';
    require __DIR__ . '/purchases.php';
    require __DIR__ . '/sales.php';
    require __DIR__ . '/suppliers.php';
}

require __DIR__ . '/masters.php';
require __DIR__ . '/merchants.php';
require __DIR__ . '/settings.php';
require __DIR__ . '/users.php';
