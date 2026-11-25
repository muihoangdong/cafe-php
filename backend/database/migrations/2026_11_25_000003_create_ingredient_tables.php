<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kho nguyên liệu và phiếu nhập: mỗi phiếu nhập cộng vào tồn của nguyên liệu và ghi lại chi phí.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ingredients', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
            $t->string('unit', 20);
            $t->decimal('stock', 12, 2)->default(0);
            // Tồn dưới mức này thì admin thấy cảnh báo cần nhập thêm.
            $t->decimal('min_stock', 12, 2)->default(0);
            $t->boolean('active')->default(true);
            $t->timestamps();
        });
        Schema::create('ingredient_imports', function (Blueprint $t) {
            $t->id();
            $t->string('code')->unique();
            $t->string('supplier')->nullable();
            $t->text('note')->nullable();
            $t->unsignedBigInteger('total');
            $t->timestamp('imported_at')->index();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->timestamps();
        });
        Schema::create('ingredient_import_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('ingredient_import_id')->constrained()->cascadeOnDelete();
            $t->foreignId('ingredient_id')->constrained()->restrictOnDelete();
            $t->decimal('quantity', 12, 2);
            $t->unsignedInteger('unit_price');
            $t->unsignedBigInteger('amount');
            $t->timestamps();
            $t->index('ingredient_import_id');
            $t->index('ingredient_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ingredient_import_items');
        Schema::dropIfExists('ingredient_imports');
        Schema::dropIfExists('ingredients');
    }
};
