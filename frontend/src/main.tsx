import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { RealtimeProvider } from "./Realtime";
import App from "./App";
import "./style.css";
const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15000 } },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <RealtimeProvider>
          <App />
          <Toaster richColors position="top-right" />
        </RealtimeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
