'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '../components/ui/page-header';
import { Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

interface PlanFeature {
  feature: string;
  available: boolean;
}

interface Plan {
  name: string;
  price: string;
  description: string;
  features: PlanFeature[];
  buttonText: string;
  recommended?: boolean;
}

// 定義 Supabase 客戶端類型，避免類型錯誤
interface SupabaseClientWithAuth {
  auth: {
    getUser: () => Promise<{data: {user: any}}>;
    updateUser: (options: {data: any}) => Promise<{error: any}>;
  }
};

export default function SubscriptionPage() {
  const [user, setUser] = useState<any>(null);
  const [currentPlan, setCurrentPlan] = useState('Free plan');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  useEffect(() => {
    const getUser = async () => {
      try {
        // 動態導入 supabase 函數
        const { supabase } = await import('@/lib/supabase');
        const supabaseClient = supabase();
        
        // 明確轉換類型
        const supabaseWithTypes = supabaseClient as unknown as SupabaseClientWithAuth;
        
        const { data: { user } } = await supabaseWithTypes.auth.getUser();
        if (user) {
          setUser(user);
          setCurrentPlan(user.user_metadata?.subscription_plan || 'Free plan');
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    getUser();
  }, []);

  const plans: Plan[] = [
    {
      name: 'Free',
      price: '$0',
      description: t('basic_features'),
      features: [
        { feature: t('track_students'), available: true },
        { feature: t('basic_analytics'), available: true },
        { feature: t('create_lessons'), available: true },
        { feature: t('ai_assisted_tools'), available: false },
        { feature: t('advanced_reporting'), available: false },
        { feature: t('priority_support'), available: false },
      ],
      buttonText: currentPlan === 'Free plan' ? t('current_plan') : t('upgrade'),
    },
    {
      name: 'Pro',
      price: '$29',
      description: t('advanced_features'),
      features: [
        { feature: t('unlimited_students'), available: true },
        { feature: t('advanced_analytics'), available: true },
        { feature: t('unlimited_lessons'), available: true },
        { feature: t('ai_assisted_tools'), available: true },
        { feature: t('advanced_reporting'), available: true },
        { feature: t('priority_support'), available: false },
      ],
      buttonText: currentPlan === 'Pro plan' ? t('current_plan') : t('upgrade'),
      recommended: true,
    },
    {
      name: 'Enterprise',
      price: '$99',
      description: t('complete_solution'),
      features: [
        { feature: t('unlimited_students'), available: true },
        { feature: t('advanced_analytics'), available: true },
        { feature: t('unlimited_lessons'), available: true },
        { feature: t('ai_assisted_tools'), available: true },
        { feature: t('advanced_reporting'), available: true },
        { feature: t('priority_support'), available: true },
      ],
      buttonText: currentPlan === 'Enterprise plan' ? t('current_plan') : t('upgrade'),
    },
  ];

  const handlePlanChange = async (planName: string) => {
    if (!user) return;

    if (planName === 'Free' && currentPlan === 'Free plan') {
      toast({
        title: `${t('already_on')} ${t('free_plan')}`,
        description: `${t('already_using')} ${t('free_plan')}.`,
      });
      return;
    }

    if (planName === 'Pro' && currentPlan === 'Pro plan') {
      toast({
        title: `${t('already_on')} ${t('pro_plan')}`,
        description: `${t('already_using')} ${t('pro_plan')}.`,
      });
      return;
    }

    if (planName === 'Enterprise' && currentPlan === 'Enterprise plan') {
      toast({
        title: `${t('already_on')} ${t('enterprise_plan')}`,
        description: `${t('already_using')} ${t('enterprise_plan')}.`,
      });
      return;
    }

    try {
      setIsLoading(true);

      // 動態導入 supabase 函數
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      
      // 顯式轉換類型以解決類型檢查問題
      const supabaseWithTypes = supabaseClient as unknown as SupabaseClientWithAuth;

      // In a real app, this would integrate with a payment processor
      // For now, we'll just update the user metadata
      const { error } = await supabaseWithTypes.auth.updateUser({
        data: {
          subscription_plan: `${planName} plan`
        }
      });

      if (error) throw error;

      setCurrentPlan(`${planName} plan`);

      const planTranslationKey = planName === 'Free' 
        ? 'free_plan' 
        : planName === 'Pro' 
          ? 'pro_plan' 
          : 'enterprise_plan';

      toast({
        title: t('plan_updated'),
        description: `${t('now_on')} ${t(planTranslationKey)}.`,
      });
    } catch (error: any) {
      toast({
        title: t('error_updating_plan'),
        description: error.message || t('failed_update_plan'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader 
        heading={t('subscription_plans')} 
        description={t('choose_plan')}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card 
            key={plan.name} 
            className={`flex flex-col ${plan.recommended ? 'border-primary shadow-md' : ''}`}
          >
            {plan.recommended && (
              <div className="bg-primary text-primary-foreground text-center py-1 text-sm font-medium">
                {t('recommended')}
              </div>
            )}
            <CardHeader>
              <CardTitle>{t(plan.name.toLowerCase() as any)}</CardTitle>
              <div className="flex items-baseline mt-2">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="ml-1 text-muted-foreground">{t('per_month')}</span>
              </div>
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
              <Button 
                className="w-full" 
                variant={currentPlan === `${plan.name} plan` ? 'outline' : 'default'}
                disabled={isLoading || currentPlan === `${plan.name} plan`}
                onClick={() => handlePlanChange(plan.name)}
              >
                {isLoading ? t('processing') : plan.buttonText}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-10 text-center max-w-2xl mx-auto">
        <h3 className="text-lg font-semibold mb-2">{t('custom_plan')}</h3>
        <p className="text-muted-foreground mb-4">
          {t('custom_plan_description')}
        </p>
        <Button variant="outline" onClick={() => window.open('mailto:sales@mindaitutor.com')}>
          {t('contact_sales')}
        </Button>
      </div>
    </div>
  );
} 