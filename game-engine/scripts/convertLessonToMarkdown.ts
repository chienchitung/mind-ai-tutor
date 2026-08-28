// @ts-nocheck
import TurndownService from 'turndown';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

// 處理 ESM 中的 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 動態引入 lessons.ts 的內容
const lessonsPath = path.join(__dirname, '../src/data/lessons.ts');
const lessonsContent = fs.readFileSync(lessonsPath, 'utf-8');

// 從 lessons.ts 內容中提取 lessons 資料
console.log('Reading lessons.ts file...');

// 創建一個模擬的瀏覽器環境用於解析 HTML
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
// 移除 navigator 賦值，因為它是只讀屬性

// 手動解析 lessons 數組
let lessons = [];
try {
  // 先取出 lessonMapping 和 getLessonId 函數
  const lessonMappingMatch = lessonsContent.match(/const\s+lessonMapping\s*=\s*\{([\s\S]*?)\}/);
  const lessonMapping = {};
  
  if (lessonMappingMatch) {
    // 解析 lessonMapping 物件
    const mappingText = lessonMappingMatch[1];
    const mappingEntries = mappingText.match(/["']([^"']+)["']\s*:\s*(\d+)/g);
    
    if (mappingEntries) {
      mappingEntries.forEach(entry => {
        const [key, value] = entry.split(':').map(s => s.trim());
        const cleanKey = key.replace(/["']/g, '');
        const numValue = parseInt(value);
        lessonMapping[numValue] = cleanKey;
      });
    }
    
    console.log('Parsed lesson mapping:', lessonMapping);
  }
  
  // 使用更直接的方法來提取 lessons 數組
  console.log('Using direct approach to extract lessons...');

  const lessonsArray = [];
  const lessonIdRegex = /lesson_id:\s*getLessonId\((\d+)\)/g;
  const titleRegex = /title:\s*["']([^"']+)["']/g;
  const contentRegex = /content:\s*`([\s\S]*?)`(?:,|\s+\})/g;

  let lessonIdMatch;
  let titleMatch;
  let contentMatch;

  // 重置正則表達式
  lessonIdRegex.lastIndex = 0;
  titleRegex.lastIndex = 0;
  contentRegex.lastIndex = 0;

  // 同時迭代所有正則表達式匹配
  while (
    (lessonIdMatch = lessonIdRegex.exec(lessonsContent)) !== null &&
    (titleMatch = titleRegex.exec(lessonsContent)) !== null &&
    (contentMatch = contentRegex.exec(lessonsContent)) !== null
  ) {
    const number = parseInt(lessonIdMatch[1]);
    const lesson_id = lessonMapping[number] || `unknown-${number}`;
    
    lessonsArray.push({
      lesson_id,
      number,
      title: titleMatch[1],
      content: contentMatch[1]
    });
  }

  if (lessonsArray.length > 0) {
    console.log(`Successfully extracted ${lessonsArray.length} lessons using direct approach`);
    lessons = lessonsArray;
  } else {
    console.error('Could not extract lessons using direct approach');
    process.exit(1);
  }
} catch (e) {
  console.error('Error parsing lessons:', e);
  process.exit(1);
}

// Initialize TurnDown for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  hr: '---'
});

// Configure TurnDown to handle specific HTML elements better
turndownService.addRule('codeBlock', {
  filter: function(node) {
    return (
      node.nodeName === 'DIV' && 
      node.classList.contains('bg-gray-50') && 
      node.classList.contains('p-3') && 
      node.classList.contains('rounded') &&
      node.classList.contains('font-mono')
    );
  },
  replacement: function(content) {
    return '```\n' + content.trim() + '\n```';
  }
});

turndownService.addRule('inlineCode', {
  filter: function(node) {
    return node.nodeName === 'SPAN' && node.classList.contains('font-mono');
  },
  replacement: function(content) {
    return '`' + content + '`';
  }
});

turndownService.addRule('tipBox', {
  filter: function(node) {
    return (
      node.nodeName === 'DIV' && 
      node.classList.contains('bg-gray-50') && 
      node.classList.contains('p-4')
    );
  },
  replacement: function(content) {
    if (content.includes('💡')) {
      return '> 💡 **Tip:** ' + content.replace('💡', '').trim() + '\n';
    } else if (content.includes('⚠️')) {
      return '> ⚠️ **Warning:** ' + content.replace('⚠️', '').trim() + '\n';
    } else {
      return '> **Note:** ' + content.trim() + '\n';
    }
  }
});

turndownService.addRule('table', {
  filter: 'table',
  replacement: function(content, node) {
    // Extract the table headers
    const headers = Array.from(node.querySelectorAll('th')).map(th => th.textContent?.trim() || '');
    
    // Extract the rows
    const rows = Array.from(node.querySelectorAll('tr'))
      .filter(tr => !tr.querySelector('th')) // Skip header row
      .map(tr => {
        return Array.from(tr.querySelectorAll('td')).map(td => td.textContent?.trim() || '');
      });
    
    // Build the markdown table
    let markdown = '\n';
    
    // Header row
    markdown += '| ' + headers.join(' | ') + ' |\n';
    
    // Header separator
    markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    
    // Data rows
    rows.forEach(row => {
      markdown += '| ' + row.join(' | ') + ' |\n';
    });
    
    return markdown;
  }
});

// Initialize Supabase client
// 直接設置 Supabase 連接參數 (注意：在生產環境應使用環境變數)
const supabaseUrl = "https://vuibtitfdhzoxsytzrjo.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1aWJ0aXRmZGh6b3hzeXR6cmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0Njg4MzcsImV4cCI6MjA1OTA0NDgzN30.CoGR6fQaGDY_vmgF50gFycUGKLjUO29zg6_Y4fFqOx4";
const supabase = createClient(supabaseUrl, supabaseKey);

async function convertAndUpdateLessons() {
  console.log('Starting conversion of lesson content to Markdown...');

  for (const lesson of lessons) {
    // Skip lessons without content (like the final test)
    if (!lesson.content) {
      console.log(`Skipping lesson ${lesson.number} (${lesson.title}): No content`);
      continue;
    }

    console.log(`Processing lesson ${lesson.number}: ${lesson.title}`);

    try {
      // Convert HTML content to Markdown
      const markdown = turndownService.turndown(lesson.content);
      
      // Update the lesson in Supabase
      const { data, error } = await supabase
        .from('lessons')
        .update({ 
          markdown_content: markdown 
        })
        .eq('id', lesson.lesson_id)
        .select();
      
      if (error) {
        console.error(`Error updating lesson ${lesson.number}:`, error);
      } else {
        console.log(`Successfully updated lesson ${lesson.number}`);
      }
    } catch (err) {
      console.error(`Error processing lesson ${lesson.number}:`, err);
    }
  }
  
  console.log('Conversion completed!');
}

// Run the conversion
convertAndUpdateLessons()
  .catch(err => {
    console.error('Error in conversion process:', err);
    process.exit(1);
  });