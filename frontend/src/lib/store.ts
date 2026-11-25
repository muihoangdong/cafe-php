import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, CartItem, Sugar, Ice, Topping } from "../types";
export const useAuth = create(
  persist<{
    user: User | null;
    token: string | null;
    set: (user: User, token: string) => void;
    clear: () => void;
  }>(
    (set) => ({
      user: null,
      token: null,
      set: (user, token) => set({ user, token }),
      clear: () => set({ user: null, token: null }),
    }),
    { name: "zentea-auth" },
  ),
);
export const sugarLabel: Record<Sugar, string> = {
  "0": "Không đường",
  "30": "30% đường",
  "50": "50% đường",
  "70": "70% đường",
  "100": "100% đường",
};
/** Các mức đường gợi ý sẵn trên trang món. */
export const sugarPresets: Sugar[] = ["0", "30", "50", "70", "100"];
/** Mức đường hợp lệ: số nguyên 0-100, bước 5 (giống kiểm tra ở server). */
export function isValidSugar(value: string): boolean {
  return /^(100|[1-9]?[05])$/.test(value);
}
/** Nhãn mức đường, kể cả mức khách tự nhập: "Không đường", "25% đường". */
export function sugarText(sugar: Sugar): string {
  return sugarLabel[sugar] ?? sugar + "% đường";
}
export const iceLabel: Record<Ice, string> = {
  "0": "Không đá",
  "50": "Ít đá",
  "100": "Đá bình thường",
};
/** Khóa của một dòng giỏ: cùng size, cùng đường, đá và topping thì gộp lại. */
export function lineKey(item: {
  variant_id: number;
  sugar?: string;
  ice?: string;
  toppings?: { id: number }[];
}): string {
  const toppings = (item.toppings || [])
    .map((t) => t.id)
    .sort((a, b) => a - b)
    .join(".");
  return [
    item.variant_id,
    item.sugar || "100",
    item.ice || "100",
    toppings,
  ].join("|");
}
/** Đơn giá một ly gồm size và topping. Server vẫn tính lại khi tạo đơn. */
export const unitPrice = (item: Pick<CartItem, "price" | "toppings">) =>
  item.price + (item.toppings || []).reduce((n, t) => n + t.price, 0);
export const cartTotal = (items: CartItem[]) =>
  items.reduce((n, i) => n + unitPrice(i) * i.quantity, 0);
/** Chuẩn hóa dữ liệu giỏ cũ (chưa có tùy chọn) hoặc dữ liệu từ server. */
export function normalizeItem(
  item: Omit<CartItem, "key" | "sugar" | "ice" | "toppings"> &
    Partial<Pick<CartItem, "sugar" | "ice" | "toppings">>,
): CartItem {
  const full = {
    ...item,
    sugar: (item.sugar || "100") as Sugar,
    ice: (item.ice || "100") as Ice,
    toppings: (item.toppings || []) as Topping[],
  };
  return { ...full, key: lineKey(full) };
}
export const cartPayload = (items: CartItem[]) =>
  items.map(({ variant_id, quantity, sugar, ice, toppings }) => ({
    variant_id,
    quantity,
    sugar,
    ice,
    topping_ids: toppings.map((t) => t.id),
  }));
export const useCart = create(
  persist<{
    items: CartItem[];
    add: (item: CartItem) => void;
    quantity: (key: string, quantity: number) => void;
    replace: (items: CartItem[]) => void;
    clear: () => void;
  }>(
    (set) => ({
      items: [],
      add: (item) =>
        set((s) => {
          const line = normalizeItem(item);
          return {
            items: s.items.some((i) => i.key === line.key)
              ? s.items.map((i) =>
                  i.key === line.key
                    ? {
                        ...i,
                        quantity: Math.min(99, i.quantity + line.quantity),
                      }
                    : i,
                )
              : [...s.items, line],
          };
        }),
      quantity: (key, quantity) =>
        set((s) => ({
          items: s.items
            .map((i) =>
              i.key === key ? { ...i, quantity: Math.min(99, quantity) } : i,
            )
            .filter((i) => i.quantity > 0),
        })),
      replace: (items) => set({ items: items.map(normalizeItem) }),
      clear: () => set({ items: [] }),
    }),
    {
      name: "zentea-cart",
      version: 1,
      migrate: (state) => {
        const s = state as { items?: CartItem[] };
        return { ...s, items: (s.items || []).map(normalizeItem) } as never;
      },
    },
  ),
);
export function mergeCart(local: CartItem[], remote: CartItem[]): CartItem[] {
  const merged = new Map(
    remote.map(normalizeItem).map((i) => [i.key, i] as const),
  );
  for (const item of local.map(normalizeItem)) {
    const existing = merged.get(item.key);
    merged.set(item.key, {
      ...item,
      quantity: Math.min(99, item.quantity + (existing?.quantity || 0)),
    });
  }
  return [...merged.values()];
}
