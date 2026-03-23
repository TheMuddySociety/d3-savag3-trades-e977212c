import { ArrowLeftRight, BarChart3, Bot, Bell, MessageSquare, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileTab = 'trade' | 'tokens' | 'bots' | 'alerts' | 'chat';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

const tabs = [
  { id: 'trade' as MobileTab, label: 'Trade', icon: ArrowLeftRight },
  { id: 'tokens' as MobileTab, label: 'Tokens', icon: BarChart3 },
  { id: 'bots' as MobileTab, label: 'Agent', icon: Flame },
  { id: 'alerts' as MobileTab, label: 'Alerts', icon: Bell },
  { id: 'chat' as MobileTab, label: 'AI Chat', icon: MessageSquare },
];

export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/50 safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all min-w-[48px]",
              activeTab === tab.id
                ? "text-accent"
                : "text-muted-foreground"
            )}
          >
            {activeTab === tab.id && (
              <div className="absolute top-0 w-6 h-0.5 rounded-full bg-accent shadow-[0_0_6px_hsl(var(--accent)/0.5)]" />
            )}
            <tab.icon className={cn(
              "h-4 w-4 transition-all",
              activeTab === tab.id && "scale-110"
            )} />
            <span className={cn(
              "text-[9px] font-medium",
              activeTab === tab.id && "font-semibold"
            )}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
