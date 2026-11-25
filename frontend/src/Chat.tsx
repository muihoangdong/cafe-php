import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useLocation } from "react-router-dom";
import {
  MessageCircle,
  Send,
  X,
  Sparkles,
  Plus,
  History,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { api, message, money } from "./lib/api";
import { useCart, normalizeItem, useAuth } from "./lib/store";
import { ChatError, streamChat } from "./lib/chat";
import type {
  ChatConversation,
  ChatMessage,
  ChatTranscript,
  Product,
} from "./types";

const greeting: ChatMessage = {
  role: "model",
  text: "Chào bạn, mình là trợ lý Zentea. Hôm nay bạn muốn uống gì? Mát lạnh, ít ngọt hay đậm vị cà phê?",
};
const ideas = [
  "Trời nóng nên uống gì?",
  "Món ít ngọt dưới 45.000đ",
  "Cần tỉnh táo để học bài",
  "Có mã giảm giá nào không?",
];
/** Mã hội thoại hiện tại. Nội dung nằm ở server nên mở lại trang, hay đăng nhập máy khác, vẫn thấy. */
const STORAGE = "zentea-chat-id";

function Suggestion({ product }: { product: Product }) {
  const add = useCart((s) => s.add);
  const variant =
    product.variants.find((v) => v.size === "M") || product.variants[0];
  return (
    <div className="chat-product">
      <img src={product.image} alt={product.name} loading="lazy" />
      <div>
        <Link to={"/products/" + product.id}>{product.name}</Link>
        <small>
          {variant
            ? "Size " + variant.size + " · " + money(variant.price)
            : "Tạm hết"}
        </small>
      </div>
      <button
        aria-label={"Thêm " + product.name + " vào giỏ"}
        disabled={!variant}
        onClick={() => {
          if (!variant) return;
          add(
            normalizeItem({
              variant_id: variant.id,
              product_id: product.id,
              name: product.name,
              size: variant.size,
              price: variant.price,
              quantity: 1,
              image: product.image,
            }),
          );
          toast.success("Đã thêm " + product.name + " vào giỏ");
        }}
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

export function ChatWidget() {
  const userId = useAuth((s) => s.user?.id ?? null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [history, setHistory] = useState<ChatConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const list = useRef<HTMLDivElement>(null);
  const loadedFor = useRef<string | null>(null);
  const previousUser = useRef(userId);
  const { pathname } = useLocation();

  const remember = useCallback((id: string | null) => {
    setConversationId(id);
    if (id) localStorage.setItem(STORAGE, id);
    else localStorage.removeItem(STORAGE);
  }, []);
  const reset = useCallback(() => {
    remember(null);
    setMessages([greeting]);
    setView("chat");
  }, [remember]);

  const openConversation = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const { data } = await api.get<ChatTranscript>(
          "/chat/conversations/" + id,
        );
        remember(data.conversation_id);
        setMessages([greeting, ...data.messages]);
        setView("chat");
        return true;
      } catch {
        return false;
      } finally {
        setLoading(false);
      }
    },
    [remember],
  );

  // Đăng xuất: không để người dùng sau trên cùng máy đọc được hội thoại của tài khoản trước.
  useEffect(() => {
    if (previousUser.current && !userId) {
      reset();
      setHistory([]);
    }
    if (previousUser.current !== userId) loadedFor.current = null;
    previousUser.current = userId;
  }, [userId, reset]);

  // Mở khung chat lần đầu (hoặc vừa đăng nhập): tải hội thoại đang dở, khách đăng nhập thì lấy hội thoại gần nhất.
  useEffect(() => {
    if (!open) return;
    const key = String(userId);
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    void (async () => {
      const saved = localStorage.getItem(STORAGE);
      if (saved && (await openConversation(saved))) return;
      if (saved) reset();
      if (!userId) return;
      const { data } = await api
        .get<ChatConversation[]>("/chat/conversations")
        .catch(() => ({ data: [] as ChatConversation[] }));
      if (data[0]) await openConversation(data[0].uuid);
    })();
  }, [open, userId, openConversation, reset]);

  useEffect(() => {
    list.current?.scrollTo({
      top: list.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, open, view]);

  // Không che nút thanh toán trên trang đặt hàng.
  if (pathname.startsWith("/checkout")) return null;

  async function showHistory() {
    setView("history");
    try {
      setHistory(
        (await api.get<ChatConversation[]>("/chat/conversations")).data,
      );
    } catch (e) {
      toast.error(message(e));
    }
  }

  function updateLast(change: (m: ChatMessage) => ChatMessage) {
    setMessages((all) => [...all.slice(0, -1), change(all[all.length - 1])]);
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setMessages((m) => [
      ...m,
      { role: "user", text: q },
      { role: "model", text: "" },
    ]);
    setText("");
    setBusy(true);
    const send = (id: string | null) =>
      streamChat(
        { conversation_id: id, message: q.slice(0, 1000) },
        {
          onStart: remember,
          onDelta: (delta) =>
            updateLast((m) => ({ ...m, text: m.text + delta })),
        },
      );
    try {
      let result;
      try {
        result = await send(conversationId);
      } catch (e) {
        // Hội thoại không còn mở được (ví dụ vừa đăng xuất): bắt đầu hội thoại mới với cùng câu hỏi.
        if (!(e instanceof ChatError && e.status === 404) || !conversationId)
          throw e;
        remember(null);
        updateLast((m) => ({ ...m, text: "" }));
        result = await send(null);
      }
      remember(result.conversation_id);
      updateLast(() => result.message);
    } catch (e) {
      updateLast(() => ({
        role: "model",
        text:
          "Xin lỗi, mình chưa trả lời được. " +
          (e instanceof ChatError ? e.message : message(e)),
      }));
    } finally {
      setBusy(false);
    }
  }

  const last = messages[messages.length - 1];
  return (
    <>
      <button
        className="chat-fab"
        aria-label={open ? "Đóng trợ lý" : "Mở trợ lý gợi ý món"}
        onClick={() => setOpen(!open)}
      >
        {open ? <X /> : <MessageCircle />}
      </button>
      {open && (
        <section className="chat-panel" aria-label="Trợ lý gợi ý món Zentea">
          <header>
            {view === "history" ? (
              <button
                className="chat-icon"
                aria-label="Quay lại hội thoại"
                onClick={() => setView("chat")}
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <Sparkles size={18} />
            )}
            <div>
              <strong>
                {view === "history" ? "Hội thoại trước" : "Trợ lý Zentea"}
              </strong>
              {view === "chat" && userId && (
                <small>Gợi ý theo món bạn hay gọi</small>
              )}
            </div>
            {userId && view === "chat" && (
              <button
                className="chat-icon"
                aria-label="Xem hội thoại trước"
                onClick={showHistory}
                disabled={busy}
              >
                <History size={18} />
              </button>
            )}
            <button className="chat-reset" onClick={reset} disabled={busy}>
              Cuộc mới
            </button>
          </header>
          {view === "history" ? (
            <div className="chat-list">
              {history.length === 0 && (
                <p className="chat-empty">Chưa có hội thoại nào.</p>
              )}
              {history.map((c) => (
                <button
                  key={c.uuid}
                  className={
                    "chat-thread" + (c.uuid === conversationId ? " active" : "")
                  }
                  onClick={() => void openConversation(c.uuid)}
                >
                  <strong>{c.title || "Hội thoại"}</strong>
                  <small>
                    {when(c.last_message_at)} · {c.messages_count} tin
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <div className="chat-list" ref={list} aria-live="polite">
              {loading && <p className="typing">Đang tải hội thoại…</p>}
              {messages.map((m, i) =>
                m.text ? (
                  <div
                    key={m.id ?? "local-" + i}
                    className={"chat-msg " + m.role}
                  >
                    <p>{m.text}</p>
                    {m.products?.map((p) => (
                      <Suggestion key={p.id} product={p} />
                    ))}
                  </div>
                ) : null,
              )}
              {busy && last?.role === "model" && !last.text && (
                <div className="chat-msg model">
                  <p className="typing">Đang nghĩ món cho bạn…</p>
                </div>
              )}
              {messages.length === 1 && !loading && (
                <div className="chat-ideas">
                  {ideas.map((idea) => (
                    <button key={idea} onClick={() => ask(idea)}>
                      {idea}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void ask(text);
            }}
          >
            <input
              aria-label="Nhập câu hỏi"
              placeholder="Bạn thích vị gì?"
              value={text}
              maxLength={1000}
              onFocus={() => setView("chat")}
              onChange={(e) => setText(e.target.value)}
            />
            <button aria-label="Gửi" disabled={busy || !text.trim()}>
              <Send size={18} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
