import { useState, type FormEvent } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ShoppingBag,
  Coffee,
  Users,
  MessageSquare,
  BarChart3,
  Shapes,
  Volume2,
  VolumeX,
  Plus,
  X,
  Search,
  TicketPercent,
  CupSoda,
  Package,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { toast } from "sonner";
import { api, message, money, statusLabel } from "./lib/api";
import { useLive } from "./Realtime";
import { Logo, Empty, Loading, Pager } from "./components";
import { OrderDetail } from "./Orders";
import { PageTransition } from "./lib/navigation";
import type {
  Stats,
  Order,
  Page,
  Product,
  Category,
  User,
  Review,
  Topping,
  Voucher,
} from "./types";
const nav = [
  ["", "Tổng quan", LayoutDashboard],
  ["orders", "Đơn hàng", ShoppingBag],
  ["products", "Sản phẩm", Coffee],
  ["categories", "Danh mục", Shapes],
  ["customers", "Khách hàng", Users],
  ["reviews", "Đánh giá", MessageSquare],
  ["vouchers", "Mã giảm giá", TicketPercent],
  ["toppings", "Topping", CupSoda],
  ["ingredients", "Nguyên liệu", Package],
  ["statistics", "Thống kê", BarChart3],
] as const;
export function AdminLayout() {
  const { sound, toggleSound, staffCount } = useLive();
  const { data } = useQuery({
    queryKey: ["admin", "stats", "month"],
    queryFn: async () => (await api.get<Stats>("/admin/statistics")).data,
  });
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Logo />
        <span className="eyebrow">QUẢN TRỊ CỬA HÀNG</span>
        <nav>
          {nav.map(([path, label, Icon]) => (
            <NavLink key={path} to={"/admin/" + path} end={path === ""}>
              <Icon size={20} />
              {label}
              {path === "orders" && !!data?.pending && <b>{data.pending}</b>}
              {path === "reviews" && !!data?.pending_reviews && (
                <b>{data.pending_reviews}</b>
              )}
            </NavLink>
          ))}
        </nav>
        <Link className="back-shop" to="/">
          Về trang bán hàng
        </Link>
      </aside>
      <div className="admin-main">
        <div className="admin-top">
          <span>Zentea / {staffCount} quản trị viên trực tuyến</span>
          <div>
            <button onClick={toggleSound} aria-label="Bật tắt âm báo">
              {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
          </div>
        </div>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </div>
    </div>
  );
}
function useStats(period = "month") {
  return useQuery({
    queryKey: ["admin", "stats", period],
    queryFn: async () =>
      (await api.get<Stats>("/admin/statistics?period=" + period)).data,
  });
}
export function RevenueChart({ data }: { data: Stats["chart"] }) {
  return (
    <div className="chart">
      {data.length ? (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="green" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4CAF7B" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#4CAF7B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e8eee9" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => v / 1000 + "k"}
              tick={{ fontSize: 12 }}
            />
            <Tooltip formatter={(v) => money(Number(v))} />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Doanh thu"
              stroke="#4CAF7B"
              fill="url(#green)"
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <Empty>Biểu đồ sẽ hiển thị khi có đơn hàng hoàn tất.</Empty>
      )}
    </div>
  );
}
export function Dashboard() {
  const { data, isPending, isError } = useStats();
  const orders = useQuery({
    queryKey: ["admin", "orders", "pending"],
    queryFn: async () =>
      (await api.get<Page<Order>>("/admin/orders?status=pending")).data,
  });
  if (isPending) return <Loading />;
  if (isError || !data) return <Empty>Chưa tải được thống kê.</Empty>;
  return (
    <div className="admin-content">
      <span className="eyebrow">MỖI NGÀY MỘT CHÚT TỐT HƠN</span>
      <h1>Tổng quan cửa hàng</h1>
      <p className="muted">Chào ngày mới. Cùng chăm chút từng đơn hàng nhé.</p>
      <div className="stat-grid">
        {[
          ["Doanh thu hôm nay", money(data.today)],
          ["Sản phẩm", data.products],
          ["Khách hàng", data.customers],
          ["Tổng đơn hàng", data.orders],
        ].map(([label, value]) => (
          <div className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="row-between">
            <h2>Doanh thu tháng này</h2>
            <strong>{money(data.month)}</strong>
          </div>
          <RevenueChart data={data.chart} />
        </section>
        <section className="panel green-panel">
          <Coffee size={32} />
          <h2>Sẵn sàng phục vụ</h2>
          <strong className="big-number">{data.pending}</strong>
          <p>đơn hàng đang chờ xác nhận</p>
          <Link className="btn light" to="/admin/orders">
            Xử lý đơn hàng
          </Link>
          <hr />
          <p>Doanh thu tuần này</p>
          <h3>{money(data.week)}</h3>
        </section>
      </div>
      <section className="panel">
        <div className="row-between">
          <h2>Đơn đang chờ xử lý</h2>
          <Link to="/admin/orders">Xem tất cả</Link>
        </div>
        <OrderTable orders={orders.data?.data || []} />
      </section>
    </div>
  );
}
function OrderTable({
  orders,
  onSelect,
}: {
  orders: Order[];
  onSelect?: (o: Order) => void;
}) {
  return orders.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mã đơn</th>
            <th>Khách hàng</th>
            <th>Thời gian</th>
            <th>Giá trị</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <strong>#{o.code}</strong>
              </td>
              <td>{o.recipient}</td>
              <td>{new Date(o.created_at).toLocaleString("vi-VN")}</td>
              <td>{money(o.total)}</td>
              <td>
                <span className={"badge " + o.status}>
                  {statusLabel[o.status]}
                </span>
              </td>
              <td>
                {onSelect ? (
                  <button className="text-link" onClick={() => onSelect(o)}>
                    Chi tiết
                  </button>
                ) : (
                  <Link to="/admin/orders">Xem đơn</Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty>Chưa có đơn hàng trong danh sách này.</Empty>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row-between">
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Đóng">
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function AdminOrders() {
  const client = useQueryClient();
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const { connected } = useLive();
  const { data, isPending, isError } = useQuery({
    queryKey: ["admin", "orders", status, from, to, page],
    queryFn: async () =>
      (
        await api.get<Page<Order>>("/admin/orders", {
          params: { status, from, to, page },
        })
      ).data,
    refetchInterval: connected ? false : 15000,
  });
  const current = data?.data.find((o) => o.id === selected?.id) || selected;
  async function update(value: string) {
    setBusy(true);
    try {
      const response = await api.patch<Order>(
        "/admin/orders/" + selected?.id + "/status",
        { status: value },
      );
      setSelected(response.data);
      void client.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Đã cập nhật trạng thái");
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-content">
      <h1>Quản lý đơn hàng</h1>
      <div className="filter-bar">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(statusLabel).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
        <label>
          Từ ngày
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Đến ngày
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      <section className="panel">
        {isPending ? (
          <Loading />
        ) : isError ? (
          <Empty>Không tải được danh sách đơn.</Empty>
        ) : (
          <OrderTable orders={data?.data || []} onSelect={setSelected} />
        )}
        <Pager page={page} last={data?.last_page || 1} onChange={setPage} />
      </section>
      {current && (
        <Modal title={"Đơn #" + current.code} onClose={() => setSelected(null)}>
          <OrderDetail order={current} />
          <div className="form-grid">
            <label>
              Cập nhật trạng thái
              <select
                value={current.status}
                disabled={busy}
                onChange={(e) => update(e.target.value)}
              >
                {Object.entries(statusLabel).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
async function upload(file: File) {
  const form = new FormData();
  form.append("image", file);
  return (await api.post<{ url: string }>("/admin/uploads", form)).data.url;
}
export function AdminProducts() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Product | null | undefined>();
  const [busy, setBusy] = useState(false);
  const { data, isPending } = useQuery({
    queryKey: ["admin", "products", search, category, page],
    queryFn: async () =>
      (
        await api.get<Page<Product>>("/admin/products", {
          params: { search, category, page },
        })
      ).data,
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get<Category[]>("/categories")).data,
  }).data;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const form = new FormData(e.currentTarget);
      const image = form.get("file") as File;
      const body = {
        name: form.get("name"),
        description: form.get("description"),
        category_id: Number(form.get("category_id")),
        image: image.size ? await upload(image) : form.get("image"),
        featured: form.has("featured"),
        active: form.has("active"),
        variants: ["S", "M", "L"].map((size) => ({
          size,
          price: Number(form.get("price_" + size)),
        })),
      };
      await api.request({
        method: edit ? "put" : "post",
        url: "/admin/products" + (edit ? "/" + edit.id : ""),
        data: body,
      });
      setEdit(undefined);
      void client.invalidateQueries({ queryKey: ["admin", "products"] });
      void client.invalidateQueries({ queryKey: ["products"] });
      toast.success("Đã lưu sản phẩm");
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(p: Product) {
    try {
      await api.delete("/admin/products/" + p.id);
      void client.invalidateQueries();
      toast.success("Đã ngừng bán sản phẩm");
    } catch (e) {
      toast.error(message(e));
    }
  }
  return (
    <div className="admin-content">
      <div className="section-title">
        <h1>Sản phẩm</h1>
        <button className="btn" onClick={() => setEdit(null)}>
          <Plus size={18} /> Thêm sản phẩm
        </button>
      </div>
      <div className="filter-bar">
        <label className="search">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm sản phẩm…"
          />
        </label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả danh mục</option>
          {categories?.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <section className="panel table-wrap">
        {isPending ? (
          <Loading />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Danh mục</th>
                <th>Giá từ</th>
                <th>Đang bán</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.data.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="table-product">
                      <img src={p.image} alt="" />
                      {p.name}
                    </div>
                  </td>
                  <td>{p.category.name}</td>
                  <td>{money(Math.min(...p.variants.map((v) => v.price)))}</td>
                  <td>{p.active ? "Có" : "Ngừng bán"}</td>
                  <td>
                    <button onClick={() => setEdit(p)}>Sửa</button>{" "}
                    <button className="danger" onClick={() => remove(p)}>
                      Ngừng bán
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager page={page} last={data?.last_page || 1} onChange={setPage} />
      </section>
      {edit !== undefined && (
        <Modal
          title={edit ? "Sửa sản phẩm" : "Thêm sản phẩm"}
          onClose={() => setEdit(undefined)}
        >
          <form className="form-grid" onSubmit={save}>
            <label>
              Tên sản phẩm
              <input name="name" defaultValue={edit?.name} required />
            </label>
            <label>
              Danh mục
              <select
                name="category_id"
                defaultValue={edit?.category_id}
                required
              >
                {categories?.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mô tả
              <textarea
                name="description"
                defaultValue={edit?.description}
                required
              />
            </label>
            <label>
              URL ảnh
              <input name="image" defaultValue={edit?.image} />
            </label>
            <label>
              Hoặc tải ảnh
              <input
                type="file"
                name="file"
                accept="image/png,image/jpeg,image/webp"
              />
            </label>
            {["S", "M", "L"].map((size) => (
              <div className="size-edit" key={size}>
                <strong>Size {size}</strong>
                <label>
                  Giá
                  <input
                    name={"price_" + size}
                    type="number"
                    min="1000"
                    required
                    defaultValue={
                      edit?.variants.find((v) => v.size === size)?.price ||
                      35000
                    }
                  />
                </label>
              </div>
            ))}
            <label className="check">
              <input
                type="checkbox"
                name="featured"
                defaultChecked={edit?.featured}
              />{" "}
              Nổi bật
            </label>
            <label className="check">
              <input
                type="checkbox"
                name="active"
                defaultChecked={edit?.active ?? true}
              />{" "}
              Đang bán
            </label>
            <button className="btn" disabled={busy}>
              Lưu sản phẩm
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
export function AdminCategories() {
  const client = useQueryClient();
  const { data } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get<Category[]>("/categories")).data,
  });
  const [edit, setEdit] = useState<Category | null | undefined>();
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const form = new FormData(e.currentTarget);
      const file = form.get("file") as File;
      await api.request({
        method: edit ? "put" : "post",
        url: "/admin/categories" + (edit ? "/" + edit.id : ""),
        data: {
          name: form.get("name"),
          image: file.size ? await upload(file) : form.get("image"),
        },
      });
      setEdit(undefined);
      void client.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Đã lưu danh mục");
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(c: Category) {
    try {
      await api.delete("/admin/categories/" + c.id);
      void client.invalidateQueries({ queryKey: ["categories"] });
    } catch (e) {
      toast.error(message(e));
    }
  }
  return (
    <div className="admin-content">
      <div className="section-title">
        <h1>Danh mục</h1>
        <button className="btn" onClick={() => setEdit(null)}>
          Thêm danh mục
        </button>
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tên danh mục</th>
              <th>Sản phẩm</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.products_count}</td>
                <td>
                  <button onClick={() => setEdit(c)}>Sửa</button>{" "}
                  <button className="danger" onClick={() => remove(c)}>
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit !== undefined && (
        <Modal title="Danh mục" onClose={() => setEdit(undefined)}>
          <form className="form-grid" onSubmit={save}>
            <label>
              Tên danh mục
              <input name="name" required defaultValue={edit?.name} />
            </label>
            <label>
              URL ảnh
              <input name="image" defaultValue={edit?.image} />
            </label>
            <label>
              Tải ảnh
              <input
                name="file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
              />
            </label>
            <button className="btn" disabled={busy}>
              Lưu danh mục
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
export function AdminCustomers() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<User | null>(null);
  const { data } = useQuery({
    queryKey: ["admin", "customers", page, search],
    queryFn: async () =>
      (
        await api.get<Page<User>>("/admin/customers", {
          params: { page, search },
        })
      ).data,
  });
  async function block(user: User) {
    try {
      await api.patch("/admin/customers/" + user.id, {
        is_blocked: !user.is_blocked,
      });
      void client.invalidateQueries({ queryKey: ["admin", "customers"] });
    } catch (e) {
      toast.error(message(e));
    }
  }
  async function view(user: User) {
    try {
      setDetail((await api.get<User>("/admin/customers/" + user.id)).data);
    } catch (e) {
      toast.error(message(e));
    }
  }
  return (
    <div className="admin-content">
      <h1>Khách hàng</h1>
      <input
        placeholder="Tìm email…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Khách hàng</th>
              <th>Email</th>
              <th>Số đơn</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.data.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.orders_count}</td>
                <td>{u.is_blocked ? "Đã khóa" : "Hoạt động"}</td>
                <td>
                  <button onClick={() => view(u)}>Chi tiết</button>{" "}
                  <button onClick={() => block(u)}>
                    {u.is_blocked ? "Mở khóa" : "Khóa"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={page} last={data?.last_page || 1} onChange={setPage} />
      </section>
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <p>
            {detail.email} · {detail.phone}
          </p>
          <p>{detail.address}</p>
          <h3>Lịch sử đơn hàng</h3>
          {detail.orders?.map((o) => (
            <OrderDetail key={o.id} order={o} />
          ))}
        </Modal>
      )}
    </div>
  );
}
export function AdminReviews() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["admin", "reviews", page],
    queryFn: async () =>
      (await api.get<Page<Review>>("/admin/reviews?page=" + page)).data,
  });
  async function moderate(id: number, status: string) {
    try {
      if (status === "delete") await api.delete("/admin/reviews/" + id);
      else await api.patch("/admin/reviews/" + id, { status });
      void client.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Đã cập nhật đánh giá");
    } catch (e) {
      toast.error(message(e));
    }
  }
  return (
    <div className="admin-content">
      <h1>Bình luận & đánh giá</h1>
      {data?.data.length ? (
        data.data.map((r) => (
          <article className="panel review-card" key={r.id}>
            <div className="row-between">
              <h3>
                {r.user.name} · {r.product.name}
              </h3>
              <span className="badge">
                {
                  {
                    pending: "Chờ duyệt",
                    approved: "Đã duyệt",
                    rejected: "Từ chối",
                  }[r.status]
                }
              </span>
            </div>
            <span className="stars">{"★".repeat(r.rating)}</span>
            <p>{r.comment}</p>
            <div className="button-row">
              <button
                className="btn"
                onClick={() => moderate(r.id, "approved")}
              >
                Duyệt
              </button>
              <button
                className="btn light"
                onClick={() => moderate(r.id, "rejected")}
              >
                Từ chối
              </button>
              <button
                className="danger"
                onClick={() => moderate(r.id, "delete")}
              >
                Xóa
              </button>
            </div>
          </article>
        ))
      ) : (
        <Empty>Chưa có đánh giá.</Empty>
      )}
      <Pager page={page} last={data?.last_page || 1} onChange={setPage} />
    </div>
  );
}
export function Statistics() {
  const [period, setPeriod] = useState("month");
  const { data, isPending } = useStats(period);
  async function download(format: string) {
    try {
      const response = await api.get("/admin/reports", {
        params: { period, format },
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "zentea-report." + format;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(message(e));
    }
  }
  return (
    <div className="admin-content">
      <div className="section-title">
        <h1>Thống kê kinh doanh</h1>
        <div className="button-row">
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="day">Hôm nay</option>
            <option value="week">Tuần này</option>
            <option value="month">Tháng này</option>
            <option value="year">Năm nay</option>
          </select>
          <button className="btn light" onClick={() => download("csv")}>
            Xuất CSV
          </button>
          <button className="btn" onClick={() => download("pdf")}>
            Xuất PDF
          </button>
        </div>
      </div>
      {isPending ? (
        <Loading />
      ) : data ? (
        <>
          <div className="stat-card">
            <span>Doanh thu từ đơn hoàn tất trong kỳ</span>
            <strong>{money(data.revenue)}</strong>
            {data.discount > 0 && (
              <small>
                Đã giảm cho khách {money(data.discount)} qua mã giảm giá
              </small>
            )}
          </div>
          <section className="panel">
            <RevenueChart data={data.chart} />
          </section>
          <div className="dashboard-grid">
            <section className="panel">
              <h2>Sản phẩm bán chạy</h2>
              {data.best_products.length ? (
                data.best_products.map((p) => (
                  <p className="row-between" key={p.name}>
                    <span>
                      {p.name} · {p.quantity} ly
                    </span>
                    <strong>{money(p.revenue)}</strong>
                  </p>
                ))
              ) : (
                <Empty>Chưa có dữ liệu.</Empty>
              )}
            </section>
            <section className="panel">
              <h2>Khách hàng thân thiết</h2>
              {data.loyal_customers.map((u) => (
                <p className="row-between" key={u.id}>
                  <span>{u.name}</span>
                  <strong>{money(u.orders_sum_total || 0)}</strong>
                </p>
              ))}
            </section>
          </div>
        </>
      ) : (
        <Empty>Không tải được thống kê.</Empty>
      )}
    </div>
  );
}
const toInt = (v: FormDataEntryValue | null) =>
  v === null || v === "" ? null : Number(v);
// Input datetime-local cần dạng "YYYY-MM-DDTHH:mm" theo giờ máy.
const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
function voucherRule(v: Voucher) {
  const value = v.type === "percent" ? v.value + "%" : money(v.value);
  return [
    "Giảm " + value,
    v.max_discount ? "tối đa " + money(v.max_discount) : null,
    v.min_order ? "đơn từ " + money(v.min_order) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
export function AdminVouchers() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Voucher | null | undefined>();
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [busy, setBusy] = useState(false);
  const { data, isPending } = useQuery({
    queryKey: ["admin", "vouchers", page],
    queryFn: async () =>
      (await api.get<Page<Voucher>>("/admin/vouchers?page=" + page)).data,
  });
  function open(v: Voucher | null) {
    setType(v?.type || "percent");
    setEdit(v);
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      const date = (name: string) =>
        f.get(name) ? new Date(String(f.get(name))).toISOString() : null;
      await api.request({
        method: edit ? "put" : "post",
        url: "/admin/vouchers" + (edit ? "/" + edit.id : ""),
        data: {
          code: f.get("code"),
          description: f.get("description") || null,
          type,
          value: toInt(f.get("value")),
          max_discount:
            type === "percent" ? toInt(f.get("max_discount")) : null,
          min_order: toInt(f.get("min_order")) || 0,
          usage_limit: toInt(f.get("usage_limit")),
          starts_at: date("starts_at"),
          expires_at: date("expires_at"),
          active: f.get("active") === "on",
        },
      });
      setEdit(undefined);
      void client.invalidateQueries({ queryKey: ["admin", "vouchers"] });
      toast.success("Đã lưu mã giảm giá");
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(v: Voucher) {
    if (
      !confirm(
        "Xóa mã " + v.code + "? Mã đã có người dùng sẽ chỉ bị ngừng áp dụng.",
      )
    )
      return;
    try {
      await api.delete("/admin/vouchers/" + v.id);
      void client.invalidateQueries({ queryKey: ["admin", "vouchers"] });
    } catch (e) {
      toast.error(message(e));
    }
  }
  const expired = (v: Voucher) =>
    !!v.expires_at && new Date(v.expires_at) < new Date();
  return (
    <div className="admin-content">
      <div className="section-title">
        <h1>Mã giảm giá</h1>
        <button className="btn" onClick={() => open(null)}>
          <Plus size={18} /> Thêm mã
        </button>
      </div>
      {isPending ? (
        <Loading />
      ) : data?.data.length ? (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Ưu đãi</th>
                <th>Đã dùng</th>
                <th>Hạn dùng</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.data.map((v) => (
                <tr key={v.id}>
                  <td>
                    <strong>{v.code}</strong>
                    {v.description && (
                      <small className="muted block">{v.description}</small>
                    )}
                  </td>
                  <td>{voucherRule(v)}</td>
                  <td>
                    {v.used_count}
                    {v.usage_limit ? " / " + v.usage_limit : ""}
                  </td>
                  <td>
                    {v.expires_at
                      ? new Date(v.expires_at).toLocaleString("vi-VN")
                      : "Không giới hạn"}
                  </td>
                  <td>
                    <span
                      className={
                        "badge " +
                        (v.active && !expired(v) ? "completed" : "cancelled")
                      }
                    >
                      {!v.active
                        ? "Ngừng"
                        : expired(v)
                          ? "Hết hạn"
                          : "Đang chạy"}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => open(v)}>Sửa</button>{" "}
                    <button className="danger" onClick={() => remove(v)}>
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} last={data.last_page} onChange={setPage} />
        </div>
      ) : (
        <Empty>Chưa có mã giảm giá.</Empty>
      )}
      {edit !== undefined && (
        <Modal
          title={edit ? "Sửa mã " + edit.code : "Thêm mã giảm giá"}
          onClose={() => setEdit(undefined)}
        >
          <form className="form-grid" onSubmit={save}>
            <label>
              Mã (chữ in hoa, số, - hoặc _)
              <input
                name="code"
                required
                maxLength={40}
                pattern="[A-Za-z0-9_\-]+"
                defaultValue={edit?.code}
              />
            </label>
            <label>
              Mô tả cho khách
              <input
                name="description"
                maxLength={255}
                defaultValue={edit?.description || ""}
              />
            </label>
            <label>
              Loại giảm
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "percent" | "fixed")}
              >
                <option value="percent">Theo phần trăm</option>
                <option value="fixed">Số tiền cố định</option>
              </select>
            </label>
            <label>
              {type === "percent"
                ? "Phần trăm giảm (1–100)"
                : "Số tiền giảm (đ)"}
              <input
                name="value"
                type="number"
                required
                min={1}
                max={type === "percent" ? 100 : 10000000}
                defaultValue={edit?.value}
              />
            </label>
            {type === "percent" && (
              <label>
                Giảm tối đa (đ, để trống nếu không giới hạn)
                <input
                  name="max_discount"
                  type="number"
                  min={1000}
                  defaultValue={edit?.max_discount ?? ""}
                />
              </label>
            )}
            <label>
              Đơn tối thiểu (đ)
              <input
                name="min_order"
                type="number"
                min={0}
                defaultValue={edit?.min_order ?? 0}
              />
            </label>
            <label>
              Tổng lượt dùng (để trống nếu không giới hạn)
              <input
                name="usage_limit"
                type="number"
                min={1}
                defaultValue={edit?.usage_limit ?? ""}
              />
            </label>
            <label>
              Bắt đầu
              <input
                name="starts_at"
                type="datetime-local"
                defaultValue={toLocalInput(edit?.starts_at)}
              />
            </label>
            <label>
              Kết thúc
              <input
                name="expires_at"
                type="datetime-local"
                defaultValue={toLocalInput(edit?.expires_at)}
              />
            </label>
            <label className="check">
              <input
                name="active"
                type="checkbox"
                defaultChecked={edit?.active ?? true}
              />{" "}
              Đang áp dụng
            </label>
            <p className="muted">
              Mỗi khách dùng một mã một lần. Đơn bị hủy sẽ trả lại lượt dùng.
            </p>
            <button className="btn" disabled={busy}>
              Lưu mã
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
export function AdminToppings() {
  const client = useQueryClient();
  const [edit, setEdit] = useState<Topping | null | undefined>();
  const [busy, setBusy] = useState(false);
  const { data, isPending } = useQuery({
    queryKey: ["admin", "toppings"],
    queryFn: async () => (await api.get<Topping[]>("/admin/toppings")).data,
  });
  function refresh() {
    void client.invalidateQueries({ queryKey: ["admin", "toppings"] });
    void client.invalidateQueries({ queryKey: ["toppings"] });
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      await api.request({
        method: edit ? "put" : "post",
        url: "/admin/toppings" + (edit ? "/" + edit.id : ""),
        data: {
          name: f.get("name"),
          price: Number(f.get("price")),
          active: f.get("active") === "on",
        },
      });
      setEdit(undefined);
      refresh();
      toast.success("Đã lưu topping");
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function toggle(t: Topping) {
    try {
      await api.put("/admin/toppings/" + t.id, {
        name: t.name,
        price: t.price,
        active: !t.active,
      });
      refresh();
    } catch (e) {
      toast.error(message(e));
    }
  }
  async function remove(t: Topping) {
    if (
      !confirm("Xóa topping " + t.name + "? Đơn cũ vẫn giữ thông tin topping.")
    )
      return;
    try {
      await api.delete("/admin/toppings/" + t.id);
      refresh();
    } catch (e) {
      toast.error(message(e));
    }
  }
  return (
    <div className="admin-content">
      <div className="section-title">
        <h1>Topping</h1>
        <button className="btn" onClick={() => setEdit(null)}>
          <Plus size={18} /> Thêm topping
        </button>
      </div>
      <p className="muted">
        Khách chọn tối đa 3 topping mỗi ly. Mức đường và đá là tùy chọn miễn
        phí.
      </p>
      {isPending ? (
        <Loading />
      ) : data?.length ? (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tên topping</th>
                <th>Giá thêm</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{money(t.price)}</td>
                  <td>
                    <button
                      className={
                        "badge " + (t.active ? "completed" : "cancelled")
                      }
                      onClick={() => toggle(t)}
                    >
                      {t.active ? "Đang bán" : "Tạm hết"}
                    </button>
                  </td>
                  <td>
                    <button onClick={() => setEdit(t)}>Sửa</button>{" "}
                    <button className="danger" onClick={() => remove(t)}>
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>Chưa có topping.</Empty>
      )}
      {edit !== undefined && (
        <Modal
          title={edit ? "Sửa topping" : "Thêm topping"}
          onClose={() => setEdit(undefined)}
        >
          <form className="form-grid" onSubmit={save}>
            <label>
              Tên topping
              <input
                name="name"
                required
                maxLength={60}
                defaultValue={edit?.name}
              />
            </label>
            <label>
              Giá thêm (đ)
              <input
                name="price"
                type="number"
                required
                min={0}
                max={100000}
                step={500}
                defaultValue={edit?.price ?? 5000}
              />
            </label>
            <label className="check">
              <input
                name="active"
                type="checkbox"
                defaultChecked={edit?.active ?? true}
              />{" "}
              Đang bán
            </label>
            <button className="btn" disabled={busy}>
              Lưu topping
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
