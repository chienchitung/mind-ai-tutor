'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';

export default function ResetPasswordRequestPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const { t } = useLanguage();
  const { user } = useAuth();
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      
      // Success
      setSuccess(true);
    } catch (error: any) {
      console.error('Error sending reset email:', error);
      setError(error.message || t('resetPassword.error') as string);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Back button */}
      <div className="p-4">
        <Link 
          href="/account-settings" 
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          {t('settings.backToSettings')}
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-[400px] space-y-8">
          {/* Title area */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              {t('resetPassword.title')}
            </h1>
            <p className="text-gray-600">
              {t('resetPassword.requestSubtitle')}
            </p>
          </div>

          {/* Success state */}
          {success ? (
            <div className="rounded-lg border border-green-100 bg-green-50 p-6 text-center">
              <h3 className="text-lg font-medium text-green-800 mb-2">
                {(t('resetPassword.emailSent') as string).replace('{email}', email)}
              </h3>
              <p className="text-green-700 text-sm mb-4">
                {t('resetPassword.checkInbox')}
              </p>
              <div className="space-y-4 mt-6">
                <p className="text-sm text-gray-600">
                  {t('resetPassword.noEmail')} 
                  <button 
                    onClick={handleResetPassword} 
                    className="text-[#0066FF] hover:underline ml-1 font-medium"
                    disabled={loading}
                  >
                    {t('resetPassword.resend')}
                  </button>
                </p>
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-600">
                    <Link 
                      href="/account-settings" 
                      className="text-[#0066FF] hover:underline font-medium"
                    >
                      {t('settings.backToSettings')}
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-6">
              <div className="bg-blue-50 text-blue-800 rounded-lg p-4 text-sm">
                {t('resetPassword.emailInfo')}
              </div>
              
              {error && (
                <div className="px-4 py-3 rounded-md bg-red-50 text-red-700 text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <p className="text-gray-700 mb-2">
                  {t('resetPassword.currentEmail')}: <span className="font-medium">{email}</span>
                </p>
                
                <button
                  onClick={handleResetPassword}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-[#0066FF] hover:bg-[#0052CC] text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? t('resetPassword.sending') : t('resetPassword.sendResetLink')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 