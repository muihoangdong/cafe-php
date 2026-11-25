<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ingredient extends Model
{
    protected $guarded = ['id'];

    protected $appends = ['low'];

    protected function casts(): array
    {
        return ['stock' => 'float', 'min_stock' => 'float', 'active' => 'boolean'];
    }

    public function importItems()
    {
        return $this->hasMany(IngredientImportItem::class);
    }

    /** Tồn kho đã xuống tới mức cảnh báo. */
    public function getLowAttribute(): bool
    {
        return $this->active && $this->stock <= $this->min_stock;
    }
}
