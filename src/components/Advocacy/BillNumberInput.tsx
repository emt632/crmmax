import React from 'react';
import { formatBillNumber } from '../../lib/bill-format';

interface BillNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

const BillNumberInput: React.FC<BillNumberInputProps> = ({
  value,
  onChange,
  className = '',
  placeholder = 'e.g., HR1234, SB456',
}) => {
  const handleBlur = () => {
    if (value) {
      onChange(formatBillNumber(value));
    }
  };

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={`w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition-all ${className}`}
    />
  );
};

export default BillNumberInput;
