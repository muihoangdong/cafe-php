<?php

namespace Tests\Feature;

use App\Events\ShopEvent;
use App\Models\Category;
use App\Models\Product;
use App\Models\Topping;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PerformanceTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        Event::fake([ShopEvent::class]);
        $category = Category::create(['name' => 'Trà']);
        $product = Product::create(['category_id' => $category->id, 'name' => 'Trà đào', 'description' => 'Trà tươi']);
        $variant = $product->variants()->create(['size' => 'M', 'price' => 40000]);

        return [$product, $variant];
    }

    private function queries(callable $fn): int
    {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $fn();
        $count = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $count;
    }

    public function test_catalog_reads_hit_cache(): void
    {
        [$product] = $this->fixture();
        Topping::create(['name' => 'Trân châu', 'price' => 6000]);
        foreach (['/api/products', '/api/products?category=1', '/api/categories', '/api/toppings', '/api/products/'.$product->id] as $url) {
            $this->getJson($url)->assertOk();
            $this->assertSame(0, $this->queries(fn () => $this->getJson($url)->assertOk()), $url.' phải lấy từ cache');
        }
        $this->getJson('/api/products/abc')->assertNotFound();
    }

    public function test_catalog_no_longer_exposes_stock(): void
    {
        [$product] = $this->fixture();
        $this->assertArrayNotHasKey('stock', $this->getJson('/api/products/'.$product->id)->assertOk()->json('variants.0'));
        $this->assertArrayNotHasKey('stock', $this->getJson('/api/products')->json('data.0.variants.0'));
    }

    public function test_admin_changes_refresh_cache(): void
    {
        [$product] = $this->fixture();
        $this->getJson('/api/products')->assertJsonPath('data.0.name', 'Trà đào');
        $this->getJson('/api/toppings')->assertJsonCount(0);
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->putJson('/api/admin/products/'.$product->id, ['name' => 'Trà đào cam sả', 'description' => 'Mới', 'category_id' => $product->category_id, 'variants' => [['size' => 'M', 'price' => 45000]]])->assertOk();
        $this->postJson('/api/admin/toppings', ['name' => 'Thạch', 'price' => 5000])->assertCreated();
        $this->getJson('/api/products')->assertJsonPath('data.0.name', 'Trà đào cam sả')->assertJsonPath('data.0.variants.0.price', 45000);
        $this->getJson('/api/toppings')->assertJsonCount(1);
        $this->deleteJson('/api/admin/products/'.$product->id)->assertNoContent();
        $this->getJson('/api/products/'.$product->id)->assertNotFound();
        $this->getJson('/api/products')->assertJsonCount(0, 'data');
    }

    public function test_admin_order_date_filter_uses_full_days(): void
    {
        $this->fixture();
        $user = User::factory()->create();
        $make = fn ($at) => DB::table('orders')->insert(['user_id' => $user->id, 'code' => Str::random(8), 'idempotency_key' => (string) Str::uuid(), 'request_hash' => 'x', 'payment_method' => 'cod', 'total' => 1000, 'recipient' => 'K', 'phone' => '0901234567', 'address' => 'HCM', 'created_at' => $at, 'updated_at' => $at]);
        $make('2026-11-20 23:59:00');
        $make('2026-11-21 00:00:00');
        $make('2026-11-22 08:00:00');
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->getJson('/api/admin/orders?from=2026-11-20&to=2026-11-21')->assertOk()->assertJsonPath('total', 2);
    }
}
