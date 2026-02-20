import React from 'react';
import { Eye, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, impersonatedProfile, stopImpersonating } = useAuth();

  if (!isImpersonating || !impersonatedProfile) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4" />
        <span className="text-sm font-medium">
          Viewing as: {impersonatedProfile.full_name || impersonatedProfile.email}
          <span className="ml-2 text-amber-100">
            ({impersonatedProfile.role === 'admin' ? 'Admin' : impersonatedProfile.role})
          </span>
        </span>
      </div>
      <button
        onClick={stopImpersonating}
        className="inline-flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 rounded-lg text-sm font-medium transition-colors"
      >
        <X className="w-3.5 h-3.5" />
        Stop
      </button>
    </div>
  );
};

export default ImpersonationBanner;
