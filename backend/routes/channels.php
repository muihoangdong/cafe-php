<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('user.{id}', fn ($user, $id) => ! $user->is_blocked && (int) $user->id === (int) $id);
Broadcast::channel('admin.{area}', fn ($user, $area) => ! $user->is_blocked && $user->role === 'admin' && in_array($area, ['orders', 'reviews', 'customers', 'stats']));

Broadcast::channel('store.staff', fn ($user) => ! $user->is_blocked && $user->role === 'admin' ? ['id' => $user->id, 'name' => $user->name] : false);
