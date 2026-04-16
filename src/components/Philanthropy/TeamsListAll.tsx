import React from 'react';
import { UsersRound } from 'lucide-react';
import CrossEventList from './CrossEventList';

const TeamsListAll: React.FC = () => (
  <CrossEventList
    title="All Teams"
    icon={UsersRound}
    table="phil_teams"
    columns={[
      { key: 'team_name', label: 'Team Name' },
      { key: 'tee_time', label: 'Tee Time', render: (row) => row.tee_time || '—' },
      { key: 'starting_hole', label: 'Hole', render: (row) => row.starting_hole ? `#${row.starting_hole}` : '—' },
      { key: 'cart_number', label: 'Cart' },
    ]}
  />
);

export default TeamsListAll;
