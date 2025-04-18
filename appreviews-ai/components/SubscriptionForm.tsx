'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SubscriptionFormProps {
  planName: string;
  planPrice: string;
  onClose: () => void;
}

export function SubscriptionForm({ planName, planPrice, onClose }: SubscriptionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 這裡處理信用卡驗證和訂閱邏輯
      // 可以連接到你的後端 API
      
      // 模擬 API 請求
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 成功後導向到成功頁面
      router.push('/payment/success');
    } catch (err) {
      setError('處理訂閱時發生錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">訂閱 {planName}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              持卡人姓名
            </label>
            <input
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              信用卡號碼
            </label>
            <input
              type="text"
              required
              pattern="\d{16}"
              maxLength={16}
              placeholder="1234 5678 9012 3456"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                有效期限
              </label>
              <input
                type="text"
                required
                pattern="\d{2}/\d{2}"
                placeholder="MM/YY"
                maxLength={5}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                CVV
              </label>
              <input
                type="text"
                required
                pattern="\d{3}"
                maxLength={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className={`w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-150 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? '處理中...' : `訂閱 ${planPrice}/月`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 