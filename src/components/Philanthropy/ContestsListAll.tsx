import React from 'react';
import { Trophy } from 'lucide-react';
import CrossEventList from './CrossEventList';

const CONTEST_LABELS: Record<string, string> = {
  longest_drive: 'Longest Drive',
  closest_to_pin: 'Closest to Pin',
  hole_in_one: 'Hole in One',
  putting: 'Putting',
  other: 'Other',
};

const ContestsListAll: React.FC = () => (
  <CrossEventList
    title="All Contests"
    icon={Trophy}
    table="phil_contests"
    columns={[
      { key: 'contest_type', label: 'Type', render: (row) => CONTEST_LABELS[row.contest_type] || row.contest_type },
      { key: 'hole_number', label: 'Hole', render: (row) => row.hole_number ? `#${row.hole_number}` : '—' },
      { key: 'prize_description', label: 'Prize' },
      { key: 'prize_value', label: 'Value', render: (row) => row.prize_value ? `$${Number(row.prize_value).toLocaleString()}` : '—' },
      { key: 'winning_result', label: 'Result' },
    ]}
  />
);

export default ContestsListAll;
