// Proxied through Vite dev server to avoid CORS (CMS API has no CORS headers)
// Vite proxy: /api/cms → https://data.cms.gov/provider-data/api/1
const CMS_ENDPOINT = '/api/cms/datastore/query/xubh-q36u/0';

const PROPERTIES = [
  'facility_id',
  'facility_name',
  'address',
  'citytown',
  'state',
  'zip_code',
  'countyparish',
  'telephone_number',
  'hospital_type',
  'hospital_ownership',
  'emergency_services',
  'hospital_overall_rating',
];

export interface CMSHospital {
  facility_id: string;
  facility_name: string;
  address: string;
  citytown: string;
  state: string;
  zip_code: string;
  countyparish: string;
  telephone_number: string;
  hospital_type: string;
  hospital_ownership: string;
  emergency_services: string;
  hospital_overall_rating: string;
}

/**
 * Convert ALL CAPS CMS text to Title Case.
 * "MAYO CLINIC HOSPITAL" → "Mayo Clinic Hospital"
 * "ST. MARY'S MEDICAL CENTER" → "St. Mary's Medical Center"
 */
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(?:^|\s|[-/.(])\w/g, (match) => match.toUpperCase());
}

/**
 * Search the CMS Hospital General Information dataset.
 * No API key needed — the endpoint is completely open.
 */
export async function searchCMSHospitals(
  name: string,
  state?: string
): Promise<CMSHospital[]> {
  const params = new URLSearchParams();
  params.set('limit', '50');
  params.set('offset', '0');

  // Properties to return
  PROPERTIES.forEach((prop) => {
    params.append('properties[]', prop);
  });

  // Name search condition (case-insensitive contains)
  let condIdx = 0;
  params.set(`conditions[${condIdx}][resource]`, 't');
  params.set(`conditions[${condIdx}][property]`, 'facility_name');
  params.set(`conditions[${condIdx}][value]`, name);
  params.set(`conditions[${condIdx}][operator]`, 'contains');

  // Optional state filter
  if (state) {
    condIdx++;
    params.set(`conditions[${condIdx}][resource]`, 't');
    params.set(`conditions[${condIdx}][property]`, 'state');
    params.set(`conditions[${condIdx}][value]`, state);
    params.set(`conditions[${condIdx}][operator]`, '=');
  }

  // Sort by name
  params.set('sorts[0][property]', 'facility_name');
  params.set('sorts[0][order]', 'asc');

  const response = await fetch(`${CMS_ENDPOINT}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`CMS API error: ${response.status}`);
  }

  const data = await response.json();
  return (data.results || []) as CMSHospital[];
}
