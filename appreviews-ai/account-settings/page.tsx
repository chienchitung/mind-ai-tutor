'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Eye, EyeOff, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../utils/supabase';

export default function AccountSettings() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading1, setLoading1] = useState(false);
  
  useEffect(() => {
    // Redirect if not logged in
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    
    // Set initial values
    if (user) {
      setEmail(user.email || '');
      setDisplayName(user.user_metadata?.name || user.user_metadata?.full_name || '');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading1(true);
    
    try {
      // Update user metadata (display name)
      if (displayName) {
        const { error } = await supabase.auth.updateUser({
          data: { name: displayName },
        });
        
        if (error) throw error;
      }
      
      // Update password if provided
      if (password) {
        if (password !== confirmPassword) {
          setMessage({ type: 'error', text: t('settings.passwordMismatch') as string });
          setLoading1(false);
          return;
        }
        
        const { error } = await supabase.auth.updateUser({
          password,
        });
        
        if (error) throw error;
        
        setPassword('');
        setConfirmPassword('');
      }
      
      setMessage({ type: 'success', text: t('settings.profileUpdated') as string });
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || t('settings.updateError') as string
      });
    } finally {
      setLoading1(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <Link 
            href="/scraper" 
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            {t('settings.backToScraper')}
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-5 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">{t('settings.accountSettings')}</h1>
          </div>
          
          <div className="p-6">
            {message && (
              <div className={`p-4 mb-6 rounded-md ${
                message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                <div className="flex items-center">
                  {message.type === 'error' && <AlertCircle className="h-5 w-5 mr-2" />}
                  <p>{message.text}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-8">
              {/* Profile Section */}
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('settings.profile')}</h2>
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    {user?.user_metadata?.avatar_url ? (
                      <div className="w-24 h-24 rounded-full overflow-hidden">
                        <Image
                          src={user.user_metadata.avatar_url}
                          alt="Profile"
                          width={96}
                          height={96}
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-gray-500 text-2xl font-medium">
                          {displayName ? displayName[0].toUpperCase() : 'U'}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <form onSubmit={handleSubmit}>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                            {t('settings.displayName')}
                          </label>
                          <input
                            id="displayName"
                            type="text"
                            value={displayName}
                            onChange={(e) => {
                              setDisplayName(e.target.value);
                              if (!isEditing) setIsEditing(true);
                            }}
                            className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                            {t('settings.emailAddress')}
                          </label>
                          <input
                            id="email"
                            type="email"
                            value={email}
                            disabled
                            className="w-full px-4 py-2 rounded-md border border-gray-300 bg-gray-50 text-gray-500"
                          />
                          <p className="mt-1 text-sm text-gray-500">{t('settings.emailCannotChange')}</p>
                        </div>
                      </div>
                      
                      {isEditing && (
                        <div className="mt-4">
                          <button
                            type="submit"
                            disabled={loading1}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            {loading1 ? (
                              <span className="inline-flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                {t('settings.saving')}
                              </span>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                {t('settings.saveChanges')}
                              </>
                            )}
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              setDisplayName(user?.user_metadata?.name || user?.user_metadata?.full_name || '');
                              setIsEditing(false);
                            }}
                            className="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            {t('settings.cancel')}
                          </button>
                        </div>
                      )}
                    </form>
                  </div>
                </div>
              </section>
              
              {/* Password Section */}
              <section className="border-t border-gray-200 pt-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('settings.security')}</h2>
                
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{t('settings.password')}</div>
                      <div className="text-xs text-gray-500">{t('settings.passwordDesc')}</div>
                    </div>
                    <Link
                      href="/reset-password-request"
                      className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {t('settings.resetPassword')}
                    </Link>
                  </div>
                </div>
              </section>
              
              {/* Privacy Section */}
              <section className="border-t border-gray-200 pt-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('settings.preferences')}</h2>
                
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="emailNotifications"
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="emailNotifications" className="font-medium text-gray-700">
                        {t('settings.emailNotifications')}
                      </label>
                      <p className="text-gray-500">{t('settings.emailNotificationsDesc')}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="marketingEmails"
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="marketingEmails" className="font-medium text-gray-700">
                        {t('settings.marketingEmails')}
                      </label>
                      <p className="text-gray-500">{t('settings.marketingEmailsDesc')}</p>
                    </div>
                  </div>
                </div>
              </section>
              
              {/* Connected Accounts Section */}
              <section className="border-t border-gray-200 pt-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('settings.connectedAccounts')}</h2>
                
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <div className="px-6 py-4 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <svg viewBox="0 0 24 24" className="h-6 w-6">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <div>
                        <div className="text-sm font-medium text-gray-900">Google</div>
                        <div className="text-xs text-gray-500">{t('settings.connected')}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900 hover:underline"
                    >
                      {t('settings.disconnect')}
                    </button>
                  </div>
                </div>
              </section>
              
              {/* Danger Zone */}
              <section className="border-t border-gray-200 pt-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('settings.dangerZone')}</h2>
                
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <h3 className="text-sm font-medium text-red-800">{t('settings.deleteAccount')}</h3>
                  <p className="mt-1 text-sm text-red-600">
                    {t('settings.deleteAccountDesc')}
                  </p>
                  <div className="mt-4">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-red-700 border border-red-300 rounded-md hover:bg-red-100"
                    >
                      {t('settings.deleteAccount')}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 