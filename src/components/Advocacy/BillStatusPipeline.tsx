import React from 'react';
import type { BillStatus } from '../../types';
import { BILL_STATUS_LABELS, BILL_STATUS_ORDER } from '../../lib/bill-format';

interface BillStatusPipelineProps {
  currentStatus: BillStatus;
  size?: 'sm' | 'md';
}

const STATUS_COLORS: Record<string, string> = {
  introduced: 'bg-gray-400',
  in_committee: 'bg-blue-500',
  passed_house: 'bg-indigo-500',
  passed_senate: 'bg-purple-500',
  enrolled: 'bg-amber-500',
  signed: 'bg-green-500',
  vetoed: 'bg-red-500',
  failed: 'bg-red-500',
};

const BillStatusPipeline: React.FC<BillStatusPipelineProps> = ({ currentStatus, size = 'md' }) => {
  // For terminal statuses (signed, vetoed, failed), show the main pipeline up to enrolled
  // then the terminal status
  const mainSteps = BILL_STATUS_ORDER.slice(0, 5); // introduced through enrolled
  const terminalSteps = ['signed', 'vetoed', 'failed'];
  const isTerminal = terminalSteps.includes(currentStatus);
  const currentIdx = BILL_STATUS_ORDER.indexOf(currentStatus);

  const stepHeight = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <div className="w-full">
      <div className="flex items-center gap-0.5">
        {mainSteps.map((status, idx) => {
          const isCurrent = status === currentStatus;
          const isPassed = idx < currentIdx && !isTerminal ? true : idx <= currentIdx;
          const isActive = isPassed || isCurrent;

          return (
            <div key={status} className="flex-1 flex flex-col items-center">
              <div
                className={`w-full ${stepHeight} rounded-full transition-all ${
                  isActive ? STATUS_COLORS[status] : 'bg-gray-200'
                } ${isCurrent ? 'ring-2 ring-offset-1 ring-teal-400' : ''}`}
              />
              {size === 'md' && (
                <span className={`${textSize} mt-1 text-center leading-tight ${
                  isCurrent ? 'font-semibold text-gray-900' : isActive ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  {BILL_STATUS_LABELS[status]}
                </span>
              )}
            </div>
          );
        })}

        {/* Terminal statuses */}
        {isTerminal && (
          <>
            <div className="mx-1 text-gray-300">→</div>
            <div className="flex flex-col items-center min-w-[60px]">
              <div className={`w-full ${stepHeight} rounded-full ${STATUS_COLORS[currentStatus]} ring-2 ring-offset-1 ring-teal-400`} />
              {size === 'md' && (
                <span className={`${textSize} mt-1 font-semibold text-gray-900`}>
                  {BILL_STATUS_LABELS[currentStatus]}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BillStatusPipeline;
