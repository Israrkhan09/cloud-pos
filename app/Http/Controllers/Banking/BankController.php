<?php

namespace App\Http\Controllers\Banking;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class BankController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('banking/accounts/index');
    }

    public function transfers(): Response
    {
        return Inertia::render('banking/transfers/index');
    }

    public function cheques(): Response
    {
        return Inertia::render('banking/cheques/index');
    }

    public function reconciliation(): Response
    {
        return Inertia::render('banking/reconciliation/index');
    }
}
