import { supabase } from './supabase';
import type { LegiscanLegislator, LegiscanSession } from '../types';
import { parseSponsorState } from './bill-format';

const LEGISCAN_KEY = import.meta.env.VITE_LEGISCAN_API_KEY;
const API_BASE = '/api/legiscan';

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
 * Detect if a query looks like a bill number and normalize it to LegiScan format.
 * Common inputs: "HR4710", "H.R. 4710", "HR 4710", "S 100", "HB1234", "SF 100"
 * Federal bills use HR (H.R.) and S directly. State bills use HB, SB, HF, SF, AB, etc.
 * All prefixes pass through as-is — no mapping needed.
 */
function normalizeBillNumber(query: string): string | null {
  // Strip dots, extra spaces, normalize
  const cleaned = query.replace(/\./g, '').replace(/\s+/g, ' ').trim().toUpperCase();

  // Match pattern: letter prefix + optional space + digits
  const match = cleaned.match(/^([A-Z]{1,4})\s*(\d+)$/);
  if (!match) return null;

  const [, prefix, num] = match;
  return prefix + num;
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

  // If it looks like a bill number, do a structured getSearch with the bill param
  if (billNumber) {
    const billParams: Record<string, string> = { op: 'getSearch', bill: billNumber };
    if (state) billParams.state = state;
    fetches.push(
      legiscanFetch(billParams).then(parseSearchResults).catch(() => [])
    );
  }

  // Always do a text search too (handles title/keyword searches and
  // catches bill numbers that didn't match the normalization)
  const textParams: Record<string, string> = { op: 'search', query };
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

function mapLegiscanStatus(statusId: number): string {
  // LegiScan status codes → our status values
  const map: Record<number, string> = {
    1: 'introduced',
    2: 'in_committee',  // engrossed
    3: 'passed_house',
    4: 'signed',        // enacted
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
      state: state,
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
