// ─── Dashboard Barrel Exports ───────────────────────────────────
// Re-exports all dashboard components from their feature directories
// for cleaner imports: import { X } from '@/components/dashboard'

// Portfolio
export { PortfolioTracker } from './portfolio/PortfolioTracker';
export { MiniChart } from './portfolio/MiniChart';

// Market
export { TopMemecoins } from './market/TopMemecoins';
export { TrendingCoins } from './market/TrendingCoins';
export { MemeScanner } from './market/MemeScanner';
export { Leaderboard } from './market/Leaderboard';
export { LiveSignalFeed } from './market/LiveSignalFeed';

// Alerts
export { PriceAlerts } from './alerts/PriceAlerts';
export { CreateAlertDialog } from './alerts/CreateAlertDialog';

// Analytics
export { BlockchainAnalytics } from './analytics/BlockchainAnalytics';
export { PerformanceMetrics } from './analytics/PerformanceMetrics';
export { ProfitSimulator } from './analytics/ProfitSimulator';

// Core (remain at dashboard root)
export { BotAccess } from './BotAccess';
export { AIToolsAgents } from './AIToolsAgents';
export { JupiterAIChat } from './JupiterAIChat';
export { ConnectionStatus } from './ConnectionStatus';
export { TokenDetailModal } from './TokenDetailModal';
export { TokenSafetyCard } from './TokenSafetyCard';
export { SettingsDialog } from './SettingsDialog';
