import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import {
  FileBarChart,
  Download,
  FileText,
  X,
  Users,
  Building2,
  Heart,
  Star,
  Tag,
  Calendar,
  Filter
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Contact, Organization, ContactType, ContactTypeAssignment } from '../types';
import { supabase } from '../lib/supabase';

const Reports: React.FC = () => {
  // Data
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [contactTypes, setContactTypes] = useState<ContactType[]>([]);
  const [typeAssignments, setTypeAssignments] = useState<ContactTypeAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [reportType, setReportType] = useState<'contacts' | 'organizations'>('contacts');
  const [filterState, setFilterState] = useState('all');
  const [filterTypeIds, setFilterTypeIds] = useState<string[]>([]);
  const [filterDonor, setFilterDonor] = useState<'all' | 'yes' | 'no'>('all');
  const [filterVip, setFilterVip] = useState<'all' | 'yes' | 'no'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [contactsRes, orgsRes, typesRes, assignmentsRes] = await Promise.all([
        supabase.from('contacts').select('*').order('last_name'),
        supabase.from('organizations').select('*').order('name'),
        supabase.from('contact_types').select('*').order('sort_order'),
        supabase.from('contact_type_assignments').select('*'),
      ]);

      setContacts(contactsRes.data || []);
      setOrganizations(orgsRes.data || []);
      setContactTypes(typesRes.data || []);
      setTypeAssignments(assignmentsRes.data || []);
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEntityTypes = (entityType: string, entityId: string): ContactType[] => {
    const ids = typeAssignments
      .filter(a => a.entity_type === entityType && a.entity_id === entityId)
      .map(a => a.contact_type_id);
    return contactTypes.filter(ct => ids.includes(ct.id));
  };

  const uniqueStates = useMemo(() => {
    const items = reportType === 'contacts' ? contacts : organizations;
    const states = items.map(i => i.state).filter(Boolean) as string[];
    return [...new Set(states)].sort();
  }, [contacts, organizations, reportType]);

  const filteredContacts = useMemo(() => {
    let filtered = [...contacts];

    if (filterState !== 'all') {
      filtered = filtered.filter(c => c.state === filterState);
    }
    if (filterTypeIds.length > 0) {
      filtered = filtered.filter(c => {
        const cTypes = getEntityTypes('contact', c.id);
        return filterTypeIds.some(id => cTypes.some(ct => ct.id === id));
      });
    }
    if (filterDonor === 'yes') filtered = filtered.filter(c => c.is_donor);
    if (filterDonor === 'no') filtered = filtered.filter(c => !c.is_donor);
    if (filterVip === 'yes') filtered = filtered.filter(c => c.is_vip);
    if (filterVip === 'no') filtered = filtered.filter(c => !c.is_vip);
    if (filterDateFrom) {
      filtered = filtered.filter(c => c.created_at >= filterDateFrom);
    }
    if (filterDateTo) {
      filtered = filtered.filter(c => c.created_at <= filterDateTo + 'T23:59:59');
    }

    return filtered;
  }, [contacts, filterState, filterTypeIds, filterDonor, filterVip, filterDateFrom, filterDateTo, typeAssignments]);

  const filteredOrganizations = useMemo(() => {
    let filtered = [...organizations];

    if (filterState !== 'all') {
      filtered = filtered.filter(o => o.state === filterState);
    }
    if (filterTypeIds.length > 0) {
      filtered = filtered.filter(o => {
        const oTypes = getEntityTypes('organization', o.id);
        return filterTypeIds.some(id => oTypes.some(ct => ct.id === id));
      });
    }
    if (filterDonor === 'yes') filtered = filtered.filter(o => o.is_donor);
    if (filterDonor === 'no') filtered = filtered.filter(o => !o.is_donor);
    if (filterDateFrom) {
      filtered = filtered.filter(o => o.created_at >= filterDateFrom);
    }
    if (filterDateTo) {
      filtered = filtered.filter(o => o.created_at <= filterDateTo + 'T23:59:59');
    }

    return filtered;
  }, [organizations, filterState, filterTypeIds, filterDonor, filterDateFrom, filterDateTo, typeAssignments]);

  const filteredData = reportType === 'contacts' ? filteredContacts : filteredOrganizations;
  const totalCount = reportType === 'contacts' ? contacts.length : organizations.length;

  const clearFilters = () => {
    setFilterState('all');
    setFilterTypeIds([]);
    setFilterDonor('all');
    setFilterVip('all');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const toggleTypeFilter = (typeId: string) => {
    setFilterTypeIds(prev =>
      prev.includes(typeId) ? prev.filter(id => id !== typeId) : [...prev, typeId]
    );
  };

  const buildFilterSummary = (): string => {
    const parts: string[] = [];
    if (filterState !== 'all') parts.push(`State: ${filterState}`);
    if (filterTypeIds.length > 0) {
      const names = contactTypes.filter(ct => filterTypeIds.includes(ct.id)).map(ct => ct.name);
      parts.push(`Types: ${names.join(', ')}`);
    }
    if (filterDonor !== 'all') parts.push(`Donor: ${filterDonor === 'yes' ? 'Yes' : 'No'}`);
    if (reportType === 'contacts' && filterVip !== 'all') parts.push(`VIP: ${filterVip === 'yes' ? 'Yes' : 'No'}`);
    if (filterDateFrom) parts.push(`From: ${filterDateFrom}`);
    if (filterDateTo) parts.push(`To: ${filterDateTo}`);
    return parts.length > 0 ? parts.join(' | ') : 'None';
  };

  const escapeCSV = (val: string): string => `"${(val || '').replace(/"/g, '""')}"`;

  // Standard CSV export
  const exportCSV = () => {
    let headers: string[];
    let rows: string[][];

    if (reportType === 'contacts') {
      headers = ['First Name', 'Last Name', 'Title', 'Work Email', 'Personal Email', 'Mobile Phone', 'Office Phone', 'Address', 'City', 'State', 'ZIP', 'Donor', 'VIP', 'Contact Types', 'Created'];
      rows = filteredContacts.map(c => [
        c.first_name, c.last_name, c.title || '', c.email_work || '', c.email_personal || '',
        c.phone_mobile || '', c.phone_office || '',
        c.address_line1 || '', c.city || '', c.state || '', c.zip || '',
        c.is_donor ? 'Yes' : 'No', c.is_vip ? 'Yes' : 'No',
        getEntityTypes('contact', c.id).map(ct => ct.name).join('; '),
        c.created_at ? format(new Date(c.created_at), 'yyyy-MM-dd') : ''
      ]);
    } else {
      headers = ['Name', 'Type', 'Phone', 'Email', 'Website', 'Address', 'City', 'State', 'ZIP', 'Donor', 'Contact Types', 'Created'];
      rows = filteredOrganizations.map(o => [
        o.name, o.type || '', o.phone || '', o.email || '', o.website || '',
        o.address_line1 || '', o.city || '', o.state || '', o.zip || '',
        o.is_donor ? 'Yes' : 'No',
        getEntityTypes('organization', o.id).map(ct => ct.name).join('; '),
        o.created_at ? format(new Date(o.created_at), 'yyyy-MM-dd') : ''
      ]);
    }

    const csv = [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
    downloadFile(csv, `${reportType}-report-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
  };

  // GiveButter contacts export
  const exportGiveButterContacts = () => {
    const headers = [
      'Givebutter Contact ID', 'Contact External ID', 'Contact Since', 'Prefix',
      'First Name', 'Preferred First Name', 'Middle Name', 'Last Name', 'Suffix',
      'Primary Email', 'Primary Phone Number', 'Address Line 1', 'Address Line 2',
      'City', 'State', 'Zip Code', 'Country', 'Gender', 'Pronouns',
      'Household Name', 'Household Envelope Name', 'Is Household Primary Contact',
      'Email Addresses', 'Phone Numbers', 'Date of Birth', 'Employer', 'Title',
      'Twitter URL', 'LinkedIn URL', 'Facebook URL', 'TikTok URL',
      'Tags', 'Notes', 'Email Subscription Status', 'Phone Subscription Status', 'Address Subscription Status'
    ];

    const rows = filteredContacts.map(c => {
      const tags = getEntityTypes('contact', c.id).map(ct => ct.name).join(', ');
      const primaryEmail = c.email_work || c.email_personal || '';
      const primaryPhone = c.phone_mobile || c.phone_office || '';
      const altEmails = [c.email_work, c.email_personal].filter(Boolean).filter(e => e !== primaryEmail).join(',');
      const altPhones = [c.phone_mobile, c.phone_office, c.phone_home].filter(Boolean).filter(p => p !== primaryPhone).join(', ');

      return [
        '', c.id, c.created_at ? format(new Date(c.created_at), 'yyyy-MM-dd HH:mm:ss') : '', '',
        c.first_name, '', '', c.last_name, '',
        primaryEmail, primaryPhone, c.address_line1 || '', c.address_line2 || '',
        c.city || '', c.state || '', c.zip || '', 'USA', '', '',
        '', '', '',
        altEmails, altPhones, '', '', c.title || '',
        '', '', '', '',
        tags, c.notes || '', '', '', ''
      ];
    });

    const csv = [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
    downloadFile(csv, `givebutter-contacts-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
  };

  // GiveButter companies export
  const exportGiveButterCompanies = () => {
    const headers = [
      'Givebutter Contact ID', 'Contact External ID', 'Contact Since', 'Company',
      'Primary Email', 'Primary Phone Number', 'Address Line 1', 'Address Line 2',
      'City', 'State', 'Zip Code', 'Country', 'Email Addresses', 'Phone Numbers',
      'Twitter URL', 'LinkedIn URL', 'Facebook URL', 'TikTok URL',
      'Tags', 'Notes', 'Email Subscription Status', 'Phone Subscription Status', 'Address Subscription Status',
      'Point of Contact ID', 'Point of Contact First Name', 'Point of Contact Last Name',
      'Point of Contact Primary Email', 'Point of Contact Primary Phone'
    ];

    const rows = filteredOrganizations.map(o => {
      const tags = getEntityTypes('organization', o.id).map(ct => ct.name).join(', ');
      return [
        '', o.id, o.created_at ? format(new Date(o.created_at), 'yyyy-MM-dd HH:mm:ss') : '', o.name,
        o.email || '', o.phone || '', o.address_line1 || '', o.address_line2 || '',
        o.city || '', o.state || '', o.zip || '', 'USA', '', '',
        '', '', '', '',
        tags, o.notes || '', '', '', '',
        '', '', '', '', ''
      ];
    });

    const csv = [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
    downloadFile(csv, `givebutter-companies-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
  };

  // PDF export
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(18);
    doc.text(`Life Link III - ${reportType === 'contacts' ? 'Contacts' : 'Organizations'} Report`, 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')} | Filters: ${buildFilterSummary()}`, 14, 30);

    let headers: string[];
    let rows: string[][];

    if (reportType === 'contacts') {
      headers = ['Name', 'Title', 'Email', 'Phone', 'City/State', 'Donor', 'VIP', 'Types'];
      rows = filteredContacts.map(c => [
        `${c.first_name} ${c.last_name}`,
        c.title || '',
        c.email_work || c.email_personal || '',
        c.phone_mobile || c.phone_office || '',
        [c.city, c.state].filter(Boolean).join(', '),
        c.is_donor ? 'Yes' : '',
        c.is_vip ? 'Yes' : '',
        getEntityTypes('contact', c.id).map(ct => ct.name).join(', ')
      ]);
    } else {
      headers = ['Name', 'Type', 'Email', 'Phone', 'City/State', 'Donor', 'Types'];
      rows = filteredOrganizations.map(o => [
        o.name,
        o.type || '',
        o.email || '',
        o.phone || '',
        [o.city, o.state].filter(Boolean).join(', '),
        o.is_donor ? 'Yes' : '',
        getEntityTypes('organization', o.id).map(ct => ct.name).join(', ')
      ]);
    }

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 36,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount} | Life Link III CRM`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    doc.save(`${reportType}-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
          <FileBarChart className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-blue-600" />
        </div>
        <p className="mt-4 text-gray-600">Loading report data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-600 rounded-xl p-8 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <FileBarChart className="w-8 h-8 mr-3" />
              Reports
            </h1>
            <p className="mt-2 text-blue-100">Filter, analyze, and export your CRM data</p>
          </div>
          <div className="flex space-x-6 text-center">
            <div>
              <p className="text-2xl font-bold">{contacts.length}</p>
              <p className="text-xs text-blue-200">Contacts</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{organizations.length}</p>
              <p className="text-xs text-blue-200">Organizations</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{contacts.filter(c => c.is_donor).length}</p>
              <p className="text-xs text-blue-200">Donors</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{contacts.filter(c => c.is_vip).length}</p>
              <p className="text-xs text-blue-200">VIPs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Report Type Toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 max-w-md">
        <button
          onClick={() => setReportType('contacts')}
          className={`flex-1 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-all ${
            reportType === 'contacts' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4 mr-2" />
          Contacts
        </button>
        <button
          onClick={() => setReportType('organizations')}
          className={`flex-1 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-all ${
            reportType === 'organizations' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Building2 className="w-4 h-4 mr-2" />
          Organizations
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              Showing {filteredData.length} of {totalCount} {reportType}
            </span>
            <button
              onClick={clearFilters}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* State */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All States</option>
              {uniqueStates.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Donor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Donor Status</label>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {(['all', 'yes', 'no'] as const).map(val => (
                <button
                  key={val}
                  onClick={() => setFilterDonor(val)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    filterDonor === val ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {val === 'all' ? 'All' : val === 'yes' ? 'Donors' : 'Non-Donors'}
                </button>
              ))}
            </div>
          </div>

          {/* VIP (contacts only) */}
          {reportType === 'contacts' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">VIP Status</label>
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                {(['all', 'yes', 'no'] as const).map(val => (
                  <button
                    key={val}
                    onClick={() => setFilterVip(val)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                      filterVip === val ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {val === 'all' ? 'All' : val === 'yes' ? 'VIP' : 'Non-VIP'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-3 h-3 inline mr-1" />
              Created Date Range
            </label>
            <div className="flex space-x-2">
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Contact Types Filter */}
        {contactTypes.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Tag className="w-3 h-3 inline mr-1" />
              Contact Types
            </label>
            <div className="flex flex-wrap gap-2">
              {contactTypes.map(ct => (
                <button
                  key={ct.id}
                  onClick={() => toggleTypeFilter(ct.id)}
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    filterTypeIds.includes(ct.id)
                      ? 'text-white shadow-sm'
                      : 'text-gray-700 bg-white border-gray-300 hover:border-gray-400'
                  }`}
                  style={filterTypeIds.includes(ct.id) ? { backgroundColor: ct.color, borderColor: ct.color } : undefined}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full mr-1.5 ${filterTypeIds.includes(ct.id) ? 'bg-white/50' : ''}`}
                    style={!filterTypeIds.includes(ct.id) ? { backgroundColor: ct.color } : undefined}
                  />
                  {ct.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              {reportType === 'contacts' ? (
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">City/State</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Types</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">City/State</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Types</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reportType === 'contacts' ? (
                filteredContacts.slice(0, 50).map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.first_name} {c.last_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.title || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.email_work || c.email_personal || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.phone_mobile || c.phone_office || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{[c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex space-x-1">
                        {c.is_donor && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            <Heart className="w-3 h-3 mr-0.5" />Donor
                          </span>
                        )}
                        {c.is_vip && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                            <Star className="w-3 h-3 mr-0.5" />VIP
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {getEntityTypes('contact', c.id).map(ct => (
                          <span
                            key={ct.id}
                            className="inline-block px-2 py-0.5 rounded-full text-xs text-white"
                            style={{ backgroundColor: ct.color }}
                          >
                            {ct.name}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                filteredOrganizations.slice(0, 50).map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{o.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{o.type || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{o.email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{o.phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{[o.city, o.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      {o.is_donor && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                          <Heart className="w-3 h-3 mr-0.5" />Donor
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {getEntityTypes('organization', o.id).map(ct => (
                          <span
                            key={ct.id}
                            className="inline-block px-2 py-0.5 rounded-full text-xs text-white"
                            style={{ backgroundColor: ct.color }}
                          >
                            {ct.name}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}

              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    No {reportType} match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredData.length > 50 && (
          <div className="px-4 py-3 bg-gray-50 border-t text-sm text-gray-500 text-center">
            Showing first 50 of {filteredData.length} results. Export for full data.
          </div>
        )}
      </div>

      {/* Export Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Export</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportCSV}
            disabled={filteredData.length === 0}
            className="inline-flex items-center px-4 py-2.5 border-2 border-blue-600 text-blue-600 rounded-xl font-medium hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={exportPDF}
            disabled={filteredData.length === 0}
            className="inline-flex items-center px-4 py-2.5 border-2 border-blue-600 text-blue-600 rounded-xl font-medium hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </button>
          <div className="border-l border-gray-300 mx-2" />
          {reportType === 'contacts' ? (
            <button
              onClick={exportGiveButterContacts}
              disabled={filteredContacts.length === 0}
              className="inline-flex items-center px-4 py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export for GiveButter (Contacts)
            </button>
          ) : (
            <button
              onClick={exportGiveButterCompanies}
              disabled={filteredOrganizations.length === 0}
              className="inline-flex items-center px-4 py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export for GiveButter (Companies)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
