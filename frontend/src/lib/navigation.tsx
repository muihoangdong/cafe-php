import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const STORE = "zentea-scroll";
const positions: Record<string, number> = (() => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) || "{}");
    // Mục lịch sử đầu tiên sau mỗi lần tải trang luôn có khóa "default". Chỉ giữ vị trí của nó khi tải lại
    // hoặc bấm Back/Forward vào trang; mở trang mới (gõ địa chỉ, bấm link thường) thì bắt đầu từ đầu.
    const entry = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    if (entry?.type !== "reload" && entry?.type !== "back_forward")
      delete saved.default;
    return saved;
  } catch {
    return {};
  }
})();

/**
 * Giữ vị trí cuộn theo từng mục lịch sử: bấm Back/Forward (hoặc tải lại trang) thì về đúng chỗ đang xem,
 * mở trang mới thì cuộn lên đầu. Dữ liệu tải bất đồng bộ nên thử lại tới khi trang đủ dài.
 */
export function useScrollMemory() {
  const location = useLocation();
  const type = useNavigationType();

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  }, []);

  useEffect(() => {
    let frame = 0;
    const save = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        positions[location.key] = Math.round(window.scrollY);
        sessionStorage.setItem(STORE, JSON.stringify(positions));
      });
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      window.removeEventListener("scroll", save);
      cancelAnimationFrame(frame);
    };
  }, [location.key]);

  useLayoutEffect(() => {
    if (type === "REPLACE") return;
    const anchor = location.hash ? location.hash.slice(1) : "";
    // Link có #mục thì ưu tiên cuộn tới mục đó.
    const target =
      type === "POP" && !anchor ? positions[location.key] : undefined;
    if (target === undefined && !anchor) {
      window.scrollTo(0, 0);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const stop = () => cancelAnimationFrame(frame);
    // Người dùng tự cuộn thì thôi, không kéo trang về vị trí cũ nữa.
    const events = ["wheel", "touchstart", "keydown", "mousedown"];
    events.forEach((e) => window.addEventListener(e, stop, { once: true }));
    const tick = () => {
      let ready: boolean;
      if (target !== undefined) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, Math.min(target, Math.max(0, max)));
        ready = max >= target;
      } else {
        const element = document.getElementById(anchor);
        element?.scrollIntoView();
        ready = !!element;
      }
      if (!ready && performance.now() - started < 2000)
        frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      stop();
      events.forEach((e) => window.removeEventListener(e, stop));
    };
  }, [location.key]);
}

/** Hiệu ứng hiện dần khi đổi trang. */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
}
