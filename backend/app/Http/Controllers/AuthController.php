<?php

namespace App\Http\Controllers;

use App\Events\ShopEvent;
use App\Models\ProductVariant;
use App\Models\Topping;
use App\Models\User;
use App\Support\DrinkOptions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function register(Request $r)
    {
        $data = $r->validate(['name' => 'required|string|max:100', 'email' => 'required|email|unique:users', 'password' => 'required|string|min:8|confirmed']);
        $user = User::create($data);
        event(new ShopEvent('NewCustomerRegistered', ['id' => $user->id, 'name' => $user->name], ['admin.customers']));

        return $this->credentials($user)->setStatusCode(201);
    }

    public function login(Request $r)
    {
        $data = $r->validate(['email' => 'required|email', 'password' => 'required|string']);
        $user = User::where('email', $data['email'])->first();
        abort_unless($user && Hash::check($data['password'], $user->password), 422, 'Email hoặc mật khẩu chưa đúng.');
        abort_if($user->is_blocked, 403, 'Tài khoản đã bị khóa.');

        return $this->credentials($user);
    }

    private function credentials(User $user)
    {
        $access = $user->createToken('zentea', ['*'], now()->addMinutes(30));
        $refresh = Str::random(80);
        DB::table('refresh_tokens')->insert(['user_id' => $user->id, 'access_token_id' => $access->accessToken->id, 'token' => hash('sha256', $refresh), 'expires_at' => now()->addDays(7)]);

        return response()->json(['user' => $user, 'token' => $access->plainTextToken])->cookie('zentea_refresh', $refresh, 10080, '/api/auth', null, request()->isSecure(), true, false, 'strict');
    }

    public function refresh(Request $r)
    {
        abort_unless($r->header('X-Zentea-Client') === 'web', 403);

        return DB::transaction(function () use ($r) {
            $row = DB::table('refresh_tokens')->where('token', hash('sha256', $r->cookie('zentea_refresh', '')))->lockForUpdate()->first();
            abort_unless($row && now()->lessThan($row->expires_at), 401);
            $user = User::findOrFail($row->user_id);
            abort_if($user->is_blocked, 403);
            $user->tokens()->whereKey($row->access_token_id)->delete();
            DB::table('refresh_tokens')->where('id', $row->id)->delete();

            return $this->credentials($user);
        });
    }

    public function logout(Request $r)
    {
        $r->user()->currentAccessToken()->delete();
        DB::table('refresh_tokens')->where('token', hash('sha256', $r->cookie('zentea_refresh', '')))->delete();

        return response()->json(['message' => 'Đã đăng xuất'])->withoutCookie('zentea_refresh', '/api/auth');
    }

    public function profile(Request $r)
    {
        $r->user()->update($r->validate(['name' => 'sometimes|required|string|max:100', 'phone' => 'nullable|string|max:20', 'address' => 'nullable|string|max:500']));

        return $r->user();
    }

    public function password(Request $r)
    {
        $data = $r->validate(['current_password' => 'required|current_password:sanctum', 'password' => 'required|min:8|confirmed']);
        $r->user()->update(['password' => $data['password']]);
        $r->user()->tokens()->where('id', '!=', $r->user()->currentAccessToken()->id)->delete();
        DB::table('refresh_tokens')->where('user_id', $r->user()->id)->where('access_token_id', '!=', $r->user()->currentAccessToken()->id)->delete();

        return ['message' => 'Đã đổi mật khẩu'];
    }

    public function forgot(Request $r)
    {
        $r->validate(['email' => 'required|email']);
        Password::sendResetLink($r->only('email'));

        return ['message' => 'Nếu email tồn tại, hướng dẫn khôi phục đã được gửi.'];
    }

    public function reset(Request $r)
    {
        $r->validate(['token' => 'required', 'email' => 'required|email', 'password' => 'required|min:8|confirmed']);
        $status = Password::reset($r->only('email', 'password', 'password_confirmation', 'token'), function (User $user, string $password) {
            $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
            $user->tokens()->delete();
            DB::table('refresh_tokens')->where('user_id', $user->id)->delete();
        });
        abort_unless($status === Password::PASSWORD_RESET, 422, __($status));

        return ['message' => 'Đã đặt lại mật khẩu'];
    }

    public function cart(Request $r)
    {
        if ($r->isMethod('put')) {
            $data = $r->validate(['items' => 'present|array|max:100', 'items.*.variant_id' => 'required|integer|exists:product_variants,id', 'items.*.quantity' => 'required|integer|min:1|max:99'] + DrinkOptions::rules(), DrinkOptions::messages());
            $r->user()->forceFill(['cart' => json_encode(array_map([DrinkOptions::class, 'normalize'], $data['items']))])->save();
        }
        $items = collect(json_decode($r->user()->cart ?? '[]', true))->map(fn ($item) => DrinkOptions::normalize($item));
        $variants = ProductVariant::with('product')->whereIn('id', $items->pluck('variant_id'))->get()->keyBy('id');
        $toppings = Topping::where('active', true)->whereIn('id', $items->pluck('topping_ids')->flatten()->unique())->get(['id', 'name', 'price'])->keyBy('id');

        return ['items' => $items->flatMap(function ($item) use ($variants, $toppings) {
            $v = $variants->get($item['variant_id']);
            $chosen = collect($item['topping_ids'])->map(fn ($id) => $toppings->get($id))->filter()->values();

            return $v && $v->product->active ? [['variant_id' => $v->id, 'quantity' => $item['quantity'], 'product_id' => $v->product_id, 'name' => $v->product->name, 'size' => $v->size, 'price' => $v->price, 'image' => $v->product->image, 'sugar' => $item['sugar'], 'ice' => $item['ice'], 'toppings' => $chosen]] : [];
        })->values()];
    }
}
