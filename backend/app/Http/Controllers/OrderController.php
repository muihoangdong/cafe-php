<?php

namespace App\Http\Controllers;

use App\Events\ShopEvent;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\Topping;
use App\Models\User;
use App\Models\Voucher;
use App\Support\CatalogCache;
use App\Support\DrinkOptions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    public function index(Request $r)
    {
        return $r->user()->orders()->with('items')->latest()->paginate(20);
    }

    public function show(Request $r, Order $order)
    {
        abort_unless($order->user_id === $r->user()->id || $r->user()->role === 'admin', 403);

        return $order->load('items');
    }

    public function store(Request $r)
    {
        $data = $r->validate(['idempotency_key' => 'required|uuid', 'recipient' => 'required|string|max:100', 'phone' => 'required|regex:/^[0-9+ ()-]{9,20}$/', 'address' => 'required|string|min:5|max:500', 'note' => 'nullable|string|max:1000', 'payment_method' => 'required|in:cod,momo,vnpay,zalopay', 'voucher_code' => 'nullable|string|max:40', 'items' => 'required|array|min:1|max:100', 'items.*.variant_id' => 'required|integer|exists:product_variants,id', 'items.*.quantity' => 'required|integer|min:1|max:99'] + DrinkOptions::rules(), DrinkOptions::messages());
        $data['items'] = array_map([DrinkOptions::class, 'normalize'], $data['items']);
        $data['voucher_code'] = filled($data['voucher_code'] ?? null) ? mb_strtoupper(trim($data['voucher_code'])) : null;
        $hash = hash('sha256', json_encode($data));
        $order = DB::transaction(function () use ($r, $data, $hash) {
            User::whereKey($r->user()->id)->lockForUpdate()->firstOrFail();
            $existing = Order::where('user_id', $r->user()->id)->where('idempotency_key', $data['idempotency_key'])->first();
            if ($existing) {
                abort_unless($existing->request_hash === $hash, 409, 'Mã yêu cầu đã được sử dụng với giỏ hàng khác.');

                return $existing;
            }
            $ids = collect($data['items'])->pluck('variant_id')->unique()->sort()->values();
            $variants = ProductVariant::with('product')->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $toppings = Topping::whereIn('id', collect($data['items'])->pluck('topping_ids')->flatten()->unique())->get()->keyBy('id');
            foreach ($variants as $v) {
                abort_unless($v->product->active, 422, 'Sản phẩm '.$v->product->name.' đã ngừng bán.');
            }
            $items = [];
            $subtotal = 0;
            foreach ($data['items'] as $item) {
                $v = $variants[$item['variant_id']];
                $chosen = collect($item['topping_ids'])->map(function ($id) use ($toppings) {
                    $t = $toppings[$id];
                    abort_unless($t->active, 422, 'Topping '.$t->name.' đã hết.');

                    return ['id' => $t->id, 'name' => $t->name, 'price' => $t->price];
                })->values()->all();
                $price = $v->price + array_sum(array_column($chosen, 'price'));
                $items[] = ['product_variant_id' => $v->id, 'product_id' => $v->product_id, 'name' => $v->product->name, 'size' => $v->size, 'price' => $price, 'quantity' => $item['quantity'], 'sugar' => $item['sugar'], 'ice' => $item['ice'], 'toppings' => $chosen];
                $subtotal += $price * $item['quantity'];
            }
            $discount = 0;
            if ($data['voucher_code']) {
                $voucher = Voucher::where('code', $data['voucher_code'])->lockForUpdate()->first();
                abort_unless($voucher, 422, 'Mã giảm giá không tồn tại.');
                $problem = $voucher->problem($subtotal, $r->user()->id);
                abort_if($problem, 422, $problem);
                $discount = $voucher->discountFor($subtotal);
                $voucher->increment('used_count');
            }
            $order = Order::create(collect($data)->except('items')->all() + ['user_id' => $r->user()->id, 'code' => 'ZT'.strtoupper(Str::random(10)), 'request_hash' => $hash, 'subtotal' => $subtotal, 'discount' => $discount, 'total' => $subtotal - $discount]);
            $order->items()->createMany($items);
            $order->refresh()->load('items');
            $r->user()->forceFill(['cart' => '[]'])->save();
            event(new ShopEvent('NewOrderPlaced', ['order' => $order], ['admin.orders', 'user.'.$order->user_id]));

            return $order;
        });

        return response()->json($order->load('items'), 201);
    }

    public function status(Request $r, Order $order)
    {
        $data = $r->validate(['status' => 'required|in:pending,preparing,delivering,completed,cancelled']);
        $updated = DB::transaction(function () use ($order, $data) {
            $order = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            if ($order->status === $data['status']) {
                return $order;
            }
            $allowed = ['pending' => ['preparing', 'cancelled'], 'preparing' => ['delivering', 'cancelled'], 'delivering' => ['completed', 'cancelled'], 'completed' => [], 'cancelled' => []];
            abort_unless(in_array($data['status'], $allowed[$order->status]), 422, 'Chuyển trạng thái không hợp lệ.');
            abort_if($data['status'] === 'preparing' && $order->payment_method !== 'cod' && $order->payment_status !== 'paid', 422, 'Đơn hàng chưa thanh toán.');
            if ($data['status'] === 'cancelled') {
                if ($order->payment_status === 'paid') {
                    $order->payment_status = 'refunded';
                }
                if ($order->voucher_code) {
                    Voucher::where('code', $order->voucher_code)->where('used_count', '>', 0)->decrement('used_count');
                }
                // Trả lượt dùng mã giảm giá bằng query builder không phát sự kiện model, mà chatbot đọc danh sách mã từ cache: làm mới ở đây.
                CatalogCache::flush();
            }
            $order->status = $data['status'];
            if ($order->status === 'completed') {
                $order->completed_at = now();
                $order->payment_status = 'paid';
            }
            $order->save();
            $order->load('items');
            event(new ShopEvent('OrderStatusUpdated', ['order' => $order], ['admin.orders', 'user.'.$order->user_id]));
            if (in_array($order->status, ['completed', 'cancelled'])) {
                event(new ShopEvent('StatisticsUpdated', [], ['admin.stats']));
            }

            return $order;
        });

        return $updated;
    }

    public function pay(Request $r, Order $order)
    {
        abort_unless($order->user_id === $r->user()->id, 403);
        $data = $r->validate(['result' => 'required|in:success,failed']);

        return DB::transaction(function () use ($order, $data) {
            $order = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();
            abort_unless($order->status === 'pending' && $order->payment_method !== 'cod', 422, 'Đơn không hỗ trợ thanh toán mock.');
            if ($order->payment_status === 'paid') {
                return $order;
            }
            $order->update(['payment_status' => $data['result'] === 'success' ? 'paid' : 'failed']);
            event(new ShopEvent('OrderStatusUpdated', ['order' => $order->load('items')], ['admin.orders', 'user.'.$order->user_id]));

            return $order;
        });
    }
}
