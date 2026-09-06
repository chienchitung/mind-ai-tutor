'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';
import { Check, X } from 'lucide-react';
import { useEffect } from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

interface PlanFeature {
  feature: string;
  available: boolean;
}

interface Plan {
  name: string;
  /** Omitted (with contactForPricing set) for Enterprise: its pricing
   * depends on the school/organization's needs, so there is no flat monthly
   * number to show - the card displays custom_pricing in its place and its
   * own button opens a sales email instead of the disabled "not available
   * yet" state the other two plans use. */
  price?: string;
  /** Total price for one year of the annual billing option, shown instead
   * of `price` when the annual toggle is selected. Free is NT$0 either way;
   * Enterprise has no numeric price at all. */
  annualPrice?: string;
  /** Only Pro actually saves money by paying annually (Free is free either
   * way, Enterprise is a custom quote) - gates the savings note under the
   * price instead of diffing price strings to detect a real discount. */
  hasAnnualDiscount?: boolean;
  contactForPricing?: boolean;
  description: string;
  features: PlanFeature[];
  buttonText: string;
  recommended?: boolean;
}

export default function SubscriptionPage() {
  const [currentPlan, setCurrentPlan] = useState('Free plan');
  const [isLoading, setIsLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  useEffect(() => {
    const getUser = async () => {
      try {
        // 動態導入 supabase 函數
        const { supabase } = await import('@/lib/supabase');
        const supabaseClient = supabase();

        // 明確轉換類型
        const supabaseWithTypes = supabaseClient;

        const { data: { user } } = await supabaseWithTypes.auth.getUser();
        if (user) {
          setCurrentPlan(user.user_metadata?.subscription_plan || 'Free plan');
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getUser();
  }, []);

  const plans: Plan[] = [
    {
      name: 'Free',
      price: 'NT$0',
      annualPrice: 'NT$0',
      description: t('basic_features'),
      features: [
        { feature: t('track_students'), available: true },
        { feature: t('basic_analytics'), available: true },
        { feature: t('create_lessons'), available: true },
        { feature: t('ai_points_free'), available: true },
        { feature: t('advanced_reporting'), available: false },
        { feature: t('priority_support'), available: false },
      ],
      buttonText: currentPlan === 'Free plan' ? t('current_plan') : t('upgrade'),
    },
    {
      name: 'Pro',
      price: 'NT$899',
      annualPrice: 'NT$8,990',
      hasAnnualDiscount: true,
      description: t('advanced_features'),
      features: [
        { feature: t('unlimited_students'), available: true },
        { feature: t('advanced_analytics'), available: true },
        { feature: t('unlimited_lessons'), available: true },
        { feature: t('ai_points_pro'), available: true },
        { feature: t('advanced_reporting'), available: true },
        { feature: t('priority_support'), available: false },
      ],
      buttonText: currentPlan === 'Pro plan' ? t('current_plan') : t('upgrade'),
      recommended: true,
    },
    {
      name: 'Enterprise',
      contactForPricing: true,
      description: t('complete_solution'),
      features: [
        { feature: t('unlimited_students'), available: true },
        { feature: t('advanced_analytics'), available: true },
        { feature: t('unlimited_lessons'), available: true },
        { feature: t('ai_points_unlimited'), available: true },
        { feature: t('advanced_reporting'), available: true },
        { feature: t('priority_support'), available: true },
      ],
      buttonText: currentPlan === 'Enterprise plan' ? t('current_plan') : t('upgrade'),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        heading={t('subscription_plans')}
        text={t('choose_plan')}
      />

      <div className="app-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{t('current_plan')}</p>
          <p className="mt-1 font-semibold">{currentPlan}</p>
        </div>
        <p className="text-sm text-muted-foreground">{language === 'zh-TW' ? '方案與價格僅供預覽，尚未開放線上付款及自助升級。帳號方案標記不代表付款狀態。' : 'Plans and prices are a preview. Online payment and self-service upgrades are not available. The account plan label does not indicate payment status.'}</p>
      </div>

      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border p-1">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${billingCycle === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            {t('billing_monthly')}
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${billingCycle === 'annual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            {t('billing_annual')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`relative flex flex-col overflow-hidden shadow-none ${plan.recommended ? 'border-primary ring-1 ring-primary/20' : ''}`}
          >
            {plan.recommended && (
              <div className="bg-primary px-3 py-1.5 text-center text-sm font-medium text-primary-foreground">
                {t('recommended')}
              </div>
            )}
            <CardHeader>
              <CardTitle>{t(plan.name.toLowerCase() as any)}</CardTitle>
              <div className="flex items-baseline mt-2">
                {plan.contactForPricing ? (
                  <span className="text-2xl font-bold">{t('custom_pricing')}</span>
                ) : (
                  <>
                    <span className="text-3xl font-bold">{billingCycle === 'annual' ? plan.annualPrice : plan.price}</span>
                    <span className="ml-1 text-muted-foreground">{billingCycle === 'annual' ? t('per_year') : t('per_month')}</span>
                  </>
                )}
              </div>
              {!plan.contactForPricing && billingCycle === 'annual' && plan.hasAnnualDiscount && (
                <p className="mt-1 text-xs text-green-600">{t('annual_discount_note')}</p>
              )}
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start">
                    {feature.available ? (
                      <Check className="h-5 w-5 text-green-500 mr-2 shrink-0" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground mr-2 shrink-0" />
                    )}
                    <span className={feature.available ? '' : 'text-muted-foreground'}>
                      {feature.feature}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {plan.contactForPricing ? (
                // Contacting sales isn't gated behind the self-service
                // billing this app doesn't have yet - unlike Free/Pro's
                // "upgrade" button, this one actually works today.
                <Button className="w-full" variant="outline" onClick={() => window.open('mailto:contact@mindaitutor.com')}>
                  {t('contact_sales')}
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant={currentPlan === `${plan.name} plan` ? 'outline' : 'default'}
                  disabled
                >
                  {isLoading ? t('processing') : currentPlan === `${plan.name} plan` ? t('current_plan') : (language === 'zh-TW' ? '尚未開放' : 'Not available yet')}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
