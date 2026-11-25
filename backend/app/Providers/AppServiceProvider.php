<?php

namespace App\Providers;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Review;
use App\Models\Topping;
use App\Models\Voucher;
use App\Support\CatalogCache;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        date_default_timezone_set('Asia/Ho_Chi_Minh');
        ResetPassword::createUrlUsing(fn ($user, $token) => env('FRONTEND_URL').'/reset-password?token='.$token.'&email='.urlencode($user->email));
        // Chatbot thường và streaming dùng chung hạn mức: mỗi tài khoản (hoặc IP với khách vãng lai) 10 câu hỏi mỗi phút.
        RateLimiter::for('chat', fn (Request $r) => Limit::perMinute(10)->by(($id = $r->user('sanctum')?->id) ? 'user:'.$id : 'ip:'.$r->ip()));

        // Dữ liệu thực đơn thay đổi (kể cả tồn kho sau khi đặt đơn) thì làm mới cache.
        // Cập nhật hàng loạt bằng query builder không phát sự kiện, nơi đó gọi CatalogCache::flush() trực tiếp.
        foreach ([Category::class, Product::class, ProductVariant::class, Topping::class, Voucher::class, Review::class] as $model) {
            // Dùng created/updated thay vì saved vì $model->increment()/decrement() chỉ phát sự kiện updated.
            $model::created(fn () => CatalogCache::flush());
            $model::updated(fn () => CatalogCache::flush());
            $model::deleted(fn () => CatalogCache::flush());
        }
    }
}
