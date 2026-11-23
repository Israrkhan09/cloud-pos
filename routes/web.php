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

        // Global Search API
        Route::get('global-search', [\App\Http\Controllers\Search\GlobalSearchController::class, 'search'])->name('global.search');

        // Navigation aliases
        Route::get('farmers', [\App\Http\Controllers\Farmers\FarmerController::class, 'index'])->name('farmers.index');
        Route::post('farmers', [\App\Http\Controllers\Farmers\FarmerController::class, 'store'])->name('farmers.store');
        Route::put('farmers/{id}', [\App\Http\Controllers\Farmers\FarmerController::class, 'update'])->name('farmers.update');
        Route::get('farmers/{id}/khata', [\App\Http\Controllers\Farmers\FarmerController::class, 'khata'])->name('farmers.khata');

        Route::get('farmer-khata', [\App\Http\Controllers\Farmers\FarmerKhataController::class, 'farmerKhataPage'])->name('farmers.khata_page');
        Route::post('farmer-khata/pay', [\App\Http\Controllers\Farmers\FarmerKhataController::class, 'recordPayment'])->name('farmers.pay');
        Route::get('farmer-khata/{id}/parchi', [\App\Http\Controllers\Farmers\FarmerKhataController::class, 'getParchi'])->name('farmers.parchi');

        Route::get('bijak', [\App\Http\Controllers\Farmers\BijjakController::class, 'index'])->name('farmer.bijak');
        Route::post('bijak', [\App\Http\Controllers\Farmers\BijjakController::class, 'store'])->name('farmer.bijak.store');
        Route::delete('bijak/{id}', [\App\Http\Controllers\Farmers\BijjakController::class, 'destroy'])->name('farmer.bijak.destroy');

        Route::get('khata', [\App\Http\Controllers\Farmers\FarmerKhataController::class, 'index'])->name('farmer.khata');

        Route::get('general-ledger', [\App\Http\Controllers\Ledger\GeneralLedgerController::class, 'index'])->name('cash_book.general_ledger');
        Route::post('general-ledger', [\App\Http\Controllers\Ledger\GeneralLedgerController::class, 'store'])->name('cash_book.general_ledger.store');

        Route::get('reports', [\App\Http\Controllers\Merchants\MerchantReportController::class, 'index'])->name('reports.index');
        Route::get('reports/data', [\App\Http\Controllers\Merchants\MerchantReportController::class, 'getReportData'])->name('reports.data');

        // System Backup Module
        Route::get('backup', [\App\Http\Controllers\System\BackupController::class, 'index'])->name('backup.index');
        Route::get('backup/list', [\App\Http\Controllers\System\BackupController::class, 'listBackups'])->name('backup.list');
        Route::post('backup/create', [\App\Http\Controllers\System\BackupController::class, 'createBackup'])->name('backup.create');
        Route::get('backup/download/{filename}', [\App\Http\Controllers\System\BackupController::class, 'downloadBackup'])->name('backup.download');
        Route::get('backup/full', [\App\Http\Controllers\System\BackupController::class, 'fullDatabase'])->name('backup.full');
        Route::post('backup/restore', [\App\Http\Controllers\System\BackupController::class, 'restoreDatabase'])->name('backup.restore');
        Route::get('backup/categories/summary', [\App\Http\Controllers\System\BackupController::class, 'categoriesSummary'])->name('backup.categories.summary');
        Route::get('backup/categories/{category}/preview', [\App\Http\Controllers\System\BackupController::class, 'categoryPreview'])->name('backup.categories.preview');
        Route::get('backup/categories/{category}/export-excel', [\App\Http\Controllers\System\BackupController::class, 'categoryExportExcel'])->name('backup.categories.export_excel');
        Route::get('backup/categories/{category}/export-db', [\App\Http\Controllers\System\BackupController::class, 'categoryExportDb'])->name('backup.categories.export_db');
        Route::get('backup/data', [\App\Http\Controllers\System\BackupController::class, 'getData'])->name('backup.data');

        // Expiry & Gifts Module
        Route::get('expiry-gifts', [\App\Http\Controllers\Inventory\ExpiryGiftsController::class, 'index'])->name('expiry_gifts.index');
        Route::post('expiry-gifts/discount', [\App\Http\Controllers\Inventory\ExpiryGiftsController::class, 'applyDiscount'])->name('expiry_gifts.discount');
        Route::post('expiry-gifts/wastage', [\App\Http\Controllers\Inventory\ExpiryGiftsController::class, 'recordWastage'])->name('expiry_gifts.wastage');
        Route::post('expiry-gifts/return-farmer', [\App\Http\Controllers\Inventory\ExpiryGiftsController::class, 'returnToFarmer'])->name('expiry_gifts.return_farmer');
        Route::post('expiry-gifts/gift', [\App\Http\Controllers\Inventory\ExpiryGiftsController::class, 'storeGift'])->name('expiry_gifts.gift');

        // Discount Rules Module
        Route::get('discount-rules', [\App\Http\Controllers\Discount\DiscountRuleController::class, 'index'])->name('discount_rules.index');
        Route::post('discount-rules', [\App\Http\Controllers\Discount\DiscountRuleController::class, 'store'])->name('discount_rules.store');
        Route::match(['put', 'post'], 'discount-rules/{id}/toggle', [\App\Http\Controllers\Discount\DiscountRuleController::class, 'toggle'])->name('discount_rules.toggle');
        Route::delete('discount-rules/{id}', [\App\Http\Controllers\Discount\DiscountRuleController::class, 'destroy'])->name('discount_rules.destroy');

        Route::get('banking/accounts', [\App\Http\Controllers\Banking\BankController::class, 'index'])->name('banking.accounts');
        Route::get('banking/transfers', [\App\Http\Controllers\Banking\BankController::class, 'transfers'])->name('banking.transfers');
        Route::get('banking/cheques', [\App\Http\Controllers\Banking\BankController::class, 'cheques'])->name('banking.cheques');

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
    require __DIR__ . '/employees.php';
    require __DIR__ . '/expenses.php';
    require __DIR__ . '/products.php';
    require __DIR__ . '/purchases.php';
    require __DIR__ . '/sales.php';
    require __DIR__ . '/suppliers.php';
}

require __DIR__ . '/customers.php';
require __DIR__ . '/masters.php';
require __DIR__ . '/merchants.php';
require __DIR__ . '/settings.php';
require __DIR__ . '/users.php';
