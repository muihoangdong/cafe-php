import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import {
  ShoppingCart,
  UserRound,
  LogOut,
  Menu as MenuIcon,
  X,
  Leaf,
  MapPin,
  Mail,
  Phone,
} from "lucide-react";
import { useAuth, useCart, cartPayload } from "./lib/store";
import { ChatWidget } from "./Chat";
import { PageTransition, useScrollMemory } from "./lib/navigation";
import { api } from "./lib/api";
import { Logo } from "./components";
import { Home, MenuPage, ProductPage } from "./Catalog";
import { AuthPage, Profile } from "./Account";
import { Cart, Checkout, MyOrders } from "./Orders";
import { AdminIngredients } from "./AdminIngredients";
import {
  AdminToppings,
  AdminVouchers,
  AdminLayout,
  Dashboard,
  AdminOrders,
  AdminProducts,
  AdminCategories,
  AdminCustomers,
  AdminReviews,
  Statistics,
} from "./Admin";
function Guard({ admin = false }: { admin?: boolean }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}
function Layout() {
  const { user, clear } = useAuth();
  const items = useCart((s) => s.items);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const client = useQueryClient();
  async function logout() {
    try {
      await api.post("/auth/logout");
    } finally {
      client.clear();
      clear();
      useCart.getState().clear();
      navigate("/");
    }
  }
  useEffect(() => {
    if (!user) return;
    api.get("/auth/me").catch(() => {});
    let pending = Promise.resolve();
    return useCart.subscribe((state, previous) => {
      if (state.items !== previous.items)
        pending = pending.then(() =>
          api
            .put("/cart", { items: cartPayload(state.items) })
            .then(() => {})
            .catch(() => {}),
        );
    });
  }, [user?.id]);
  return (
    <>
      <div className="announcement">
        Pha mới mỗi ngày · Gửi bạn một chút an yên
      </div>
      <header>
        <div className="nav-wrap">
          <Logo />
          <nav className={open ? "open" : ""} onClick={() => setOpen(false)}>
            <NavLink to="/" end>
              Trang chủ
            </NavLink>
            <NavLink to="/menu">Thực đơn</NavLink>
            <a href="/#story">Chuyện Zentea</a>
            <a href="#contact">Ghé thăm</a>
          </nav>
          <div className="nav-actions">
            {user ? (
              <>
                <Link to="/orders" className="desktop-link">
                  Đơn của tôi
                </Link>
                <Link
                  to={user.role === "admin" ? "/admin" : "/profile"}
                  aria-label="Tài khoản"
                >
                  <UserRound size={21} />
                </Link>
                <button onClick={logout} aria-label="Đăng xuất">
                  <LogOut size={19} />
                </button>
              </>
            ) : (
              <Link to="/login" aria-label="Đăng nhập">
                <UserRound size={21} />
              </Link>
            )}
            <Link to="/cart" className="cart-link" aria-label="Giỏ hàng">
              <ShoppingCart size={22} />
              <span>{items.reduce((n, i) => n + i.quantity, 0)}</span>
            </Link>
            <button
              className="mobile-toggle"
              onClick={() => setOpen(!open)}
              aria-label="Mở menu"
            >
              {open ? <X /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </header>
      <main>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <footer id="contact">
        <div className="footer-grid">
          <div>
            <Logo />
            <p>
              Một chút trà, một chút an yên.
              <br />
              Dành thời gian cho những điều dịu dàng.
            </p>
            <div className="footer-social">
              <a
                href={
                  "https://www.facebook.com/sharer/sharer.php?u=" +
                  encodeURIComponent(window.location.origin)
                }
                target="_blank"
                rel="noreferrer"
              >
                Chia sẻ Facebook
              </a>
              <a
                href={
                  "https://zalo.me/share?url=" +
                  encodeURIComponent(window.location.origin)
                }
                target="_blank"
                rel="noreferrer"
              >
                Chia sẻ Zalo
              </a>
            </div>
          </div>
          <div>
            <h3>Ghé Zentea</h3>
            <p>
              <MapPin size={16} /> TP. Hồ Chí Minh
            </p>
            <p>
              <Phone size={16} /> 090 123 4567
            </p>
            <p>
              <Mail size={16} /> zentea@gmail.com
            </p>
          </div>
          <iframe
            title="Bản đồ khu vực TP. Hồ Chí Minh"
            src="https://maps.google.com/maps?q=Ho%20Chi%20Minh%20City&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Zentea · Tea & Coffee</span>
          <span>
            <Leaf size={14} /> Chậm lại, thưởng trà.
          </span>
        </div>
      </footer>
      <ChatWidget />
    </>
  );
}
export default function App() {
  useScrollMemory();
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="products/:id" element={<ProductPage />} />
        <Route path="login" element={<AuthPage />} />
        <Route path="register" element={<AuthPage mode="register" />} />
        <Route path="forgot-password" element={<AuthPage mode="forgot" />} />
        <Route path="reset-password" element={<AuthPage mode="reset" />} />
        <Route path="cart" element={<Cart />} />
        <Route element={<Guard />}>
          <Route path="checkout" element={<Checkout />} />
          <Route path="orders" element={<MyOrders />} />
          <Route path="orders/:id" element={<MyOrders />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>
      <Route element={<Guard admin />}>
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="vouchers" element={<AdminVouchers />} />
          <Route path="toppings" element={<AdminToppings />} />
          <Route path="ingredients" element={<AdminIngredients />} />
        </Route>
      </Route>
      <Route
        path="*"
        element={
          <div className="empty">
            <h1>Trang này chưa có</h1>
            <Link to="/">Về trang chủ</Link>
          </div>
        }
      />
    </Routes>
  );
}
