import { Outlet } from 'react-router-dom';
import { mobile, colors } from '../styles/mobile';

export function MobileLayout() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: colors.bg,
      paddingTop: mobile.safeTop,
    }}>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </div>
    </div>
  );
}
