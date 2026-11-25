<?php

namespace App\Http\Controllers;

use App\Events\ShopEvent;
use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Review;
use App\Models\Topping;
use App\Models\User;
use App\Models\Voucher;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    public function orders(Request $r)
    {
        $r->validate(['from' => 'nullable|date', 'to' => 'nullable|date|after_or_equal:from']);

        return Order::with(['items', 'user:id,name,email'])->when($r->status, fn ($q, $v) => $q->where('status', $v))->when($r->from, fn ($q, $v) => $q->where('created_at', '>=', Carbon::parse($v)->startOfDay()))->when($r->to, fn ($q, $v) => $q->where('created_at', '<=', Carbon::parse($v)->endOfDay()))->latest()->paginate(20);
    }

    public function customers(Request $r)
    {
        return User::where('role', 'customer')->withCount('orders')->when($r->search, fn ($q, $v) => $q->where('email', 'like', '%'.$v.'%'))->latest()->paginate(20);
    }

    public function customer(User $user)
    {
        return $user->load(['orders' => fn ($q) => $q->with('items')->latest()]);
    }

    public function block(Request $r, User $user)
    {
        abort_unless($user->role === 'customer', 403);
        $data = $r->validate(['is_blocked' => 'required|boolean']);
        $user->forceFill($data)->save();
        if ($user->is_blocked) {
            $user->tokens()->delete();
        } if ($user->is_blocked) {
            DB::table('refresh_tokens')->where('user_id', $user->id)->delete();
        }

        return $user;
    }

    public function reviews()
    {
        return Review::with(['user:id,name', 'product:id,name'])->latest()->paginate(20);
    }

    public function moderate(Request $r, Review $review)
    {
        $data = $r->validate(['status' => 'required|in:approved,rejected']);
        $review->update($data);
        event(new ShopEvent('ReviewApproved', ['product_id' => $review->product_id], ['product.'.$review->product_id]));

        return $review;
    }

    public function deleteReview(Review $review)
    {
        $id = $review->product_id;
        $review->delete();
        event(new ShopEvent('ReviewApproved', ['product_id' => $id], ['product.'.$id]));

        return response()->noContent();
    }

    public function products(Request $r)
    {
        return Product::with(['variants', 'category'])->when($r->search, fn ($q, $v) => $q->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($v).'%']))->when($r->category, fn ($q, $v) => $q->where('category_id', $v))->latest()->paginate(20);
    }

    public function saveProduct(Request $r, ?Product $product = null)
    {
        $data = $r->validate(['name' => 'required|string|max:150', 'description' => 'required|string|max:3000', 'category_id' => 'required|exists:categories,id', 'image' => 'nullable|string|max:1000', 'featured' => 'boolean', 'active' => 'boolean', 'variants' => 'required|array|min:1|max:3', 'variants.*.size' => 'required|distinct|in:S,M,L', 'variants.*.price' => 'required|integer|min:1000|max:10000000']);

        return DB::transaction(function () use ($data, $product) {
            $product = $product ? Product::whereKey($product->id)->lockForUpdate()->firstOrFail() : new Product;
            $product->fill(collect($data)->except('variants')->all())->save();
            foreach ($data['variants'] as $variant) {
                $product->variants()->updateOrCreate(['size' => $variant['size']], $variant);
            }

            return $product->load('variants');
        });
    }

    public function deleteProduct(Product $product)
    {
        $product->update(['active' => false]);

        return response()->noContent();
    }

    public function saveCategory(Request $r, ?Category $category = null)
    {
        $data = $r->validate(['name' => 'required|string|max:100|unique:categories,name,'.($category?->id ?? 'NULL'), 'image' => 'nullable|string|max:1000']);
        if ($category) {
            $category->update($data);

            return $category;
        }

        return Category::create($data);
    }

    public function deleteCategory(Category $category)
    {
        abort_if($category->products()->exists(), 422, 'Danh mục đang có sản phẩm.');
        $category->delete();

        return response()->noContent();
    }

    public function upload(Request $r)
    {
        $r->validate(['image' => 'required|image|mimes:jpg,jpeg,png,webp|max:5120']);

        return ['url' => '/storage/'.$r->file('image')->store('images', 'public')];
    }

    public function statistics(Request $r)
    {
        $r->validate(['period' => 'nullable|in:day,week,month,year']);
        $now = now();
        $period = $r->input('period', 'month');
        $start = match ($period) {
            'day' => $now->copy()->startOfDay(),'week' => $now->copy()->startOfWeek(),'year' => $now->copy()->startOfYear(),default => $now->copy()->startOfMonth()
        };
        $completed = Order::where('status', 'completed');
        $range = (clone $completed)->whereBetween('completed_at', [$start, $now]);

        return ['products' => Product::where('active', true)->count(), 'customers' => User::where('role', 'customer')->count(), 'orders' => Order::count(), 'pending' => Order::where('status', 'pending')->count(), 'pending_reviews' => Review::where('status', 'pending')->count(),
            'today' => (clone $completed)->whereBetween('completed_at', [$now->copy()->startOfDay(), $now])->sum('total'),
            'week' => (clone $completed)->whereBetween('completed_at', [$now->copy()->startOfWeek(), $now])->sum('total'),
            'month' => (clone $completed)->whereBetween('completed_at', [$now->copy()->startOfMonth(), $now])->sum('total'),
            'revenue' => (clone $range)->sum('total'),
            'discount' => (clone $range)->sum('discount'),
            'chart' => (clone $range)->selectRaw('CAST(completed_at AS DATE) as date, SUM(total) as revenue')->groupByRaw('CAST(completed_at AS DATE)')->orderBy('date')->get(),
            'best_products' => OrderItem::whereHas('order', fn ($q) => $q->where('status', 'completed')->whereBetween('completed_at', [$start, $now]))->selectRaw('name, SUM(quantity) as quantity, SUM(price * quantity) as revenue')->groupBy('name')->orderByDesc('quantity')->limit(5)->get(),
            'loyal_customers' => User::whereHas('orders', fn ($q) => $q->where('status', 'completed')->whereBetween('completed_at', [$start, $now]))->withSum(['orders' => fn ($q) => $q->where('status', 'completed')->whereBetween('completed_at', [$start, $now])], 'total')->orderByDesc('orders_sum_total')->limit(5)->get(['id', 'name', 'email'])];
    }

    public function export(Request $r)
    {
        $stats = $this->statistics($r);
        if ($r->input('format') === 'pdf') {
            return Pdf::loadView('report', ['stats' => $stats])->download('zentea-report.pdf');
        }

        return response()->streamDownload(function () use ($stats) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Ngày', 'Doanh thu (VND)']);
            foreach ($stats['chart'] as $row) {
                fputcsv($out, [$row->date, $row->revenue]);
            } fclose($out);
        }, 'zentea-report.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function toppings()
    {
        return Topping::orderBy('id')->get();
    }

    public function saveTopping(Request $r, ?Topping $topping = null)
    {
        $data = $r->validate(['name' => ['required', 'string', 'max:60', Rule::unique('toppings')->ignore($topping?->id)], 'price' => 'required|integer|min:0|max:100000', 'active' => 'boolean']);
        $topping ??= new Topping;
        $topping->fill($data)->save();

        return $topping;
    }

    public function deleteTopping(Topping $topping)
    {
        // Đơn cũ lưu bản chụp topping nên có thể xóa an toàn; giỏ đang lưu sẽ tự bỏ topping không còn.
        $topping->delete();

        return response()->noContent();
    }

    public function vouchers()
    {
        return Voucher::latest()->paginate(20);
    }

    public function saveVoucher(Request $r, ?Voucher $voucher = null)
    {
        $r->merge(['code' => mb_strtoupper(trim((string) $r->input('code')))]);
        $data = $r->validate(['code' => ['required', 'string', 'max:40', 'regex:/^[A-Z0-9_-]+$/', Rule::unique('vouchers')->ignore($voucher?->id)], 'description' => 'nullable|string|max:255', 'type' => 'required|in:percent,fixed', 'value' => ['required', 'integer', 'min:1', $r->input('type') === 'percent' ? 'max:100' : 'max:10000000'], 'max_discount' => 'nullable|integer|min:1000|max:10000000', 'min_order' => 'nullable|integer|min:0|max:100000000', 'usage_limit' => 'nullable|integer|min:1|max:1000000', 'starts_at' => 'nullable|date', 'expires_at' => 'nullable|date|after:starts_at', 'active' => 'boolean']);
        $data['min_order'] ??= 0;
        $voucher ??= new Voucher;
        $voucher->fill($data)->save();

        return $voucher;
    }

    public function deleteVoucher(Voucher $voucher)
    {
        // Mã đã dùng chỉ ngừng áp dụng để giữ lịch sử đơn hàng.
        $voucher->used_count > 0 ? $voucher->update(['active' => false]) : $voucher->delete();

        return response()->noContent();
    }
}
