<?php

namespace App\Http\Controllers;

use App\Models\Ingredient;
use App\Models\IngredientImport;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** Kho nguyên liệu và phiếu nhập (chỉ admin). */
class IngredientController extends Controller
{
    public const UNITS = ['g', 'kg', 'ml', 'l', 'gói', 'hộp', 'chai', 'túi', 'cái'];

    public function index(Request $r)
    {
        $ingredients = Ingredient::orderBy('name')
            ->when($r->search, fn ($q, $v) => $q->whereRaw('lower(name) like ?', ['%'.mb_strtolower($v).'%']))
            ->get();

        return [
            'data' => $r->boolean('low') ? $ingredients->where('low', true)->values() : $ingredients,
            'units' => self::UNITS,
            'summary' => [
                'total' => Ingredient::count(),
                'low' => Ingredient::where('active', true)->whereColumn('stock', '<=', 'min_stock')->count(),
                'month_cost' => (int) IngredientImport::where('imported_at', '>=', now()->startOfMonth())->sum('total'),
            ],
        ];
    }

    public function save(Request $r, ?Ingredient $ingredient = null)
    {
        $data = $r->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('ingredients')->ignore($ingredient?->id)],
            'unit' => ['required', Rule::in(self::UNITS)],
            'min_stock' => 'required|numeric|min:0|max:1000000',
            // Sửa tồn trực tiếp dùng cho kiểm kê; nhập hàng thì dùng phiếu nhập.
            'stock' => 'sometimes|numeric|min:0|max:100000000',
            'active' => 'boolean',
        ]);
        $ingredient ??= new Ingredient;
        $ingredient->fill($data)->save();

        return $ingredient->refresh();
    }

    public function destroy(Ingredient $ingredient)
    {
        // Đã có phiếu nhập thì chỉ ngừng dùng để giữ lịch sử chi phí.
        if ($ingredient->importItems()->exists()) {
            $ingredient->update(['active' => false]);
        } else {
            $ingredient->delete();
        }

        return response()->noContent();
    }

    public function imports(Request $r)
    {
        return IngredientImport::with(['items.ingredient:id,name,unit', 'user:id,name'])
            ->when($r->search, fn ($q, $v) => $q->where(fn ($q) => $q->whereRaw('lower(code) like ?', ['%'.mb_strtolower($v).'%'])->orWhereRaw('lower(supplier) like ?', ['%'.mb_strtolower($v).'%'])))
            ->latest('imported_at')->latest('id')->paginate(20);
    }

    public function storeImport(Request $r)
    {
        $data = $r->validate([
            'supplier' => 'nullable|string|max:150',
            'note' => 'nullable|string|max:1000',
            'imported_at' => 'nullable|date|before_or_equal:now',
            'items' => 'required|array|min:1|max:50',
            'items.*.ingredient_id' => ['required', 'integer', 'distinct', Rule::exists('ingredients', 'id')->where('active', true)],
            'items.*.quantity' => 'required|numeric|min:0.01|max:1000000',
            'items.*.unit_price' => 'required|integer|min:0|max:100000000',
        ], ['items.*.ingredient_id.distinct' => 'Mỗi nguyên liệu chỉ ghi một dòng trong phiếu.', 'items.*.ingredient_id.exists' => 'Nguyên liệu không tồn tại hoặc đã ngừng dùng.']);

        $import = DB::transaction(function () use ($r, $data) {
            $ingredients = Ingredient::whereIn('id', array_column($data['items'], 'ingredient_id'))->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $items = collect($data['items'])->map(fn ($i) => [
                'ingredient_id' => $i['ingredient_id'],
                'quantity' => round((float) $i['quantity'], 2),
                'unit_price' => $i['unit_price'],
                'amount' => (int) round(round((float) $i['quantity'], 2) * $i['unit_price']),
            ]);
            $import = IngredientImport::create([
                'code' => 'PN'.now()->format('ymd').strtoupper(Str::random(4)),
                'supplier' => $data['supplier'] ?? null,
                'note' => $data['note'] ?? null,
                'imported_at' => $data['imported_at'] ?? now(),
                'total' => $items->sum('amount'),
                'user_id' => $r->user()->id,
            ]);
            $import->items()->createMany($items->all());
            foreach ($items as $item) {
                $ingredients[$item['ingredient_id']]->increment('stock', $item['quantity']);
            }

            return $import;
        });

        return response()->json($import->load(['items.ingredient:id,name,unit', 'user:id,name']), 201);
    }
}
