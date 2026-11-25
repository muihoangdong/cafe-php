<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatConversation extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['id'];

    protected function casts(): array
    {
        return ['last_message_at' => 'datetime', 'messages_count' => 'integer'];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function messages()
    {
        return $this->hasMany(ChatMessage::class);
    }

    /** Hội thoại chưa gắn tài khoản ai cũng mở được bằng uuid; đã gắn thì chỉ chủ tài khoản. */
    public function visibleTo(?User $user): bool
    {
        return $this->user_id === null || $this->user_id === $user?->id;
    }
}
