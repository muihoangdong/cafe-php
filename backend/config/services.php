<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'gemini' => [
        'key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL') ?: 'gemini-3.5-flash-lite',
        // Thử lần lượt khi model chính quá tải hoặc không còn dùng được.
        'fallback_models' => env('GEMINI_FALLBACK_MODELS') ?: 'gemini-flash-lite-latest,gemini-3.5-flash',
        'timeout' => (int) env('GEMINI_TIMEOUT', 15),
        'total_timeout' => (int) env('GEMINI_TOTAL_TIMEOUT', 25),
        'connect_timeout' => (int) env('GEMINI_CONNECT_TIMEOUT', 3),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
