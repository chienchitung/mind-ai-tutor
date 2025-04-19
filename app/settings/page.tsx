'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '../components/ui/page-header';
import { useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, CreditCard } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

// 定義 Supabase 客戶端類型，避免類型錯誤
interface SupabaseClientWithAuth {
  auth: {
    getUser: () => Promise<{data: {user: any}}>;
    updateUser: (options: {data: any}) => Promise<{error: any}>;
  }
}

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  // Fetch user data
  useEffect(() => {
    const getUser = async () => {
      try {
        // 動態導入 supabase 函數
        const { supabase } = await import('@/lib/supabase');
        const supabaseClient = supabase();
        
        // 使用更明確的轉換方式
        const supabaseWithTypes = supabaseClient as unknown as SupabaseClientWithAuth;
        console.log("Got Supabase client:", !!supabaseWithTypes); // 偵錯用
        
        const { data: { user } } = await supabaseWithTypes.auth.getUser();
        console.log("Got user data:", user); // 偵錯用，顯示完整用戶數據
        
        if (user) {
          setUser(user);
          setEmail(user.email || '');
          
          // 處理從不同來源獲取名字的情況
          let extractedFirstName = '';
          let extractedLastName = '';
          
          console.log("User metadata:", user.user_metadata);
          console.log("App metadata:", user.app_metadata);
          
          // 使用已保存的 first_name 和 last_name（優先）
          if (user.user_metadata?.first_name && user.user_metadata?.last_name) {
            extractedFirstName = user.user_metadata.first_name;
            extractedLastName = user.user_metadata.last_name;
            console.log("Using stored first_name and last_name");
          }
          // 對於 Google 登入，使用 Google 提供的命名規則
          else if (user.app_metadata?.provider === 'google') {
            // 優先使用 Google Profile 中的 given_name 和 family_name
            if (user.user_metadata?.given_name && user.user_metadata?.family_name) {
              extractedFirstName = user.user_metadata.given_name;
              extractedLastName = user.user_metadata.family_name;
              console.log("Using Google given_name and family_name");
            }
            // 如果沒有明確的 given_name 和 family_name，使用完整名稱
            else if (user.user_metadata?.name) {
              const nameParts = user.user_metadata.name.split(' ');
              // 假設最後一個部分是姓氏，前面都是名字
              if (nameParts.length > 1) {
                extractedFirstName = nameParts.slice(0, nameParts.length - 1).join(' ');
                extractedLastName = nameParts[nameParts.length - 1];
              } else {
                extractedFirstName = nameParts[0] || '';
                extractedLastName = '';
              }
              console.log("Using split name parts from Google name");
            }
          }
          // 如果有 full_name，拆分它
          else if (user.user_metadata?.full_name) {
            const nameParts = user.user_metadata.full_name.split(' ');
            if (nameParts.length > 1) {
              extractedFirstName = nameParts.slice(0, nameParts.length - 1).join(' ');
              extractedLastName = nameParts[nameParts.length - 1];
            } else {
              extractedFirstName = nameParts[0] || '';
              extractedLastName = '';
            }
            console.log("Using split name parts from full_name");
          }
          // 如果有 name，拆分它
          else if (user.user_metadata?.name) {
            const nameParts = user.user_metadata.name.split(' ');
            if (nameParts.length > 1) {
              extractedFirstName = nameParts.slice(0, nameParts.length - 1).join(' ');
              extractedLastName = nameParts[nameParts.length - 1];
            } else {
              extractedFirstName = nameParts[0] || '';
              extractedLastName = '';
            }
            console.log("Using split name parts from name");
          }
          // 最後使用郵件地址
          else if (user.email) {
            extractedFirstName = user.email.split('@')[0];
            extractedLastName = '';
            console.log("Using email prefix as name");
          }
          
          setFirstName(extractedFirstName);
          setLastName(extractedLastName);
          
          console.log("Extracted name:", extractedFirstName, extractedLastName); // 偵錯用
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getUser();
  }, []);

  const handleUpdateProfile = async () => {
    try {
      setIsLoading(true);
      
      // 動態導入 supabase 函數
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      
      // 顯式轉換類型以解決類型檢查問題
      const supabaseWithTypes = supabaseClient as unknown as SupabaseClientWithAuth;
      
      const { error } = await supabaseWithTypes.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`
        }
      });

      if (error) throw error;

      // 更新本地狀態以立即顯示變更
      setUser({
        ...user,
        user_metadata: {
          ...user.user_metadata,
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`
        }
      });

      toast({
        title: t('profile_updated'),
        description: t('profile_update_success')
      });
    } catch (error: any) {
      toast({
        title: t('update_failed'),
        description: error.message || 'Failed to update profile. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = () => {
    // Implement password change
    toast({
      title: 'Coming soon',
      description: 'Password change feature will be available soon.'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeader 
        heading={t('settings')} 
        description={t('manage_settings')}
      />

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>{t('profile')}</span>
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span>{t('account')}</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span>{t('billing')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile_information')}</CardTitle>
              <CardDescription>{t('update_personal_information')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                <Avatar className="h-16 w-16">
                  {user?.user_metadata?.avatar_url ? (
                    <AvatarImage src={user.user_metadata.avatar_url} alt="User" />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-primary text-xl">
                      {firstName.charAt(0)}{lastName.charAt(0)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">{`${firstName} ${lastName}`}</h3>
                  <p className="text-sm text-muted-foreground">{email}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t('first_name')}</Label>
                  <Input 
                    id="firstName" 
                    value={firstName} 
                    onChange={(e) => setFirstName(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t('last_name')}</Label>
                  <Input 
                    id="lastName" 
                    value={lastName} 
                    onChange={(e) => setLastName(e.target.value)} 
                  />
                </div>
              </div>

              <Button onClick={handleUpdateProfile} disabled={isLoading}>
                {t('update_profile')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('account')}</CardTitle>
              <CardDescription>{t('manage_account_details')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input id="email" value={email} disabled />
                <p className="text-sm text-muted-foreground">
                  {t('email_used_for')}
                </p>
            </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">{t('password')}</h3>
              <p className="text-sm text-muted-foreground">
                  {t('change_password_description')}
                </p>
                <Button variant="outline" onClick={handleChangePassword}>
                  {t('change_password')}
                  </Button>
            </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('subscription')}</CardTitle>
              <CardDescription>{t('manage_subscription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="text-lg font-medium">
                    {user?.user_metadata?.subscription_plan === 'Free plan' 
                      ? t('free_plan') 
                      : user?.user_metadata?.subscription_plan === 'Pro plan' 
                        ? t('pro_plan')
                        : user?.user_metadata?.subscription_plan === 'Enterprise plan'
                          ? t('enterprise_plan')
                          : user?.user_metadata?.subscription_plan || t('free_plan')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {user?.user_metadata?.subscription_plan === 'Free plan' 
                      ? t('basic_features_description')
                      : t('full_access_description')}
                  </p>
                </div>
                <Button variant="outline" onClick={() => window.location.href = '/subscription'}>
                  {t('upgrade')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 