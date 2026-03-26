
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import { TradingModeProvider } from "@/hooks/useTradingMode";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NetworkProvider } from "@/providers/NetworkProvider";
// Jupiter Unified Wallet Kit configuration consolidated within NetworkProvider

const Landing = lazy(() => import("./pages/Landing"));
const Index = lazy(() => import("./pages/Index"));
const Admin = lazy(() => import("./pages/Admin"));
const TokenDetail = lazy(() => import("./pages/TokenDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Helius RPC proxied through edge function — API key never reaches client
const RPC_PROXY = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rpc-proxy`;

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
          <NetworkProvider>
            <TradingModeProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <ErrorBoundary>
                <BrowserRouter>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Landing />} />
                      <Route path="/dashboard" element={<Index />} />
                      <Route path="/token/:address" element={<TokenDetail />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </BrowserRouter>
              </ErrorBoundary>
            </TooltipProvider>
            </TradingModeProvider>
          </NetworkProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
