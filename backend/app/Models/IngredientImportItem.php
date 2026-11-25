<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IngredientImportItem extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['quantity' => 'float', 'unit_price' => 'integer', 'amount' => 'integer'];
    }

    public function ingredient()
    {
        return $this->belongsTo(Ingredient::class);
    }
}
