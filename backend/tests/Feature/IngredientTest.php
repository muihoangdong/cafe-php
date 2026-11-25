<?php

namespace Tests\Feature;

use App\Models\Ingredient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class IngredientTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_manages_ingredients_and_sees_low_stock(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $tea = $this->postJson('/api/admin/ingredients', ['name' => 'Trà đen', 'unit' => 'kg', 'min_stock' => 2])->assertCreated()
            ->assertJsonPath('stock', 0)->assertJsonPath('low', true)->json('id');
        $this->postJson('/api/admin/ingredients', ['name' => 'Trà đen', 'unit' => 'kg', 'min_stock' => 1])->assertUnprocessable();
        $this->postJson('/api/admin/ingredients', ['name' => 'Sữa', 'unit' => 'thùng', 'min_stock' => 1])->assertUnprocessable();
        $this->postJson('/api/admin/ingredients', ['name' => 'Sữa tươi', 'unit' => 'l', 'min_stock' => 5, 'stock' => 20])->assertCreated()->assertJsonPath('low', false);

        $this->getJson('/api/admin/ingredients')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('summary.low', 1);
        $this->getJson('/api/admin/ingredients?low=1')->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Trà đen');
        // Kiểm kê: sửa tồn trực tiếp.
        $this->putJson('/api/admin/ingredients/'.$tea, ['name' => 'Trà đen', 'unit' => 'kg', 'min_stock' => 2, 'stock' => 3.5])->assertOk()->assertJsonPath('stock', 3.5)->assertJsonPath('low', false);
    }

    public function test_import_adds_stock_and_records_cost(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $tea = Ingredient::create(['name' => 'Trà đen', 'unit' => 'kg', 'stock' => 1.5, 'min_stock' => 2]);
        $milk = Ingredient::create(['name' => 'Sữa tươi', 'unit' => 'l', 'stock' => 0, 'min_stock' => 5]);
        Sanctum::actingAs($admin);

        $res = $this->postJson('/api/admin/ingredient-imports', ['supplier' => 'Công ty Trà Việt', 'items' => [
            ['ingredient_id' => $tea->id, 'quantity' => 2.25, 'unit_price' => 180000],
            ['ingredient_id' => $milk->id, 'quantity' => 12, 'unit_price' => 32000],
        ]])->assertCreated()->assertJsonPath('total', 405000 + 384000)->assertJsonPath('user.id', $admin->id)->assertJsonCount(2, 'items');
        $this->assertStringStartsWith('PN', $res->json('code'));
        $this->assertSame(3.75, $tea->fresh()->stock);
        $this->assertSame(12.0, $milk->fresh()->stock);

        $this->getJson('/api/admin/ingredient-imports')->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.items.0.ingredient.name', 'Trà đen');
        $this->getJson('/api/admin/ingredient-imports?search=trà việt')->assertJsonPath('total', 1);
        $this->getJson('/api/admin/ingredients')->assertJsonPath('summary.month_cost', 789000)->assertJsonPath('summary.low', 0);
    }

    public function test_import_rejects_bad_rows_without_changing_stock(): void
    {
        $tea = Ingredient::create(['name' => 'Trà đen', 'unit' => 'kg', 'stock' => 1]);
        $old = Ingredient::create(['name' => 'Bột cũ', 'unit' => 'kg', 'stock' => 0, 'active' => false]);
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $row = fn ($id, $qty = 1) => ['ingredient_id' => $id, 'quantity' => $qty, 'unit_price' => 1000];

        $this->postJson('/api/admin/ingredient-imports', ['items' => []])->assertUnprocessable();
        $this->postJson('/api/admin/ingredient-imports', ['items' => [$row($tea->id), $row($tea->id)]])->assertJsonValidationErrors('items.1.ingredient_id');
        $this->postJson('/api/admin/ingredient-imports', ['items' => [$row($old->id)]])->assertJsonValidationErrors('items.0.ingredient_id');
        $this->postJson('/api/admin/ingredient-imports', ['items' => [$row($tea->id, 0)]])->assertJsonValidationErrors('items.0.quantity');
        $this->postJson('/api/admin/ingredient-imports', ['imported_at' => now()->addDay()->toDateString(), 'items' => [$row($tea->id)]])->assertJsonValidationErrors('imported_at');
        $this->assertSame(1.0, $tea->fresh()->stock);
    }

    public function test_used_ingredient_is_deactivated_not_deleted_and_customers_are_blocked(): void
    {
        $tea = Ingredient::create(['name' => 'Trà đen', 'unit' => 'kg']);
        $sugar = Ingredient::create(['name' => 'Đường', 'unit' => 'kg']);
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->postJson('/api/admin/ingredient-imports', ['items' => [['ingredient_id' => $tea->id, 'quantity' => 1, 'unit_price' => 1000]]])->assertCreated();

        $this->deleteJson('/api/admin/ingredients/'.$tea->id)->assertNoContent();
        $this->assertFalse($tea->fresh()->active);
        $this->deleteJson('/api/admin/ingredients/'.$sugar->id)->assertNoContent();
        $this->assertNull($sugar->fresh());

        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/admin/ingredients')->assertForbidden();
        $this->postJson('/api/admin/ingredient-imports', [])->assertForbidden();
    }
}
