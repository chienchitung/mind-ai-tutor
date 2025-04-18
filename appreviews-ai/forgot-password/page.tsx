'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../utils/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    if (!email) {
      setError(t('forgotPassword.emailRequired') as string);
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      
      // Success
      setSuccess(true);
    } catch (error: any) {
      console.error('Error sending reset email:', error);
      setError(error.message || t('forgotPassword.error') as string);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Back button */}
      <div className="p-4">
        <Link 
          href="/login" 
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          {t('forgotPassword.backToLogin')}
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-[400px] space-y-8">
          {/* Title area */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              {t('forgotPassword.title')}
            </h1>
            <p className="text-gray-600">
              {t('forgotPassword.subtitle')}
            </p>
          </div>

          {/* Success state */}
          {success ? (
            <div className="rounded-lg border border-green-100 bg-green-50 p-6 text-center">
              <h3 className="text-lg font-medium text-green-800 mb-2">
                {(t('forgotPassword.emailSent') as string).replace('{email}', email)}
              </h3>
              <p className="text-green-700 text-sm mb-4">
                {t('forgotPassword.checkInbox')}
              </p>
              <div className="space-y-4 mt-6">
                <p className="text-sm text-gray-600">
                  {t('forgotPassword.noEmail')} 
                  <button 
                    onClick={handleSubmit} 
                    className="text-[#0066FF] hover:underline ml-1 font-medium"
                    disabled={loading}
                  >
                    {t('forgotPassword.resend')}
                  </button>
                </p>
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-600">
                    {t('forgotPassword.rememberPassword')} 
                    <Link 
                      href="/login" 
                      className="text-[#0066FF] hover:underline ml-1 font-medium"
                    >
                      {t('forgotPassword.backToLoginLink')}
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Form area */
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="px-4 py-3 rounded-md bg-red-50 text-red-700 text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('forgotPassword.email.placeholder') as string}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 outline-none transition-all"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-[#0066FF] hover:bg-[#0052CC] text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? t('forgotPassword.loading') : t('forgotPassword.button')}
              </button>
              
              <div className="text-center">
                <Link 
                  href="/login" 
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  {t('forgotPassword.rememberPassword')} <span className="text-[#0066FF] hover:underline">{t('forgotPassword.backToLoginLink')}</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
} 