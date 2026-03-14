import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTradingData } from '../context/TradingDataContext';
import { PortfolioHeader } from '../components/PortfolioHeader';
import { MobileCard } from '../components/MobileCard';
import { TradeEventCard } from '../components/TradeEventCard';
import { tokens } from '../../styles/theme';
import { mobile } from '../styles/mobile';

export function PortfolioScreen() {
  const { holdings, perpHoldings, recentTrades, portfolio, chains } = useTradingData();
  const [chainFilter, setChainFilter] = useState('All');
  const [showTrades, setShowTrades] = useState(false);

  const chainFilters = useMemo(() => ['All', ...chains], [chains]);
  const filtered = chainFilter === 'All' ? holdings : holdings.filter(h => h.chain === chainFilter);
  const perpPnl = portfolio.perpTotalPnl;

  return (
    <div style={{ overflow: 'auto', height: '100%', scrollbarWidth: 'none' }}>
      <div style={{ padding: `0 ${mobile.screenPadding}px`, paddingBottom: 16 }}>
        {/* Portfolio Value */}
        <PortfolioHeader portfolio={portfolio} />

        {/* Chain filter pills */}
        <div style={{
          display: 'flex',
          gap: 5,
          marginBottom: 12,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}>
          {chainFilters.map(c => (
            <button key={c} onClick={() => setChainFilter(c)} style={{
              padding: '5px 12px',
              borderRadius: tokens.radii.pill,
              border: 'none',
              fontSize: 11,
              fontWeight: 500,
              background: chainFilter === c ? tokens.colors.accent : tokens.colors.bgSurface,
              color: chainFilter === c ? '#0a0a0a' : tokens.colors.textSecondary,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: `all ${tokens.transitions.fast}`,
            }}>
              {c}
            </button>
          ))}
        </div>

        {/* Holdings */}
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: tokens.colors.text }}>Holdings</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map(h => (
            <MobileCard key={h.token} style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: tokens.radii.sm,
                    background: tokens.colors.bgInput,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: tokens.colors.textSecondary,
                  }}>
                    {h.token.slice(0, 3)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: tokens.colors.text }}>{h.token}</div>
                    <div style={{ fontSize: 10, color: tokens.colors.textMuted }}>
                      {h.chain}
                      <span style={{
                        marginLeft: 6,
                        padding: '0 4px',
                        borderRadius: 3,
                        background: tokens.colors.bgInput,
                        fontSize: 9,
                        color: tokens.colors.textSecondary,
                      }}>
                        {h.balance}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, fontFamily: tokens.fonts.mono, color: tokens.colors.text }}>
                    {h.usd}
                  </div>
                  <div style={{
                    fontSize: 10,
                    fontFamily: tokens.fonts.mono,
                    color: h.change >= 0 ? tokens.colors.positive : tokens.colors.negative,
                  }}>
                    {h.change >= 0 ? '+' : ''}{h.change}%
                  </div>
                </div>
              </div>
            </MobileCard>
          ))}
        </div>

        {/* Perps positions */}
        {chainFilter === 'All' && perpHoldings.length > 0 && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 16,
              marginBottom: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: tokens.colors.text }}>US Stock Perps</span>
                <span style={{
                  fontSize: 9,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'rgba(167, 139, 250, 0.12)',
                  color: tokens.colors.purple,
                  fontWeight: 600,
                }}>
                  Hyperliquid
                </span>
              </div>
              <div style={{
                fontSize: 11,
                fontFamily: tokens.fonts.mono,
                fontWeight: 600,
                color: perpPnl >= 0 ? tokens.colors.positive : tokens.colors.negative,
              }}>
                {perpPnl >= 0 ? '+' : ''}${Math.abs(Math.round(perpPnl)).toLocaleString()} P&L
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {perpHoldings.map(p => (
                <MobileCard key={p.token} style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: tokens.radii.sm,
                        background: p.side === 'Long' ? tokens.colors.positiveBg : tokens.colors.negativeBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 8,
                        fontWeight: 700,
                        color: p.side === 'Long' ? tokens.colors.positive : tokens.colors.negative,
                      }}>
                        {p.side === 'Long' ? 'LONG' : 'SHRT'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: tokens.colors.text }}>{p.token.replace('-PERP', '')}</div>
                        <div style={{ fontSize: 10, color: tokens.colors.textMuted }}>
                          {p.side} {p.leverage} · Entry {p.entry}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, fontFamily: tokens.fonts.mono, color: tokens.colors.text }}>{p.size}</div>
                      <div style={{
                        fontSize: 10,
                        fontFamily: tokens.fonts.mono,
                        fontWeight: 600,
                        color: p.pnlPct >= 0 ? tokens.colors.positive : tokens.colors.negative,
                      }}>
                        {p.pnl} ({p.pnlPct >= 0 ? '+' : ''}{p.pnlPct}%)
                      </div>
                    </div>
                  </div>
                </MobileCard>
              ))}
            </div>
          </>
        )}

        {/* Recent Trades (collapsible) */}
        <button
          onClick={() => setShowTrades(!showTrades)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginTop: 16,
            marginBottom: 8,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: tokens.colors.text }}>Recent Trades</span>
          {showTrades ? <ChevronUp size={16} color={tokens.colors.textMuted} /> : <ChevronDown size={16} color={tokens.colors.textMuted} />}
        </button>
        {showTrades && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recentTrades.map(t => (
              <TradeEventCard key={t.id} trade={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
