<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Support\Str;

class ShopEvent implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    public function __construct(public string $name, public array $payload, public array $channels)
    {
        $this->payload['event_id'] = (string) Str::uuid();
    }

    public function broadcastOn(): array
    {
        return array_map(fn ($channel) => str_starts_with($channel, 'product.') ? new Channel($channel) : new PrivateChannel($channel), $this->channels);
    }

    public function broadcastAs(): string
    {
        return $this->name;
    }

    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
