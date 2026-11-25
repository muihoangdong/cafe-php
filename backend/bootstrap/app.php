<?php

use App\Http\Middleware\EnsureActive;
use App\Http\Middleware\EnsureAdmin;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(web: __DIR__.'/../routes/web.php', api: __DIR__.'/../routes/api.php', commands: __DIR__.'/../routes/console.php', health: '/up')
    ->withBroadcasting(__DIR__.'/../routes/channels.php', ['middleware' => ['api', 'auth:sanctum', 'active']])
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias(['admin' => EnsureAdmin::class, 'active' => EnsureActive::class]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Lỗi HTTP mặc định của Laravel là tiếng Anh (và lỗi 404 của model còn lộ tên class):
        // đổi sang câu tiếng Việt. Thông báo tự viết trong code (abort(422, '...')) giữ nguyên.
        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            if (! $response instanceof JsonResponse || ! is_array($data = $response->getData(true)) || ! isset($data['message'])) {
                return $response;
            }
            $message = (string) $data['message'];
            $default = match (true) {
                $message === 'Unauthenticated.' => 'Unauthenticated.',
                $message === 'This action is unauthorized.' => 'This action is unauthorized.',
                $message === 'Too Many Attempts.' => 'Too Many Attempts.',
                $message === 'Server Error' => 'Server Error',
                $response->getStatusCode() === 404 && ($message === '' || str_starts_with($message, 'No query results') || str_starts_with($message, 'The route ') || $message === 'Not Found') => 'Not Found',
                $response->getStatusCode() === 405 => 'Method Not Allowed',
                $response->getStatusCode() === 403 && in_array($message, ['', 'Forbidden']) => 'Forbidden',
                $response->getStatusCode() === 503 && in_array($message, ['', 'Service Unavailable']) => 'Service Unavailable',
                $response->getStatusCode() === 419 => 'Page Expired',
                default => null,
            };
            if ($default) {
                $response->setData(['message' => __($default)] + $data);
            }

            return $response;
        });
    })
    ->create();
