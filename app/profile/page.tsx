'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/types/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, PageLoader } from '@/components/ui/page-state';
import { UserRound } from 'lucide-react';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function ProfilePage() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // 動態導入 supabase 函數
        const { supabase } = await import('@/lib/supabase');
        const supabaseClient = supabase();
        
        const {
          data: { user },
        } = await supabaseClient.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        const { data, error } = await supabaseClient
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) {
          throw error;
        }

        setProfile(data);
      } catch (error: any) {
        toast({
          title: t('error'),
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router, toast, t]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setUpdating(true);
    try {
      // 動態導入 supabase 函數
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      
      const { error } = await supabaseClient
        .from('profiles')
        .update({
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        })
        .eq('id', profile.id);

      if (error) {
        throw error;
      }

      toast({
        title: t('success'),
        description: t('profile_update_success'),
      });
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  if (!profile) {
    return (
      <EmptyState
        title={t('no_profile_found')}
        description={language === 'zh-TW' ? '目前帳號沒有可編輯的個人資料。' : 'There is no editable profile for this account.'}
        icon={UserRound}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        heading={t('profile_settings')}
        text={language === 'zh-TW' ? '更新你的公開名稱與個人資料。' : 'Update your display name and profile information.'}
      />
      <Card className="mx-auto w-full max-w-2xl shadow-none">
        <CardHeader>
          <CardTitle>{t('profile_information')}</CardTitle>
          <CardDescription>{t('update_personal_information')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex items-center gap-4 rounded-xl bg-muted/50 p-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name || ''} />
              <AvatarFallback>
                {profile.full_name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">{profile.full_name}</p>
              <p className="text-sm capitalize text-muted-foreground">{profile.role}</p>
            </div>
          </div>
          <form onSubmit={handleUpdateProfile} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="full_name">{t('full_name')}</Label>
            <Input
              id="full_name"
              value={profile.full_name ?? ''}
              onChange={(e) =>
                setProfile({ ...profile, full_name: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">{t('role')}</Label>
            <Input id="role" value={profile.role} disabled />
          </div>
          <div className="flex justify-end border-t border-border/70 pt-5">
          <Button type="submit" disabled={updating}>
            {updating ? t('updating') : t('update_profile')}
          </Button>
          </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
