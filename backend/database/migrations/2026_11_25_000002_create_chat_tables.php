<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lưu hội thoại với trợ lý gợi ý món.
 * Khách vãng lai giữ uuid trong trình duyệt; khách đăng nhập thì hội thoại gắn với tài khoản để mở lại trên máy khác.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_conversations', function (Blueprint $t) {
            $t->id();
            // Mã công khai, không đoán được: khách vãng lai dùng nó thay cho đăng nhập.
            $t->uuid('uuid')->unique();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->string('title')->nullable();
            $t->unsignedInteger('messages_count')->default(0);
            $t->timestamp('last_message_at')->nullable();
            $t->timestamps();
            // Danh sách hội thoại của khách và trang admin: mới nhất trước.
            $t->index(['user_id', 'last_message_at']);
            $t->index('last_message_at');
        });
        Schema::create('chat_messages', function (Blueprint $t) {
            $t->id();
            $t->foreignId('chat_conversation_id')->constrained()->cascadeOnDelete();
            $t->string('role', 10);
            $t->text('text');
            $t->json('product_ids')->nullable();
            // gemini | fallback, để admin thấy lúc nào AI không trả lời được.
            $t->string('source', 20)->nullable();
            $t->timestamps();
            $t->index(['chat_conversation_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_messages');
        Schema::dropIfExists('chat_conversations');
    }
};
