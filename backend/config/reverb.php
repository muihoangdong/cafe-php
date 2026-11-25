<?php

return [
    'default' => 'reverb',
    'servers' => ['reverb' => [
        'host' => env('REVERB_SERVER_HOST', '0.0.0.0'), 'port' => env('REVERB_SERVER_PORT', 8080),
        'hostname' => env('REVERB_HOST'), 'options' => ['tls' => []], 'max_request_size' => 10000,
        'scaling' => ['enabled' => false, 'channel' => 'reverb', 'server' => ['host' => env('REDIS_HOST', 'redis'), 'port' => 6379, 'database' => 0]],
        'pulse_ingest_interval' => 15, 'telescope_ingest_interval' => 15,
    ]],
    'apps' => ['provider' => 'config', 'apps' => [[
        'key' => env('REVERB_APP_KEY'), 'secret' => env('REVERB_APP_SECRET'), 'app_id' => env('REVERB_APP_ID'),
        'options' => ['host' => env('REVERB_HOST'), 'port' => env('REVERB_PORT', 8080), 'scheme' => env('REVERB_SCHEME', 'http'), 'useTLS' => false],
        'allowed_origins' => explode(',', env('REVERB_ALLOWED_ORIGINS', 'localhost,127.0.0.1')),
        'ping_interval' => 60, 'activity_timeout' => 30, 'max_message_size' => 10000,
    ]]],
];
