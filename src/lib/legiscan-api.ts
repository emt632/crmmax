import { supabase } from './supabase';
import type { LegiscanLegislator, LegiscanSession } from '../types';
import { parseSponsorState } from './bill-format';

const LEGISCAN_KEY = import.meta.env.VITE_LEGISCAN_API_KEY;
const API_BASE = 'https://api.legiscan.com';

// Cache TTLs
const LEGISLATOR_CACHE_HOURS = 24;

interface LegiscanResponse {
  status: string;
  [key: string]: any;
}

async function legiscanFetch(params: Record<string, string>): Promise<LegiscanResponse> {
  const searchParams = new URLSearchParams({ key: LEGISCAN_KEY, ...params });
  const res = await fetch(`${API_BASE}/?${searchParams.toString()}`);
  if (!res.ok) throw new Error(`LegiScan API error: ${res.status}`);
  return res.json();
}

// ─── Bill Search ────────────────────────────────────────────

export interface LegiscanSearchResult {
  bill_id: number;
  bill_number: string;
  title: string;
  state: string;
  session: { session_id: number; session_name: string };
  last_action: string;
  last_action_date: string;
}

/**
 * Detect if a query looks like a bill number and normalize it for LegiScan search.
 * Common inputs: "HR4710", "H.R. 4710", "HR 4710", "S 100", "HB1234", "SF 100"
 * LegiScan's full-text engine requires a space between prefix and number
 * (e.g. "HR 1561" finds results, "HR1561" does not).
 */
function normalizeBillNumber(query: string): string | null {
  // Strip dots, extra spaces, normalize
  const cleaned = query.replace(/\./g, '').replace(/\s+/g, ' ').trim().toUpperCase();

  // Match pattern: letter prefix + optional space + digits
  const match = cleaned.match(/^([A-Z]{1,4})\s*(\d+)$/);
  if (!match) return null;

  const [, prefix, num] = match;
  return prefix + ' ' + num;
}

function parseSearchResults(data: LegiscanResponse): LegiscanSearchResult[] {
  if (data.status !== 'OK' || !data.searchresult) return [];

  const results: LegiscanSearchResult[] = [];
  const searchResult = data.searchresult;

  for (const key of Object.keys(searchResult)) {
    if (key === 'summary') continue;
    const item = searchResult[key];
    if (item && item.bill_id) {
      results.push({
        bill_id: item.bill_id,
        bill_number: item.bill_number,
        title: item.title,
        state: item.state,
        session: {
          session_id: item.session_id,
          session_name: item.session_name || '',
        },
        last_action: item.last_action || '',
        last_action_date: item.last_action_date || '',
      });
    }
  }

  return results;
}

export async function searchBills(query: string, state?: string): Promise<LegiscanSearchResult[]> {
  const billNumber = normalizeBillNumber(query);
  const fetches: Promise<LegiscanSearchResult[]>[] = [];

  // If it looks like a bill number, search with the normalized form
  if (billNumber) {
    const billParams: Record<string, string> = { op: 'getSearch', query: billNumber };
    if (state) billParams.state = state;
    fetches.push(
      legiscanFetch(billParams).then(parseSearchResults).catch(() => [])
    );
  }

  // Always do a text search too with the raw query (handles title/keyword
  // searches and catches bill numbers that didn't match the normalization)
  const textParams: Record<string, string> = { op: 'getSearch', query };
  if (state) textParams.state = state;
  fetches.push(
    legiscanFetch(textParams).then(parseSearchResults).catch(() => [])
  );

  const allResults = await Promise.all(fetches);

  // Merge and deduplicate, bill-number results first
  const seen = new Set<number>();
  const merged: LegiscanSearchResult[] = [];
  for (const batch of allResults) {
    for (const r of batch) {
      if (!seen.has(r.bill_id)) {
        seen.add(r.bill_id);
        merged.push(r);
      }
    }
  }

  // When no state filter, sort federal (US) results to the top
  if (!state) {
    merged.sort((a, b) => {
      if (a.state === 'US' && b.state !== 'US') return -1;
      if (a.state !== 'US' && b.state === 'US') return 1;
      return 0;
    });
  }

  return merged;
}

// ─── Bill Detail ────────────────────────────────────────────

export interface LegiscanBillDetail {
  bill_id: number;
  bill_number: string;
  title: string;
  description: string;
  state: string;
  session_id: number;
  status: number;
  status_desc: string;
  sponsors: Array<{
    people_id: number;
    name: string;
    party: string;
    state: string;
    district: string;
    role: string;
  }>;
  committee: Array<{
    committee_id: number;
    name: string;
    chamber: string;
  }>;
  history: Array<{
    date: string;
    action: string;
    chamber: string;
  }>;
  sasts: Array<{
    type: string;
    sast_bill_number: string;
    sast_bill_id: number;
  }>;
  raw: any;
}

export function mapLegiscanStatus(statusId: number): string {
  // LegiScan status codes → our status values
  // 1=Introduced, 2=Engrossed (passed one chamber), 3=Enrolled (passed both),
  // 4=Passed/Enacted, 5=Vetoed, 6=Failed/Dead
  const map: Record<number, string> = {
    1: 'introduced',
    2: 'passed_house',   // engrossed = passed originating chamber
    3: 'enrolled',       // enrolled = passed both chambers
    4: 'signed',         // enacted
    5: 'vetoed',
    6: 'failed',
  };
  return map[statusId] || 'introduced';
}

export async function getBillDetail(billId: number): Promise<LegiscanBillDetail | null> {
  const data = await legiscanFetch({ op: 'getBill', id: String(billId) });
  if (data.status !== 'OK' || !data.bill) return null;

  const bill = data.bill;
  return {
    bill_id: bill.bill_id,
    bill_number: bill.bill_number,
    title: bill.title,
    description: bill.description || '',
    state: bill.state,
    session_id: bill.session_id,
    status: bill.status,
    status_desc: bill.status_desc || '',
    sponsors: (bill.sponsors || []).map((s: any) => {
      // sponsor_type_id: 0=Author, 1=Primary Sponsor, 2=Co-Sponsor, 3=Joint Sponsor
      const SPONSOR_ROLES: Record<number, string> = {
        0: 'Author',
        1: 'Primary Sponsor',
        2: 'Co-Sponsor',
        3: 'Joint Sponsor',
      };
      return {
        people_id: s.people_id,
        name: s.name,
        party: s.party || '',
        state: parseSponsorState(bill.state, s.district || ''),
        district: s.district || '',
        role: s.sponsor_type_desc || SPONSOR_ROLES[s.sponsor_type_id] || 'Cosponsor',
      };
    }),
    committee: (Array.isArray(bill.committee) ? bill.committee : bill.committee ? [bill.committee] : []).map((c: any) => ({
      committee_id: c.committee_id,
      name: c.name,
      chamber: c.chamber || '',
    })),
    history: (bill.history || []).map((h: any) => ({
      date: h.date,
      action: h.action,
      chamber: h.chamber || '',
    })),
    sasts: (bill.sasts || []).map((s: any) => ({
      type: s.type || 'Related',
      sast_bill_number: s.sast_bill_number,
      sast_bill_id: s.sast_bill_id,
    })),
    raw: bill,
  };
}

/**
 * Import a bill from LegiScan into Supabase.
 * Returns the bill data ready for the form (not saved yet — caller saves).
 */
export function legiscanBillToFormData(detail: LegiscanBillDetail) {
  const isPrimary = (role: string) => {
    const r = role.toLowerCase();
    return r === 'primary sponsor' || r === 'author' || r === 'sponsor';
  };

  const primarySponsor = detail.sponsors.find((s) => isPrimary(s.role));

  return {
    bill_number: detail.bill_number,
    title: detail.title,
    description: detail.description,
    status: mapLegiscanStatus(detail.status),
    jurisdiction: detail.state || 'US',
    session_id: detail.session_id,
    author: primarySponsor?.name || '',
    committees: detail.committee.map((c) => ({
      committee_id: c.committee_id,
      name: c.name,
      chamber: c.chamber,
    })),
    cosponsors: detail.sponsors
      .filter((s) => !isPrimary(s.role))
      .map((s) => ({
        people_id: s.people_id,
        name: s.name,
        party: s.party,
        state: s.state,
        district: s.district,
      })),
    legiscan_bill_id: detail.bill_id,
    legiscan_raw: detail.raw,
    legiscan_sasts: detail.sasts,
  };
}

/**
 * Refresh a bill from LegiScan and update it in Supabase.
 * Returns the updated fields or null if the bill couldn't be fetched.
 */
export async function refreshBillFromLegiscan(
  supabaseBillId: string,
  legiscanBillId: number,
): Promise<{ updated: boolean; changes: string[] } | null> {
  const detail = await getBillDetail(legiscanBillId);
  if (!detail) return null;

  const formData = legiscanBillToFormData(detail);

  // Fetch current bill to detect what changed
  const { data: current } = await supabase
    .from('bills')
    .select('status, title, description, author')
    .eq('id', supabaseBillId)
    .single();

  const changes: string[] = [];
  if (current) {
    if (current.status !== formData.status) changes.push(`Status: ${current.status} → ${formData.status}`);
    if (current.title !== formData.title) changes.push('Title updated');
    if (current.description !== formData.description) changes.push('Description updated');
    if (current.author !== formData.author) changes.push('Author updated');
  }

  const { error } = await supabase
    .from('bills')
    .update({
      status: formData.status,
      title: formData.title,
      description: formData.description,
      author: formData.author,
      committees: formData.committees,
      cosponsors: formData.cosponsors,
      legiscan_raw: formData.legiscan_raw,
      updated_at: new Date().toISOString(),
    })
    .eq('id', supabaseBillId);

  if (error) throw error;

  return { updated: changes.length > 0, changes };
}

// LegiScan state_id → abbreviation (from getStateList, 1-indexed)
export const LEGISCAN_STATE_IDS: Record<number, string> = {
  1:'AL',2:'AK',3:'AZ',4:'AR',5:'CA',6:'CO',7:'CT',8:'DE',9:'FL',10:'GA',
  11:'HI',12:'ID',13:'IL',14:'IN',15:'IA',16:'KS',17:'KY',18:'LA',19:'ME',20:'MD',
  21:'MA',22:'MI',23:'MN',24:'MS',25:'MO',26:'MT',27:'NE',28:'NV',29:'NH',30:'NJ',
  31:'NM',32:'NY',33:'NC',34:'ND',35:'OH',36:'OK',37:'OR',38:'PA',39:'RI',40:'SC',
  41:'SD',42:'TN',43:'TX',44:'UT',45:'VT',46:'VA',47:'WA',48:'WV',49:'WI',50:'WY',
  51:'DC',52:'US',
};

// ─── Legislator Cache ───────────────────────────────────────

export async function getLegislators(state?: string): Promise<LegiscanLegislator[]> {
  // Try cache first
  let query = supabase.from('legiscan_legislators').select('*');
  if (state) query = query.eq('state', state);

  const { data: cached } = await query;

  // Check staleness
  const isStale = !cached?.length || cached.some((l) => {
    const age = Date.now() - new Date(l.fetched_at).getTime();
    return age > LEGISLATOR_CACHE_HOURS * 60 * 60 * 1000;
  });

  if (!isStale && cached) return cached as LegiscanLegislator[];

  // Refresh from API
  if (!state) return cached || [];

  try {
    // Resolve the current session ID for this state (id=0 no longer works)
    const sessions = await getSessionList(state);
    const currentSession = sessions.find((s) => !('prior' in s) || true); // use first (most recent)
    const sessionId = currentSession?.session_id ? String(currentSession.session_id) : '0';

    const data = await legiscanFetch({ op: 'getSessionPeople', id: sessionId, state });
    if (data.status !== 'OK' || !data.sessionpeople?.people) return cached || [];

    const legislators: LegiscanLegislator[] = Object.values(data.sessionpeople.people).map((p: any) => ({
      people_id: p.people_id,
      name: p.name,
      first_name: p.first_name,
      last_name: p.last_name,
      party: p.party,
      state: parseHomeStateFromDistrict(p.district) || (p.state_id ? LEGISCAN_STATE_IDS[p.state_id] : null) || state,
      chamber: p.role || '',
      district: p.district || '',
      committee_ids: [],
      fetched_at: new Date().toISOString(),
    }));

    // Upsert cache
    if (legislators.length > 0) {
      await supabase.from('legiscan_legislators').upsert(legislators, { onConflict: 'people_id' });
    }

    return legislators;
  } catch (err) {
    console.error('Failed to fetch legislators from LegiScan:', err);
    return cached || [];
  }
}

/**
 * Parse home state from LegiScan federal district string.
 * Federal districts: "SD-MN" (Senate), "HD-MN-7" (House)
 */
function parseHomeStateFromDistrict(district?: string): string | null {
  if (!district) return null;
  // Patterns: "SD-MN", "HD-MN-7", "HD-WA-9"
  const m = district.match(/^[SH]D-([A-Z]{2})/);
  return m ? m[1] : null;
}

/**
 * Resolve home states for legislators cached with state="US".
 * Fetches fresh data from LegiScan getSessionPeople for the US session,
 * parses home state from district field (e.g. "SD-MN" → "MN"), updates cache.
 */
export async function resolveUSLegislatorStates(peopleIds: number[]): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (!peopleIds.length || !LEGISCAN_KEY) return result;

  try {
    const sessions = await getSessionList('US');
    const sessionId = sessions[0]?.session_id;
    if (!sessionId) return result;

    const data = await legiscanFetch({ op: 'getSessionPeople', id: String(sessionId), state: 'US' });
    if (data.status !== 'OK' || !data.sessionpeople?.people) return result;

    const pidSet = new Set(peopleIds);
    const people: any[] = Array.isArray(data.sessionpeople.people)
      ? data.sessionpeople.people
      : Object.values(data.sessionpeople.people);

    for (const p of people) {
      if (pidSet.has(p.people_id)) {
        const homeState = parseHomeStateFromDistrict(p.district);
        if (homeState) {
          result.set(p.people_id, homeState);
          // Update cache permanently
          supabase.from('legiscan_legislators').update({ state: homeState }).eq('people_id', p.people_id).then(() => {});
        }
      }
    }
  } catch {
    // Silently fail — state will just be missing
  }
  return result;
}

// ─── Session Cache ──────────────────────────────────────────

export async function getSessionList(state?: string): Promise<LegiscanSession[]> {
  let query = supabase.from('legiscan_sessions').select('*');
  if (state) query = query.eq('jurisdiction', state);

  const { data: cached } = await query;

  if (cached?.length) return cached as LegiscanSession[];

  if (!state) return [];

  try {
    const data = await legiscanFetch({ op: 'getSessionList', state });
    if (data.status !== 'OK' || !data.sessions) return [];

    const sessions: LegiscanSession[] = data.sessions.map((s: any) => ({
      session_id: s.session_id,
      jurisdiction: state,
      name: s.session_name || s.name || '',
      year_start: s.year_start,
      year_end: s.year_end,
      fetched_at: new Date().toISOString(),
    }));

    if (sessions.length > 0) {
      await supabase.from('legiscan_sessions').upsert(sessions, { onConflict: 'session_id' });
    }

    return sessions;
  } catch (err) {
    console.error('Failed to fetch sessions from LegiScan:', err);
    return [];
  }
}

// ─── AdvoLink Settings ──────────────────────────────────────

export async function getAdvoLinkSetting(key: string): Promise<any> {
  const { data } = await supabase
    .from('advolink_settings')
    .select('value')
    .eq('key', key)
    .single();
  return data?.value ?? null;
}

export async function setAdvoLinkSetting(key: string, value: any, userId: string): Promise<void> {
  await supabase
    .from('advolink_settings')
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    }, { onConflict: 'key' });
}

export async function getOurStates(): Promise<string[]> {
  const val = await getAdvoLinkSetting('our_states');
  return Array.isArray(val) ? val : [];
}

export async function getAssociationOptions(): Promise<string[]> {
  const val = await getAdvoLinkSetting('association_options');
  return Array.isArray(val) ? val : [];
}

export async function getInitiativeOptions(): Promise<string[]> {
  const val = await getAdvoLinkSetting('initiative_options');
  return Array.isArray(val) ? val : [];
}

export async function getLocationOptions(): Promise<string[]> {
  const val = await getAdvoLinkSetting('location_options');
  return Array.isArray(val) ? val : [];
}

export async function getCommitteeOptions(): Promise<string[]> {
  // Extract unique committee names from tracked bills
  const { data: bills } = await supabase.from('bills').select('committees');
  const fromBills = new Set<string>();
  (bills || []).forEach((b: any) => {
    (b.committees || []).forEach((c: any) => { if (c.name) fromBills.add(c.name); });
  });
  // Merge with stored custom options
  const custom = await getAdvoLinkSetting('committee_options');
  const all = [...fromBills, ...(Array.isArray(custom) ? custom : [])];
  return [...new Set(all)].sort();
}
