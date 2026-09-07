
  import { createRoot } from "react-dom/client";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { BrowserRouter } from "react-router-dom";
  import React, { Component, ErrorInfo, ReactNode } from "react";
  import App from "./App.tsx";
  import "./styles/index.css";
  import { Capacitor } from "@capacitor/core";

  // Global polyfill/guard to prevent "TypeError: Illegal constructor" for Web Notifications in Android WebViews
  if (typeof window !== 'undefined' && Capacitor.getPlatform() === 'android') {
    const win = window as any;
    if (win.Notification && typeof win.Notification !== 'function') {
      console.warn("Fixing non-constructor window.Notification in Android WebView");
      win.Notification = undefined;
    }
  }

  class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
    constructor(props: { children: ReactNode }) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
      console.error("App Crash Error:", error);
      console.error("Error Info:", errorInfo);
    }

    render() {
      if (this.state.hasError) {
        return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-[#0E1117] text-white p-6 text-center">
            <h1 className="text-2xl font-bold mb-4">Nimadir xato ketdi</h1>
            <p className="text-gray-400 mb-6">Ilovani yuklashda xatolik yuz berdi. Iltimos, keshni tozalab qaytadan urinib ko'ring.</p>

            <div className="w-full max-w-md text-left mb-6">
              <p className="text-red-400 text-[10px] font-mono p-4 bg-black/40 rounded-xl overflow-auto max-h-64 whitespace-pre-wrap border border-red-500/20">
                {this.state.error?.toString()}
                {"\n\n"}
                {this.state.error?.stack}
              </p>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-[#4ADE80] text-black font-bold rounded-xl active:scale-95 transition-transform"
            >
              Qayta yuklash
            </button>
          </div>
        );
      }
      return this.props.children;
    }
  }

  import { UserProvider } from "./store/UserContext.tsx";
  import { ThemeProvider } from "./store/ThemeContext.tsx";

  const queryClient = new QueryClient();

  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <UserProvider>
          <ThemeProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ThemeProvider>
        </UserProvider>
      </QueryClientProvider>
    </ErrorBoundary>
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
