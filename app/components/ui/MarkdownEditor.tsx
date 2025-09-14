import React, { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import 'easymde/dist/easymde.min.css';

// 動態導入以避免 SSR 問題
const SimpleMDE = dynamic(() => import('react-simplemde-editor'), { 
  ssr: false,
  loading: () => <div className="h-[300px] border rounded-md flex items-center justify-center">載入編輯器中...</div>
});

// 注意：在 Next.js 中，我們需要在客戶端組件中動態載入 CSS
interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ 
  value, 
  onChange, 
  placeholder = '請輸入課程內容，支持 Markdown 格式...' 
}) => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const editorRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 創建一個事件處理器來模擬圖片按鈕點擊
  const handleImageButtonClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  // 修改 options 以包含自定義圖片上傳處理
  const options = React.useMemo(() => {
    // 添加自定義圖片處理功能
    const imageUploadFunction = {
      name: "custom-image",
      action: handleImageButtonClick,
      className: "fa fa-picture-o",
      title: "插入圖片",
    };

    return {
      spellChecker: false,
      autofocus: false,
      placeholder: placeholder,
      status: ['lines', 'words'],
      minHeight: '300px',
      maxHeight: '500px',
      // 替換原始 image 按鈕為我們的自定義按鈕
      toolbar: [
        'bold', 'italic', 'heading', '|', 
        'quote', 'unordered-list', 'ordered-list', '|',
        'link', imageUploadFunction as any, 'table', '|',
        'preview', 'side-by-side', 'fullscreen', '|',
        'guide'
      ] as any,
    };
  }, [placeholder, handleImageButtonClick]);

  // 處理圖片上傳
  const handleImageUpload = useCallback(async (file: File) => {
    if (!file) return;
    
    try {
      setIsUploading(true);
      
      // 顯示上傳中的提示
      toast({
        title: "圖片上傳中",
        description: "請稍候...",
      });
      
      // 動態導入 supabase 函數
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      
      // 檢查文件類型
      if (!file.type.includes('image/')) {
        toast({
          title: "上傳失敗",
          description: "請選擇有效的圖片文件",
          variant: "destructive",
        });
        return;
      }
      
      // 生成唯一檔名
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `lesson-images/${fileName}`;
      
      // 上傳至 Supabase Storage
      const { data, error } = await supabaseClient.storage
        .from('course-content')  // 請確保已在 Supabase 中創建此 bucket
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) {
        throw error;
      }
      
      // 獲取圖片公開URL
      const { data: { publicUrl } } = supabaseClient.storage
        .from('course-content')
        .getPublicUrl(filePath);
      
      // 在編輯器中插入圖片 Markdown
      const imageMarkdown = `![${file.name}](${publicUrl})`;
      
      // 獲取當前編輯器內容並追加圖片
      const currentValue = value || '';
      const newValue = currentValue + '\n' + imageMarkdown + '\n';
      onChange(newValue);
      
      toast({
        title: "圖片上傳成功",
        description: "圖片已成功插入至編輯器",
      });
    } catch (error: any) {
      toast({
        title: "圖片上傳失敗",
        description: error.message || "請稍後再試",
        variant: "destructive",
      });
      console.error('圖片上傳錯誤:', error);
    } finally {
      setIsUploading(false);
      
      // 重置檔案輸入，以便能夠選擇相同檔案
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [value, onChange, toast]);

  // 處理文件選擇
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageUpload(e.target.files[0]);
    }
  }, [handleImageUpload]);

  // 獲取編輯器實例的回調
  const getEditorInstance = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  return (
    <div className="markdown-editor w-full">
      {/* 隱藏的文件輸入用於圖片上傳 */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleFileSelect}
        disabled={isUploading}
      />
      {isUploading && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-green-500 text-white text-center py-1 text-sm">
          圖片上傳中...
        </div>
      )}
      <SimpleMDE
        value={value}
        onChange={onChange}
        options={options}
        getMdeInstance={getEditorInstance}
      />
    </div>
  );
};

export default MarkdownEditor;