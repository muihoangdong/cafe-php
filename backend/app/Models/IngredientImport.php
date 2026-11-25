<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IngredientImport extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['total' => 'integer', 'imported_at' => 'datetime'];
    }

    public function items()
    {
        return $this->hasMany(IngredientImportItem::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
