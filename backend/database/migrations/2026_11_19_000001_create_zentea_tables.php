<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->string('role')->default('customer');
            $t->boolean('is_blocked')->default(false);
            $t->string('phone')->nullable();
            $t->text('address')->nullable();
            $t->json('cart')->nullable();
        });
        Schema::create('categories', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
            $t->string('image')->nullable();
            $t->timestamps();
        });
        Schema::create('products', function (Blueprint $t) {
            $t->id();
            $t->foreignId('category_id')->constrained()->restrictOnDelete();
            $t->string('name');
            $t->text('description');
            $t->string('image')->nullable();
            $t->boolean('featured')->default(false);
            $t->boolean('active')->default(true);
            $t->timestamps();
        });
        Schema::create('product_variants', function (Blueprint $t) {
            $t->id();
            $t->foreignId('product_id')->constrained()->cascadeOnDelete();
            $t->string('size');
            $t->unsignedInteger('price');
            $t->unsignedInteger('stock');
            $t->unique(['product_id', 'size']);
            $t->timestamps();
        });
        Schema::create('orders', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained();
            $t->string('code')->unique();
            $t->uuid('idempotency_key');
            $t->string('request_hash', 64);
            $t->string('status')->default('pending')->index();
            $t->string('payment_method');
            $t->string('payment_status')->default('unpaid');
            $t->unsignedInteger('total');
            $t->string('recipient');
            $t->string('phone');
            $t->text('address');
            $t->text('note')->nullable();
            $t->timestamp('completed_at')->nullable()->index();
            $t->timestamps();
            $t->unique(['user_id', 'idempotency_key']);
        });
        Schema::create('order_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('order_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_variant_id')->constrained()->restrictOnDelete();
            $t->unsignedBigInteger('product_id');
            $t->string('name');
            $t->string('size');
            $t->unsignedInteger('price');
            $t->unsignedInteger('quantity');
            $t->timestamps();
        });
        Schema::create('reviews', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained();
            $t->foreignId('product_id')->constrained();
            $t->unsignedSmallInteger('rating');
            $t->text('comment');
            $t->string('status')->default('pending')->index();
            $t->unique(['user_id', 'product_id']);
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['reviews', 'order_items', 'orders', 'product_variants', 'products', 'categories'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn(['role', 'is_blocked', 'phone', 'address', 'cart']));
    }
};
