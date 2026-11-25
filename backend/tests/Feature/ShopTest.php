<?php

namespace Tests\Feature;

use App\Events\ShopEvent;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ShopTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $this->assertSame('sqlite', DB::connection()->getDriverName());
        Event::fake([ShopEvent::class]);
        $user = User::factory()->create();
        $admin = User::factory()->create(['role' => 'admin']);
        $category = Category::create(['name' => 'Trà']);
        $product = Product::create(['category_id' => $category->id, 'name' => 'Trà đào', 'description' => 'Trà tươi']);
        $variant = $product->variants()->create(['size' => 'M', 'price' => 42000]);

        return [$user, $admin, $product, $variant];
    }

    private function payload(int $id): array
    {
        return ['idempotency_key' => (string) Str::uuid(), 'recipient' => 'Khách Zentea', 'phone' => '0901234567', 'address' => '123 Nguyễn Huệ', 'payment_method' => 'cod', 'items' => [['variant_id' => $id, 'quantity' => 2, 'price' => 1]]];
    }

    public function test_checkout_prices_and_idempotency(): void
    {
        [$user,$admin,$product,$v] = $this->fixture();
        Sanctum::actingAs($user);
        $payload = $this->payload($v->id);
        $response = $this->postJson('/api/orders', $payload)->assertCreated()->assertJsonPath('total', 84000);
        $this->postJson('/api/orders', $payload)->assertCreated()->assertJsonPath('id', $response->json('id'));
        $this->assertDatabaseCount('orders', 1);
        $payload['items'][0]['quantity'] = 1;
        $this->postJson('/api/orders', $payload)->assertStatus(409);
        Event::assertDispatched(ShopEvent::class, fn ($e) => $e->name === 'NewOrderPlaced' && in_array('user.'.$user->id, $e->channels));
    }

    public function test_inactive_product_cannot_be_ordered(): void
    {
        [$user,$admin,$p,$v] = $this->fixture();
        Sanctum::actingAs($user);
        $p->update(['active' => false]);
        $this->postJson('/api/orders', $this->payload($v->id))->assertUnprocessable()->assertJsonPath('message', 'Sản phẩm '.$p->name.' đã ngừng bán.');
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_permissions_transitions_and_cancellation(): void
    {
        [$user,$admin,$p,$v] = $this->fixture();
        Sanctum::actingAs($user);
        $id = $this->postJson('/api/orders', $this->payload($v->id))->json('id');
        $this->getJson('/api/admin/orders')->assertForbidden();
        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/orders/'.$id)->assertForbidden();
        Sanctum::actingAs($admin);
        $this->patchJson('/api/admin/orders/'.$id.'/status', ['status' => 'completed'])->assertUnprocessable();
        $this->patchJson('/api/admin/orders/'.$id.'/status', ['status' => 'cancelled'])->assertOk();
        $this->patchJson('/api/admin/orders/'.$id.'/status', ['status' => 'cancelled'])->assertOk()->assertJsonPath('status', 'cancelled');
    }

    public function test_reviews_require_completed_purchase_and_moderation(): void
    {
        [$user,$admin,$p,$v] = $this->fixture();
        Sanctum::actingAs($user);
        $this->postJson('/api/products/'.$p->id.'/reviews', ['rating' => 5, 'comment' => 'Trà rất ngon'])->assertForbidden();
        $id = $this->postJson('/api/orders', $this->payload($v->id))->json('id');
        Sanctum::actingAs($admin);
        foreach (['preparing', 'delivering', 'completed'] as $status) {
            $this->patchJson('/api/admin/orders/'.$id.'/status', compact('status'))->assertOk();
        }
        Sanctum::actingAs($user);
        $review = $this->postJson('/api/products/'.$p->id.'/reviews', ['rating' => 5, 'comment' => 'Trà rất ngon'])->assertCreated()->json('id');
        $this->getJson('/api/products/'.$p->id)->assertJsonCount(0, 'reviews');
        Sanctum::actingAs($admin);
        $this->patchJson('/api/admin/reviews/'.$review, ['status' => 'approved'])->assertOk();
        $this->getJson('/api/products/'.$p->id)->assertJsonCount(1, 'reviews');
        $this->getJson('/api/admin/statistics')->assertOk()->assertJsonPath('today', 84000);
    }

    public function test_private_channel_authorization(): void
    {
        [$user,$admin] = $this->fixture();
        Sanctum::actingAs($user);
        $this->postJson('/broadcasting/auth', ['socket_id' => '123.456', 'channel_name' => 'private-admin.orders'])->assertForbidden();
        $this->postJson('/broadcasting/auth', ['socket_id' => '123.456', 'channel_name' => 'private-user.'.($user->id + 100)])->assertForbidden();
        $this->postJson('/broadcasting/auth', ['socket_id' => '123.456', 'channel_name' => 'private-user.'.$user->id])->assertOk();
    }
}
