
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import { TradingModeProvider } from "@/hooks/useTradingMode";
import { JupiverseKitProvider } from "jupiverse-kit";
import "jupiverse-kit/dist/index.css";

import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import TokenDetail from "./pages/TokenDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Use Helius RPC for better performance (public key is fine client-side)
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=9d3be76b-1741-43d2-a8f9-3880668415ad";

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <JupiverseKitProvider
          endpoint={HELIUS_RPC}
          autoConnect={true}
          lang="en"
          env="mainnet-beta"
          theme="dark"
          walletConnectProjectId="336bea3a7584798217797f3b46943ac5"
          metadata={{
            name: "SAVAG3BOT",
            description: "Solana Memecoin Trading Terminal",
            url: "https://memebot-profit-finder.lovable.app",
            iconUrls: ["https://memebot-profit-finder.lovable.app/savag3bot-logo.png"],
          }}
        >
          <TradingModeProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/dashboard" element={<Index />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </TradingModeProvider>
        </JupiverseKitProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
