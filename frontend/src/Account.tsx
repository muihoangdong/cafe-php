import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { api, message } from "./lib/api";
import { useAuth, useCart, mergeCart, cartPayload } from "./lib/store";
import type { Product, User, CartItem } from "./types";
const schema = z.object({
  email: z.string().email("Nhập email hợp lệ"),
  password: z.string(),
  name: z.string(),
  password_confirmation: z.string(),
});
type Fields = z.infer<typeof schema>;
export function AuthPage({
  mode = "login",
}: {
  mode?: "login" | "register" | "forgot" | "reset";
}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [params] = useSearchParams();
  const [notice, setNotice] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: params.get("email") || "",
      password: "",
      name: "",
      password_confirmation: "",
    },
  });
  async function submit(values: Fields) {
    try {
      if (mode === "forgot" || mode === "reset") {
        const { data } = await api.post(
          "/auth/" + (mode === "forgot" ? "forgot-password" : "reset-password"),
          { ...values, token: params.get("token") },
        );
        setNotice(data.message);
        return;
      }
      const { data } = await api.post<{ user: User; token: string }>(
        "/auth/" + mode,
        values,
      );
      client.clear();
      useAuth.getState().set(data.user, data.token);
      try {
        const remote = (await api.get<{ items: CartItem[] }>("/cart")).data
          .items;
        useCart.getState().replace(mergeCart(useCart.getState().items, remote));
        await api.put("/cart", {
          items: cartPayload(useCart.getState().items),
        });
      } catch {
        toast("Đã đăng nhập. Giỏ hàng trên thiết bị vẫn được giữ.");
      }
      navigate(data.user.role === "admin" ? "/admin" : "/menu");
    } catch (e) {
      toast.error(message(e));
    }
  }
  const titles = {
    login: "Chào bạn trở lại.",
    register: "Bắt đầu chuyện trà.",
    forgot: "Tìm lại tài khoản",
    reset: "Đặt mật khẩu mới",
  };
  return (
    <div className="auth-wrap">
      <div className="auth-art">
        <span>ZENTEA · TEA & COFFEE</span>
        <h2>
          Chậm một nhịp.
          <br />
          Thương mình hơn.
        </h2>
      </div>
      <form className="auth-form" onSubmit={handleSubmit(submit)}>
        <span className="eyebrow">GÓC NHỎ CỦA BẠN</span>
        <h1>{titles[mode]}</h1>
        <p className="muted">Một ly nước ngon đang chờ bạn ở Zentea.</p>
        {notice ? (
          <div className="notice">{notice}</div>
        ) : (
          <>
            {mode === "register" && (
              <label>
                Họ tên
                <input {...register("name")} required />
              </label>
            )}
            <label>
              Email
              <input type="email" {...register("email")} required />
              {errors.email && (
                <small className="error">{errors.email.message}</small>
              )}
            </label>
            {mode !== "forgot" && (
              <label>
                Mật khẩu
                <input
                  type="password"
                  {...register("password")}
                  minLength={8}
                  required
                />
              </label>
            )}
            {(mode === "register" || mode === "reset") && (
              <label>
                Nhập lại mật khẩu
                <input
                  type="password"
                  {...register("password_confirmation")}
                  minLength={8}
                  required
                />
              </label>
            )}
            <button className="btn" disabled={isSubmitting}>
              {isSubmitting
                ? "Đang xử lý…"
                : mode === "login"
                  ? "Đăng nhập"
                  : mode === "register"
                    ? "Tạo tài khoản"
                    : "Gửi yêu cầu"}
            </button>
          </>
        )}
        {mode === "login" ? (
          <>
            <Link to="/forgot-password">Quên mật khẩu?</Link>
            <p>
              Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
            </p>
          </>
        ) : (
          <Link to="/login">Về đăng nhập</Link>
        )}
      </form>
    </div>
  );
}
export function Profile() {
  const { user, set, token } = useAuth();
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget));
      const response = await api.patch<User>("/profile", data);
      set(response.data, token!);
      toast.success("Đã lưu hồ sơ");
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function password(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await api.put(
        "/profile/password",
        Object.fromEntries(new FormData(form)),
      );
      toast.success("Đã đổi mật khẩu");
      form.reset();
    } catch (e) {
      toast.error(message(e));
    }
  }
  return (
    <div className="section narrow">
      <h1>Hồ sơ của tôi</h1>
      <p><Link className="text-link" to="/orders">Xem đơn hàng của tôi</Link></p>
      <form className="panel form-grid" onSubmit={save}>
        <label>
          Họ tên
          <input name="name" defaultValue={user?.name} required />
        </label>
        <label>
          Email
          <input value={user?.email} disabled />
        </label>
        <label>
          Số điện thoại
          <input name="phone" defaultValue={user?.phone} />
        </label>
        <label>
          Địa chỉ
          <textarea name="address" defaultValue={user?.address} />
        </label>
        <button className="btn" disabled={busy}>
          Lưu thay đổi
        </button>
      </form>
      <h2>Đổi mật khẩu</h2>
      <form className="panel form-grid" onSubmit={password}>
        <label>
          Mật khẩu hiện tại
          <input name="current_password" type="password" required />
        </label>
        <label>
          Mật khẩu mới
          <input name="password" type="password" minLength={8} required />
        </label>
        <label>
          Nhập lại mật khẩu
          <input
            name="password_confirmation"
            type="password"
            minLength={8}
            required
          />
        </label>
        <button className="btn">Đổi mật khẩu</button>
      </form>
    </div>
  );
}
