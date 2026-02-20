import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Building2, MapPin, Phone, Star, Loader2 } from 'lucide-react';
import { searchCMSHospitals, toTitleCase, type CMSHospital } from '../../lib/cms-api';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'DC','PR','VI','GU','AS','MP',
];

interface CMSHospitalLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (hospital: CMSHospital) => void;
}

const CMSHospitalLookupModal: React.FC<CMSHospitalLookupModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [results, setResults] = useState<CMSHospital[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      // Reset on close
      setSearchTerm('');
      setStateFilter('');
      setResults([]);
      setError('');
      setHasSearched(false);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchTerm.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch();
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm, stateFilter]);

  const performSearch = async () => {
    if (searchTerm.length < 2) return;
    setLoading(true);
    setError('');
    try {
      const data = await searchCMSHospitals(searchTerm, stateFilter || undefined);
      setResults(data);
      setHasSearched(true);
    } catch (err: any) {
      setError(err.message || 'Failed to search CMS database');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (hospital: CMSHospital) => {
    onSelect(hospital);
    onClose();
  };

  const renderStars = (rating: string) => {
    const num = parseInt(rating);
    if (isNaN(num) || num < 1) return null;
    return (
      <div className="flex items-center space-x-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${i < num ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-start justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500/75 transition-opacity" onClick={onClose} />

        <div className="relative inline-block bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-3xl sm:w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-white">
                <Building2 className="w-5 h-5 mr-2" />
                <h3 className="text-lg font-semibold">Search CMS Hospitals</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-emerald-100 text-sm mt-1">
              Search Medicare-certified hospitals from CMS data
            </p>
          </div>

          {/* Search Controls */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by hospital name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm min-w-[100px]"
              >
                <option value="">All States</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            {searchTerm.length > 0 && searchTerm.length < 2 && (
              <p className="text-xs text-gray-500 mt-2">Type at least 2 characters to search</p>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                <span className="ml-2 text-sm text-gray-600">Searching CMS database...</span>
              </div>
            )}

            {error && (
              <div className="px-6 py-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {!loading && !error && hasSearched && results.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No hospitals found matching "{searchTerm}"</p>
                <p className="text-xs text-gray-400 mt-1">Try a different name or remove the state filter</p>
              </div>
            )}

            {!loading && !error && !hasSearched && (
              <div className="text-center py-12">
                <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Enter a hospital name to search</p>
                <p className="text-xs text-gray-400 mt-1">~5,400 Medicare-certified hospitals available</p>
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="divide-y divide-gray-100">
                {results.map((hospital) => (
                  <button
                    key={hospital.facility_id}
                    onClick={() => handleSelect(hospital)}
                    className="w-full text-left px-6 py-4 hover:bg-emerald-50 transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 truncate">
                            {toTitleCase(hospital.facility_name)}
                          </p>
                          {renderStars(hospital.hospital_overall_rating)}
                        </div>
                        <div className="flex items-center mt-1 text-xs text-gray-500">
                          <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span className="truncate">
                            {toTitleCase(hospital.address)}, {toTitleCase(hospital.citytown)}, {hospital.state} {hospital.zip_code}
                          </span>
                        </div>
                        <div className="flex items-center mt-1 space-x-3">
                          {hospital.telephone_number && (
                            <span className="flex items-center text-xs text-gray-500">
                              <Phone className="w-3 h-3 mr-1" />
                              {hospital.telephone_number}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {hospital.hospital_type}
                          </span>
                          {hospital.emergency_services === 'Yes' && (
                            <span className="text-xs text-red-500 font-medium">ER</span>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        <span className="text-xs text-emerald-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          Select
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {results.length > 0 && (
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Showing {results.length} result{results.length !== 1 ? 's' : ''} — Click a hospital to auto-fill the form
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CMSHospitalLookupModal;
