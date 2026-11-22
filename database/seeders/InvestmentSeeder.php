<?php

namespace Database\Seeders;

use App\Models\InvestmentAlert;
use App\Models\InvestmentAuditLog;
use App\Models\InvestmentLoan;
use App\Models\InvestmentPartner;
use App\Models\InvestmentSurplus;
use App\Models\InvestmentTransaction;
use Illuminate\Database\Seeder;

class InvestmentSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Partners
        $bilal = InvestmentPartner::updateOrCreate(
            ['name' => 'Bilal'],
            [
                'name_ur'           => 'بلال',
                'role'              => 'partner',
                'phone'             => '0300-4455667',
                'profit_percentage' => 10.0,
                'opening_capital'   => 0,
                'status'            => 'active',
                'notes'             => 'Partner with 10% equity share',
            ]
        );

        $ali = InvestmentPartner::updateOrCreate(
            ['name' => 'Ali Raza'],
            [
                'name_ur'           => 'علی رضا',
                'role'              => 'partner',
                'phone'             => '0301-8899776',
                'profit_percentage' => 5.0,
                'opening_capital'   => 0,
                'status'            => 'active',
                'notes'             => 'Partner with 5% equity share',
            ]
        );

        $hajji = InvestmentPartner::updateOrCreate(
            ['name' => 'Owner (Hajji Sb)'],
            [
                'name_ur'           => 'حاجی صاحب (مالک)',
                'role'              => 'owner',
                'phone'             => '0321-1234567',
                'profit_percentage' => 85.0,
                'opening_capital'   => 0,
                'status'            => 'active',
                'notes'             => 'Main proprietor account with 85% profit pool share',
            ]
        );

        // 2. Loans
        $ahmedLoan = InvestmentLoan::updateOrCreate(
            ['lender_name' => 'Ahmed Lender'],
            [
                'lender_name_ur'   => 'احمد لنڈر',
                'phone'            => '0333-5566778',
                'principal_amount' => 180000,
                'fee_or_interest'  => 2000,
                'paid_amount'      => 0,
                'due_date'         => '2026-12-01',
                'status'           => 'active',
                'notes'            => 'Short-term mandi working loan',
            ]
        );

        $sohailLoan = InvestmentLoan::updateOrCreate(
            ['lender_name' => 'Sohail (Partial)'],
            [
                'lender_name_ur'   => 'سہیل (جزوی)',
                'phone'            => '0345-9988776',
                'principal_amount' => 140000,
                'fee_or_interest'  => 0,
                'paid_amount'      => 120000,
                'due_date'         => '2026-11-18', // 4 days overdue
                'status'           => 'active',
                'notes'            => 'Partial payment of Rs. 120,000 completed, Rs. 20,000 balance remaining',
            ]
        );

        // 3. Surplus
        $fundA = InvestmentSurplus::updateOrCreate(
            ['fund_name' => 'Fund A (15-day)'],
            [
                'fund_name_ur'     => 'فنڈ اے (15 روزہ)',
                'principal_amount' => 250000,
                'profit_or_loss'   => 8000,
                'roi_rate'         => '3.2%',
                'is_realised'      => false,
                'maturity_date'    => '2026-12-06', // Exactly 15 days from 21 Nov
                'status'           => 'active',
                'notes'            => 'Active 15-day liquidity reserve fund, matures on 06 Dec',
            ]
        );

        $goldSavings = InvestmentSurplus::updateOrCreate(
            ['fund_name' => 'Gold Savings'],
            [
                'fund_name_ur'     => 'گولڈ سیونگز',
                'principal_amount' => 120000,
                'profit_or_loss'   => 4200,
                'roi_rate'         => '3.5%',
                'is_realised'      => true,
                'maturity_date'    => '2026-10-15', // 38 days overdue from 22 Nov
                'status'           => 'matured',
                'notes'            => 'Matured on 15 Oct (38 din se cash wapas aana baqi hai)',
            ]
        );

        // 4. Transactions (matching screenshots and reconciliation)
        // LI-0001: 05 Nov, Sohail, Loan In, +140,000, Approved
        InvestmentTransaction::updateOrCreate(
            ['ref_no' => 'LI-0001'],
            [
                'date'               => '2026-11-05',
                'type'               => 'loan_in',
                'loan_id'            => $sohailLoan->id,
                'party_name'         => 'Sohail (Partial)',
                'amount'             => 140000,
                'payment_method'     => 'cash',
                'reason'             => 'Short-term mandi loan',
                'approval_status'    => 'approved',
                'approved_by'        => 'Hajji Sb (Owner)',
                'approved_at'        => '2026-11-05 10:00:00',
                'created_by_role'    => 'munshi',
            ]
        );

        // LR-0001: 12 Nov, Sohail, Loan Return, -100,000 Pehli qist wapsi, Approved
        InvestmentTransaction::updateOrCreate(
            ['ref_no' => 'LR-0001'],
            [
                'date'               => '2026-11-12',
                'type'               => 'loan_out',
                'loan_id'            => $sohailLoan->id,
                'party_name'         => 'Sohail (Partial)',
                'amount'             => 100000,
                'payment_method'     => 'cash',
                'reason'             => 'Pehli qist wapsi',
                'approval_status'    => 'approved',
                'approved_by'        => 'Hajji Sb (Owner)',
                'approved_at'        => '2026-11-12 16:00:00',
                'created_by_role'    => 'munshi',
            ]
        );

        // LR-0002: 16 Nov, Sohail, Loan Return, -20,000 Dusri qist wapsi, Approved
        InvestmentTransaction::updateOrCreate(
            ['ref_no' => 'LR-0002'],
            [
                'date'               => '2026-11-16',
                'type'               => 'loan_out',
                'loan_id'            => $sohailLoan->id,
                'party_name'         => 'Sohail (Partial)',
                'amount'             => 20000,
                'payment_method'     => 'bank',
                'bank_name'          => 'Meezan Bank Ltd',
                'reason'             => 'Dusri qist wapsi (Baqaya Rs. 20,000)',
                'approval_status'    => 'approved',
                'approved_by'        => 'Hajji Sb (Owner)',
                'approved_at'        => '2026-11-16 14:00:00',
                'created_by_role'    => 'munshi',
            ]
        );

        // CI-0141: 20 Nov, Bilal, Capital In, +400,000 Season stock, Approved (Owner)
        InvestmentTransaction::updateOrCreate(
            ['ref_no' => 'CI-0141'],
            [
                'date'               => '2026-11-20',
                'type'               => 'capital_in',
                'partner_id'         => $bilal->id,
                'party_name'         => 'Bilal',
                'amount'             => 400000,
                'payment_method'     => 'cash',
                'reason'             => 'Season stock',
                'approval_status'    => 'approved',
                'approved_by'        => 'Hajji Sb (Owner)',
                'approved_at'        => '2026-11-20 18:30:00',
                'created_by_role'    => 'munshi',
            ]
        );

        // CO-0152: 21 Nov, Bilal, Capital Out, -100,000 Ghar kharch, Pending Owner
        InvestmentTransaction::updateOrCreate(
            ['ref_no' => 'CO-0152'],
            [
                'date'               => '2026-11-21',
                'type'               => 'capital_out',
                'partner_id'         => $bilal->id,
                'party_name'         => 'Bilal',
                'amount'             => 100000,
                'payment_method'     => 'cash',
                'reason'             => 'Ghar kharch',
                'approval_status'    => 'pending_owner',
                'created_by_role'    => 'munshi',
            ]
        );

        // CI-0139: 18 Nov, Ali Raza, Capital In, +50,000 Typo, Reversed
        InvestmentTransaction::updateOrCreate(
            ['ref_no' => 'CI-0139'],
            [
                'date'               => '2026-11-18',
                'type'               => 'capital_in',
                'partner_id'         => $ali->id,
                'party_name'         => 'Ali Raza',
                'amount'             => 50000,
                'payment_method'     => 'cash',
                'reason'             => 'Typo',
                'approval_status'    => 'reversed',
                'is_reversed'        => true,
                'reversal_reason'    => 'Typo in amount entry',
                'reversal_ref_no'    => 'REV-0139',
                'created_by_role'    => 'munshi',
            ]
        );

        // CI-0140: 19 Nov, Ali Raza, Capital In, +300,000 Initial Capital, Approved
        InvestmentTransaction::updateOrCreate(
            ['ref_no' => 'CI-0140'],
            [
                'date'               => '2026-11-19',
                'type'               => 'capital_in',
                'partner_id'         => $ali->id,
                'party_name'         => 'Ali Raza',
                'amount'             => 300000,
                'payment_method'     => 'bank',
                'bank_name'          => 'Meezan Bank',
                'reason'             => 'Initial Capital deposit',
                'approval_status'    => 'approved',
                'approved_by'        => 'Owner (Hajji Sb)',
                'approved_at'        => '2026-11-19 12:00:00',
                'created_by_role'    => 'owner',
            ]
        );

        // SO-0147: 21 Nov, Fund A, Surplus Out, -250,000 20 din ke liye, Posted
        InvestmentTransaction::updateOrCreate(
            ['ref_no' => 'SO-0147'],
            [
                'date'               => '2026-11-21',
                'type'               => 'surplus_out',
                'surplus_id'         => $fundA->id,
                'party_name'         => 'Fund A',
                'amount'             => 250000,
                'payment_method'     => 'bank',
                'bank_name'          => 'Habib Bank Ltd',
                'reason'             => '20 din ke liye',
                'approval_status'    => 'posted',
                'created_by_role'    => 'owner',
            ]
        );

        // 5. Audit Log Initial Records
        InvestmentAuditLog::create([
            'action'         => 'create',
            'ref_no'         => 'CI-0141',
            'user_name'      => 'Munshi Aslam',
            'user_role'      => 'munshi',
            'details'        => 'Capital In Rs. 400,000 recorded for Bilal (Cash)',
        ]);

        InvestmentAuditLog::create([
            'action'         => 'approve',
            'ref_no'         => 'CI-0141',
            'user_name'      => 'Hajji Sb (Owner)',
            'user_role'      => 'owner',
            'details'        => 'Approved capital deposit entry CI-0141',
        ]);

        InvestmentAuditLog::create([
            'action'         => 'create',
            'ref_no'         => 'CO-0152',
            'user_name'      => 'Munshi Aslam',
            'user_role'      => 'munshi',
            'details'        => 'Capital Out Rs. 100,000 submitted for Bilal - Pending Owner approval',
        ]);

        InvestmentAuditLog::create([
            'action'         => 'void',
            'ref_no'         => 'CI-0139',
            'user_name'      => 'Hajji Sb (Owner)',
            'user_role'      => 'owner',
            'details'        => 'Voided and reversed entry CI-0139. Reason: Typo in amount entry',
        ]);

        // 6. Alert
        InvestmentAlert::updateOrCreate(
            ['partner_name' => 'Bilal'],
            [
                'partner_id'       => $bilal->id,
                'attempted_amount' => 350000,
                'excess_amount'    => 50000,
                'resolved'         => false,
                'notes'            => 'Bilal ke capital se Rs. 50,000 zyada nikaalne ki koshish ki gayi (blocked, Drawings/Advance ke tor par record hona chahiye)',
            ]
        );
    }
}
