import { Link } from "react-router-dom";

export function NavLogo() {
  return (
    <Link to="/" className="flex items-center gap-2 group">
      <div className="relative h-8 w-8 rounded-lg bg-foreground flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform duration-200 border border-accent/30">
        <img 
          src="/dan-logo.jpg" 
          alt="SAVAG3BOT" 
          className="h-6 w-6 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <div className="absolute inset-0 border border-accent/20 rounded-lg pointer-events-none"></div>
      </div>
      <span className="hidden font-bold sm:inline-block text-xl tracking-tighter text-foreground group-hover:text-accent transition-colors">
        SAVAG3<span className="text-accent">BOT</span>
      </span>
    </Link>
  );
}
