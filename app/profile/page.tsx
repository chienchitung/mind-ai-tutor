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
    return (
      <div className="flex h-[400px] items-center justify-center">
        <p>{t('loading_profile')}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <p>{t('no_profile_found')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-10">
      <h1 className="mb-8 text-3xl font-bold">{t('profile_settings')}</h1>
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback>
              {profile.full_name
                ?.split(' ')
                .map((n) => n[0])
                .join('')}
            </AvatarFallback>
          </Avatar>
          <Button variant="outline">{t('change_avatar')}</Button>
        </div>
        <form onSubmit={handleUpdateProfile} className="space-y-4">
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
          <Button type="submit" disabled={updating}>
            {updating ? t('updating') : t('update_profile')}
          </Button>
        </form>
      </div>
    </div>
  );
} 