<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('toppings', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
            $t->unsignedInteger('price');
            $t->boolean('active')->default(true);
            $t->timestamps();
        });
        Schema::create('vouchers', function (Blueprint $t) {
            $t->id();
            $t->string('code')->unique();
            $t->string('description')->nullable();
            $t->string('type');
            $t->unsignedInteger('value');
            $t->unsignedInteger('max_discount')->nullable();
            $t->unsignedInteger('min_order')->default(0);
            $t->unsignedInteger('usage_limit')->nullable();
            $t->unsignedInteger('used_count')->default(0);
            $t->timestamp('starts_at')->nullable();
            $t->timestamp('expires_at')->nullable();
            $t->boolean('active')->default(true);
            $t->timestamps();
        });
        Schema::table('order_items', function (Blueprint $t) {
            $t->string('sugar')->default('100');
            $t->string('ice')->default('100');
            $t->json('toppings')->nullable();
        });
        Schema::table('orders', function (Blueprint $t) {
            $t->unsignedInteger('subtotal')->default(0);
            $t->unsignedInteger('discount')->default(0);
            $t->string('voucher_code')->nullable()->index();
        });
        DB::table('orders')->update(['subtotal' => DB::raw('total')]);
    }

    public function down(): void
    {
        Schema::table('orders', fn (Blueprint $t) => $t->dropColumn(['subtotal', 'discount', 'voucher_code']));
        Schema::table('order_items', fn (Blueprint $t) => $t->dropColumn(['sugar', 'ice', 'toppings']));
        Schema::dropIfExists('vouchers');
        Schema::dropIfExists('toppings');
    }
};
