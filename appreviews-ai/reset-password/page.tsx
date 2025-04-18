'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../utils/supabase';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    // Check for the password reset hash in the URL
    const checkHashParam = async () => {
      const hash = window.location.hash;
      if (!hash || !hash.startsWith('#access_token=')) {
        router.push('/login');
      }
    };

    checkHashParam();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('resetPassword.passwordMismatch') as string);
      return;
    }

    if (password.length < 6) {
      setError(t('resetPassword.passwordTooShort') as string);
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password
      });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } catch (error: any) {
      console.error('Error updating password:', error);
      setError(error.message || t('resetPassword.error') as string);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-[400px] space-y-8">
          {/* Title area */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              {t('resetPassword.title')}
            </h1>
            <p className="text-gray-600">
              {t('resetPassword.subtitle')}
            </p>
          </div>

          {success ? (
            <div className="rounded-lg border border-green-100 bg-green-50 p-6 text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              <h3 className="text-lg font-medium text-green-800 mb-2">
                {t('resetPassword.success')}
              </h3>
              <p className="text-green-700 text-sm mb-4">
                {t('resetPassword.redirecting')}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="px-4 py-3 rounded-md bg-red-50 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="relative">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('resetPassword.newPassword')}
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 outline-none transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('resetPassword.confirmPassword')}
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 outline-none transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-[#0066FF] hover:bg-[#0052CC] text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? t('resetPassword.loading') : t('resetPassword.button')}
              </button>
              
              <div className="text-center">
                <Link 
                  href="/login" 
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  {t('resetPassword.backToLogin')} <span className="text-[#0066FF] hover:underline">{t('resetPassword.loginLink')}</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
} 