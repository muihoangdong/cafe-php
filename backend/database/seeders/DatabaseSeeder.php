<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Ingredient;
use App\Models\Product;
use App\Models\Topping;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(['email' => 'admin@zentea.local'], ['name' => 'Zentea Admin', 'password' => 'Zentea@123'])->forceFill(['role' => 'admin'])->save();
        User::firstOrCreate(['email' => 'khach@zentea.local'], ['name' => 'Minh Anh', 'password' => 'Zentea@123', 'phone' => '0901234567', 'address' => '123 Nguyễn Huệ, TP. Hồ Chí Minh']);
        $catalog = [
            ['Trà trái cây', 'Trà đào cam sả', 'Trà lài thơm dịu, đào ngọt thanh và sả tươi.', 42000, 'photo-1556679343-c7306c1976bc'],
            ['Trà sữa', 'Trà sữa ô long', 'Ô long rang quyện sữa tươi, hậu vị thanh nhẹ.', 39000, 'photo-1570968915860-54d5c301fa9f'],
            ['Matcha', 'Matcha latte', 'Matcha Nhật Bản, sữa tươi và lớp bọt mịn.', 49000, 'photo-1515823064-d6e0c04616a7'],
            ['Cà phê', 'Cà phê sữa đá', 'Cà phê Việt đậm đà, pha phin cùng sữa đặc.', 32000, 'photo-1461023058943-07fcbe16d735'],
            ['Trà trái cây', 'Trà vải hoa hồng', 'Hương hoa nhẹ nhàng, vải mọng nước và trà lài.', 45000, 'photo-1544145945-f90425340c7e'],
            ['Cà phê', 'Cold brew cam vàng', 'Ủ lạnh chậm, thêm cam vàng thơm mát.', 48000, 'photo-1517701604599-bb29b565090c'],
            ['Matcha', 'Matcha dâu tươi', 'Matcha xanh dịu cùng dâu và sữa tươi.', 55000, 'photo-1515823064-d6e0c04616a7'],
            ['Trà sữa', 'Hồng trà sữa', 'Hồng trà ủ mới mỗi ngày cùng sữa thơm béo.', 35000, 'photo-1570968915860-54d5c301fa9f'],
        ];
        foreach ($catalog as $i => [$category,$name,$description,$price,$image]) {
            $c = Category::firstOrCreate(['name' => $category]);
            $p = Product::firstOrCreate(['name' => $name], ['category_id' => $c->id, 'description' => $description, 'image' => 'https://images.unsplash.com/'.$image.'?auto=format&fit=crop&w=800&q=85', 'featured' => $i < 4]);
            foreach (['S', 'M', 'L'] as $j => $size) {
                $p->variants()->firstOrCreate(['size' => $size], ['price' => $price + $j * 6000]);
            }
        }
        foreach ([['Trân châu đen', 6000], ['Trân châu trắng', 8000], ['Thạch đào', 7000], ['Kem cheese', 10000], ['Pudding trứng', 9000]] as [$name, $price]) {
            Topping::firstOrCreate(['name' => $name], ['price' => $price]);
        }
        // Nguyên liệu mẫu: [tên, đơn vị, tồn, mức cảnh báo].
        foreach ([['Trà lài', 'kg', 4, 2], ['Trà ô long', 'kg', 1.5, 2], ['Bột matcha', 'kg', 0.8, 1], ['Cà phê Robusta', 'kg', 6, 3], ['Sữa tươi', 'l', 24, 10], ['Sữa đặc', 'hộp', 8, 12], ['Đào ngâm', 'hộp', 10, 4], ['Đường cát', 'kg', 15, 5]] as [$name, $unit, $stock, $min]) {
            Ingredient::firstOrCreate(['name' => $name], ['unit' => $unit, 'stock' => $stock, 'min_stock' => $min]);
        }
        Voucher::firstOrCreate(['code' => 'ZENTEA10'], ['description' => 'Giảm 10% tối đa 20.000đ cho đơn từ 50.000đ', 'type' => 'percent', 'value' => 10, 'max_discount' => 20000, 'min_order' => 50000]);
        Voucher::firstOrCreate(['code' => 'CHAOBAN'], ['description' => 'Giảm 15.000đ cho đơn từ 80.000đ', 'type' => 'fixed', 'value' => 15000, 'min_order' => 80000, 'usage_limit' => 100]);
    }
}
