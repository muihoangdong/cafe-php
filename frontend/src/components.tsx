import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Leaf, Plus } from "lucide-react";
import type { Product } from "./types";
import { money } from "./lib/api";
export function Logo() {
  return (
    <Link className="logo" to="/">
      <Leaf size={25} />
      <span>
        zentea<span className="logo-dot">.</span>
      </span>
    </Link>
  );
}
export function ProductCard({ product }: { product: Product }) {
  return (
    <Link to={"/products/" + product.id} className="product-card">
      <div className="product-image">
        <img src={product.image} alt={product.name} loading="lazy" />
        {product.featured && (
          <span className="product-tag">Được yêu thích</span>
        )}
        <span className="add-circle">
          <Plus size={22} />
        </span>
      </div>
      <div className="product-meta">
        <span>{product.category?.name}</span>
        <h3>{product.name}</h3>
        <p>{money(Math.min(...product.variants.map((v) => v.price)))}</p>
      </div>
    </Link>
  );
}
export function Loading() {
  return <div className="empty">Đang tải dữ liệu…</div>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function Pager({
  page,
  last,
  onChange,
}: {
  page: number;
  last: number;
  onChange: (p: number) => void;
}) {
  return last > 1 ? (
    <div className="pager">
      <button disabled={page === 1} onClick={() => onChange(page - 1)}>
        Trang trước
      </button>
      <span>
        {page} / {last}
      </span>
      <button disabled={page === last} onClick={() => onChange(page + 1)}>
        Trang sau
      </button>
    </div>
  ) : null;
}
