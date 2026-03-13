import { ArrowLeftRight, BarChart3, Bot, Bell, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileTab = 'trade' | 'tokens' | 'bots' | 'alerts' | 'chat';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

const tabs = [
  { id: 'trade' as MobileTab, label: 'Trade', icon: ArrowLeftRight },
  { id: 'tokens' as MobileTab, label: 'Tokens', icon: BarChart3 },
  { id: 'bots' as MobileTab, label: 'Bots', icon: Bot },
  { id: 'alerts' as MobileTab, label: 'Alerts', icon: Bell },
  { id: 'chat' as MobileTab, label: 'AI Chat', icon: MessageSquare },
];

export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all min-w-[56px]",
              activeTab === tab.id
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <tab.icon className={cn(
              "h-5 w-5 transition-all",
              activeTab === tab.id && "scale-110"
            )} />
            <span className={cn(
              "text-[10px] font-medium",
              activeTab === tab.id && "font-semibold"
            )}>
              {tab.label}
            </span>
            {activeTab === tab.id && (
              <div className="absolute bottom-1 w-8 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
