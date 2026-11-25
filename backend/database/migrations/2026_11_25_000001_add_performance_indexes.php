<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PostgreSQL không tự tạo index cho khóa ngoại như MySQL.
 * Các index dưới đây phục vụ những truy vấn chạy thường xuyên nhất.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $t) {
            // Tải chi tiết đơn: $order->load('items').
            $t->index('order_id');
            // Kiểm tra quyền đánh giá: đơn có chứa món X không.
            $t->index(['product_id', 'order_id']);
        });
        Schema::table('reviews', function (Blueprint $t) {
            // Trang món: đánh giá đã duyệt, mới nhất trước.
            $t->index(['product_id', 'status', 'created_at']);
        });
        Schema::table('orders', function (Blueprint $t) {
            // Admin: danh sách đơn mới nhất và lọc theo ngày.
            $t->index('created_at');
        });
        Schema::table('products', function (Blueprint $t) {
            // Lọc thực đơn theo danh mục và kiểm tra danh mục còn sản phẩm.
            $t->index(['category_id', 'active']);
        });
    }

    public function down(): void
    {
        Schema::table('products', fn (Blueprint $t) => $t->dropIndex(['category_id', 'active']));
        Schema::table('orders', fn (Blueprint $t) => $t->dropIndex(['created_at']));
        Schema::table('reviews', fn (Blueprint $t) => $t->dropIndex(['product_id', 'status', 'created_at']));
        Schema::table('order_items', function (Blueprint $t) {
            $t->dropIndex(['product_id', 'order_id']);
            $t->dropIndex(['order_id']);
        });
    }
};
