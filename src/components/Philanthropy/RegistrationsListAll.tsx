import React from 'react';
import { ClipboardList } from 'lucide-react';
import CrossEventList from './CrossEventList';

const ROLE_COLORS: Record<string, string> = {
  golfer: 'bg-blue-100 text-blue-700',
  dinner_only: 'bg-purple-100 text-purple-700',
  volunteer: 'bg-teal-100 text-teal-700',
  vip: 'bg-amber-100 text-amber-700',
  speaker: 'bg-rose-100 text-rose-700',
};

const RegistrationsListAll: React.FC = () => (
  <CrossEventList
    title="All Registrations"
    icon={ClipboardList}
    table="phil_registrations"
    columns={[
      { key: 'role', label: 'Role', render: (row) => (
        <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[row.role] || 'bg-gray-100 text-gray-600'}`}>
          {(row.role || '').replace(/_/g, ' ')}
        </span>
      )},
      { key: 'fee_amount', label: 'Fee', render: (row) => row.fee_amount ? `$${Number(row.fee_amount).toLocaleString()}` : '—' },
      { key: 'fee_paid', label: 'Paid', render: (row) => row.fee_paid ? 'Yes' : 'No' },
      { key: 'waiver_signed', label: 'Waiver', render: (row) => row.waiver_signed ? 'Signed' : 'Pending' },
    ]}
  />
);

export default RegistrationsListAll;
