<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\Item;

class ExpiryGiftsSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('expiry_lots')->truncate();
        DB::table('gifts')->truncate();
        DB::table('wastages')->truncate();

        $items = Item::all()->keyBy('name_en');

        $tamatar = $items->first(fn($i) => str_contains($i->name_en, 'Tamatar'));
        $mirch = $items->first(fn($i) => str_contains($i->name_en, 'Harri Mirch'));
        $gobhi = $items->first(fn($i) => str_contains($i->name_en, 'Band Gobhi'));
        $piyaz = $items->first(fn($i) => str_contains($i->name_en, 'Piyaz'));
        $aloo = $items->first(fn($i) => str_contains($i->name_en, 'Aloo'));

        // Seed Expiry Lots
        DB::table('expiry_lots')->insert([
            [
                'id' => 1,
                'item_id' => $tamatar?->id ?? 3,
                'item_name' => 'Tamatar',
                'lot_code' => 'T-1118',
                'arrival_date' => '2026-11-19',
                'expiry_at' => '2026-11-21 10:00:00',
                'quantity' => 200,
                'unit' => 'kg',
                'rate' => 90,
                'nuqsan' => 18000,
                'status' => 'expired',
                'discount_rate' => null,
                'action_taken' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 2,
                'item_id' => $mirch?->id ?? 4,
                'item_name' => 'Harri Mirch',
                'lot_code' => 'H-1120',
                'arrival_date' => '2026-11-20',
                'expiry_at' => date('Y-m-d H:i:s', strtotime('+5 hours 24 minutes')),
                'quantity' => 80,
                'unit' => 'kg',
                'rate' => 250,
                'nuqsan' => 20000,
                'status' => 'jaldi_bechein',
                'discount_rate' => null,
                'action_taken' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 3,
                'item_id' => $gobhi?->id ?? 5,
                'item_name' => 'Band Gobhi',
                'lot_code' => 'G-1119',
                'arrival_date' => '2026-11-19',
                'expiry_at' => date('Y-m-d H:i:s', strtotime('+32 hours')), // 1d 8h
                'quantity' => 150,
                'unit' => 'kg',
                'rate' => 60,
                'nuqsan' => 9000,
                'status' => 'jaldi_bechein',
                'discount_rate' => null,
                'action_taken' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 4,
                'item_id' => $tamatar?->id ?? 3,
                'item_name' => 'Tamatar',
                'lot_code' => 'T-1121',
                'arrival_date' => '2026-11-20',
                'expiry_at' => date('Y-m-d H:i:s', strtotime('+51 hours')), // 2d 3h
                'quantity' => 300,
                'unit' => 'kg',
                'rate' => 90,
                'nuqsan' => 27000,
                'status' => 'jaldi_bechein',
                'discount_rate' => null,
                'action_taken' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 5,
                'item_id' => $piyaz?->id ?? 2,
                'item_name' => 'Piyaz',
                'lot_code' => 'P-1115',
                'arrival_date' => '2026-11-14',
                'expiry_at' => date('Y-m-d H:i:s', strtotime('+12 days')),
                'quantity' => 2000,
                'unit' => 'kg',
                'rate' => 40,
                'nuqsan' => 80000,
                'status' => 'fresh',
                'discount_rate' => null,
                'action_taken' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 6,
                'item_id' => $aloo?->id ?? 1,
                'item_name' => 'Aloo',
                'lot_code' => 'A-1116',
                'arrival_date' => '2026-11-15',
                'expiry_at' => date('Y-m-d H:i:s', strtotime('+20 days')),
                'quantity' => 3000,
                'unit' => 'kg',
                'rate' => 35,
                'nuqsan' => 105000,
                'status' => 'fresh',
                'discount_rate' => null,
                'action_taken' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        // Seed Gifts
        // Total this month = 12,500
        // Karachi Fresh Store: 1800 + 2200 = 4000
        // Baloch Trading Co: 2000 + 1500 = 3500
        // Ch. Imran: 1050 + 1450 = 2500
        // Naya customer: 1250
        // Other: 1200
        // Sum: 4000 + 3500 + 2500 + 1250 + 1250 = 12,500
        DB::table('gifts')->insert([
            [
                'voucher_no' => 'G-0042',
                'date' => '2026-11-20',
                'recipient_name' => 'Karachi Fresh Store',
                'item_id' => $tamatar?->id ?? 3,
                'lot_id' => 1,
                'item_name' => 'Tamatar',
                'quantity' => 20,
                'unit' => 'kg',
                'rate' => 90,
                'value' => 1800,
                'reason' => 'Eid',
                'status' => 'approved',
                'created_at' => now()->subDays(2),
                'updated_at' => now()->subDays(2),
            ],
            [
                'voucher_no' => 'G-0041',
                'date' => '2026-11-19',
                'recipient_name' => 'Baloch Trading Co',
                'item_id' => $piyaz?->id ?? 2,
                'lot_id' => 5,
                'item_name' => 'Piyaz',
                'quantity' => 50,
                'unit' => 'kg',
                'rate' => 40,
                'value' => 2000,
                'reason' => 'Loyalty',
                'status' => 'approved',
                'created_at' => now()->subDays(3),
                'updated_at' => now()->subDays(3),
            ],
            [
                'voucher_no' => 'G-0040',
                'date' => '2026-11-18',
                'recipient_name' => 'Ch. Imran (kisan)',
                'item_id' => $aloo?->id ?? 1,
                'lot_id' => 6,
                'item_name' => 'Aloo',
                'quantity' => 30,
                'unit' => 'kg',
                'rate' => 35,
                'value' => 1050,
                'reason' => 'Muawza',
                'status' => 'approved',
                'created_at' => now()->subDays(4),
                'updated_at' => now()->subDays(4),
            ],
            [
                'voucher_no' => 'G-0039',
                'date' => '2026-11-16',
                'recipient_name' => 'Naya customer',
                'item_id' => $mirch?->id ?? 4,
                'lot_id' => 2,
                'item_name' => 'Harri Mirch',
                'quantity' => 5,
                'unit' => 'kg',
                'rate' => 250,
                'value' => 1250,
                'reason' => 'Sample',
                'status' => 'approved',
                'created_at' => now()->subDays(6),
                'updated_at' => now()->subDays(6),
            ],
            [
                'voucher_no' => 'G-0038',
                'date' => '2026-11-12',
                'recipient_name' => 'Karachi Fresh Store',
                'item_id' => $gobhi?->id ?? 5,
                'lot_id' => 3,
                'item_name' => 'Band Gobhi',
                'quantity' => 36.67,
                'unit' => 'kg',
                'rate' => 60,
                'value' => 2200,
                'reason' => 'Loyalty',
                'status' => 'approved',
                'created_at' => now()->subDays(10),
                'updated_at' => now()->subDays(10),
            ],
            [
                'voucher_no' => 'G-0037',
                'date' => '2026-11-09',
                'recipient_name' => 'Baloch Trading Co',
                'item_id' => $aloo?->id ?? 1,
                'lot_id' => 6,
                'item_name' => 'Aloo',
                'quantity' => 42.86,
                'unit' => 'kg',
                'rate' => 35,
                'value' => 1500,
                'reason' => 'Taaluqat',
                'status' => 'approved',
                'created_at' => now()->subDays(13),
                'updated_at' => now()->subDays(13),
            ],
            [
                'voucher_no' => 'G-0036',
                'date' => '2026-11-05',
                'recipient_name' => 'Ch. Imran (kisan)',
                'item_id' => $piyaz?->id ?? 2,
                'lot_id' => 5,
                'item_name' => 'Piyaz',
                'quantity' => 36.25,
                'unit' => 'kg',
                'rate' => 40,
                'value' => 1450,
                'reason' => 'Muawza',
                'status' => 'approved',
                'created_at' => now()->subDays(17),
                'updated_at' => now()->subDays(17),
            ],
            [
                'voucher_no' => 'G-0035',
                'date' => '2026-11-02',
                'recipient_name' => 'Al-Madina Fruits',
                'item_id' => $tamatar?->id ?? 3,
                'lot_id' => 1,
                'item_name' => 'Tamatar',
                'quantity' => 13.89,
                'unit' => 'kg',
                'rate' => 90,
                'value' => 1250,
                'reason' => 'Sample',
                'status' => 'approved',
                'created_at' => now()->subDays(20),
                'updated_at' => now()->subDays(20),
            ],
        ]);

        // Seed Wastage (Total this month: 34,500)
        DB::table('wastages')->insert([
            [
                'voucher_no' => 'W-0001',
                'date' => '2026-11-04',
                'item_id' => $tamatar?->id ?? 3,
                'lot_id' => null,
                'item_name' => 'Tamatar',
                'quantity' => 120,
                'unit' => 'kg',
                'loss_amount' => 10800,
                'reason' => 'Kharab Maal (Gal gaya)',
                'status' => 'approved',
                'approved_by' => 'Owner',
                'created_at' => now()->subDays(18),
                'updated_at' => now()->subDays(18),
            ],
            [
                'voucher_no' => 'W-0002',
                'date' => '2026-11-10',
                'item_id' => $mirch?->id ?? 4,
                'lot_id' => null,
                'item_name' => 'Harri Mirch',
                'quantity' => 45,
                'unit' => 'kg',
                'loss_amount' => 11250,
                'reason' => 'Sukh gayi (Heat loss)',
                'status' => 'approved',
                'approved_by' => 'Owner',
                'created_at' => now()->subDays(12),
                'updated_at' => now()->subDays(12),
            ],
            [
                'voucher_no' => 'W-0003',
                'date' => '2026-11-15',
                'item_id' => $gobhi?->id ?? 5,
                'lot_id' => null,
                'item_name' => 'Band Gobhi',
                'quantity' => 207.5,
                'unit' => 'kg',
                'loss_amount' => 12450,
                'reason' => 'Patey kharab (Moisture damage)',
                'status' => 'approved',
                'approved_by' => 'Owner',
                'created_at' => now()->subDays(7),
                'updated_at' => now()->subDays(7),
            ],
        ]);
    }
}
