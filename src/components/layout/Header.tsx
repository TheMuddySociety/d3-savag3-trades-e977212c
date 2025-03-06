
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Moon, Sun, Wallet } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";

export function Header() {
  const { theme, setTheme } = useTheme();
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  const handleConnect = () => {
    setIsConnected(true);
    toast({
      title: "Wallet Connected",
      description: "Your wallet has been successfully connected",
    });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-effect">
      <div className="container flex items-center justify-between h-16 px-4 mx-auto">
        <div className="flex items-center space-x-2">
          <img 
            src="/lovable-uploads/bb8128a0-c9a0-4849-8520-af85d4a40e33.png" 
            alt="Memebot Profit Finder" 
            className="w-10 h-10 animate-float"
          />
          <span className="text-xl font-bold bg-clip-text text-transparent bg-memecoin-gradient animate-gradient-shift">
            MemeBot Profit Finder
          </span>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-full"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5 text-yellow-400" />
            ) : (
              <Moon className="h-5 w-5 text-slate-700" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
          
          {!isConnected ? (
            <Button 
              onClick={handleConnect}
              className="bg-solana hover:bg-solana-dark text-primary-foreground flex items-center gap-2 rounded-full"
            >
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </Button>
          ) : (
            <Avatar className="border-2 border-solana animate-pulse-glow">
              <AvatarImage src="https://source.boringavatars.com/beam/40/user?colors=14F195,0ca36c,4ffab5" />
              <AvatarFallback className="bg-memecoin-dark text-solana">
                ME
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </header>
  );
}
