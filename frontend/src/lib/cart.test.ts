import { describe, it, expect } from "vitest";
import { mergeCart, normalizeItem, cartTotal, cartPayload } from "./store";
import type { CartItem } from "../types";
const item: CartItem = normalizeItem({
  variant_id: 1,
  product_id: 1,
  name: "Trà",
  size: "M",
  price: 42000,
  quantity: 2,
  image: "",
});
const pearl = { id: 7, name: "Trân châu", price: 6000 };
describe("Đồng bộ giỏ hàng", () => {
  it("gộp theo variant và giữ các kích cỡ riêng", () => {
    const large = normalizeItem({ ...item, variant_id: 2, size: "L" });
    expect(mergeCart([item], [{ ...item, quantity: 3 }, large])).toEqual([
      { ...item, quantity: 5 },
      large,
    ]);
  });
  it("giới hạn số lượng khi gộp", () => {
    expect(
      mergeCart([{ ...item, quantity: 90 }], [{ ...item, quantity: 50 }])[0]
        .quantity,
    ).toBe(99);
  });
  it("tách dòng khi khác đường, đá hoặc topping", () => {
    const lessSugar = normalizeItem({ ...item, sugar: "50" });
    const withPearl = normalizeItem({ ...item, toppings: [pearl] });
    expect(new Set([item.key, lessSugar.key, withPearl.key]).size).toBe(3);
    expect(mergeCart([lessSugar, withPearl], [item])).toHaveLength(3);
  });
  it("tính topping vào tạm tính và gửi id topping lên server", () => {
    const withPearl = normalizeItem({ ...item, toppings: [pearl] });
    expect(cartTotal([withPearl])).toBe(2 * 48000);
    expect(cartPayload([withPearl])[0]).toEqual({
      variant_id: 1,
      quantity: 2,
      sugar: "100",
      ice: "100",
      topping_ids: [7],
    });
  });
});
