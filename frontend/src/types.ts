export interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "customer";
  phone?: string;
  address?: string;
  is_blocked: boolean;
  orders_count?: number;
  orders?: Order[];
}
export interface Variant {
  id: number;
  size: string;
  price: number;
}
export interface Category {
  id: number;
  name: string;
  image?: string;
  products_count: number;
}
export interface Product {
  id: number;
  category_id: number;
  name: string;
  description: string;
  image: string;
  featured: boolean;
  active: boolean;
  category: Category;
  variants: Variant[];
  reviews?: Review[];
}
export interface Review {
  id: number;
  rating: number;
  comment: string;
  status: string;
  user: User;
  product: Product;
}
export interface Order {
  id: number;
  code: string;
  status: string;
  total: number;
  payment_method: string;
  payment_status: string;
  recipient: string;
  phone: string;
  address: string;
  note?: string;
  created_at: string;
  subtotal: number;
  discount: number;
  voucher_code?: string | null;
  items: {
    id: number;
    name: string;
    size: string;
    price: number;
    quantity: number;
    sugar: Sugar;
    ice: Ice;
    toppings?: Topping[] | null;
  }[];
  user?: User;
}
export interface Page<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}
/** Mức đường theo %, từ "0" đến "100", bước 5 (các mức gợi ý sẵn: 0, 30, 50, 70, 100). */
export type Sugar = string;
export type Ice = "0" | "50" | "100";
export interface Topping {
  id: number;
  name: string;
  price: number;
  active?: boolean;
}
export interface Voucher {
  id: number;
  code: string;
  description?: string | null;
  type: "percent" | "fixed";
  value: number;
  max_discount?: number | null;
  min_order: number;
  usage_limit?: number | null;
  used_count: number;
  starts_at?: string | null;
  expires_at?: string | null;
  active: boolean;
}
export interface ChatMessage {
  id?: number;
  role: "user" | "model";
  text: string;
  products?: Product[];
  source?: "gemini" | "fallback" | null;
  created_at?: string;
}
export interface Ingredient {
  id: number;
  name: string;
  unit: string;
  stock: number;
  min_stock: number;
  active: boolean;
  low: boolean;
}
export interface IngredientList {
  data: Ingredient[];
  units: string[];
  summary: { total: number; low: number; month_cost: number };
}
export interface IngredientImport {
  id: number;
  code: string;
  supplier: string | null;
  note: string | null;
  total: number;
  imported_at: string;
  user: { id: number; name: string } | null;
  items: {
    id: number;
    quantity: number;
    unit_price: number;
    amount: number;
    ingredient: { id: number; name: string; unit: string };
  }[];
}
export interface ChatConversation {
  uuid: string;
  title: string | null;
  messages_count: number;
  last_message_at: string | null;
  created_at: string;
  user?: Pick<User, "id" | "name" | "email"> | null;
  fallback_count?: number;
}
export interface ChatTranscript {
  conversation_id: string;
  title: string | null;
  messages: ChatMessage[];
  user?: Pick<User, "id" | "name" | "email"> | null;
}
export interface CartItem {
  /** Khóa dòng: cùng size, đường, đá, topping thì gộp chung. */
  key: string;
  sugar: Sugar;
  ice: Ice;
  toppings: Topping[];
  variant_id: number;
  product_id: number;
  name: string;
  size: string;
  price: number;
  quantity: number;
  image: string;
}
export interface Stats {
  products: number;
  customers: number;
  orders: number;
  pending: number;
  pending_reviews: number;
  today: number;
  week: number;
  month: number;
  revenue: number;
  discount: number;
  chart: { date: string; revenue: number }[];
  best_products: { name: string; quantity: number; revenue: number }[];
  loyal_customers: { id: number; name: string; orders_sum_total: number }[];
}
