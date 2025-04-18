'use client';

import { useLanguage } from '../contexts/LanguageContext';

interface CompanyFilterProps {
  companies: string[];
  selectedCompany: string;
  onCompanyChange: (company: string) => void;
}

export default function CompanyFilter({ 
  companies, 
  selectedCompany, 
  onCompanyChange 
}: CompanyFilterProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {t('filter.company')}
      </label>
      <div className="relative">
        <select
          value={selectedCompany}
          onChange={(e) => onCompanyChange(e.target.value)}
          className="w-full px-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
        >
          <option value="">{t('filter.allCompanies')}</option>
          {companies.map((company) => (
            <option key={company} value={company}>
              {company}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg
            className="h-5 w-5 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    </div>
  );
} 