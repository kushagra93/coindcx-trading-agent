import { Outlet } from 'react-router-dom';
import { tokens } from '../../styles/theme';
import { mobile } from '../styles/mobile';
import { TabBar } from '../components/TabBar';

export function MobileLayout() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: tokens.colors.bg,
      paddingTop: mobile.safeTop,
    }}>
      <div style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: mobile.tabBarHeight + mobile.safeBottom,
      }}>
        <Outlet />
      </div>
      <TabBar />
    </div>
  );
}
