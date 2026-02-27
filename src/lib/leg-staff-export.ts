import type { LegislativeOffice, LegislativeOfficeStaff } from '../types';

function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

export function staffToVCard(staff: LegislativeOfficeStaff, office: LegislativeOffice): string {
  const lines: string[] = [];

  lines.push('BEGIN:VCARD');
  lines.push('VERSION:3.0');

  const fn = `${staff.first_name} ${staff.last_name}`.trim();
  lines.push(`N:${escapeVCard(staff.last_name)};${escapeVCard(staff.first_name)};;;`);
  lines.push(`FN:${escapeVCard(fn)}`);

  if (staff.title) {
    lines.push(`TITLE:${escapeVCard(staff.title)}`);
  }

  lines.push(`ORG:${escapeVCard(office.name)}`);

  if (staff.phone) {
    lines.push(`TEL;TYPE=WORK,VOICE:${staff.phone}`);
  }

  if (staff.email) {
    lines.push(`EMAIL;TYPE=WORK:${staff.email}`);
  }

  const hasAddress = office.address || office.city || office.office_state || office.zip;
  if (hasAddress) {
    const street = escapeVCard(office.address || '');
    const city = escapeVCard(office.city || '');
    const state = escapeVCard(office.office_state || '');
    const zip = escapeVCard(office.zip || '');
    lines.push(`ADR;TYPE=WORK:;;${street};${city};${state};${zip};`);
  }

  lines.push('END:VCARD');

  return lines.join('\r\n');
}

export function allStaffToVCardFile(
  staffWithOffice: { staff: LegislativeOfficeStaff; office: LegislativeOffice }[]
): string {
  return staffWithOffice
    .map(({ staff, office }) => staffToVCard(staff, office))
    .join('\r\n');
}

export function exportDirectoryCSV(
  offices: LegislativeOffice[],
  staffMap: Record<string, LegislativeOfficeStaff[]>
): string {
  const headers = [
    'Office Name', 'Office Type', 'State', 'Chamber', 'District',
    'Office Phone', 'Office Email', 'Address', 'City', 'Office State', 'Zip',
    'Staff First Name', 'Staff Last Name', 'Staff Title', 'Staff Email', 'Staff Phone',
  ];

  const csvEscape = (val: string) => {
    if (!val) return '';
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows: string[] = [headers.map(csvEscape).join(',')];

  for (const office of offices) {
    const staff = staffMap[office.id] || [];
    if (staff.length === 0) {
      rows.push([
        office.name, office.office_type, office.state || '', office.chamber || '', office.district || '',
        office.phone || '', office.email || '', office.address || '', office.city || '', office.office_state || '', office.zip || '',
        '', '', '', '', '',
      ].map(csvEscape).join(','));
    } else {
      for (const s of staff) {
        rows.push([
          office.name, office.office_type, office.state || '', office.chamber || '', office.district || '',
          office.phone || '', office.email || '', office.address || '', office.city || '', office.office_state || '', office.zip || '',
          s.first_name, s.last_name, s.title || '', s.email || '', s.phone || '',
        ].map(csvEscape).join(','));
      }
    }
  }

  return rows.join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
