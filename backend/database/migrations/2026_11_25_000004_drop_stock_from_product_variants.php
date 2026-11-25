<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bỏ tồn kho theo món: món luôn đặt được, muốn ngừng bán thì admin tắt món.
 * Tồn kho của quán giờ theo dõi bằng nguyên liệu (bảng ingredients).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_variants', fn (Blueprint $t) => $t->dropColumn('stock'));
    }

    public function down(): void
    {
        Schema::table('product_variants', fn (Blueprint $t) => $t->unsignedInteger('stock')->default(100));
    }
};
