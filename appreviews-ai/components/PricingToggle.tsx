import { useState } from 'react';

// 年付/月付切換組件
export function BillingToggle() {
  const [isAnnual, setIsAnnual] = useState(false);
  
  return (
    <div className="flex items-center justify-center mt-8 space-x-4">
      <span className={`${!isAnnual ? 'text-blue-600' : 'text-gray-500'}`}>
        月付方案
      </span>
      <button
        onClick={() => setIsAnnual(!isAnnual)}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full
          ${isAnnual ? 'bg-blue-600' : 'bg-gray-200'}
        `}
      >
        <span className={`
          inline-block h-4 w-4 transform rounded-full bg-white transition
          ${isAnnual ? 'translate-x-6' : 'translate-x-1'}
        `} />
      </button>
      <span className={`${isAnnual ? 'text-blue-600' : 'text-gray-500'}`}>
        年付方案 (省20%)
      </span>
    </div>
  );
} 