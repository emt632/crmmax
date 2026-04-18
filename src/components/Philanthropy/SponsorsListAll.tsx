import React from 'react';
import { Gem } from 'lucide-react';
import CrossEventList from './CrossEventList';

const PAYMENT_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  waived: 'bg-blue-100 text-blue-700',
};

const SponsorsListAll: React.FC = () => (
  <CrossEventList
    title="All Sponsors"
    icon={Gem}
    table="phil_sponsors"
    columns={[
      { key: 'payment_status', label: 'Status', render: (row) => (
        <span className={`text-xs px-2 py-0.5 rounded-full ${PAYMENT_COLORS[row.payment_status] || 'bg-gray-100 text-gray-600'}`}>
          {(row.payment_status || '').replace(/_/g, ' ')}
        </span>
      )},
      { key: 'payment_amount', label: 'Amount', render: (row) => row.payment_amount ? `$${Number(row.payment_amount).toLocaleString()}` : '—' },
      { key: 'hole_assignment', label: 'Hole' },
      { key: 'logo_received', label: 'Logo', render: (row) => row.logo_received ? 'Yes' : 'No' },
    ]}
  />
);

export default SponsorsListAll;
