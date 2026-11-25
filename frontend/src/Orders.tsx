import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Trash2, Check } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { api, message, money, statusLabel } from "./lib/api";
import {
  useAuth,
  useCart,
  cartTotal,
  cartPayload,
  unitPrice,
  sugarText,
  iceLabel,
} from "./lib/store";
import { Empty, Loading, Pager } from "./components";
import { useLive } from "./Realtime";
import type { Order, Page, Sugar, Ice, Topping } from "./types";
/** Mô tả ngắn tùy chọn của một ly: "50% đường · Ít đá · Trân châu". */
export function optionText(o: {
  sugar?: Sugar;
  ice?: Ice;
  toppings?: Topping[] | null;
}) {
  return [
    o.sugar && o.sugar !== "100" ? sugarText(o.sugar) : null,
    o.ice && o.ice !== "100" ? iceLabel[o.ice] : null,
    ...(o.toppings || []).map((t) => t.name),
  ]
    .filter(Boolean)
    .join(" · ");
}
export function Cart() {
  const { items, quantity } = useCart();
  const total = cartTotal(items);
  const user = useAuth((s) => s.user);

  return (
    <div className="section">
      <h1>Giỏ hàng của bạn</h1>
      {!items.length ? (
        <Empty>
          <ShoppingCart size={42} />
          <h2>Chọn một chút tươi mát nhé.</h2>
          <Link className="btn" to="/menu">
            Khám phá thực đơn
          </Link>
        </Empty>
      ) : (
        <div className="checkout-grid">
          <div>
            {items.map((item) => (
              <article className="cart-item" key={item.key}>
                <img src={item.image} alt={item.name} />
                <div>
                  <h3>{item.name}</h3>
                  <span className="muted">
                    Size {item.size} · {money(unitPrice(item))}
                  </span>
                  {optionText(item) && (
                    <small className="options">{optionText(item)}</small>
                  )}
                </div>
                <div className="quantity">
                  <button
                    onClick={() => quantity(item.key, item.quantity - 1)}
                    aria-label="Giảm số lượng"
                  >
                    −
                  </button>
                  {item.quantity}
                  <button
                    onClick={() => quantity(item.key, item.quantity + 1)}
                    aria-label="Tăng số lượng"
                  >
                    +
                  </button>
                </div>
                <strong>{money(item.quantity * unitPrice(item))}</strong>
                <button
                  aria-label="Xóa sản phẩm"
                  onClick={() => quantity(item.key, 0)}
                >
                  <Trash2 size={18} />
                </button>
              </article>
            ))}
          </div>
          <aside className="panel summary">
            <h2>Tóm tắt đơn hàng</h2>
            <p>
              <span>Tạm tính</span>
              <strong>{money(total)}</strong>
            </p>
            <p>
              <span>Phí giao hàng</span>
              <span>Miễn phí</span>
            </p>
            <hr />
            <p>
              <strong>Tổng thanh toán</strong>
              <strong>{money(total)}</strong>
            </p>
            <Link className="btn" to={user ? "/checkout" : "/login"}>
              {user ? "Tiến hành thanh toán" : "Đăng nhập để đặt hàng"}
            </Link>
            <Link to="/menu">Chọn thêm món</Link>
          </aside>
        </div>
      )}
    </div>
  );
}
export function Checkout() {
  const { items, clear } = useCart();
  const user = useAuth((s) => s.user);
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  const navigate = useNavigate();
  const subtotal = cartTotal(items);
  const [code, setCode] = useState("");
  const [voucher, setVoucher] = useState<{
    code: string;
    description?: string | null;
    discount: number;
    subtotal: number;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  // Giỏ thay đổi thì giảm giá cũ không còn đúng, phải áp dụng lại.
  useEffect(() => {
    if (voucher && voucher.subtotal !== subtotal) setVoucher(null);
  }, [subtotal, voucher]);
  const discount = voucher?.discount || 0;
  const total = subtotal - discount;
  async function applyVoucher() {
    if (!code.trim()) return;
    setChecking(true);
    try {
      const { data } = await api.post("/vouchers/check", {
        code: code.trim(),
        subtotal,
      });
      setVoucher({ ...data, subtotal });
      toast.success("Đã áp dụng mã " + data.code);
    } catch (e) {
      setVoucher(null);
      toast.error(message(e));
    } finally {
      setChecking(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const fields = Object.fromEntries(new FormData(e.currentTarget));
      const { data } = await api.post<Order>("/orders", {
        ...fields,
        idempotency_key: key.current,
        voucher_code: voucher?.code || null,
        items: cartPayload(items),
      });
      clear();
      toast.success("Zentea đã nhận đơn của bạn");
      navigate("/orders/" + data.id);
    } catch (e) {
      toast.error(message(e));
      // Server đã từ chối (422, ví dụ mã hết lượt) thì lần gửi sau là yêu cầu mới.
      // Lỗi mạng giữ nguyên khóa để không tạo trùng đơn.
      if (axios.isAxiosError(e) && e.response?.status === 422)
        key.current = crypto.randomUUID();
    } finally {
      setBusy(false);
    }
  }
  if (!items.length)
    return (
      <Empty>
        Giỏ hàng đang trống. <Link to="/menu">Chọn món</Link>
      </Empty>
    );
  return (
    <div className="section">
      <h1>Thêm một bước, trà đến bên bạn.</h1>
      <form className="checkout-grid" onSubmit={submit}>
        <div className="panel form-grid">
          <h2>Thông tin giao hàng</h2>
          <label>
            Người nhận
            <input
              name="recipient"
              defaultValue={user?.name}
              required
              maxLength={100}
            />
          </label>
          <label>
            Số điện thoại
            <input
              name="phone"
              type="tel"
              defaultValue={user?.phone}
              required
              pattern="[0-9+ ()-]{9,20}"
            />
          </label>
          <label>
            Địa chỉ giao hàng
            <textarea
              name="address"
              defaultValue={user?.address}
              required
              minLength={5}
            />
          </label>
          <label>
            Ghi chú cho quán
            <textarea
              name="note"
              placeholder="Giao trước 10 giờ, gọi trước khi đến…"
            />
          </label>
          <h2>Phương thức thanh toán</h2>
          <label>
            Chọn phương thức
            <select name="payment_method">
              <option value="cod">Tiền mặt khi nhận hàng</option>
              <option value="momo">MoMo · Mô phỏng</option>
              <option value="vnpay">VNPay · Mô phỏng</option>
              <option value="zalopay">ZaloPay · Mô phỏng</option>
            </select>
          </label>
        </div>
        <aside className="panel summary">
          <h2>Đơn hàng của bạn</h2>
          {items.map((i) => (
            <p key={i.key}>
              <span>
                {i.quantity} × {i.name} ({i.size})
                {optionText(i) && (
                  <small className="options">{optionText(i)}</small>
                )}
              </span>
              <strong>{money(unitPrice(i) * i.quantity)}</strong>
            </p>
          ))}
          <div className="voucher-row">
            <input
              aria-label="Mã giảm giá"
              placeholder="Mã giảm giá"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void applyVoucher();
                }
              }}
            />
            {voucher ? (
              <button
                type="button"
                className="btn light"
                onClick={() => {
                  setVoucher(null);
                  setCode("");
                }}
              >
                Bỏ mã
              </button>
            ) : (
              <button
                type="button"
                className="btn light"
                disabled={checking || !code.trim()}
                onClick={applyVoucher}
              >
                Áp dụng
              </button>
            )}
          </div>
          {voucher?.description && (
            <p className="muted">{voucher.description}</p>
          )}
          <hr />
          <p>
            <span>Tạm tính</span>
            <span>{money(subtotal)}</span>
          </p>
          {discount > 0 && (
            <p className="discount">
              <span>Giảm giá ({voucher?.code})</span>
              <span>−{money(discount)}</span>
            </p>
          )}
          <p>
            <strong>Tổng cộng</strong>
            <strong>{money(total)}</strong>
          </p>
          <p className="muted">
            Giao hàng miễn phí trong bản demo. Giá được xác nhận lại khi tạo
            đơn.
          </p>
          <button className="btn" disabled={busy}>
            {busy ? "Đang gửi đơn…" : "Xác nhận đặt hàng"}
          </button>
        </aside>
      </form>
    </div>
  );
}
export function OrderDetail({
  order,
  onChange,
}: {
  order: Order;
  onChange?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const stages = ["pending", "preparing", "delivering", "completed"];
  const index = stages.indexOf(order.status);
  async function pay(result: string) {
    setBusy(true);
    try {
      await api.post("/orders/" + order.id + "/mock-payment", { result });
      toast.success(
        result === "success"
          ? "Thanh toán mô phỏng thành công"
          : "Đã mô phỏng thanh toán thất bại",
      );
      onChange?.();
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="panel order-card">
      <div className="row-between">
        <h3>#{order.code}</h3>
        <span className={"badge " + order.status}>
          {statusLabel[order.status]}
        </span>
      </div>
      <p className="muted">
        {new Date(order.created_at).toLocaleString("vi-VN")}
      </p>
      {order.status !== "cancelled" && (
        <div className="tracking">
          {stages.map((s, i) => (
            <div className={i <= index ? "done" : ""} key={s}>
              <span>{i < index ? <Check size={15} /> : i + 1}</span>
              <small>{statusLabel[s]}</small>
            </div>
          ))}
        </div>
      )}
      <div className="order-lines">
        {order.items?.map((i) => (
          <p key={i.id}>
            <span>
              {i.quantity} × {i.name} · {i.size}
              {optionText(i) && (
                <small className="options">{optionText(i)}</small>
              )}
            </span>
            <strong>{money(i.price * i.quantity)}</strong>
          </p>
        ))}
      </div>
      {order.discount > 0 && (
        <div className="row-between discount">
          <span>Giảm giá ({order.voucher_code})</span>
          <span>−{money(order.discount)}</span>
        </div>
      )}
      <div className="row-between">
        <strong>Tổng cộng</strong>
        <strong>{money(order.total)}</strong>
      </div>
      <p>
        {order.recipient} · {order.phone}
        <br />
        {order.address}
      </p>
      {order.note && <p>Ghi chú · {order.note}</p>}
      <p className="muted">
        {order.payment_method.toUpperCase()} ·{" "}
        {
          {
            unpaid: "Chưa thanh toán",
            paid: "Đã thanh toán",
            failed: "Thanh toán thất bại",
            refunded: "Đã hoàn tiền mô phỏng",
          }[order.payment_status]
        }
      </p>
      {order.payment_method !== "cod" &&
        order.status === "pending" &&
        order.payment_status !== "paid" && (
          <div className="notice">
            <strong>Thanh toán mô phỏng</strong>
            <p>Chọn kết quả để kiểm tra luồng thanh toán.</p>
            <button
              className="btn"
              disabled={busy}
              onClick={() => pay("success")}
            >
              Mô phỏng thành công
            </button>
            <button
              className="btn light"
              disabled={busy}
              onClick={() => pay("failed")}
            >
              Mô phỏng thất bại
            </button>
          </div>
        )}
    </article>
  );
}
export function MyOrders() {
  const { id } = useParams();
  const [page, setPage] = useState(1);
  const { connected } = useLive();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["orders", id, page],
    queryFn: async () =>
      id
        ? [(await api.get<Order>("/orders/" + id)).data]
        : (await api.get<Page<Order>>("/orders?page=" + page)).data,
    refetchInterval: connected ? false : 15000,
  });
  if (isPending) return <Loading />;
  if (isError)
    return (
      <Empty>
        Không tải được đơn hàng.{" "}
        <button onClick={() => refetch()}>Thử lại</button>
      </Empty>
    );
  const orders = Array.isArray(data) ? data : data?.data;
  return (
    <div className="section narrow">
      <div className="section-title">
        <h1>Đơn hàng của tôi</h1>
        <span className="muted">
          {connected ? "Đang cập nhật trực tiếp" : "Đồng bộ mỗi 15 giây"}
        </span>
      </div>
      {id && <Link to="/orders">Xem tất cả đơn hàng</Link>}
      {orders?.length ? (
        orders.map((order) => (
          <div key={order.id}>
            <OrderDetail order={order} onChange={() => refetch()} />
            {!id && <Link to={"/orders/" + order.id}>Theo dõi đơn hàng</Link>}
          </div>
        ))
      ) : (
        <Empty>
          Bạn chưa có đơn hàng. <Link to="/menu">Chọn món đầu tiên</Link>
        </Empty>
      )}
      {!Array.isArray(data) && data && (
        <Pager page={page} last={data.last_page} onChange={setPage} />
      )}
    </div>
  );
}
