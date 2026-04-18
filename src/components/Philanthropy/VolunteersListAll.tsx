import React from 'react';
import { UserCheck } from 'lucide-react';
import CrossEventList from './CrossEventList';

const VolunteersListAll: React.FC = () => (
  <CrossEventList
    title="All Volunteer Assignments"
    icon={UserCheck}
    table="phil_volunteer_assignments"
    columns={[
      { key: 'checked_in', label: 'Checked In', render: (row) => row.checked_in ? 'Yes' : 'No' },
      { key: 'hours_logged', label: 'Hours', render: (row) => row.hours_logged != null ? `${row.hours_logged}h` : '—' },
      { key: 'notes', label: 'Notes', render: (row) => row.notes ? (row.notes.length > 40 ? row.notes.slice(0, 40) + '...' : row.notes) : '—' },
    ]}
  />
);

export default VolunteersListAll;
