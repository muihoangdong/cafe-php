<?php

namespace App\Support;

class DrinkOptions
{
    /** Các mức đường gợi ý sẵn; khách vẫn có thể tự nhập mức khác (xem SUGAR_PATTERN). */
    public const SUGAR = ['0', '30', '50', '70', '100'];

    /** Mức đường tự nhập: 0 đến 100%, bước 5% để quầy pha dễ đong. */
    public const SUGAR_PATTERN = '/^(100|[1-9]?[05])$/';

    public const ICE = ['0', '50', '100'];

    public const MAX_TOPPINGS = 3;

    /** Luật kiểm tra tùy chọn cho mỗi dòng món trong giỏ/đơn. */
    public static function rules(string $prefix = 'items.*.'): array
    {
        return [
            $prefix.'sugar' => ['nullable', 'regex:'.self::SUGAR_PATTERN],
            $prefix.'ice' => 'nullable|in:'.implode(',', self::ICE),
            $prefix.'topping_ids' => 'nullable|array|max:'.self::MAX_TOPPINGS,
            $prefix.'topping_ids.*' => 'integer|distinct|exists:toppings,id',
        ];
    }

    /** Thông báo lỗi tiếng Việt cho tùy chọn món. */
    public static function messages(string $prefix = 'items.*.'): array
    {
        return [$prefix.'sugar.regex' => 'Mức đường phải từ 0 đến 100%, theo bước 5%.'];
    }

    /** Chuẩn hóa một dòng: mặc định 100% đường, đá bình thường, topping sắp xếp tăng dần. */
    public static function normalize(array $item): array
    {
        $toppings = collect($item['topping_ids'] ?? [])->map(fn ($id) => (int) $id)->unique()->sort()->values()->all();

        return ['variant_id' => (int) $item['variant_id'], 'quantity' => (int) $item['quantity'], 'sugar' => (string) ($item['sugar'] ?? '100'), 'ice' => (string) ($item['ice'] ?? '100'), 'topping_ids' => $toppings];
    }
}
