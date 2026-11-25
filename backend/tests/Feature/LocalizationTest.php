<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LocalizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_validation_messages_are_vietnamese_with_field_names(): void
    {
        $this->postJson('/api/auth/register', ['email' => 'khong-phai-email', 'password' => 'ngan', 'password_confirmation' => 'khac'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.name.0', 'Bạn chưa nhập tên.')
            ->assertJsonPath('errors.email.0', 'Email phải là địa chỉ email hợp lệ.')
            ->assertJsonPath('errors.password', ['Mật khẩu phải dài ít nhất 8 ký tự.', 'Xác nhận mật khẩu không khớp.'])
            // Câu tóm tắt ở "message" cũng tiếng Việt.
            ->assertJsonPath('message', 'Bạn chưa nhập tên. (và 3 lỗi khác)');

        User::factory()->create(['email' => 'da-co@zentea.local']);
        $this->postJson('/api/auth/register', ['name' => 'An', 'email' => 'da-co@zentea.local', 'password' => 'Zentea@123', 'password_confirmation' => 'Zentea@123'])
            ->assertJsonPath('errors.email.0', 'Email này đã được đăng ký.');
    }

    public function test_order_errors_use_vietnamese_names_for_list_fields(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $this->postJson('/api/orders', [
            'idempotency_key' => (string) Str::uuid(), 'recipient' => 'An', 'phone' => 'abc', 'address' => 'Q1', 'payment_method' => 'tien-mat',
            'items' => [['variant_id' => 999, 'quantity' => 0, 'ice' => '30']],
        ])->assertUnprocessable()->assertJsonPath('errors', [
            'phone' => ['Số điện thoại chỉ gồm 9-20 chữ số, có thể kèm dấu +, khoảng trắng, ngoặc hoặc gạch ngang.'],
            'address' => ['Địa chỉ phải dài ít nhất 5 ký tự.'],
            'payment_method' => ['Phương thức thanh toán không hợp lệ.'],
            'items.0.variant_id' => ['Size món không tồn tại.'],
            'items.0.quantity' => ['Số lượng phải từ 1 trở lên.'],
            'items.0.ice' => ['Mức đá không hợp lệ.'],
        ]);
    }

    public function test_default_http_errors_are_vietnamese_and_hide_class_names(): void
    {
        $this->getJson('/api/orders')->assertUnauthorized()->assertJsonPath('message', 'Bạn cần đăng nhập để tiếp tục.');
        $this->getJson('/api/products/999')->assertNotFound()->assertJsonPath('message', 'Không tìm thấy dữ liệu.');
        $this->getJson('/api/khong-co-duong-dan')->assertNotFound()->assertJsonPath('message', 'Không tìm thấy dữ liệu.');
        $this->deleteJson('/api/products')->assertStatus(405)->assertJsonPath('message', 'Thao tác không được hỗ trợ.');
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'a@b.vn', 'password' => 'sai']);
        }
        $this->postJson('/api/auth/login', ['email' => 'a@b.vn', 'password' => 'sai'])->assertStatus(429)
            ->assertJsonPath('message', 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.');
    }

    public function test_custom_vietnamese_messages_are_kept(): void
    {
        $category = Category::create(['name' => 'Trà']);
        $product = Product::create(['category_id' => $category->id, 'name' => 'Trà đào', 'description' => 'Mát', 'active' => false]);
        $variant = $product->variants()->create(['size' => 'M', 'price' => 40000]);
        Sanctum::actingAs(User::factory()->create());
        $this->postJson('/api/orders', ['idempotency_key' => (string) Str::uuid(), 'recipient' => 'An', 'phone' => '0901234567', 'address' => '123 Lê Lợi', 'payment_method' => 'cod', 'items' => [['variant_id' => $variant->id, 'quantity' => 1]]])
            ->assertUnprocessable()->assertJsonPath('message', 'Sản phẩm Trà đào đã ngừng bán.');
        $this->postJson('/api/auth/reset-password', ['token' => 'sai', 'email' => 'khong-co@zentea.local', 'password' => 'Zentea@123', 'password_confirmation' => 'Zentea@123'])
            ->assertUnprocessable()->assertJsonPath('message', 'Không tìm thấy tài khoản với email này.');
    }
}
