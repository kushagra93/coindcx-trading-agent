import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTradingData } from '../context/TradingDataContext';
import { HotNowCarousel } from '../components/HotNowCarousel';
import { TokenCard } from '../components/TokenCard';
import { tokens } from '../../styles/theme';
import { mobile } from '../styles/mobile';
import { screenToken } from '../services/blockchain';

export function MarketsScreen() {
  const { allTokens } = useTradingData();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  // Categorize tokens
  const hotNow = useMemo(
    () => allTokens
      .filter(t => t.ctScore > 65 || t.priceChange24h > 15)
      .sort((a, b) => b.ctScore - a.ctScore)
      .slice(0, 8),
    [allTokens]
  );

  const newListings = useMemo(
    () => allTokens
      .filter(t => t.ageMinutes < 43200) // < 30 days
      .sort((a, b) => a.ageMinutes - b.ageMinutes)
      .slice(0, 6),
    [allTokens]
  );

  const topGainers = useMemo(
    () => allTokens
      .filter(t => t.priceChange24h > 0)
      .sort((a, b) => b.priceChange24h - a.priceChange24h)
      .slice(0, 6),
    [allTokens]
  );

  const filteredTokens = useMemo(() => {
    if (!searchQuery) return allTokens.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return allTokens.filter(t =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.chain.toLowerCase().includes(q)
    );
  }, [allTokens, searchQuery]);

  return (
    <div style={{ overflow: 'auto', height: '100%', scrollbarWidth: 'none' }}>
      <div style={{ padding: `0 ${mobile.screenPadding}px`, paddingBottom: 16 }}>
        {/* Header */}
        <div style={{ fontSize: 20, fontWeight: 700, color: tokens.colors.text, padding: '4px 0 12px' }}>
          Markets
        </div>

        {/* Search bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: tokens.radii.md,
          background: tokens.colors.bgInput,
          border: `1px solid ${tokens.colors.border}`,
          marginBottom: 16,
        }}>
          <Search size={16} color={tokens.colors.textMuted} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tokens, chains..."
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: tokens.colors.text,
              fontSize: 13,
            }}
          />
        </div>

        {/* Hot Now */}
        {!searchQuery && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: tokens.colors.text, marginBottom: 8 }}>
              Hot Now
            </div>
            <div style={{ marginBottom: 20 }}>
              <HotNowCarousel tokens={hotNow} />
            </div>

            {/* New Listings */}
            {newListings.length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: tokens.colors.text, marginBottom: 8 }}>
                  New Listings
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
                  {newListings.map(t => (
                    <TokenCard key={t.symbol} token={t} grade={screenToken(t.symbol).grade} />
                  ))}
                </div>
              </>
            )}

            {/* Top Gainers */}
            <div style={{ fontSize: 13, fontWeight: 600, color: tokens.colors.text, marginBottom: 8 }}>
              Top Gainers (24h)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              {topGainers.map(t => (
                <TokenCard key={t.symbol} token={t} grade={screenToken(t.symbol).grade} />
              ))}
            </div>
          </>
        )}

        {/* All tokens / Search results */}
        <div style={{ fontSize: 13, fontWeight: 600, color: tokens.colors.text, marginBottom: 8 }}>
          {searchQuery ? `Results for "${searchQuery}"` : 'All Tokens'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filteredTokens.map(t => (
            <TokenCard key={t.symbol} token={t} grade={screenToken(t.symbol).grade} />
          ))}
          {filteredTokens.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: tokens.colors.textMuted, fontSize: 13 }}>
              No tokens found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
