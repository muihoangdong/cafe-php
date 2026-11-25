<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Topping extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['price' => 'integer', 'active' => 'boolean'];
    }
}
