import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { TradingDataProvider } from './context/TradingDataContext';
import { PhoneFrame } from './layouts/PhoneFrame';
import { MobileLayout } from './layouts/MobileLayout';
import { MainScreen } from './screens/MainScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { TradeExplanationScreen } from './screens/TradeExplanationScreen';
import { CopyTraderDetailScreen } from './screens/CopyTraderDetailScreen';

function AppInner() {
  const { isOnboarded } = useApp();

  return (
    <Routes>
      <Route index element={<Navigate to={isOnboarded ? 'home' : 'onboarding'} replace />} />
      <Route path="onboarding" element={<OnboardingScreen />} />
      <Route element={<MobileLayout />}>
        <Route path="home" element={<MainScreen />} />
        <Route path="explore/trader/:traderId" element={<CopyTraderDetailScreen />} />
        <Route path="activity/:tradeId" element={<TradeExplanationScreen />} />
      </Route>
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
