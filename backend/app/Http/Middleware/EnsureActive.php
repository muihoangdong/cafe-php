<?php

namespace App\Http\Middleware;

class EnsureActive
{
    public function handle($request, \Closure $next)
    {
        abort_if($request->user()?->is_blocked, 403, 'Tài khoản đã bị khóa.');

        return $next($request);
    }
}
