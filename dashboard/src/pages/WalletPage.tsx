import { useState } from 'react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Wallet, ArrowUpRight, ArrowDownLeft, Copy, ExternalLink } from 'lucide-react';

const mockBalances = [
  { chain: 'solana', token: 'SOL', balance: '32.5', valueUsd: 5088.75, address: '7xKQ...j4Pm' },
  { chain: 'solana', token: 'USDC', balance: '2,450.00', valueUsd: 2450, address: '7xKQ...j4Pm' },
  { chain: 'ethereum', token: 'ETH', balance: '1.85', valueUsd: 6382.5, address: '0x3f2...8a1c' },
  { chain: 'ethereum', token: 'USDT', balance: '1,200.00', valueUsd: 1200, address: '0x3f2...8a1c' },
  { chain: 'polygon', token: 'MATIC', balance: '5,250.00', valueUsd: 4462.5, address: '0x3f2...8a1c' },
  { chain: 'hyperliquid', token: 'USDC', balance: '3,000.00', valueUsd: 3000, address: '0x3f2...8a1c' },
];

const totalValue = mockBalances.reduce((s, b) => s + b.valueUsd, 0);

export function WalletPage() {
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const chains = [...new Set(mockBalances.map(b => b.chain))];
  const filtered = selectedChain
    ? mockBalances.filter(b => b.chain === selectedChain)
    : mockBalances;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Wallet</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Manage deposits and withdrawals</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary"><ArrowDownLeft size={14} /> Deposit</Button>
          <Button variant="primary" onClick={() => setShowWithdraw(true)}><ArrowUpRight size={14} /> Withdraw</Button>
        </div>
      </div>

      {/* Total */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Total Balance</div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>${totalValue.toLocaleString()}</div>
          </div>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: 'rgba(59, 130, 246, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Wallet size={28} color="#3b82f6" />
          </div>
        </div>
      </Card>

      {/* Chain Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setSelectedChain(null)}
          style={{
            padding: '6px 14px', borderRadius: 8, border: 'none',
            background: !selectedChain ? '#3b82f6' : '#1e293b',
            color: !selectedChain ? '#fff' : '#94a3b8',
            fontSize: 12, fontWeight: 500,
          }}
        >
          All Chains
        </button>
        {chains.map(c => (
          <button
            key={c}
            onClick={() => setSelectedChain(c)}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: selectedChain === c ? '#3b82f6' : '#1e293b',
              color: selectedChain === c ? '#fff' : '#94a3b8',
              fontSize: 12, fontWeight: 500, textTransform: 'capitalize',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Balances */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((b, i) => (
          <Card key={`${b.chain}-${b.token}-${i}`} hoverable>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: '#1e293b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 12,
                }}>
                  {b.token.slice(0, 3)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{b.token}</div>
                  <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Badge color="blue">{b.chain}</Badge>
                    <span>{b.address}</span>
                    <Copy size={10} style={{ cursor: 'pointer' }} />
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{b.balance} {b.token}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>${b.valueUsd.toLocaleString()}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Withdraw Modal */}
      {showWithdraw && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}
        onClick={() => setShowWithdraw(false)}
        >
          <Card style={{ width: 420, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Withdraw Funds</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Chain</label>
              <select style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9',
              }}>
                {chains.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Token</label>
              <select style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9',
              }}>
                <option>SOL</option><option>ETH</option><option>USDC</option><option>USDT</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Amount</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9',
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 16 }}>
              Funds will be sent to your CoinDCX web3 wallet. Unsettled fees will be deducted.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={() => setShowWithdraw(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Button>
              <Button style={{ flex: 1, justifyContent: 'center' }}>Confirm Withdrawal</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
