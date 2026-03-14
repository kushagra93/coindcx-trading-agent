import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { TradingDataProvider } from './context/TradingDataContext';
import { PhoneFrame } from './layouts/PhoneFrame';
import { MobileLayout } from './layouts/MobileLayout';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { AgentScreen } from './screens/AgentScreen';
import { AgentChatScreen } from './screens/AgentChatScreen';
import { PortfolioScreen } from './screens/PortfolioScreen';
import { MarketsScreen } from './screens/MarketsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { TradeExplanationScreen } from './screens/TradeExplanationScreen';
import { CopyTraderDetailScreen } from './screens/CopyTraderDetailScreen';

function AppInner() {
  const { isOnboarded } = useApp();

  return (
    <Routes>
      <Route index element={<Navigate to={isOnboarded ? 'agent' : 'onboarding'} replace />} />
      <Route path="onboarding" element={<OnboardingScreen />} />
      <Route element={<MobileLayout />}>
        <Route path="portfolio" element={<PortfolioScreen />} />
        <Route path="agent" element={<AgentScreen />} />
        <Route path="agent/chat" element={<AgentChatScreen />} />
        <Route path="markets" element={<MarketsScreen />} />
        <Route path="profile" element={<ProfileScreen />} />
        <Route path="explore/trader/:traderId" element={<CopyTraderDetailScreen />} />
        <Route path="activity/:tradeId" element={<TradeExplanationScreen />} />
      </Route>
      <Route path="home" element={<Navigate to="/app/agent" replace />} />
    </Routes>
  );
}

export function AppRoutes() {
  return (
    <TradingDataProvider>
      <AppProvider>
        <PhoneFrame>
          <AppInner />
        </PhoneFrame>
      </AppProvider>
    </TradingDataProvider>
  );
}
