import type { Contact } from '../types';

function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function escapeNote(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function contactToVCard(
  contact: Partial<Contact>,
  orgName?: string,
  orgRole?: string
): string {
  const lines: string[] = [];

  lines.push('BEGIN:VCARD');
  lines.push('VERSION:3.0');

  const fn = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
  lines.push(`N:${escapeVCard(contact.last_name || '')};${escapeVCard(contact.first_name || '')};;;`);
  lines.push(`FN:${escapeVCard(fn)}`);

  if (contact.title) {
    lines.push(`TITLE:${escapeVCard(contact.title)}`);
  }

  if (orgName) {
    lines.push(`ORG:${escapeVCard(orgName)}`);
  }

  if (orgRole) {
    lines.push(`ROLE:${escapeVCard(orgRole)}`);
  }

  if (contact.phone_mobile) {
    lines.push(`TEL;TYPE=CELL:${contact.phone_mobile}`);
  }

  if (contact.phone_office) {
    lines.push(`TEL;TYPE=WORK,VOICE:${contact.phone_office}`);
  }

  if (contact.phone_home) {
    lines.push(`TEL;TYPE=HOME,VOICE:${contact.phone_home}`);
  }

  if (contact.email_work) {
    lines.push(`EMAIL;TYPE=WORK:${contact.email_work}`);
  }

  if (contact.email_personal) {
    lines.push(`EMAIL;TYPE=HOME:${contact.email_personal}`);
  }

  const hasAddress = contact.address_line1 || contact.city || contact.state || contact.zip;
  if (hasAddress) {
    const street = escapeVCard(contact.address_line1 || '');
    const extended = escapeVCard(contact.address_line2 || '');
    const city = escapeVCard(contact.city || '');
    const state = escapeVCard(contact.state || '');
    const zip = escapeVCard(contact.zip || '');
    lines.push(`ADR;TYPE=WORK:;${extended};${street};${city};${state};${zip};`);
  }

  if (contact.notes) {
    lines.push(`NOTE:${escapeNote(contact.notes)}`);
  }

  lines.push('END:VCARD');

  return lines.join('\r\n');
}

export function contactsToVCardFile(
  contacts: Partial<Contact>[],
  getOrgInfo?: (contactId: string) => { name?: string; role?: string } | null
): string {
  return contacts
    .map(c => {
      const orgInfo = getOrgInfo && c.id ? getOrgInfo(c.id) : null;
      return contactToVCard(c, orgInfo?.name, orgInfo?.role);
    })
    .join('\r\n');
}

export function downloadVCard(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/vcard' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
