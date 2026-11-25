<?php

namespace App\Http\Middleware;

class EnsureAdmin
{
    public function handle($request, \Closure $next)
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Chỉ quản trị viên được truy cập.');

        return $next($request);
    }
}
