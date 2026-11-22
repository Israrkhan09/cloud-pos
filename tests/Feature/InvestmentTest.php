<?php

namespace Tests\Feature;

use App\Models\InvestmentAlert;
use App\Models\InvestmentLoan;
use App\Models\InvestmentPartner;
use App\Models\InvestmentSurplus;
use App\Models\InvestmentTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvestmentTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    /**
     * Test 1: Navigation routes respond with 200 OK for authenticated user
     */
    public function test_investment_routes_render_successfully()
    {
        $this->actingAs($this->user);

        // Main 4 sub-pages
        $this->get('/investment/partners')->assertOk();
        $this->get('/investment/loans')->assertOk();
        $this->get('/investment/surplus')->assertOk();
        $this->get('/investment/audit')->assertOk();

        // /investment index redirects to /investment/partners
        $this->get('/investment')->assertRedirect('/investment/partners');
    }

    /**
     * Test 2: Partner financial calculations (Equity, Cap In, Drawings)
     */
    public function test_partner_equity_and_drawings_calculations()
    {
        $partner = InvestmentPartner::create([
            'name'              => 'Test Partner',
            'role'              => 'partner',
            'profit_percentage' => 10,
            'status'            => 'active',
        ]);

        // Add Capital In: 400,000
        InvestmentTransaction::create([
            'ref_no'          => 'CI-TEST-1',
            'date'            => now(),
            'partner_id'      => $partner->id,
            'party_name'      => $partner->name,
            'type'            => 'capital_in',
            'amount'          => 400000,
            'payment_method'  => 'cash',
            'approval_status' => 'approved',
        ]);

        // Add Capital Out (Drawings): 100,000
        InvestmentTransaction::create([
            'ref_no'          => 'CO-TEST-1',
            'date'            => now(),
            'partner_id'      => $partner->id,
            'party_name'      => $partner->name,
            'type'            => 'capital_out',
            'amount'          => 100000,
            'payment_method'  => 'cash',
            'approval_status' => 'approved',
        ]);

        $financials = $partner->financials;
        $this->assertEquals(400000, $financials['cap_in']);
        $this->assertEquals(100000, $financials['drawings']);
        $this->assertEquals(300000, $financials['net_equity']);
    }

    /**
     * Test 3: Guardrail blocks capital withdrawal when exceeding partner net equity
     */
    public function test_guardrail_blocks_withdrawal_exceeding_net_equity_without_advance()
    {
        $this->actingAs($this->user);

        $partner = InvestmentPartner::create([
            'name'              => 'Bilal Guardrail',
            'role'              => 'partner',
            'profit_percentage' => 10,
            'status'            => 'active',
        ]);

        // Add 200,000 capital in
        InvestmentTransaction::create([
            'ref_no'          => 'CI-GUARD-1',
            'date'            => now(),
            'partner_id'      => $partner->id,
            'party_name'      => $partner->name,
            'type'            => 'capital_in',
            'amount'          => 200000,
            'payment_method'  => 'cash',
            'approval_status' => 'approved',
        ]);

        // Attempt to withdraw 300,000 (exceeds 200,000 net equity by 100,000)
        $response = $this->postJson('/investment/entry', [
            'type'           => 'capital_out',
            'partner_id'     => $partner->id,
            'party_name'     => $partner->name,
            'amount'         => 300000,
            'payment_method' => 'cash',
            'reason'         => 'Attempted excess withdrawal',
            'is_advance'     => false,
        ]);

        // Must fail with HTTP 422 Unprocessable Entity
        $response->assertStatus(422);
        $response->assertJson([
            'guardrail'     => true,
            'excess_amount' => 100000,
            'partner_name'  => 'Bilal Guardrail',
        ]);

        // Must record an alert in investment_alerts
        $this->assertDatabaseHas('investment_alerts', [
            'partner_id'       => $partner->id,
            'partner_name'     => 'Bilal Guardrail',
            'attempted_amount' => 300000,
            'excess_amount'    => 100000,
        ]);
    }

    /**
     * Test 4: Guardrail allows withdrawal when confirmed as Advance
     */
    public function test_guardrail_allows_withdrawal_when_confirmed_as_advance()
    {
        $this->actingAs($this->user);

        $partner = InvestmentPartner::create([
            'name'              => 'Bilal Advance',
            'role'              => 'partner',
            'profit_percentage' => 10,
            'status'            => 'active',
        ]);

        InvestmentTransaction::create([
            'ref_no'          => 'CI-ADV-1',
            'date'            => now(),
            'partner_id'      => $partner->id,
            'party_name'      => $partner->name,
            'type'            => 'capital_in',
            'amount'          => 200000,
            'payment_method'  => 'cash',
            'approval_status' => 'approved',
        ]);

        // Attempt 300,000 with is_advance = true
        $response = $this->post('/investment/entry', [
            'type'           => 'capital_out',
            'partner_id'     => $partner->id,
            'party_name'     => $partner->name,
            'amount'         => 300000,
            'payment_method' => 'cash',
            'reason'         => 'Emergency advance needed',
            'is_advance'     => true,
        ]);

        $response->assertRedirect();

        // Must record transaction as advance
        $this->assertDatabaseHas('investment_transactions', [
            'partner_id'     => $partner->id,
            'type'           => 'capital_out',
            'amount'         => 300000,
            'is_advance'     => true,
            'advance_amount' => 100000,
        ]);
    }

    /**
     * Test 5: Maker-Checker rule (Munshi creates pending_owner, Owner approves)
     */
    public function test_maker_checker_workflow()
    {
        $this->actingAs($this->user);

        // Set role to munshi
        $this->withSession(['investment_role' => 'munshi']);

        $partner = InvestmentPartner::create([
            'name'              => 'Maker Partner',
            'role'              => 'partner',
            'profit_percentage' => 10,
            'status'            => 'active',
        ]);

        // Munshi posts entry
        $this->post('/investment/entry', [
            'type'           => 'capital_in',
            'partner_id'     => $partner->id,
            'party_name'     => $partner->name,
            'amount'         => 150000,
            'payment_method' => 'cash',
        ]);

        $tx = InvestmentTransaction::where('partner_id', $partner->id)->first();
        $this->assertNotNull($tx);
        $this->assertEquals('pending_owner', $tx->approval_status);

        // Owner approves
        $this->withSession(['investment_role' => 'owner']);
        $this->post("/investment/approve/{$tx->id}")->assertRedirect();

        $tx->refresh();
        $this->assertEquals('approved', $tx->approval_status);
        $this->assertEquals($this->user->name, $tx->approved_by);
    }

    /**
     * Test 6: Append-only ledger rule (Void does not delete; generates Reversal Entry)
     */
    public function test_void_entry_creates_append_only_reversal()
    {
        $this->actingAs($this->user);

        $tx = InvestmentTransaction::create([
            'ref_no'          => 'SO-TEST-1',
            'date'            => now(),
            'party_name'      => 'Fund A',
            'type'            => 'surplus_out',
            'amount'          => 250000,
            'payment_method'  => 'cash',
            'approval_status' => 'posted',
        ]);

        $initialCount = InvestmentTransaction::count();

        // Void with mandatory reason
        $this->post("/investment/void/{$tx->id}", [
            'reason' => 'Wrong fund selected',
        ])->assertRedirect();

        // Total count must increase by 1 (append-only)
        $this->assertEquals($initialCount + 1, InvestmentTransaction::count());

        $tx->refresh();
        $this->assertTrue((bool)$tx->is_reversed);
        $this->assertEquals('reversed', $tx->approval_status);
        $this->assertEquals('Wrong fund selected', $tx->reversal_reason);
        $this->assertNotNull($tx->reversal_ref_no);

        // Reversal transaction exists
        $reversalTx = InvestmentTransaction::where('ref_no', $tx->reversal_ref_no)->first();
        $this->assertNotNull($reversalTx);
        $this->assertEquals('surplus_in', $reversalTx->type);
        $this->assertEquals(250000, $reversalTx->amount);
    }
}
