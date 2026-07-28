
  import { createRoot } from "react-dom/client";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { BrowserRouter } from "react-router-dom";
  import App from "./App.tsx";
  import "./styles/index.css";

  const queryClient = new QueryClient();

  createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  );

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
    // A tab that was already open keeps running its old in-memory JS bundle
    // even after a new service worker activates in the background — reload
    // once so an already-open tab always picks up the deployed fix instead
    // of silently running stale code indefinitely.
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }
