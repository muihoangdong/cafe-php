import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Leaf, Search, Plus, Minus, Star, Clock, Heart } from "lucide-react";
import { toast } from "sonner";
import { api, message, money } from "./lib/api";
import {
  useCart,
  useAuth,
  sugarPresets,
  isValidSugar,
  iceLabel,
  normalizeItem,
} from "./lib/store";
import { useProductRealtime } from "./Realtime";
import { ProductCard, Loading, Empty, Pager } from "./components";
import type { Page, Product, Category, Sugar, Ice, Topping } from "./types";

const ratingLabel = [
  "",
  "Chưa hài lòng",
  "Tạm được",
  "Ổn",
  "Ngon",
  "Tuyệt vời",
];

/**
 * Ô tự nhập mức đường (0-100%, bước 5%) bên cạnh các mức gợi ý sẵn.
 * Số hợp lệ được áp dụng ngay khi gõ; rời ô với số lẻ thì làm tròn về bước 5% gần nhất.
 */
function SugarInput({
  value,
  onChange,
}: {
  value: Sugar;
  onChange: (sugar: Sugar) => void;
}) {
  const [text, setText] = useState(sugarPresets.includes(value) ? "" : value);
  const [note, setNote] = useState("");
  const [lastValue, setLastValue] = useState(value);
  // Mức đường đổi từ bên ngoài (khách bấm một mức gợi ý sẵn) thì xóa ô tự nhập.
  // Khách gõ đúng một mức có sẵn, ví dụ 30, thì giữ nguyên chữ đang gõ.
  if (value !== lastValue) {
    setLastValue(value);
    if (value !== text && text !== "") {
      setText("");
      setNote("");
    }
  }
  function commit() {
    if (text === "") {
      // Xóa trống ô khi đang dùng mức tự nhập: quay về mức mặc định để luôn có một lựa chọn.
      if (!sugarPresets.includes(value)) {
        onChange("100");
        setNote("Đã về mức mặc định 100%.");
      } else setNote("");
      return;
    }
    const n = Math.min(100, Math.max(0, Math.round(Number(text) / 5) * 5));
    if (String(n) !== text) setNote("Đã làm tròn về " + n + "% (bước 5%).");
    setText(String(n));
    onChange(String(n));
  }
  return (
    <>
      {/* Lời nhắc nằm trên dòng riêng của hàng chip, không đè ra ngoài khung trang. */}
      {note && (
        <small className="chip-note" role="status">
          {note}
        </small>
      )}
      <span
        className={
          "chip-input" + (text !== "" && text === value ? " selected" : "")
        }
      >
        <input
          aria-label="Tự chọn mức đường (%)"
          inputMode="numeric"
          placeholder="Tự chọn"
          maxLength={3}
          value={text}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, "");
            setText(next);
            setNote("");
            if (isValidSugar(next)) onChange(next);
          }}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
        %
      </span>
    </>
  );
}

/** Chọn số sao bằng cách bấm từng ngôi sao; rê chuột để xem trước, dùng phím mũi tên được. */
function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="star-picker">
      <div
        role="radiogroup"
        aria-label="Số sao"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={n + " sao"}
            // Chỉ sao đang chọn nằm trong thứ tự Tab, các sao khác chuyển bằng phím mũi tên.
            tabIndex={value === n ? 0 : -1}
            className={n <= shown ? "on" : ""}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            onKeyDown={(e) => {
              const step =
                e.key === "ArrowRight" || e.key === "ArrowUp"
                  ? 1
                  : e.key === "ArrowLeft" || e.key === "ArrowDown"
                    ? -1
                    : 0;
              if (!step) return;
              e.preventDefault();
              const next = Math.min(5, Math.max(1, value + step));
              onChange(next);
              (
                e.currentTarget.parentElement?.children[next - 1] as
                  HTMLElement | undefined
              )?.focus();
            }}
          >
            <Star size={30} />
          </button>
        ))}
      </div>
      <span aria-hidden="true">{ratingLabel[shown]}</span>
    </div>
  );
}
export function useToppings() {
  return useQuery({
    queryKey: ["toppings"],
    queryFn: async () => (await api.get<Topping[]>("/toppings")).data,
    staleTime: 60000,
  });
}
export function Home() {
  const recent = useQuery({
    queryKey: ["products", "new"],
    queryFn: async () => (await api.get<Page<Product>>("/products")).data,
  }).data;
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get<Category[]>("/categories")).data,
  }).data;
  const { data } = useQuery({
    queryKey: ["products", "featured"],
    queryFn: async () =>
      (await api.get<Page<Product>>("/products?featured=1")).data,
  });
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <Leaf size={16} /> TRÀ TƯƠI · CÀ PHÊ · AN YÊN
          </span>
          <h1>
            Một chút trà,
            <br />
            một chút <em>an yên.</em>
          </h1>
          <p>
            Gác lại những vội vàng. Để hương trà tự nhiên
            <br className="desktop-link" /> và vị cà phê thân quen làm dịu ngày
            của bạn.
          </p>
          <Link className="btn" to="/menu">
            Khám phá thực đơn
          </Link>
          <div className="hero-note">
            <span className="leaf-mark">
              <Leaf size={22} />
            </span>
            <span>
              Pha mới từ nguyên liệu chọn lọc
              <br />
              <strong>Trọn vị trong từng khoảnh khắc</strong>
            </span>
          </div>
        </div>
        <div className="hero-photo">
          <img
            src="https://images.unsplash.com/photo-1515823064-d6e0c04616a7?auto=format&fit=crop&w=1200&q=90"
            alt="Matcha latte xanh mát tại Zentea"
          />
          <div className="photo-note">
            <span>MỘT NGỤM TƯƠI MÁT</span>
            <strong>Matcha latte</strong>
            <Link to="/menu">Thưởng thức hôm nay</Link>
          </div>
        </div>
      </section>
      <section className="values">
        <span>
          <Leaf />
          Nguyên liệu tự nhiên
        </span>
        <span>
          <Clock />
          Pha mới mỗi ngày
        </span>
        <span>
          <Heart />
          Chăm chút từng ly
        </span>
      </section>
      <section className="section">
        <div className="section-title">
          <div>
            <span className="eyebrow">CHỌN MỘT MÓN HỢP TÂM TRẠNG</span>
            <h2>Hôm nay, bạn uống gì?</h2>
          </div>
          <Link className="text-link" to="/menu">
            Xem toàn bộ thực đơn
          </Link>
        </div>
        <div className="product-grid">
          {data?.data.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        {!data && (
          <p className="empty">Thực đơn sẽ hiện khi máy chủ sẵn sàng.</p>
        )}
      </section>
      <section className="section new-menu">
        <div className="section-title">
          <div>
            <span className="eyebrow">THÊM MỘT CHÚT MỚI MẺ</span>
            <h2>Hương vị mới tại Zentea</h2>
          </div>
        </div>
        <div className="tabs">
          {categories?.map((c) => (
            <Link
              key={c.id}
              className="btn light"
              to={"/menu?category=" + c.id}
            >
              {c.name}
            </Link>
          ))}
        </div>
        <div className="product-grid">
          {recent?.data.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
      <section className="story section" id="story">
        <img
          src="https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1000&q=85"
          alt="Không gian cà phê và những phút giây bình yên"
          loading="lazy"
        />
        <div>
          <span className="eyebrow">CHUYỆN CỦA ZENTEA</span>
          <h2>
            Những điều giản dị,
            <br />
            làm nên một ngày đẹp.
          </h2>
          <p>
            Zentea bắt đầu từ niềm yêu thích những lá trà thơm và những cuộc trò
            chuyện không vội. Mỗi ly nước được chăm chút để bạn tìm thấy một
            khoảng nghỉ của riêng mình.
          </p>
          <Link className="btn light" to="/menu">
            Tìm hương vị của bạn
          </Link>
        </div>
      </section>
      <section className="promo">
        <Leaf size={36} />
        <h2>Hẹn nhau một ly trà nhé.</h2>
        <p>Trà trái cây thanh mát, matcha dịu êm hay cà phê đậm đà?</p>
        <Link className="btn" to="/menu">
          Đặt món ngay
        </Link>
      </section>
    </>
  );
}
export function MenuPage() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(params.get("category") || "");
  const [page, setPage] = useState(1);
  const [price, setPrice] = useState("");
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get<Category[]>("/categories")).data,
  }).data;
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["products", search, category, page, price],
    queryFn: async () =>
      (
        await api.get<Page<Product>>("/products", {
          params: { search, category, page, max_price: price || undefined },
        })
      ).data,
  });
  return (
    <div className="section">
      <div className="page-heading">
        <span className="eyebrow">FRESHLY BREWED, JUST FOR YOU</span>
        <h1>Thực đơn Zentea</h1>
        <p>Hương vị tự nhiên, niềm vui giản dị.</p>
      </div>
      <div className="filter-bar">
        <div className="tabs">
          <button
            className={!category ? "selected" : ""}
            onClick={() => {
              setCategory("");
              setPage(1);
            }}
          >
            Tất cả
          </button>
          {categories?.map((c) => (
            <button
              key={c.id}
              className={category === String(c.id) ? "selected" : ""}
              onClick={() => {
                setCategory(String(c.id));
                setPage(1);
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Tìm món"
            placeholder="Tìm món bạn thích…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          aria-label="Khoảng giá"
          value={price}
          onChange={(e) => {
            setPrice(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Mọi mức giá</option>
          <option value="40000">Đến 40.000đ</option>
          <option value="50000">Đến 50.000đ</option>
        </select>
      </div>
      {isPending ? (
        <Loading />
      ) : isError ? (
        <Empty>
          Chưa tải được thực đơn.{" "}
          <button onClick={() => refetch()}>Thử lại</button>
        </Empty>
      ) : data?.data.length ? (
        <>
          <p className="muted">{data.total} hương vị để bạn lựa chọn</p>
          <div className="product-grid">
            {data.data.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <Pager page={page} last={data.last_page} onChange={setPage} />
        </>
      ) : (
        <Empty>Chưa tìm thấy món phù hợp.</Empty>
      )}
    </div>
  );
}
export function ProductPage() {
  const { id } = useParams();
  useProductRealtime(id);
  const [size, setSize] = useState("M");
  const [quantity, setQuantity] = useState(1);
  const [sugar, setSugar] = useState<Sugar>("100");
  const [ice, setIce] = useState<Ice>("100");
  const [picked, setPicked] = useState<number[]>([]);
  const toppings = useToppings().data || [];
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const add = useCart((s) => s.add);
  const user = useAuth((s) => s.user);
  const {
    data: p,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => (await api.get<Product>("/products/" + id)).data,
  });
  if (isPending) return <Loading />;
  if (isError || !p) return <Empty>Không tìm thấy sản phẩm.</Empty>;
  const variant = p.variants.find((v) => v.size === size) || p.variants[0];
  const chosen = toppings.filter((t) => picked.includes(t.id));
  const unit = variant.price + chosen.reduce((n, t) => n + t.price, 0);
  function toggleTopping(id: number) {
    setPicked((list) =>
      list.includes(id)
        ? list.filter((x) => x !== id)
        : list.length < 3
          ? [...list, id]
          : (toast("Mỗi ly chọn tối đa 3 topping"), list),
    );
  }
  async function review() {
    setBusy(true);
    try {
      await api.post("/products/" + id + "/reviews", { rating, comment });
      toast.success("Đã gửi đánh giá, đang chờ duyệt.");
      setComment("");
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="section">
      <div className="breadcrumb">
        <Link to="/menu">Thực đơn</Link> / {p.name}
      </div>
      <div className="product-detail">
        <img className="detail-image" src={p.image} alt={p.name} />
        <div>
          <span className="eyebrow">{p.category.name}</span>
          <h1>{p.name}</h1>
          <p>{p.description}</p>
          <div className="detail-price">{money(unit)}</div>
          <label>Chọn kích cỡ</label>
          <div className="sizes">
            {p.variants.map((v) => (
              <button
                className={v.id === variant.id ? "selected" : ""}
                key={v.id}
                onClick={() => setSize(v.size)}
              >
                {v.size}
                <small>{money(v.price)}</small>
              </button>
            ))}
          </div>
          <label>Mức đường</label>
          <div className="chips">
            {sugarPresets.map((v) => (
              <button
                key={v}
                className={sugar === v ? "selected" : ""}
                onClick={() => setSugar(v)}
              >
                {v === "0" ? "Không" : v + "%"}
              </button>
            ))}
            <SugarInput value={sugar} onChange={setSugar} />
          </div>
          <label>Mức đá</label>
          <div className="chips">
            {(Object.keys(iceLabel) as Ice[]).map((v) => (
              <button
                key={v}
                className={ice === v ? "selected" : ""}
                onClick={() => setIce(v)}
              >
                {iceLabel[v]}
              </button>
            ))}
          </div>
          {toppings.length > 0 && (
            <>
              <label>Topping (tối đa 3)</label>
              <div className="chips">
                {toppings.map((t) => (
                  <button
                    key={t.id}
                    aria-pressed={picked.includes(t.id)}
                    className={picked.includes(t.id) ? "selected" : ""}
                    onClick={() => toggleTopping(t.id)}
                  >
                    {t.name}
                    <small>+{money(t.price)}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="buy-row">
            <div className="quantity">
              <button
                aria-label="Giảm"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus size={16} />
              </button>
              {quantity}
              <button
                aria-label="Tăng"
                onClick={() => setQuantity(Math.min(99, quantity + 1))}
              >
                <Plus size={16} />
              </button>
            </div>
            <button
              className="btn"
              onClick={() => {
                add(
                  normalizeItem({
                    variant_id: variant.id,
                    product_id: p.id,
                    name: p.name,
                    size: variant.size,
                    price: variant.price,
                    quantity,
                    image: p.image,
                    sugar,
                    ice,
                    toppings: chosen,
                  }),
                );
                toast.success("Đã thêm vào giỏ hàng");
              }}
            >
              Thêm vào giỏ · {money(unit * quantity)}
            </button>
          </div>
          <div className="detail-promise">
            <Leaf size={18} /> Pha mới khi bạn đặt · Nguyên liệu chọn lọc
          </div>
        </div>
      </div>
      <section className="reviews">
        <h2>Những lời thương gửi Zentea</h2>
        {p.reviews?.length ? (
          p.reviews.map((r) => (
            <article key={r.id}>
              <strong>{r.user.name}</strong>
              <span className="stars">{"★".repeat(r.rating)}</span>
              <p>{r.comment}</p>
            </article>
          ))
        ) : (
          <p className="muted">Chưa có đánh giá được duyệt.</p>
        )}
        {user ? (
          <div className="review-form">
            <h3>Chia sẻ trải nghiệm của bạn</h3>
            <p className="muted">Dành cho khách đã hoàn tất đơn mua món này.</p>
            <StarPicker value={rating} onChange={setRating} />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Bạn cảm nhận thế nào về món này?"
            />
            <button
              className="btn"
              disabled={busy || comment.length < 3}
              onClick={review}
            >
              Gửi đánh giá
            </button>
          </div>
        ) : (
          <Link to="/login">Đăng nhập để viết đánh giá</Link>
        )}
      </section>
    </div>
  );
}
