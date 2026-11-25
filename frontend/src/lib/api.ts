import axios from "axios";
import { useAuth } from "./store";
export const api = axios.create({
  baseURL: "/api",
  headers: { Accept: "application/json" },
});
api.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});
let refreshing: Promise<string> | null = null;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (
      error.response?.status !== 401 ||
      config?._retry ||
      !useAuth.getState().user
    )
      return Promise.reject(error);
    config._retry = true;
    try {
      refreshing ||= axios
        .post(
          "/api/auth/refresh",
          {},
          { headers: { "X-Zentea-Client": "web", Accept: "application/json" } },
        )
        .then(({ data }) => {
          useAuth.getState().set(data.user, data.token);
          return data.token;
        })
        .finally(() => {
          refreshing = null;
        });
      const token = await refreshing;
      config.headers.Authorization = "Bearer " + token;
      return api.request(config);
    } catch (refreshError) {
      useAuth.getState().clear();
      return Promise.reject(refreshError);
    }
  },
);
export function message(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    return (
      Object.values(data?.errors || {})
        .flat()
        .join(" ") ||
      data?.message ||
      "Không thể kết nối máy chủ."
    );
  }
  return "Đã xảy ra lỗi. Vui lòng thử lại.";
}
export const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value,
  );
export const statusLabel: Record<string, string> = {
  pending: "Chờ xác nhận",
  preparing: "Đang pha chế",
  delivering: "Đang giao",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
};
