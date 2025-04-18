'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../contexts/LanguageContext';

export default function CheckoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [expiry, setExpiry] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const { t } = useLanguage();

  // 處理信用卡號碼格式化
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;
    
    // 移除所有非數字字符
    input = input.replace(/\D/g, '');
    
    // 加入空格
    let formatted = '';
    for (let i = 0; i < input.length; i++) {
      if (i > 0 && i % 4 === 0) {
        formatted += ' ';
      }
      formatted += input[i];
    }
    
    // 限制長度為19（16位數字 + 3個空格）
    if (formatted.length <= 19) {
      setCardNumber(formatted);
    }
  };

  // 在這裡加入處理有效期限的函數
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;
    
    // 如果是在刪除
    if (input.length < expiry.length) {
      // 如果刪除到只剩 "/" 就直接清空
      if (input === '/') {
        input = '';
      }
      // 如果刪到最後一個數字，同時移除斜線
      else if (input.length === 2 && expiry.length === 3) {
        input = input.slice(0, -1);
      }
    } 
    // 如果是在輸入
    else {
      // 自動加入斜線
      if (input.length === 2 && !input.includes('/')) {
        input = input + '/';
      }
      // 只允許數字
      input = input.replace(/[^\d/]/g, '');
    }
    
    setExpiry(input);
  };

  // 在提交表單時移除空格進行驗證
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    // 移除信用卡號碼中的空格進行驗證
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    if (cleanCardNumber.length !== 16) {
      alert(t('checkout.error.invalidCard'));
      setLoading(false);
      return;
    }

    try {
      // 這裡處理付款邏輯
      await new Promise(resolve => setTimeout(resolve, 1500));
      router.push('/payment/success');
    } catch (error) {
      console.error('付款錯誤:', error);
      alert(t('checkout.error.paymentFailed'));
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 py-24">
      <div className="max-w-md mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {t('checkout.title')}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('checkout.cardHolder')}
              </label>
              <input
                type="text"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder={t('checkout.cardHolder.placeholder') as string}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('checkout.cardNumber')}
              </label>
              <input
                type="tel"
                inputMode="numeric"
                required
                value={cardNumber}
                onChange={handleCardNumberChange}
                placeholder={t('checkout.cardNumber.placeholder') as string}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('checkout.expiry')}
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  required
                  value={expiry}
                  onChange={handleExpiryChange}
                  placeholder={t('checkout.expiry.placeholder') as string}
                  maxLength={5}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('checkout.cvc')}
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  required
                  pattern="\d{3}"
                  maxLength={3}
                  placeholder={t('checkout.cvc.placeholder') as string}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="mt-8">
              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition duration-150 ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? t('checkout.processing') : t('checkout.button', { price: 'NT$ 499' })}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 