'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { t } = useLanguage();
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate form
    if (!name || !email || !password || !confirmPassword) {
      setError(t('signup.allFieldsRequired') as string);
      return;
    }
    
    if (password !== confirmPassword) {
      setError(t('signup.passwordMismatch') as string);
      return;
    }
    
    if (!termsAccepted) {
      setError(t('signup.acceptTerms') as string);
      return;
    }
    
    setLoading(true);
    
    try {
      // Register the user with Supabase
      const data = await signUp(email, password, {
        data: { name },
      });
      
      if (data?.user?.identities?.length === 0) {
        // User already exists
        setError(t('signup.emailExists') as string);
      } else if (data?.user) {
        // Check if email confirmation is needed
        if (data.user.confirmed_at) {
          // No email confirmation needed
          alert(t('signup.success'));
          router.push('/login');
        } else {
          // Email confirmation needed
          alert(t('signup.confirmEmail'));
          router.push('/login');
        }
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      if (error.message) {
        setError(error.message);
      } else {
        setError(t('signup.error') as string);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 返回按鈕 */}
      <div className="p-4">
        <Link 
          href="/" 
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          {t('signup.backToHome')}
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-[400px] space-y-8">
          {/* 標題區 */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              {t('signup.title')}
            </h1>
            <p className="text-gray-600">
              {t('signup.subtitle')}
            </p>
          </div>

          {/* 表單區 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="px-4 py-3 rounded-md bg-red-50 text-red-700 text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('signup.name.placeholder') as string}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('signup.email.placeholder') as string}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 outline-none transition-all"
                  required
                />
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('signup.password.placeholder') as string}
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
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('signup.confirmPassword.placeholder') as string}
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

            <div className="flex items-center">
              <input 
                type="checkbox" 
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#0066FF] focus:ring-[#0066FF]/20"
                required
              />
              <label htmlFor="terms" className="ml-2 text-sm text-gray-600">
                {t('signup.terms.agree')} <Link href="/terms" className="text-[#0066FF] hover:underline">{t('signup.terms.link')}</Link> {t('signup.privacy.and')} <Link href="/privacy" className="text-[#0066FF] hover:underline">{t('signup.privacy.link')}</Link>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#0066FF] hover:bg-[#0052CC] text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? t('signup.loading') : t('signup.button')}
            </button>
          </form>

          {/* 分隔線 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">{t('signup.or')}</span>
            </div>
          </div>

          {/* 其他登入選項 */}
          <div className="space-y-4">
            <Link
              href="/login"
              className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center space-x-2 transition-colors duration-200"
            >
              <span className="text-gray-700 font-medium">{t('signup.hasAccount')} {t('signup.login')}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 