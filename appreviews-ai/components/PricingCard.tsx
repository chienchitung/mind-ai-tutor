'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

// 將 Plan 介面導出
export interface Plan {
  name: string;
  price: string;
  description: string;
  features: string[];
  popular?: boolean;
  type: 'free' | 'pro' | 'enterprise';
}

export function PricingCard({ plan }: { plan: Plan }) {
  const router = useRouter();
  const { t } = useLanguage();

  const handleClick = () => {
    switch (plan.type) {
      case 'free':
        router.push('/scraper');
        break;
      case 'pro':
        router.push('/checkout');
        break;
      case 'enterprise':
        router.push('/enterprise');
        break;
    }
  };

  const getButtonText = () => {
    switch (plan.type) {
      case 'free':
        return t('pricing.card.button.free');
      case 'pro':
        return t('pricing.card.button.pro');
      case 'enterprise':
        return t('pricing.card.button.enterprise');
    }
  };

  return (
    <div
      className={`rounded-lg shadow-lg overflow-hidden bg-white relative
        ${plan.popular ? 'ring-2 ring-blue-500 scale-105' : ''}`}
    >
      {plan.popular && (
        <div className="absolute top-0 right-0 bg-blue-500 text-white px-4 py-1 rounded-bl-lg">
          {t('pricing.card.popular')}
        </div>
      )}
      <div className="px-6 py-8">
        <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
        <p className="mt-4 text-gray-500">{plan.description}</p>
        <p className="mt-8">
          <span className="text-4xl font-extrabold text-gray-900">
            {plan.price}
          </span>
          {plan.type !== 'enterprise' && (
            <span className="text-base font-medium text-gray-500">
              {t('pricing.card.perMonth')}
            </span>
          )}
        </p>
        <button
          onClick={handleClick}
          className="mt-8 block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-150"
        >
          {getButtonText()}
        </button>
      </div>
      <div className="px-6 pt-6 pb-8 bg-gray-50">
        <h4 className="text-sm font-bold text-gray-900 tracking-wide uppercase">
          {t('pricing.card.features')}
        </h4>
        <ul className="mt-6 space-y-4">
          {plan.features.map((feature) => (
            <li key={feature} className="flex space-x-3">
              <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
              <span className="text-base text-gray-700">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
} 