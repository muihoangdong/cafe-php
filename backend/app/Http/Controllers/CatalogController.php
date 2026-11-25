<?php

namespace App\Http\Controllers;

use App\Events\ShopEvent;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\Review;
use App\Models\Topping;
use App\Models\Voucher;
use App\Support\CatalogCache;
use Illuminate\Http\Request;

class CatalogController extends Controller
{
    public function categories()
    {
        return CatalogCache::remember('categories', fn () => Category::withCount('products')->orderBy('id')->get()->toArray());
    }

    public function products(Request $r)
    {
        $filters = ['search' => trim((string) $r->search), 'category' => (int) $r->category, 'featured' => $r->boolean('featured'), 'min_price' => $r->filled('min_price') ? (int) $r->min_price : null, 'max_price' => $r->filled('max_price') ? (int) $r->max_price : null, 'page' => max(1, (int) $r->page)];
        $query = fn () => Product::with(['category', 'variants'])->where('active', true)
            ->when($filters['search'], fn ($q, $v) => $q->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($v).'%']))
            ->when($filters['category'], fn ($q, $v) => $q->where('category_id', $v))
            ->when($filters['featured'], fn ($q) => $q->where('featured', true))
            ->when($filters['min_price'] !== null, fn ($q) => $q->whereHas('variants', fn ($v) => $v->where('price', '>=', $filters['min_price'])))
            ->when($filters['max_price'] !== null, fn ($q) => $q->whereHas('variants', fn ($v) => $v->where('price', '<=', $filters['max_price'])))
            ->orderByDesc('id')->paginate(12, ['*'], 'page', $filters['page'])->toArray();
        // Từ khóa tìm kiếm rất đa dạng, cache lại chỉ làm đầy Redis nên truy vấn trực tiếp.
        if ($filters['search'] !== '') {
            return $query();
        }

        return CatalogCache::remember('products:'.md5(json_encode($filters)), $query);
    }

    public function product(int $product)
    {
        $data = CatalogCache::remember('product:'.$product, fn () => Product::where('active', true)->with(['category', 'variants', 'reviews' => fn ($q) => $q->where('status', 'approved')->with('user:id,name')->latest()])->find($product)?->toArray());
        abort_unless($data, 404);

        return $data;
    }

    public function review(Request $r, Product $product)
    {
        $data = $r->validate(['rating' => 'required|integer|min:1|max:5', 'comment' => 'required|string|min:3|max:2000']);
        abort_unless(Order::where('user_id', $r->user()->id)->where('status', 'completed')->whereHas('items', fn ($q) => $q->where('product_id', $product->id))->exists(), 403, 'Bạn cần hoàn tất đơn mua sản phẩm này để đánh giá.');
        abort_if(Review::where('user_id', $r->user()->id)->where('product_id', $product->id)->exists(), 422, 'Bạn đã đánh giá sản phẩm này.');
        $review = Review::create($data + ['user_id' => $r->user()->id, 'product_id' => $product->id]);
        event(new ShopEvent('NewReviewSubmitted', ['id' => $review->id], ['admin.reviews']));

        return response()->json($review, 201);
    }

    public function toppings()
    {
        return CatalogCache::remember('toppings', fn () => Topping::where('active', true)->orderBy('price')->orderBy('id')->get(['id', 'name', 'price'])->toArray());
    }

    /** Kiểm tra mã giảm giá với tạm tính do server tính lại từ giỏ. */
    public function voucher(Request $r)
    {
        $data = $r->validate(['code' => 'required|string|max:40', 'subtotal' => 'required|integer|min:0|max:1000000000']);
        $voucher = Voucher::where('code', mb_strtoupper(trim($data['code'])))->first();
        abort_unless($voucher, 422, 'Mã giảm giá không tồn tại.');
        $problem = $voucher->problem($data['subtotal'], $r->user()->id);
        abort_if($problem, 422, $problem);

        return ['code' => $voucher->code, 'description' => $voucher->description, 'discount' => $voucher->discountFor($data['subtotal'])];
    }
}
