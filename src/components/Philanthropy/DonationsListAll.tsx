import React, { useState } from 'react';
import { HandHeart } from 'lucide-react';
import CrossEventList from './CrossEventList';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', check: 'Check', credit_card: 'Credit Card', ach: 'ACH', other: 'Other',
};

const CATEGORY_LABELS: Record<string, string> = {
  goods: 'Goods', services: 'Services', experiences: 'Experiences',
  food_beverage: 'Food & Beverage', printing: 'Printing', venue: 'Venue', other: 'Other',
};

const DonationsListAll: React.FC = () => {
  const [tab, setTab] = useState<'cash' | 'inkind'>('cash');

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('cash')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'cash' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          Cash Donations
        </button>
        <button
          onClick={() => setTab('inkind')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'inkind' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          In-Kind Donations
        </button>
      </div>

      {tab === 'cash' ? (
        <CrossEventList
          title="Cash Donations"
          icon={HandHeart}
          table="phil_cash_donations"
          columns={[
            { key: 'amount', label: 'Amount', render: (row) => `$${Number(row.amount).toLocaleString()}` },
            { key: 'method', label: 'Method', render: (row) => METHOD_LABELS[row.method] || row.method },
            { key: 'donation_date', label: 'Date' },
            { key: 'acknowledgement_sent', label: 'Ack\'d', render: (row) => row.acknowledgement_sent ? 'Yes' : 'No' },
          ]}
        />
      ) : (
        <CrossEventList
          title="In-Kind Donations"
          icon={HandHeart}
          table="phil_inkind_donations"
          columns={[
            { key: 'item_description', label: 'Item' },
            { key: 'category', label: 'Category', render: (row) => CATEGORY_LABELS[row.category] || row.category },
            { key: 'fair_market_value', label: 'FMV', render: (row) => row.fair_market_value ? `$${Number(row.fair_market_value).toLocaleString()}` : '—' },
            { key: 'form_8283_required', label: '8283', render: (row) => row.form_8283_required ? (row.form_8283_completed ? 'Done' : 'Required') : '—' },
          ]}
        />
      )}
    </div>
  );
};

export default DonationsListAll;
