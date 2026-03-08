/**
 * Formats raw bill numbers into standard legislative format.
 * HR1234 → "H.R. 1234", S123 → "S. 123", HB1234 → "H.B. 1234", etc.
 */
export function formatBillNumber(raw: string): string {
  if (!raw) return raw;

  const trimmed = raw.trim().toUpperCase();

  // Map of prefixes to their formatted equivalents
  const patterns: [RegExp, string][] = [
    // Joint Resolutions
    [/^HJ(?:RES)?\.?\s*(\d+)$/i, 'H.J.Res. $1'],
    [/^SJ(?:RES)?\.?\s*(\d+)$/i, 'S.J.Res. $1'],
    // Concurrent Resolutions
    [/^HCON(?:RES)?\.?\s*(\d+)$/i, 'H.Con.Res. $1'],
    [/^SCON(?:RES)?\.?\s*(\d+)$/i, 'S.Con.Res. $1'],
    // Simple Resolutions
    [/^HRES\.?\s*(\d+)$/i, 'H.Res. $1'],
    [/^SRES\.?\s*(\d+)$/i, 'S.Res. $1'],
    // Federal bills
    [/^HR\.?\s*(\d+)$/i, 'H.R. $1'],
    [/^S\.?\s*(\d+)$/i, 'S. $1'],
    // State bills
    [/^HB\.?\s*(\d+)$/i, 'H.B. $1'],
    [/^SB\.?\s*(\d+)$/i, 'S.B. $1'],
    [/^HF\.?\s*(\d+)$/i, 'H.F. $1'],
    [/^SF\.?\s*(\d+)$/i, 'S.F. $1'],
    [/^AB\.?\s*(\d+)$/i, 'A.B. $1'],
    // Already formatted (contains dots or spaces) — return as-is
  ];

  for (const [regex, replacement] of patterns) {
    if (regex.test(trimmed)) {
      return trimmed.replace(regex, replacement);
    }
  }

  // If already formatted or unrecognized, return as-is
  return raw.trim();
}

/**
 * Labels for bill statuses
 */
export const BILL_STATUS_LABELS: Record<string, string> = {
  introduced: 'Introduced',
  in_committee: 'In Committee',
  passed_house: 'Passed House',
  passed_senate: 'Passed Senate',
  enrolled: 'Enrolled',
  signed: 'Signed',
  vetoed: 'Vetoed',
  failed: 'Failed',
};

/**
 * Colors for bill status badges
 */
export const BILL_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  introduced: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
  in_committee: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  passed_house: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  passed_senate: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  enrolled: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  signed: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  vetoed: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  failed: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
};

/**
 * Ordered list of bill statuses for pipeline visualization
 */
export const BILL_STATUS_ORDER: string[] = [
  'introduced',
  'in_committee',
  'passed_house',
  'passed_senate',
  'enrolled',
  'signed',
  'vetoed',
  'failed',
];

/**
 * US state abbreviations
 */
export const US_STATES: { value: string; label: string }[] = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'US', label: 'Federal' },
];

/**
 * GA engagement type labels
 */
export const GA_ENGAGEMENT_TYPE_LABELS: Record<string, string> = {
  lobby_team: 'Lobby Team',
  ga_committee: 'GA Committee',
  legislator_office: 'Legislator Office',
  committee_meeting: 'Committee Meeting',
  federal_state_entity: 'Federal/State Entity',
};

/**
 * Committee role labels for legislator engagements
 */
export const COMMITTEE_ROLE_LABELS: Record<string, string> = {
  chair: 'Chair',
  ranking_member: 'Ranking Member',
  vice_chair: 'Vice Chair',
  member: 'Member',
  subcommittee_chair: 'Subcommittee Chair',
  ex_officio: 'Ex Officio',
};

/**
 * Association name options for ga_committee type
 */
export const GA_ASSOCIATION_OPTIONS = [
  'Association of Air Medical Services (AAMS)',
  'Association of Critical Care Transport (ACCT)',
  'Air Medical Operators Association (AMOA)',
  'Medical Alley Association',
  'Minnesota Hospital Association (MHA)',
  'Wisconsin Hospital Association (WHA)',
  'Wisconsin Rural Health Association',
  'Minnesota Rural Health Association',
  'Other',
];

/**
 * Badge colors for GA engagement types (shared between BillDetail & EngagementsList)
 */
export const GA_ENGAGEMENT_TYPE_BADGE_COLORS: Record<string, string> = {
  lobby_team: 'bg-blue-100 text-blue-700',
  ga_committee: 'bg-emerald-100 text-emerald-700',
  legislator_office: 'bg-purple-100 text-purple-700',
  committee_meeting: 'bg-amber-100 text-amber-700',
  federal_state_entity: 'bg-rose-100 text-rose-700',
};

// ─── Support Campaign Labels ─────────────────────────────

export const SUPPORT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  follow_up_needed: 'Follow-Up Needed',
  committed: 'Committed',
  received: 'Received',
  declined: 'Declined',
};

export const SUPPORT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  follow_up_needed: 'bg-amber-100 text-amber-700',
  committed: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
};

export const SUPPORT_TYPE_LABELS: Record<string, string> = {
  letter_of_support: 'Letter of Support',
  testimonial: 'Testimonial',
  reach_out_on_behalf: 'Reach Out on Behalf',
  sign_on_letter: 'Sign-On Letter',
  public_statement: 'Public Statement',
  event_attendance: 'Event Attendance',
  funding_commitment: 'Funding Commitment',
  other: 'Other',
};

export const OUTREACH_METHOD_LABELS: Record<string, string> = {
  virtual: 'Virtual',
  in_person: 'In-Person',
  email: 'Email',
  phone: 'Phone',
  letter: 'Letter',
  other: 'Other',
};

export const TARGET_TYPE_LABELS: Record<string, string> = {
  legislator: 'Legislator',
  contact: 'Contact',
  organization: 'Organization',
  leg_staff: 'Legislative Staff',
  other: 'Other',
};

export const THANK_YOU_METHOD_LABELS: Record<string, string> = {
  letter: 'Letter',
  email: 'Email',
  phone: 'Phone Call',
  in_person: 'In-Person',
  other: 'Other',
};

/**
 * Valid 2-letter US state abbreviations for validation
 */
const STATE_ABBREVS = new Set(US_STATES.map((s) => s.value));

/**
 * Parse the actual state from a sponsor's district field.
 * For federal bills, LegiScan sets `state` to "US" for all sponsors
 * but the district field contains the real state info:
 *   "HD-NC-3" → "NC"     (LegiScan House District format)
 *   "SD-MN" → "MN"       (LegiScan Senate District format)
 *   "MN-05" → "MN"
 *   "Senior Seat for MN" → "MN"
 *   "MN" → "MN"
 *
 * For state bills, the bill-level state is already correct.
 */
export function parseSponsorState(billState: string, district?: string): string {
  // State-level bills already have the correct state
  if (billState !== 'US') return billState;
  if (!district) return billState;

  const d = district.trim().toUpperCase();

  // Pattern: "HD-XX-##" (LegiScan House District, e.g., "HD-NC-3", "HD-CA-19")
  const hdMatch = d.match(/^HD-([A-Z]{2})-\d+$/);
  if (hdMatch && STATE_ABBREVS.has(hdMatch[1])) return hdMatch[1];

  // Pattern: "SD-XX" (LegiScan Senate District, e.g., "SD-MN")
  const sdMatch = d.match(/^SD-([A-Z]{2})(?:-\d+)?$/);
  if (sdMatch && STATE_ABBREVS.has(sdMatch[1])) return sdMatch[1];

  // Pattern: "XX-##" (e.g., "MN-05", "CA-12")
  const dashMatch = d.match(/^([A-Z]{2})-\d+$/);
  if (dashMatch && STATE_ABBREVS.has(dashMatch[1])) return dashMatch[1];

  // Pattern: exact 2-letter state code
  if (d.length === 2 && STATE_ABBREVS.has(d)) return d;

  // Pattern: "Senior Seat for XX" / "Junior Seat for XX" (Senate)
  const seatMatch = d.match(/\b([A-Z]{2})$/);
  if (seatMatch && STATE_ABBREVS.has(seatMatch[1])) return seatMatch[1];

  return billState;
}
