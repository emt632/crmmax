import React, { useState, useEffect, useMemo } from 'react';
import {
  BookUser, Search, Plus, ChevronDown, ChevronRight,
  Edit2, Trash2, Loader2, Download, UserCircle, Gavel,
  Phone, Mail, MapPin, Save, X, Sparkles, GitMerge,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { LegislativeOffice, LegislativeOfficeStaff } from '../../types';
import { exportDirectoryCSV, allStaffToVCardFile, downloadFile } from '../../lib/leg-staff-export';
import QuickAddLegOfficeModal from './QuickAddLegOfficeModal';
import QuickAddCommitteeStaffModal from './QuickAddCommitteeStaffModal';
import SmartCaptureLegStaffModal from './SmartCaptureLegStaffModal';
import MergeLegOfficeModal from './MergeLegOfficeModal';

type TabType = 'legislator' | 'committee';

// State color coding — sports/collegiate inspired
const STATE_COLORS: Record<string, string> = {
  MN: 'bg-purple-100 text-purple-800 border border-purple-300',   // Vikings purple
  WI: 'bg-red-100 text-red-800 border border-red-300',            // Badgers red
  ND: 'bg-amber-100 text-amber-800 border border-amber-300',      // NDSU Bison gold
  MI: 'bg-blue-100 text-blue-800 border border-blue-300',         // Wolverines blue
  US: 'bg-slate-100 text-slate-800 border border-slate-300',      // Federal — neutral
  IA: 'bg-yellow-100 text-yellow-800 border border-yellow-300',   // Hawkeyes gold
  IL: 'bg-orange-100 text-orange-800 border border-orange-300',   // Illini orange
  SD: 'bg-sky-100 text-sky-800 border border-sky-300',            // Jackrabbits blue
  OH: 'bg-red-100 text-red-800 border border-red-300',            // Buckeyes scarlet
  IN: 'bg-red-100 text-red-800 border border-red-300',            // Hoosiers crimson
  PA: 'bg-indigo-100 text-indigo-800 border border-indigo-300',   // Penn State navy
};
const DEFAULT_STATE_COLOR = 'bg-gray-100 text-gray-700 border border-gray-300';

// Left border accent per state
const STATE_BORDER: Record<string, string> = {
  MN: 'border-l-purple-500',
  WI: 'border-l-red-500',
  ND: 'border-l-amber-500',
  MI: 'border-l-blue-500',
  US: 'border-l-slate-500',
  IA: 'border-l-yellow-500',
  IL: 'border-l-orange-500',
  SD: 'border-l-sky-500',
  OH: 'border-l-red-500',
  IN: 'border-l-red-500',
  PA: 'border-l-indigo-500',
};

function getStateColor(state?: string): string {
  return state ? (STATE_COLORS[state] || DEFAULT_STATE_COLOR) : DEFAULT_STATE_COLOR;
}

function getStateBorder(state?: string): string {
  return state ? (STATE_BORDER[state] || 'border-l-gray-300') : 'border-l-gray-300';
}

// Strip all title/office prefixes to get just the person's name
function stripName(name: string): string {
  return name
    .replace(/^Office of\s+(Sen\.\s*|Rep\.\s*|Senator\s+|Representative\s+)?/i, '')
    .replace(/^Senator\s+/i, '')
    .replace(/^Representative\s+/i, '')
    .replace(/^Sen\.\s*/i, '')
    .replace(/^Rep\.\s*/i, '')
    .trim();
}

// Build display name: "Senator Jane Doe" or "Representative John Smith"
function displayOfficeName(name: string, chamber?: string): string {
  const clean = stripName(name);
  const c = (chamber || '').toLowerCase();
  if (c === 'senate' || c === 'sen') return `Senator ${clean}`;
  if (c === 'house' || c === 'assembly' || c === 'rep') return `Representative ${clean}`;
  return clean || name;
}

const inputClass = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-teal-100 focus:border-teal-500 transition-all text-sm';

const LegislativeDirectory: React.FC = () => {
  const { user, hasModule } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('legislator');
  const [offices, setOffices] = useState<LegislativeOffice[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, LegislativeOfficeStaff[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOffices, setExpandedOffices] = useState<Set<string>>(new Set());

  // Modal state
  const [showAddOfficeModal, setShowAddOfficeModal] = useState(false);
  const [addOfficeDefaultType, setAddOfficeDefaultType] = useState<'legislator' | 'committee'>('legislator');
  const [showAddStaffForOffice, setShowAddStaffForOffice] = useState<LegislativeOffice | null>(null);
  const [showSmartCapture, setShowSmartCapture] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [stateFilter, setStateFilter] = useState<string>(''); // empty = all

  // Inline edit state
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editStaffData, setEditStaffData] = useState<Partial<LegislativeOfficeStaff>>({});
  const [savingStaff, setSavingStaff] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data: officeData } = await supabase
      .from('legislative_offices')
      .select('*')
      .order('name');

    const allOffices = (officeData || []) as LegislativeOffice[];
    setOffices(allOffices);

    if (allOffices.length > 0) {
      const { data: staffData } = await supabase
        .from('legislative_office_staff')
        .select('*')
        .neq('is_active', false)
        .order('last_name');

      const map: Record<string, LegislativeOfficeStaff[]> = {};
      for (const s of (staffData || []) as LegislativeOfficeStaff[]) {
        if (!map[s.office_id]) map[s.office_id] = [];
        map[s.office_id].push(s);
      }
      setStaffMap(map);
    }
    setLoading(false);
  };

  // Unique states for filter pills (across both tabs)
  const availableStates = useMemo(() => {
    const states = new Set<string>();
    for (const o of offices) {
      if (o.state) states.add(o.state);
    }
    return Array.from(states).sort();
  }, [offices]);

  const filteredOffices = useMemo(() => {
    let byType = offices.filter((o) => o.office_type === activeTab);
    if (stateFilter) {
      byType = byType.filter((o) => o.state === stateFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      byType = byType.filter((o) => {
        if (o.name.toLowerCase().includes(q)) return true;
        if (o.state?.toLowerCase().includes(q)) return true;
        if (o.chamber?.toLowerCase().includes(q)) return true;
        const staff = staffMap[o.id] || [];
        return staff.some(
          (s) =>
            s.first_name.toLowerCase().includes(q) ||
            s.last_name.toLowerCase().includes(q) ||
            (s.email || '').toLowerCase().includes(q)
        );
      });
    }
    // Sort A-Z by last name (last word of the stripped name)
    return byType.sort((a, b) => {
      const aWords = stripName(a.name).split(/\s+/);
      const bWords = stripName(b.name).split(/\s+/);
      const aLast = (aWords[aWords.length - 1] || '').toLowerCase();
      const bLast = (bWords[bWords.length - 1] || '').toLowerCase();
      return aLast.localeCompare(bLast);
    });
  }, [offices, activeTab, searchQuery, stateFilter, staffMap]);

  const toggleExpand = (id: string) => {
    setExpandedOffices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteOffice = async (office: LegislativeOffice) => {
    if (!confirm(`Delete "${office.name}"? Staff will be deactivated to preserve historical records.`)) return;
    // Soft-delete staff first to preserve engagement history
    await supabase.from('legislative_office_staff').update({ is_active: false }).eq('office_id', office.id);
    await supabase.from('legislative_offices').delete().eq('id', office.id);
    setOffices((prev) => prev.filter((o) => o.id !== office.id));
    setStaffMap((prev) => {
      const next = { ...prev };
      delete next[office.id];
      return next;
    });
  };

  const handleDeleteStaff = async (staffId: string, officeId: string) => {
    if (!confirm('Deactivate this staff member? They will be hidden but historical engagement records will be preserved.')) return;
    await supabase.from('legislative_office_staff').update({ is_active: false }).eq('id', staffId);
    setStaffMap((prev) => ({
      ...prev,
      [officeId]: (prev[officeId] || []).filter((s) => s.id !== staffId),
    }));
  };

  const startEditStaff = (staff: LegislativeOfficeStaff) => {
    setEditingStaffId(staff.id);
    setEditStaffData({
      first_name: staff.first_name,
      last_name: staff.last_name,
      title: staff.title || '',
      email: staff.email || '',
      phone: staff.phone || '',
    });
  };

  const saveEditStaff = async (staffId: string, officeId: string) => {
    setSavingStaff(true);
    const { error } = await supabase
      .from('legislative_office_staff')
      .update({
        first_name: editStaffData.first_name,
        last_name: editStaffData.last_name,
        title: (editStaffData.title as string)?.trim() || null,
        email: (editStaffData.email as string)?.trim() || null,
        phone: (editStaffData.phone as string)?.trim() || null,
      })
      .eq('id', staffId);

    if (!error) {
      setStaffMap((prev) => ({
        ...prev,
        [officeId]: (prev[officeId] || []).map((s) =>
          s.id === staffId ? { ...s, ...editStaffData } as LegislativeOfficeStaff : s
        ),
      }));
    }
    setSavingStaff(false);
    setEditingStaffId(null);
  };

  const handleExportCSV = () => {
    const filtered = offices.filter((o) => o.office_type === activeTab);
    const csv = exportDirectoryCSV(filtered, staffMap);
    downloadFile(csv, `legislative-directory-${activeTab}.csv`, 'text/csv');
  };

  const handleExportVCards = () => {
    const filtered = offices.filter((o) => o.office_type === activeTab);
    const pairs: { staff: LegislativeOfficeStaff; office: LegislativeOffice }[] = [];
    for (const office of filtered) {
      for (const staff of staffMap[office.id] || []) {
        pairs.push({ staff, office });
      }
    }
    if (pairs.length === 0) { alert('No staff to export.'); return; }
    const vcf = allStaffToVCardFile(pairs);
    downloadFile(vcf, `legislative-staff-${activeTab}.vcf`, 'text/vcard');
  };

  if (!hasModule('advoLink')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-gray-500 text-lg">Access to ADVO-LINK is required to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-teal-700 rounded-xl p-5 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center">
            <BookUser className="w-5 h-5 mr-2" />
            Legislative Directory
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              onClick={handleExportVCards}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              vCards
            </button>
            <button
              onClick={() => setShowSmartCapture(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Smart Capture
            </button>
            <button
              onClick={() => setShowMerge(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm transition-colors"
            >
              <GitMerge className="w-3.5 h-3.5" />
              Merge
            </button>
            <button
              onClick={() => {
                setAddOfficeDefaultType(activeTab);
                setShowAddOfficeModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Office
            </button>
          </div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-200 px-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('legislator')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'legislator'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <UserCircle className="w-4 h-4" />
              Legislator Offices
            </button>
            <button
              onClick={() => setActiveTab('committee')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'committee'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Gavel className="w-4 h-4" />
              Committee Offices
            </button>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search offices or staff..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none"
            />
          </div>
        </div>

        {/* State filter pills */}
        {availableStates.length > 1 && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-500 mr-1">Filter:</span>
            <button
              onClick={() => setStateFilter('')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                !stateFilter
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {availableStates.map((st) => (
              <button
                key={st}
                onClick={() => setStateFilter(stateFilter === st ? '' : st)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  stateFilter === st
                    ? getStateColor(st) + ' ring-2 ring-offset-1 ring-teal-400'
                    : getStateColor(st) + ' opacity-70 hover:opacity-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
          ) : filteredOffices.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <BookUser className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No {activeTab === 'legislator' ? 'legislator' : 'committee'} offices found.</p>
              <button
                onClick={() => {
                  setAddOfficeDefaultType(activeTab);
                  setShowAddOfficeModal(true);
                }}
                className="mt-3 text-sm text-teal-600 hover:text-teal-800 font-medium"
              >
                + Add your first office
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOffices.map((office) => {
                const isExpanded = expandedOffices.has(office.id);
                const staff = staffMap[office.id] || [];

                return (
                  <div
                    key={office.id}
                    className={`border border-gray-200 rounded-lg overflow-hidden border-l-4 ${getStateBorder(office.state)}`}
                  >
                    {/* Office header */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => toggleExpand(office.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {office.state && (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${getStateColor(office.state)}`}>{office.state}</span>
                          )}
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {office.office_type === 'legislator' ? displayOfficeName(office.name, office.chamber) : office.name}
                          </span>
                          {office.district && (
                            <span className="text-xs text-gray-500 flex-shrink-0">District {office.district}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                          {office.phone && (
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{office.phone}</span>
                          )}
                          {office.email && (
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{office.email}</span>
                          )}
                          {office.address && (
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{office.address}{office.city ? `, ${office.city}` : ''}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-gray-400 mr-2">{staff.length} staff</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteOffice(office); }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete office"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Staff list */}
                    {isExpanded && (
                      <div className="border-t border-gray-200">
                        {staff.length === 0 ? (
                          <div className="px-4 py-4 text-center text-xs text-gray-400">
                            No staff members yet.
                          </div>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                                <th className="px-4 py-2 text-left font-medium">Name</th>
                                <th className="px-4 py-2 text-left font-medium">Title</th>
                                <th className="px-4 py-2 text-left font-medium">Email</th>
                                <th className="px-4 py-2 text-left font-medium">Phone</th>
                                <th className="px-4 py-2 text-right font-medium w-20">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {staff.map((s) => (
                                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                                  {editingStaffId === s.id ? (
                                    <>
                                      <td className="px-4 py-2">
                                        <div className="flex gap-1">
                                          <input
                                            value={editStaffData.first_name || ''}
                                            onChange={(e) => setEditStaffData((p) => ({ ...p, first_name: e.target.value }))}
                                            className={inputClass}
                                            placeholder="First"
                                          />
                                          <input
                                            value={editStaffData.last_name || ''}
                                            onChange={(e) => setEditStaffData((p) => ({ ...p, last_name: e.target.value }))}
                                            className={inputClass}
                                            placeholder="Last"
                                          />
                                        </div>
                                      </td>
                                      <td className="px-4 py-2">
                                        <input
                                          value={editStaffData.title || ''}
                                          onChange={(e) => setEditStaffData((p) => ({ ...p, title: e.target.value }))}
                                          className={inputClass}
                                        />
                                      </td>
                                      <td className="px-4 py-2">
                                        <input
                                          value={editStaffData.email || ''}
                                          onChange={(e) => setEditStaffData((p) => ({ ...p, email: e.target.value }))}
                                          className={inputClass}
                                        />
                                      </td>
                                      <td className="px-4 py-2">
                                        <input
                                          value={editStaffData.phone || ''}
                                          onChange={(e) => setEditStaffData((p) => ({ ...p, phone: e.target.value }))}
                                          className={inputClass}
                                        />
                                      </td>
                                      <td className="px-4 py-2 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <button
                                            onClick={() => saveEditStaff(s.id, office.id)}
                                            disabled={savingStaff}
                                            className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                          >
                                            {savingStaff ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                          </button>
                                          <button
                                            onClick={() => setEditingStaffId(null)}
                                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-4 py-2 text-gray-900">{s.first_name} {s.last_name}</td>
                                      <td className="px-4 py-2 text-gray-600">{s.title || '—'}</td>
                                      <td className="px-4 py-2 text-gray-600">{s.email || '—'}</td>
                                      <td className="px-4 py-2 text-gray-600">{s.phone || '—'}</td>
                                      <td className="px-4 py-2 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <button
                                            onClick={() => startEditStaff(s)}
                                            className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                            title="Edit staff"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteStaff(s.id, office.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete staff"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        <div className="px-4 py-2 border-t border-gray-100">
                          <button
                            onClick={() => setShowAddStaffForOffice(office)}
                            className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            Add Staff
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddOfficeModal && user && (
        <QuickAddLegOfficeModal
          defaultType={addOfficeDefaultType}
          userId={user.id}
          onCreated={(office) => {
            setOffices((prev) => [...prev, office].sort((a, b) => a.name.localeCompare(b.name)));
            setShowAddOfficeModal(false);
          }}
          onClose={() => setShowAddOfficeModal(false)}
        />
      )}

      {showAddStaffForOffice && user && (
        <QuickAddCommitteeStaffModal
          committeeOffice={showAddStaffForOffice}
          userId={user.id}
          onCreated={(staff) => {
            setStaffMap((prev) => ({
              ...prev,
              [showAddStaffForOffice.id]: [...(prev[showAddStaffForOffice.id] || []), staff],
            }));
            setShowAddStaffForOffice(null);
          }}
          onClose={() => setShowAddStaffForOffice(null)}
        />
      )}

      {showSmartCapture && user && (
        <SmartCaptureLegStaffModal
          isOpen={showSmartCapture}
          existingOffices={offices}
          userId={user.id}
          onCreated={(staff, office) => {
            // Add office if new
            if (!offices.find((o) => o.id === office.id)) {
              setOffices((prev) => [...prev, office].sort((a, b) => a.name.localeCompare(b.name)));
            }
            // Add staff to map
            setStaffMap((prev) => ({
              ...prev,
              [office.id]: [...(prev[office.id] || []), staff],
            }));
            setShowSmartCapture(false);
          }}
          onClose={() => setShowSmartCapture(false)}
        />
      )}

      {showMerge && (
        <MergeLegOfficeModal
          offices={offices}
          staffMap={staffMap}
          onMerged={() => {
            setShowMerge(false);
            fetchAll();
          }}
          onClose={() => setShowMerge(false)}
        />
      )}
    </div>
  );
};

export default LegislativeDirectory;
