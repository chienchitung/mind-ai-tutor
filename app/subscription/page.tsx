'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '../components/ui/page-header';
import { Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '../../lib/supabase';
import { useEffect } from 'react';

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

export default function SubscriptionPage() {
  const [user, setUser] = useState<any>(null);
  const [currentPlan, setCurrentPlan] = useState('Free plan');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
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
      description: 'Basic features for individual teachers',
      features: [
        { feature: 'Track up to 30 students', available: true },
        { feature: 'Basic analytics', available: true },
        { feature: 'Create up to 5 lessons', available: true },
        { feature: 'AI-assisted learning tools', available: false },
        { feature: 'Advanced reporting', available: false },
        { feature: 'Priority support', available: false },
      ],
      buttonText: currentPlan === 'Free plan' ? 'Current Plan' : 'Downgrade',
    },
    {
      name: 'Pro',
      price: '$29',
      description: 'Advanced features for professional educators',
      features: [
        { feature: 'Unlimited students', available: true },
        { feature: 'Advanced analytics', available: true },
        { feature: 'Unlimited lessons', available: true },
        { feature: 'AI-assisted learning tools', available: true },
        { feature: 'Advanced reporting', available: true },
        { feature: 'Priority support', available: false },
      ],
      buttonText: currentPlan === 'Pro plan' ? 'Current Plan' : 'Upgrade',
      recommended: true,
    },
    {
      name: 'Enterprise',
      price: '$99',
      description: 'Complete solution for schools and organizations',
      features: [
        { feature: 'Unlimited students', available: true },
        { feature: 'Advanced analytics', available: true },
        { feature: 'Unlimited lessons', available: true },
        { feature: 'AI-assisted learning tools', available: true },
        { feature: 'Advanced reporting', available: true },
        { feature: 'Priority support', available: true },
      ],
      buttonText: currentPlan === 'Enterprise plan' ? 'Current Plan' : 'Upgrade',
    },
  ];

  const handlePlanChange = async (planName: string) => {
    if (!user) return;

    if (planName === 'Free' && currentPlan === 'Free plan') {
      toast({
        title: 'Already on Free plan',
        description: 'You are already using the Free plan.',
      });
      return;
    }

    if (planName === 'Pro' && currentPlan === 'Pro plan') {
      toast({
        title: 'Already on Pro plan',
        description: 'You are already using the Pro plan.',
      });
      return;
    }

    if (planName === 'Enterprise' && currentPlan === 'Enterprise plan') {
      toast({
        title: 'Already on Enterprise plan',
        description: 'You are already using the Enterprise plan.',
      });
      return;
    }

    try {
      setIsLoading(true);

      // In a real app, this would integrate with a payment processor
      // For now, we'll just update the user metadata
      const { error } = await supabase.auth.updateUser({
        data: {
          subscription_plan: `${planName} plan`
        }
      });

      if (error) throw error;

      setCurrentPlan(`${planName} plan`);

      toast({
        title: 'Plan updated',
        description: `You are now on the ${planName} plan.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error updating plan',
        description: error.message || 'Failed to update subscription plan.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader 
        heading="Subscription Plans" 
        description="Choose the plan that best fits your needs"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card 
            key={plan.name} 
            className={`flex flex-col ${plan.recommended ? 'border-primary shadow-md' : ''}`}
          >
            {plan.recommended && (
              <div className="bg-primary text-primary-foreground text-center py-1 text-sm font-medium">
                Recommended
              </div>
            )}
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <div className="flex items-baseline mt-2">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="ml-1 text-muted-foreground">/month</span>
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
                {isLoading ? 'Processing...' : plan.buttonText}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-10 text-center max-w-2xl mx-auto">
        <h3 className="text-lg font-semibold mb-2">Need a custom plan?</h3>
        <p className="text-muted-foreground mb-4">
          If you need a custom plan for your school or organization, please contact our sales team.
        </p>
        <Button variant="outline" onClick={() => window.open('mailto:sales@mindaitutor.com')}>
          Contact Sales
        </Button>
      </div>
    </div>
  );
} 