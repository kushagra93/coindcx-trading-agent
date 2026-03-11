import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { setAuthToken } from '../api/client';
import { Activity, Lock } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!token.trim()) {
      setError('Please enter your API key');
      return;
    }
    setAuthToken(token.trim());
    navigate('/');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0e17',
    }}>
      <Card style={{ width: 400, maxWidth: '90vw' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'rgba(59, 130, 246, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <Activity size={28} color="#3b82f6" />
          </div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>Trading Agent</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Connect with your API key to continue</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
            API Key
          </label>
          <div style={{ position: 'relative' }}>
            <Lock size={14} color="#64748b" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="password"
              value={token}
              onChange={e => { setToken(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Enter your API key"
              style={{
                width: '100%',
                padding: '12px 12px 12px 36px',
                borderRadius: 8,
                border: `1px solid ${error ? '#ef4444' : '#334155'}`,
                background: '#1e293b',
                color: '#f1f5f9',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>
          {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>{error}</div>}
        </div>

        <Button onClick={handleLogin} style={{ width: '100%', justifyContent: 'center' }} size="lg">
          Connect
        </Button>

        <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 16 }}>
          Your API key is stored locally and sent only to the trading agent API.
        </div>
      </Card>
    </div>
  );
}
