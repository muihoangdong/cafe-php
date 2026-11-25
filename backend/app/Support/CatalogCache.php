<?php

namespace App\Support;

use Closure;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Cache dữ liệu đọc nhiều của thực đơn (danh mục, sản phẩm, topping, dữ liệu chatbot).
 *
 * Mỗi khóa gắn với một số phiên bản. Khi dữ liệu đổi (admin sửa món, đơn làm đổi tồn kho,
 * duyệt đánh giá…), chỉ cần tăng phiên bản: mọi khóa cũ bị bỏ qua và tự hết hạn sau TTL,
 * không phải tìm và xóa từng khóa.
 */
class CatalogCache
{
    private const VERSION_KEY = 'catalog:version';

    /** TTL dự phòng; dữ liệu thường bị làm mới sớm hơn nhờ tăng phiên bản. */
    public const TTL = 600;

    public static function remember(string $key, Closure $callback, int $ttl = self::TTL): mixed
    {
        $version = Cache::get(self::VERSION_KEY, 1);

        return Cache::remember("catalog:v{$version}:{$key}", $ttl, $callback);
    }

    /**
     * Làm mới cache sau khi transaction hiện tại commit.
     * Nếu tăng phiên bản trước khi commit, một request khác có thể kịp lưu dữ liệu cũ vào phiên bản mới.
     */
    public static function flush(): void
    {
        DB::afterCommit(function () {
            Cache::add(self::VERSION_KEY, 1, null);
            Cache::increment(self::VERSION_KEY);
        });
    }
}
