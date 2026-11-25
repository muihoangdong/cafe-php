import { api } from "./api";
import { useAuth } from "./store";
import type { ChatMessage } from "../types";

export class ChatError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface ChatDone {
  conversation_id: string;
  message: ChatMessage;
}

function post(
  body: { conversation_id?: string | null; message: string },
  signal?: AbortSignal,
) {
  const token = useAuth.getState().token;
  return fetch("/api/chat/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
}

/**
 * Gửi câu hỏi và đọc câu trả lời dạng Server-Sent Events.
 * axios không đọc được stream nên dùng fetch; khi token hết hạn thì nhờ axios làm mới token rồi gửi lại một lần.
 */
export async function streamChat(
  body: { conversation_id?: string | null; message: string },
  handlers: { onStart?: (id: string) => void; onDelta: (text: string) => void },
  signal?: AbortSignal,
): Promise<ChatDone> {
  let res = await post(body, signal);
  if (res.status === 401 && useAuth.getState().user) {
    // Gọi một API cần đăng nhập: interceptor của axios sẽ làm mới token (hoặc đăng xuất nếu không làm mới được).
    await api.get("/auth/me").catch(() => undefined);
    res = await post(body, signal);
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    const errors = Object.values(data?.errors || {})
      .flat()
      .join(" ");
    throw new ChatError(
      res.status,
      errors ||
        data?.message ||
        (res.status === 429
          ? "Bạn hỏi nhanh quá, đợi một chút nhé."
          : "Không thể kết nối máy chủ."),
    );
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done: ChatDone | null = null;
  const handle = (raw: string) => {
    let event = "message";
    let data = "";
    for (const line of raw.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) return;
    const payload = JSON.parse(data);
    if (event === "start") handlers.onStart?.(payload.conversation_id);
    else if (event === "delta") handlers.onDelta(payload.text);
    else if (event === "done") done = payload;
  };
  for (;;) {
    const { value, done: finished } = await reader.read();
    buffer += decoder.decode(value, { stream: !finished });
    let match: RegExpExecArray | null;
    while ((match = /\r?\n\r?\n/.exec(buffer))) {
      handle(buffer.slice(0, match.index));
      buffer = buffer.slice(match.index + match[0].length);
    }
    if (finished) break;
  }
  if (buffer.trim()) handle(buffer);
  if (!done) throw new ChatError(0, "Kết nối bị ngắt giữa chừng.");
  return done;
}
