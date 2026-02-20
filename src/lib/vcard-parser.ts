export interface ParsedContact {
  first_name: string;
  last_name: string;
  title?: string;
  email_work?: string;
  email_personal?: string;
  phone_mobile?: string;
  phone_office?: string;
  phone_home?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  org_name?: string;
  selected: boolean;
}

function unescapeVCard(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\;/g, ';')
    .replace(/\\,/g, ',')
    .replace(/\\\\/g, '\\');
}

function parseTypeParams(params: string): string[] {
  const types: string[] = [];
  const parts = params.split(';');
  for (const part of parts) {
    const trimmed = part.trim().toUpperCase();
    if (trimmed.startsWith('TYPE=')) {
      types.push(...trimmed.substring(5).split(',').map(t => t.trim()));
    } else if (['CELL', 'MOBILE', 'WORK', 'HOME', 'VOICE', 'FAX', 'PREF', 'PERSONAL'].includes(trimmed)) {
      types.push(trimmed);
    }
  }
  return types;
}

function parseSingleVCard(lines: string[]): ParsedContact | null {
  const contact: ParsedContact = {
    first_name: '',
    last_name: '',
    selected: true,
  };

  let emailCount = 0;
  let phoneCount = 0;

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const propPart = line.substring(0, colonIdx);
    const value = unescapeVCard(line.substring(colonIdx + 1).trim());
    if (!value) continue;

    const semiIdx = propPart.indexOf(';');
    const propName = (semiIdx === -1 ? propPart : propPart.substring(0, semiIdx)).toUpperCase();
    const paramStr = semiIdx === -1 ? '' : propPart.substring(semiIdx + 1);
    const types = paramStr ? parseTypeParams(paramStr) : [];

    switch (propName) {
      case 'N': {
        const parts = value.split(';');
        contact.last_name = parts[0] || '';
        contact.first_name = parts[1] || '';
        break;
      }
      case 'FN': {
        // Only use FN as fallback if N didn't provide names
        if (!contact.first_name && !contact.last_name) {
          const parts = value.split(' ');
          contact.first_name = parts[0] || '';
          contact.last_name = parts.slice(1).join(' ') || '';
        }
        break;
      }
      case 'TITLE': {
        contact.title = value;
        break;
      }
      case 'ORG': {
        contact.org_name = value.split(';')[0];
        break;
      }
      case 'TEL': {
        if (types.includes('CELL') || types.includes('MOBILE')) {
          contact.phone_mobile = value;
        } else if (types.includes('WORK')) {
          contact.phone_office = value;
        } else if (types.includes('HOME')) {
          contact.phone_home = value;
        } else {
          // No type specified — fill first available
          if (phoneCount === 0) contact.phone_mobile = value;
          else if (phoneCount === 1) contact.phone_office = value;
          else contact.phone_home = value;
        }
        phoneCount++;
        break;
      }
      case 'EMAIL': {
        if (types.includes('WORK')) {
          contact.email_work = value;
        } else if (types.includes('HOME') || types.includes('PERSONAL')) {
          contact.email_personal = value;
        } else {
          if (emailCount === 0) contact.email_work = value;
          else contact.email_personal = value;
        }
        emailCount++;
        break;
      }
      case 'ADR': {
        // ADR: pobox;extended;street;city;state;zip;country
        const parts = value.split(';');
        contact.address_line2 = parts[1] || undefined;
        contact.address_line1 = parts[2] || undefined;
        contact.city = parts[3] || undefined;
        contact.state = parts[4] || undefined;
        contact.zip = parts[5] || undefined;
        break;
      }
      case 'NOTE': {
        contact.notes = value;
        break;
      }
    }
  }

  // Skip empty contacts
  if (!contact.first_name && !contact.last_name && !contact.email_work) {
    return null;
  }

  return contact;
}

export function parseVCardFile(text: string): ParsedContact[] {
  // Normalize line endings
  let normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Handle line folding (lines starting with space or tab are continuations)
  normalized = normalized.replace(/\n[ \t]/g, '');

  const contacts: ParsedContact[] = [];
  const blocks = normalized.split(/BEGIN:VCARD/i);

  for (const block of blocks) {
    const endIdx = block.toUpperCase().indexOf('END:VCARD');
    if (endIdx === -1) continue;

    const content = block.substring(0, endIdx);
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const parsed = parseSingleVCard(lines);
    if (parsed) {
      contacts.push(parsed);
    }
  }

  return contacts;
}
