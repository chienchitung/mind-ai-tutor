'use client';

import { PricingCard, type Plan } from '../components/PricingCard';
import { Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function PricingPage() {
  const { t } = useLanguage();

  const plans: Plan[] = [
    {
      name: t('pricing.plan.free.name') as string,
      price: t('pricing.plan.free.price') as string,
      description: t('pricing.plan.free.description') as string,
      features: (t('pricing.plan.free.features') || []) as string[],
      popular: false,
      type: 'free' as const
    },
    {
      name: t('pricing.plan.pro.name') as string,
      price: t('pricing.plan.pro.price') as string,
      description: t('pricing.plan.pro.description') as string,
      features: (t('pricing.plan.pro.features') || []) as string[],
      popular: true,
      type: 'pro' as const
    },
    {
      name: t('pricing.plan.enterprise.name') as string,
      price: t('pricing.plan.enterprise.price') as string,
      description: t('pricing.plan.enterprise.description') as string,
      features: (t('pricing.plan.enterprise.features') || []) as string[],
      type: 'enterprise' as const
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            {t('pricing.title')}
          </h2>
          <p className="mt-4 text-xl text-gray-600">
            {t('pricing.subtitle')}
          </p>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <PricingCard key={plan.name} plan={plan} />
          ))}
        </div>
      </div>
    </div>
  );
} 