interface AppResult {
  id: string;
  name?: string;
  appleStoreUrl?: string;
  googlePlayUrl?: string;
}

interface SearchResultsProps {
  results: {
    data?: AppResult[];
    message?: string;
  } | AppResult[] | null;
}

function SearchResults({ results }: SearchResultsProps) {
  const NOT_FOUND_MESSAGE = "找不到相關應用程式";

  // 檢查是否為空結果或錯誤訊息
  const isEmptyResult = !results || 
    (Array.isArray(results) && results.length === 0) || 
    ('message' in results && results.message?.includes(NOT_FOUND_MESSAGE)) ||
    ('data' in results && Array.isArray(results.data) && results.data.length === 0) ||
    (Array.isArray(results) && results.some(r => r.name?.includes(NOT_FOUND_MESSAGE)));

  if (isEmptyResult) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">{NOT_FOUND_MESSAGE}</p>
      </div>
    );
  }

  // 確保有效的搜尋結果
  const displayResults = ('data' in results && Array.isArray(results.data)) 
    ? results.data 
    : (Array.isArray(results) ? results : []);

  return (
    <div>
      {displayResults.map((app: AppResult) => {
        // 檢查 name 是否為空值或未找到應用程式
        const isAppleNameEmpty = !app.name || app.name.includes(NOT_FOUND_MESSAGE);
        const isGoogleNameEmpty = !app.name || app.name.includes(NOT_FOUND_MESSAGE);
        const shouldHideUrls = isAppleNameEmpty && isGoogleNameEmpty;

        // 如果兩個商店的名稱都是空的，則不顯示任何內容
        if (shouldHideUrls) {
          return null;
        }

        return (
          <div key={app.id}>
            {/* 應用程式資訊 */}
            <div className="store-urls">
              {!isAppleNameEmpty && (
                <input 
                  type="text" 
                  placeholder="Apple Store URL"
                  value={app.appleStoreUrl || ''}
                  // ... 其他屬性
                />
              )}
              {!isGoogleNameEmpty && (
                <input 
                  type="text" 
                  placeholder="Google Play Store URL"
                  value={app.googlePlayUrl || ''}
                  // ... 其他屬性
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default SearchResults; 