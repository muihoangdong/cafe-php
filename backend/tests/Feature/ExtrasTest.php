<?php

namespace Tests\Feature;

use App\Events\ShopEvent;
use App\Models\Category;
use App\Models\Product;
use App\Models\Topping;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ExtrasTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        Event::fake([ShopEvent::class]);
        $user = User::factory()->create();
        $admin = User::factory()->create(['role' => 'admin']);
        $category = Category::create(['name' => 'Trà']);
        $product = Product::create(['category_id' => $category->id, 'name' => 'Trà đào', 'description' => 'Trà đào cam sả thanh mát', 'featured' => true]);
        $variant = $product->variants()->create(['size' => 'M', 'price' => 40000]);
        $pearl = Topping::create(['name' => 'Trân châu', 'price' => 6000]);
        $cheese = Topping::create(['name' => 'Kem cheese', 'price' => 10000]);

        return [$user, $admin, $product, $variant, $pearl, $cheese];
    }

    private function payload(array $items, ?string $voucher = null): array
    {
        return ['idempotency_key' => (string) Str::uuid(), 'recipient' => 'Khách Zentea', 'phone' => '0901234567', 'address' => '123 Nguyễn Huệ', 'payment_method' => 'cod', 'voucher_code' => $voucher, 'items' => $items];
    }

    public function test_options_and_toppings_are_priced_on_server(): void
    {
        [$user, , , $v, $pearl, $cheese] = $this->fixture();
        Sanctum::actingAs($user);
        $order = $this->postJson('/api/orders', $this->payload([
            ['variant_id' => $v->id, 'quantity' => 2, 'sugar' => '50', 'ice' => '0', 'topping_ids' => [$cheese->id, $pearl->id]],
            ['variant_id' => $v->id, 'quantity' => 1],
        ]))->assertCreated()->assertJsonPath('subtotal', 2 * 56000 + 40000)->assertJsonPath('total', 152000);
        $order->assertJsonPath('items.0.sugar', '50')->assertJsonPath('items.0.ice', '0')->assertJsonPath('items.0.toppings.0.name', 'Trân châu')->assertJsonPath('items.1.sugar', '100');
    }

    public function test_large_orders_are_not_limited_by_stock(): void
    {
        [$user, , , $v] = $this->fixture();
        Sanctum::actingAs($user);
        // Không còn tồn kho theo món: cùng size, khác tùy chọn, số lượng lớn vẫn đặt được.
        $this->postJson('/api/orders', $this->payload([['variant_id' => $v->id, 'quantity' => 99, 'sugar' => '0'], ['variant_id' => $v->id, 'quantity' => 99]]))
            ->assertCreated()->assertJsonCount(2, 'items')->assertJsonPath('subtotal', 198 * 40000);
    }

    public function test_invalid_options_and_inactive_topping_are_rejected(): void
    {
        [$user, , , $v, $pearl] = $this->fixture();
        Sanctum::actingAs($user);
        foreach (['42', '105', '-5', '05', 'abc', '50.5'] as $sugar) {
            $this->postJson('/api/orders', $this->payload([['variant_id' => $v->id, 'quantity' => 1, 'sugar' => $sugar]]))
                ->assertUnprocessable()->assertJsonPath('errors', ['items.0.sugar' => ['Mức đường phải từ 0 đến 100%, theo bước 5%.']]);
        }
        $pearl->update(['active' => false]);
        $this->postJson('/api/orders', $this->payload([['variant_id' => $v->id, 'quantity' => 1, 'topping_ids' => [$pearl->id]]]))->assertUnprocessable();
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_cart_keeps_options(): void
    {
        [$user, , , $v, $pearl] = $this->fixture();
        Sanctum::actingAs($user);
        // Mức đường tự nhập ngoài các mức gợi ý vẫn được nhận.
        $this->putJson('/api/cart', ['items' => [['variant_id' => $v->id, 'quantity' => 1, 'sugar' => 25]]])->assertOk()->assertJsonPath('items.0.sugar', '25');
        $this->putJson('/api/cart', ['items' => [['variant_id' => $v->id, 'quantity' => 1, 'sugar' => '30', 'ice' => '50', 'topping_ids' => [$pearl->id]]]])
            ->assertOk()->assertJsonPath('items.0.sugar', '30')->assertJsonPath('items.0.toppings.0.id', $pearl->id);
    }

    public function test_voucher_discount_limits_and_restore_on_cancel(): void
    {
        [$user, $admin, , $v] = $this->fixture();
        Voucher::create(['code' => 'GIAM10', 'type' => 'percent', 'value' => 10, 'max_discount' => 5000, 'min_order' => 50000, 'usage_limit' => 1]);
        Sanctum::actingAs($user);
        $this->postJson('/api/vouchers/check', ['code' => 'giam10', 'subtotal' => 40000])->assertUnprocessable();
        $this->postJson('/api/vouchers/check', ['code' => 'giam10', 'subtotal' => 80000])->assertOk()->assertJsonPath('discount', 5000);
        $id = $this->postJson('/api/orders', $this->payload([['variant_id' => $v->id, 'quantity' => 2]], 'giam10'))
            ->assertCreated()->assertJsonPath('discount', 5000)->assertJsonPath('total', 75000)->json('id');
        $this->assertEquals(1, Voucher::first()->used_count);
        Sanctum::actingAs(User::factory()->create());
        $this->postJson('/api/orders', $this->payload([['variant_id' => $v->id, 'quantity' => 2]], 'GIAM10'))->assertUnprocessable();
        Sanctum::actingAs($admin);
        $this->patchJson('/api/admin/orders/'.$id.'/status', ['status' => 'cancelled'])->assertOk();
        $this->assertEquals(0, Voucher::first()->used_count);
    }

    public function test_expired_voucher_and_admin_crud(): void
    {
        [$user, $admin] = $this->fixture();
        Sanctum::actingAs($user);
        $this->postJson('/api/admin/vouchers', ['code' => 'X', 'type' => 'fixed', 'value' => 1000])->assertForbidden();
        Sanctum::actingAs($admin);
        $id = $this->postJson('/api/admin/vouchers', ['code' => 'het han', 'type' => 'fixed', 'value' => 1000])->assertUnprocessable();
        $id = $this->postJson('/api/admin/vouchers', ['code' => 'hethan', 'type' => 'fixed', 'value' => 10000, 'expires_at' => now()->subDay()->toDateTimeString()])->assertCreated()->assertJsonPath('code', 'HETHAN')->json('id');
        $this->postJson('/api/admin/vouchers', ['code' => 'PHANTRAM', 'type' => 'percent', 'value' => 150])->assertUnprocessable();
        Sanctum::actingAs($user);
        $this->postJson('/api/vouchers/check', ['code' => 'HETHAN', 'subtotal' => 100000])->assertUnprocessable()->assertJsonPath('message', 'Mã giảm giá đã hết hạn.');
        Sanctum::actingAs($admin);
        $this->deleteJson('/api/admin/vouchers/'.$id)->assertNoContent();
        $this->assertDatabaseCount('vouchers', 0);
        $this->postJson('/api/admin/toppings', ['name' => 'Thạch', 'price' => 5000])->assertCreated();
        $this->getJson('/api/toppings')->assertOk()->assertJsonCount(3);
    }
}
