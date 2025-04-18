import { Mail, Phone, Building2, Users } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            企業方案諮詢
          </h2>
          <p className="mt-4 text-xl text-gray-600">
            讓我們為您的企業打造最適合的解決方案
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 左側表單 */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <form className="space-y-6">
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-700">
                  公司名稱
                </label>
                <input
                  type="text"
                  name="company"
                  id="company"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  聯絡人姓名
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  電子郵件
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  聯絡電話
                </label>
                <input
                  type="tel"
                  name="phone"
                  id="phone"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                  需求說明
                </label>
                <textarea
                  name="message"
                  id="message"
                  rows={4}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-150"
              >
                提交諮詢
              </button>
            </form>
          </div>

          {/* 右側資訊 */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              為什麼選擇我們的企業方案？
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <Users className="h-6 w-6 text-blue-500 mt-1" />
                <div>
                  <h4 className="font-semibold">專屬客戶經理</h4>
                  <p className="text-gray-600">一對一專屬服務，快速回應您的需求</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <Building2 className="h-6 w-6 text-blue-500 mt-1" />
                <div>
                  <h4 className="font-semibold">客製化解決方案</h4>
                  <p className="text-gray-600">根據您的業務需求打造專屬分析模型</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <Phone className="h-6 w-6 text-blue-500 mt-1" />
                <div>
                  <h4 className="font-semibold">24/7 技術支援</h4>
                  <p className="text-gray-600">全天候技術團隊支援，確保服務穩定運行</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <Mail className="h-6 w-6 text-blue-500 mt-1" />
                <div>
                  <h4 className="font-semibold">聯絡我們</h4>
                  <p className="text-gray-600">enterprise@appreviews.ai</p>
                  <p className="text-gray-600">+886 2 2345 6789</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 