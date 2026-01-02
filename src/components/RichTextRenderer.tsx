import React from 'react';

interface RichTextRendererProps {
  content: string;
  className?: string;
  onTagClick?: (tag: string) => void;
  truncate?: boolean;
}

export const RichTextRenderer: React.FC<RichTextRendererProps> = ({ 
  content, 
  className = '',
  onTagClick,
  truncate: _truncate = false
}) => {
  if (!content) return null;

  // Basic Markdown Parser
  const renderText = (text: string) => {
    // 1. Split by formatting tokens
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\)|#[a-zA-Z0-9_]+)/g);
    
    return parts.map((part, index) => {
      // Bold
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold text-slate-900 dark:text-slate-100">{part.slice(2, -2)}</strong>;
      }
      // Italic
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index} className="italic">{part.slice(1, -1)}</em>;
      }
      // Inline Code
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={index} className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-pink-600 dark:text-pink-400">{part.slice(1, -1)}</code>;
      }
      // Links
      if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
        const matches = part.match(/\[(.*?)\]\((.*?)\)/);
        if (matches) {
          return (
            <a 
              key={index} 
              href={matches[2]} 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()} 
              className="text-primary-600 dark:text-primary-400 hover:underline"
            >
              {matches[1]}
            </a>
          );
        }
      }
      // Hashtags
      if (part.startsWith('#') && !part.includes(' ')) {
        const tag = part.slice(1);
        return (
          <span 
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              if (onTagClick) onTagClick(tag);
            }}
            className="text-primary-600 dark:text-primary-400 font-medium hover:underline cursor-pointer"
          >
            {part}
          </span>
        );
      }
      
      return part;
    });
  };

  // Split content into blocks (paragraphs, headers, lists)
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  
  let inList = false;
  let listItems: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    
    // Empty lines (Reset list)
    if (!trimmed) {
      if (inList) {
        elements.push(<ul key={`list-${i}`} className="list-disc list-outside ml-5 mb-4 space-y-1">{listItems}</ul>);
        listItems = [];
        inList = false;
      }
      return; 
    }
    
    // Headers
    if (trimmed.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-lg font-bold mt-4 mb-2">{renderText(trimmed.slice(4))}</h3>);
      return;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-xl font-bold mt-4 mb-2">{renderText(trimmed.slice(3))}</h2>);
      return;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-2xl font-bold mt-4 mb-2">{renderText(trimmed.slice(2))}</h1>);
      return;
    }
    
    // Lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      inList = true;
      listItems.push(<li key={i}>{renderText(trimmed.slice(2))}</li>);
      return;
    }
    
    // Blockquote
    if (trimmed.startsWith('> ')) {
      elements.push(<blockquote key={i} className="border-l-4 border-slate-300 dark:border-slate-600 pl-4 italic my-2">{renderText(trimmed.slice(2))}</blockquote>);
      return;
    }
    
    // Code block
    if (trimmed.startsWith('```')) {
      // Simple code block handling
      return;
    }
    
    // Regular paragraph
    if (inList) {
      elements.push(<ul key={`list-${i}`} className="list-disc list-outside ml-5 mb-4 space-y-1">{listItems}</ul>);
      listItems = [];
      inList = false;
    }
    elements.push(<p key={i} className="mb-2">{renderText(trimmed)}</p>);
  });
  
  // Close any remaining list
  if (inList) {
    elements.push(<ul key="list-final" className="list-disc list-outside ml-5 mb-4 space-y-1">{listItems}</ul>);
  }

  return <div className={className}>{elements}</div>;
};


