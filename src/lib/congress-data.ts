import yaml from 'js-yaml';

// ─── Types ──────────────────────────────────────────────────

interface CongressCommittee {
  type: string; // 'house' | 'senate' | 'joint'
  name: string;
  thomas_id: string;
  subcommittees?: { name: string; thomas_id: string }[];
}

interface CommitteeMemberRaw {
  name: string;
  party: 'majority' | 'minority';
  rank: number;
  title?: string;
  bioguide: string;
}

export interface CommitteeMember {
  name: string;
  party: string; // R, D, I
  partyFull: string;
  state: string;
  rank: number;
  title?: string;
  bioguide: string;
  side: 'majority' | 'minority';
}

interface LegislatorInfo {
  party: string;
  state: string;
}

interface CacheData {
  committees: Map<string, CongressCommittee>;
  membership: Record<string, CommitteeMemberRaw[]>;
  legislators: Map<string, LegislatorInfo>;
  fetchedAt: number;
}

// ─── In-memory cache (24-hour TTL) ─────────────────────────

let cache: CacheData | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const BASE_URL =
  'https://raw.githubusercontent.com/unitedstates/congress-legislators/main';

async function fetchAndCache(): Promise<CacheData> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache;

  const [committeesText, membershipText, legislatorsText] = await Promise.all([
    fetch(`${BASE_URL}/committees-current.yaml`).then((r) => r.text()),
    fetch(`${BASE_URL}/committee-membership-current.yaml`).then((r) => r.text()),
    fetch(`${BASE_URL}/legislators-current.yaml`).then((r) => r.text()),
  ]);

  const committeesData = yaml.load(committeesText) as any[];
  const membershipData = yaml.load(membershipText) as Record<string, CommitteeMemberRaw[]>;
  const legislatorsData = yaml.load(legislatorsText) as any[];

  // Build committee map: thomas_id → committee info
  const committees = new Map<string, CongressCommittee>();
  for (const c of committeesData) {
    committees.set(c.thomas_id, {
      type: c.type,
      name: c.name,
      thomas_id: c.thomas_id,
      subcommittees: c.subcommittees?.map((s: any) => ({
        name: s.name,
        thomas_id: s.thomas_id,
      })),
    });
  }

  // Build legislator lookup: bioguide → {party, state}
  const legislators = new Map<string, LegislatorInfo>();
  for (const leg of legislatorsData) {
    const bioguide = leg.id?.bioguide;
    if (!bioguide) continue;
    const lastTerm = leg.terms?.[leg.terms.length - 1];
    if (!lastTerm) continue;
    legislators.set(bioguide, {
      party: lastTerm.party || '',
      state: lastTerm.state || '',
    });
  }

  cache = { committees, membership: membershipData, legislators, fetchedAt: Date.now() };
  return cache;
}

// ─── Name matching ──────────────────────────────────────────

function normalizeCommitteeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(house|senate)\s+committee\s+on\s+/i, '')
    .replace(/^(house|senate)\s+/i, '')
    .replace(/^committee\s+on\s+/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match a LegiScan committee name + chamber to a thomas_id.
 * LegiScan gives short names like "Ways and Means" with chamber "H".
 * The YAML has full names like "House Committee on Ways and Means".
 */
export async function matchCommittee(
  name: string,
  chamber?: string,
): Promise<string | null> {
  const data = await fetchAndCache();
  const normalizedInput = normalizeCommitteeName(name);

  const chamberType =
    chamber?.toUpperCase() === 'H'
      ? 'house'
      : chamber?.toUpperCase() === 'S'
        ? 'senate'
        : null;

  // Pass 1: exact normalized match
  for (const [thomasId, committee] of data.committees) {
    if (chamberType && committee.type !== chamberType) continue;
    if (normalizeCommitteeName(committee.name) === normalizedInput) return thomasId;
  }

  // Pass 2: either side substring match
  for (const [thomasId, committee] of data.committees) {
    if (chamberType && committee.type !== chamberType) continue;
    const nc = normalizeCommitteeName(committee.name);
    if (nc.includes(normalizedInput) || normalizedInput.includes(nc)) return thomasId;
  }

  // Pass 3: check subcommittees
  for (const [thomasId, committee] of data.committees) {
    if (chamberType && committee.type !== chamberType) continue;
    for (const sub of committee.subcommittees || []) {
      const nSub = normalizeCommitteeName(sub.name);
      if (nSub === normalizedInput || nSub.includes(normalizedInput) || normalizedInput.includes(nSub)) {
        return `${thomasId}${sub.thomas_id}`;
      }
    }
  }

  return null;
}

// ─── Public API ─────────────────────────────────────────────

function partyAbbrev(partyFull: string): string {
  if (partyFull === 'Republican') return 'R';
  if (partyFull === 'Democrat') return 'D';
  if (partyFull === 'Independent') return 'I';
  return partyFull.charAt(0) || '?';
}

/**
 * Get enriched committee members for a given thomas_id.
 * Returns members sorted: majority first, then minority, each by rank.
 */
export async function getCommitteeMembers(thomasId: string): Promise<CommitteeMember[]> {
  const data = await fetchAndCache();
  const rawMembers = data.membership[thomasId];
  if (!rawMembers) return [];

  return rawMembers.map((m) => {
    const legInfo = data.legislators.get(m.bioguide);
    const partyFull = legInfo?.party || (m.party === 'majority' ? 'Republican' : 'Democrat');

    return {
      name: m.name,
      party: partyAbbrev(partyFull),
      partyFull,
      state: legInfo?.state || '',
      rank: m.rank,
      title: m.title,
      bioguide: m.bioguide,
      side: m.party,
    };
  });
}
