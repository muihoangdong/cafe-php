import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createEcho } from "./lib/echo";
import { useAuth } from "./lib/store";
import { statusLabel } from "./lib/api";
import type { Order } from "./types";
const LiveContext = createContext({
  staffCount: 0,
  connected: false,
  sound: false,
  toggleSound: () => {},
});
export const useLive = () => useContext(LiveContext);
let audio: AudioContext | undefined;
function beep() {
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.frequency.value = 740;
  gain.gain.setValueAtTime(0.12, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.35);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.35);
}
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const client = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [sound, setSound] = useState(false);
  const [staffCount, setStaffCount] = useState(0);
  const seen = useRef(new Set<string>());
  useEffect(() => {
    if (!user || !token) return;
    const echo = createEcho(token);
    const connection = echo.connector.pusher.connection;
    connection.bind("connected", () => {
      setConnected(true);
      void client.invalidateQueries();
    });
    connection.bind("disconnected", () => setConnected(false));
    connection.bind("unavailable", () => setConnected(false));
    const invalidate = () => {
      void client.invalidateQueries({ queryKey: ["orders"] });
      void client.invalidateQueries({ queryKey: ["admin"] });
    };
    const orderEvent = (
      event: { order: Order; event_id?: string },
      fresh = false,
    ) => {
      if (event.event_id && seen.current.has(event.event_id)) return;
      if (event.event_id) seen.current.add(event.event_id);
      if (seen.current.size > 500)
        seen.current.delete(seen.current.values().next().value!);
      invalidate();
      toast(
        fresh
          ? "Đơn hàng mới #" + event.order.code
          : "Đơn #" +
              event.order.code +
              " · " +
              statusLabel[event.order.status],
      );
      if (fresh && sound) beep();
    };
    if (user.role === "admin") {
      const staff = new Set<number>();
      echo
        .join("store.staff")
        .here((users: { id: number }[]) => {
          users.forEach((u) => staff.add(u.id));
          setStaffCount(staff.size);
        })
        .joining((u: { id: number }) => {
          staff.add(u.id);
          setStaffCount(staff.size);
        })
        .leaving((u: { id: number }) => {
          staff.delete(u.id);
          setStaffCount(staff.size);
        });
      echo
        .private("admin.orders")
        .listen(".NewOrderPlaced", (e: { order: Order }) => orderEvent(e, true))
        .listen(".OrderStatusUpdated", orderEvent);
      echo.private("admin.reviews").listen(".NewReviewSubmitted", () => {
        toast("Có đánh giá mới cần duyệt");
        void client.invalidateQueries({ queryKey: ["admin"] });
      });
      echo.private("admin.customers").listen(".NewCustomerRegistered", () => {
        void client.invalidateQueries({ queryKey: ["admin"] });
      });
      echo.private("admin.stats").listen(".StatisticsUpdated", () => {
        void client.invalidateQueries({ queryKey: ["admin"] });
      });
    } else
      echo
        .private("user." + user.id)
        .listen(".NewOrderPlaced", (e: { order: Order }) => orderEvent(e, true))
        .listen(".OrderStatusUpdated", orderEvent);
    return () => {
      echo.disconnect();
      setConnected(false);
      setStaffCount(0);
    };
  }, [user?.id, user?.role, token, client, sound]);
  function toggleSound() {
    audio ||= new AudioContext();
    void audio.resume();
    setSound(!sound);
  }
  return (
    <LiveContext.Provider value={{ connected, sound, toggleSound, staffCount }}>
      {children}
    </LiveContext.Provider>
  );
}
export function useProductRealtime(id: string | undefined) {
  const client = useQueryClient();
  useEffect(() => {
    if (!id) return;
    const echo = createEcho(null);
    echo.channel("product." + id).listen(".ReviewApproved", () => {
      void client.invalidateQueries({ queryKey: ["product", id] });
    });
    return () => {
      echo.leave("product." + id);
      echo.disconnect();
    };
  }, [id, client]);
}
