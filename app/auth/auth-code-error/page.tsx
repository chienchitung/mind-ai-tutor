'use client';

import Link from 'next/link';

export default function AuthCodeErrorPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h1 className="text-3xl font-bold mb-4">授權錯誤</h1>
      <p className="text-lg mb-6">
        登入過程中發生問題。請再試一次。
      </p>
      <Link 
        href="/login" 
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
      >
        返回登入頁面
      </Link>
    </div>
  );
} 