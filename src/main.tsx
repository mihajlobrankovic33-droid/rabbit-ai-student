import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { registerSW } from "@/services/study/offlineService";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import AuthPage from "@/pages/Auth";
import NotFound from "@/pages/NotFound";
import "@/index.css";

// Register Service Worker for PWA and 100% offline capability
registerSW();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
