import { useState } from 'react';
import { 
  ArrowLeftRight, BarChart3, Bot, Bell, MessageSquare, 
  Activity, ChevronLeft, ChevronRight, LineChart, Wallet,
  Zap, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'react-router-dom';

export type DesktopPanel = 'swap' | 'tokens' | 'bots' | 'alerts' | 'chat' | 'portfolio' | 'signals';

interface DesktopSidebarProps {
  activePanel: DesktopPanel;
  onPanelChange: (panel: DesktopPanel) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  isAdmin?: boolean;
}

const navItems = [
  { id: 'swap' as DesktopPanel, label: 'Swap', icon: ArrowLeftRight, section: 'Trade' },
  { id: 'portfolio' as DesktopPanel, label: 'Portfolio', icon: Wallet, section: 'Trade' },
  { id: 'tokens' as DesktopPanel, label: 'Tokens', icon: BarChart3, section: 'Market' },
  { id: 'signals' as DesktopPanel, label: 'Signals', icon: Zap, section: 'Market' },
  { id: 'bots' as DesktopPanel, label: 'Bot Tools', icon: Bot, section: 'Automation' },
  { id: 'alerts' as DesktopPanel, label: 'Alerts', icon: Bell, section: 'Automation' },
  { id: 'chat' as DesktopPanel, label: 'AI Chat', icon: MessageSquare, section: 'AI' },
];

export function DesktopSidebar({ activePanel, onPanelChange, collapsed, onCollapsedChange, isAdmin }: DesktopSidebarProps) {
  const location = useLocation();
  const sections = [...new Set(navItems.map(i => i.section))];

  return (
    <aside className={cn(
      "fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-background border-r border-accent/10 transition-all duration-300",
      collapsed ? "w-[56px]" : "w-[200px]"
    )}>
      {/* Logo */}
      <div className="h-14 flex items-center gap-2 px-3 border-b border-accent/10 shrink-0">
        <Activity className="h-5 w-5 text-accent shrink-0" />
        {!collapsed && (
          <span className="text-sm font-bold tracking-tight text-foreground whitespace-nowrap group">
            SAVAG3<span className="text-accent">BOT</span>
          </span>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {sections.map((section) => (
          <div key={section}>
            {!collapsed && (
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
                {section}
              </div>
            )}
            <div className="space-y-0.5">
              {navItems.filter(i => i.section === section).map((item) => (
                <button
                  key={item.id}
                  onClick={() => onPanelChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-all",
                    activePanel === item.id
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/5"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Admin + Collapse */}
      <div className="border-t border-border p-2 space-y-1 shrink-0">
        {isAdmin && (
          <Link to="/admin">
            <button className={cn(
              "w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-accent hover:bg-accent/10 transition-all",
              location.pathname === '/admin' && "bg-accent/10 font-medium"
            )}>
              <Shield className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Admin</span>}
            </button>
          </Link>
        )}
        <button
          onClick={() => onCollapsedChange(!collapsed)}
          className="w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
