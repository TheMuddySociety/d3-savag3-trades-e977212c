
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center glass-card p-8 max-w-md">
        <h1 className="text-6xl font-bold mb-4 bg-clip-text text-transparent bg-memecoin-gradient animate-gradient-shift">404</h1>
        <p className="text-xl text-foreground mb-6">Sorry, we couldn't find the page you were looking for.</p>
        <Button className="bg-solana hover:bg-solana-dark text-primary-foreground" asChild>
          <a href="/" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Return to Dashboard
          </a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
