import React, { useState, useEffect } from 'react';
import { Link2, X, Plus, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatBillNumber } from '../../lib/bill-format';
import type { Bill } from '../../types';

interface CompanionBillGroupProps {
  billId: string;
  billGroupId: string | null;
  onGroupChange: (groupId: string | null) => void;
  userId: string;
}

const CompanionBillGroup: React.FC<CompanionBillGroupProps> = ({
  billId,
  billGroupId,
  onGroupChange,
  userId,
}) => {
  const [companionBills, setCompanionBills] = useState<Bill[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Bill[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (billGroupId) fetchCompanions();
  }, [billGroupId]);

  const fetchCompanions = async () => {
    if (!billGroupId) return;
    const { data } = await supabase
      .from('bills')
      .select('id, bill_number, title, jurisdiction, status')
      .eq('bill_group_id', billGroupId)
      .neq('id', billId);
    setCompanionBills((data || []) as Bill[]);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const { data } = await supabase
      .from('bills')
      .select('id, bill_number, title, jurisdiction, status')
      .neq('id', billId)
      .ilike('bill_number', `%${searchQuery}%`)
      .limit(10);
    setSearchResults((data || []) as Bill[]);
    setIsSearching(false);
  };

  const linkBill = async (targetBill: Bill) => {
    let groupId = billGroupId;

    // Create group if none exists
    if (!groupId) {
      const { data, error } = await supabase
        .from('bill_groups')
        .insert({ label: 'Companion Bills', created_by: userId })
        .select('id')
        .single();
      if (error || !data) return;
      groupId = data.id;

      // Assign current bill to group
      await supabase.from('bills').update({ bill_group_id: groupId }).eq('id', billId);
      onGroupChange(groupId);
    }

    // Assign target bill to group
    await supabase.from('bills').update({ bill_group_id: groupId }).eq('id', targetBill.id);

    setCompanionBills((prev) => [...prev, targetBill]);
    setSearchResults([]);
    setSearchQuery('');
    setShowSearch(false);
  };

  const unlinkBill = async (targetBillId: string) => {
    await supabase.from('bills').update({ bill_group_id: null }).eq('id', targetBillId);
    setCompanionBills((prev) => prev.filter((b) => b.id !== targetBillId));

    // If no companions left, remove group from current bill
    if (companionBills.length <= 1) {
      await supabase.from('bills').update({ bill_group_id: null }).eq('id', billId);
      onGroupChange(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          Companion Bills
        </h4>
        <button
          type="button"
          onClick={() => setShowSearch(!showSearch)}
          className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Link Bill
        </button>
      </div>

      {companionBills.length > 0 && (
        <div className="space-y-1">
          {companionBills.map((b) => (
            <div key={b.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <div>
                <span className="text-sm font-medium text-gray-900">{formatBillNumber(b.bill_number)}</span>
                <span className="mx-2 text-xs text-gray-400">|</span>
                <span className="text-xs text-gray-500">{b.jurisdiction}</span>
                <p className="text-xs text-gray-500 truncate max-w-xs">{b.title}</p>
              </div>
              <button
                type="button"
                onClick={() => unlinkBill(b.id)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showSearch && (
        <div className="border border-gray-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by bill number..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={isSearching}
              className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {searchResults.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => linkBill(b)}
                  className="w-full text-left py-2 px-3 rounded-lg hover:bg-teal-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900">{formatBillNumber(b.bill_number)}</span>
                  <span className="mx-2 text-xs text-gray-400">|</span>
                  <span className="text-xs text-gray-500">{b.jurisdiction}</span>
                  <p className="text-xs text-gray-500 truncate">{b.title}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!billGroupId && companionBills.length === 0 && !showSearch && (
        <p className="text-sm text-gray-400 italic">No companion bills linked</p>
      )}
    </div>
  );
};

export default CompanionBillGroup;
