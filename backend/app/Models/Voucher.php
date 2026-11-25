<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Voucher extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['value' => 'integer', 'max_discount' => 'integer', 'min_order' => 'integer', 'usage_limit' => 'integer', 'used_count' => 'integer', 'active' => 'boolean', 'starts_at' => 'datetime', 'expires_at' => 'datetime'];
    }

    /** Trả về lý do không dùng được, hoặc null nếu hợp lệ. */
    public function problem(int $subtotal, ?int $userId = null): ?string
    {
        if (! $this->active) {
            return 'Mã giảm giá đã ngừng áp dụng.';
        }
        if ($this->starts_at && now()->lt($this->starts_at)) {
            return 'Mã giảm giá chưa đến thời gian áp dụng.';
        }
        if ($this->expires_at && now()->gt($this->expires_at)) {
            return 'Mã giảm giá đã hết hạn.';
        }
        if ($this->usage_limit !== null && $this->used_count >= $this->usage_limit) {
            return 'Mã giảm giá đã hết lượt sử dụng.';
        }
        if ($subtotal < $this->min_order) {
            return 'Đơn tối thiểu '.number_format($this->min_order, 0, ',', '.').'đ để dùng mã này.';
        }
        if ($userId && Order::where('user_id', $userId)->where('voucher_code', $this->code)->where('status', '!=', 'cancelled')->exists()) {
            return 'Bạn đã dùng mã giảm giá này.';
        }

        return null;
    }

    public function discountFor(int $subtotal): int
    {
        $discount = $this->type === 'percent' ? intdiv($subtotal * $this->value, 100) : $this->value;
        if ($this->max_discount) {
            $discount = min($discount, $this->max_discount);
        }

        return min($discount, $subtotal);
    }
}
