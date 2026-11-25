import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { api } from "./api";
export function createEcho(token: string | null) {
  return new Echo({
    broadcaster: "reverb",
    client: new Pusher(import.meta.env.VITE_REVERB_APP_KEY || "zentea-key", {
      wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
      wsPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
      wssPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
      forceTLS: import.meta.env.VITE_REVERB_SCHEME === "https",
      enabledTransports: ["ws", "wss"],
      cluster: "mt1",
      channelAuthorization: {
        endpoint: "/broadcasting/auth",
        transport: "ajax",
        headers: { Authorization: "Bearer " + token },
      },
    }),
  });
}
export { api };
