import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mb-4 text-blue-600 border-b pb-2" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-2xl font-bold mb-4 text-blue-600 border-b pb-2" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-xl font-bold mb-2 text-blue-700" {...props} />,
          p: ({ node, ...props }) => <p className="mb-4" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc ml-6 space-y-1 mb-4" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal ml-6 space-y-1 mb-4" {...props} />,
          li: ({ node, ...props }) => <li className="mb-1" {...props} />,
          table: ({ node, ...props }) => <table className="border-collapse w-full mb-3 bg-gray-50" {...props} />,
          th: ({ node, ...props }) => <th className="border border-gray-300 p-2 text-left bg-gray-100" {...props} />,
          td: ({ node, ...props }) => <td className="border border-gray-300 p-2" {...props} />,
          pre: ({ node, ...props }) => <pre className="bg-gray-50 p-3 rounded mb-3 font-mono border-l-4 border-blue-500" {...props} />,
          code: ({ node, className, children, ...props }: any) => {
            const isInline = !className || !className.includes('language-');
            return isInline 
              ? <code className="font-mono bg-gray-100 px-1 rounded" {...props}>{children}</code>
              : <code className="block bg-gray-50 p-3 rounded font-mono" {...props}>{children}</code>;
          },
          blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;