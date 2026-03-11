import type { ReactNode } from 'react';
import { Card } from './Card';

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changePositive?: boolean;
  icon?: ReactNode;
}

export function StatCard({ label, value, change, changePositive, icon }: StatCardProps) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
          {change && (
            <div style={{
              fontSize: 12,
              marginTop: 4,
              color: changePositive ? '#22c55e' : '#ef4444',
              fontWeight: 500,
            }}>
              {changePositive ? '+' : ''}{change}
            </div>
          )}
        </div>
        {icon && (
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
