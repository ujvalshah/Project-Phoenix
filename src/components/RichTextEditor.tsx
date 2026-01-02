import React, { useRef } from 'react';
import { 
  Bold, Italic, List, Link as LinkIcon, 
  Heading1, Heading2, Quote, Code, 
  ListOrdered, LucideIcon
} from 'lucide-react';

interface RichTextEditorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  error?: string;
  onImagePaste?: (file: File) => void; // Callback when image is pasted
}

interface ToolbarButtonProps {
  icon: LucideIcon;
  onClick: () => void;
  tooltip: string;
}

// --- HTML to Markdown Conversion Logic for Paste ---
const convertHtmlToMarkdown = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const processNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    
    const el = node as HTMLElement;
    let content = '';
    
    // Recursively process children
    node.childNodes.forEach(child => {
      content += processNode(child);
    });

    switch (el.tagName.toLowerCase()) {
      case 'strong':
      case 'b':
        return content.trim() ? `**${content}**` : '';
      case 'em':
      case 'i':
        return content.trim() ? `*${content}*` : '';
      case 'p':
        return content.trim() ? `\n\n${content.trim()}\n` : ''; 
      case 'br':
        return '\n';
      case 'a':
        const href = el.getAttribute('href');
        return href ? `[${content}](${href})` : content;
      case 'ul':
      case 'ol':
        return `\n${content}\n`;
      case 'li':
        return `- ${content.trim()}\n`;
      case 'h1': return `\n# ${content.trim()}\n\n`;
      case 'h2': return `\n## ${content.trim()}\n\n`;
      case 'h3': return `\n### ${content.trim()}\n\n`;
      case 'blockquote': return `\n> ${content.trim()}\n\n`;
      case 'code': return `\`${content}\``;
      case 'pre': return `\n\`\`\`\n${content}\n\`\`\`\n`;
      case 'div': 
        return `\n${content}\n`;
      default:
        return content;
    }
  };

  // Start processing from body, trim resulting whitespace
  let markdown = processNode(doc.body);
  
  // Collapse multiple newlines (3 or more) into 2
  return markdown.replace(/\n{3,}/g, '\n\n').trim();
};

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  label,
  value,
  onChange,
  placeholder,
  className = '',
  error,
  onImagePaste
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertFormat = (startTag: string, endTag: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    const newText = 
      text.substring(0, start) + 
      startTag + selectedText + endTag + 
      text.substring(end);

    onChange(newText);

    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + startTag.length,
        end + startTag.length
      );
    }, 0);
  };

  const insertLineFormat = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const text = textarea.value;
    
    // Find start of current line
    let lineStart = text.lastIndexOf('\n', start - 1) + 1;
    
    const newText = 
      text.substring(0, lineStart) + 
      prefix + 
      text.substring(lineStart);

    onChange(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Check for image files first - improved detection for screenshots
    // Support multiple images in a single paste operation
    const items = e.clipboardData.items;
    if (items && items.length > 0) {
      const imageFiles: File[] = [];
      
      // Collect all images from clipboard
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemType = item.type.toLowerCase();
        
        // Check if item is an image type
        const isImageType = itemType.startsWith('image/') || 
                           (item.kind === 'file' && itemType.includes('image'));
        
        if (isImageType) {
          // Try to get the file
          const file = item.getAsFile();
          
          // Verify it's actually an image file
          if (file) {
            // Check file type or size (images usually have a reasonable size)
            const isImageFile = file.type.startsWith('image/') || 
                               (!file.type && file.size > 0 && file.size < 50 * 1024 * 1024); // < 50MB, likely image
            
            if (isImageFile) {
              // Ensure file has proper type if missing (common with screenshots)
              if (!file.type || file.type === '') {
                // Try to infer from item type, default to PNG for screenshots
                const inferredType = itemType.startsWith('image/') ? itemType : 'image/png';
                const timestamp = Date.now();
                const typedFile = new File([file], `screenshot-${timestamp}-${i}.png`, {
                  type: inferredType
                });
                imageFiles.push(typedFile);
              } else {
                imageFiles.push(file);
              }
            }
          }
        }
      }
      
      // If we found any images, process them all
      if (imageFiles.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        
        if (onImagePaste) {
          // Process each image (callback handles single file, so call for each)
          imageFiles.forEach((file) => {
            onImagePaste(file);
          });
        }
        return;
      }
    }

    // Check if clipboard has HTML content
    const html = e.clipboardData.getData('text/html');
    
    if (html) {
      e.preventDefault();
      
      const markdown = convertHtmlToMarkdown(html);
      
      // If conversion resulted in empty string (e.g. unrecognizable tags), 
      // fallback to plain text paste manually to be safe, or just insert the plain text version.
      const plainText = e.clipboardData.getData('text/plain');
      const textToInsert = markdown || plainText;

      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;

      const newText = 
        text.substring(0, start) + 
        textToInsert + 
        text.substring(end);

      onChange(newText);
      
      // Move cursor to end of pasted text
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + textToInsert.length,
          start + textToInsert.length
        );
      }, 0);
    }
    // If no HTML, allow default behavior (text/plain paste)
  };

  const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon: Icon, onClick, tooltip }) => (
    <button
      type="button"
      onClick={onClick}
      className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
      title={tooltip}
    >
      <Icon size={18} />
    </button>
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-900 dark:text-slate-200">
          {label}
        </label>
      )}
      
      <div className={`
        bg-slate-50 dark:bg-slate-800 
        border rounded-xl overflow-hidden
        transition-all focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500
        ${error ? 'border-red-300 ring-red-500' : 'border-slate-200 dark:border-slate-700'}
      `}>
        {/* Toolbar */}
        <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-x-auto">
          <ToolbarButton icon={Bold} onClick={() => insertFormat('**', '**')} tooltip="Bold" />
          <ToolbarButton icon={Italic} onClick={() => insertFormat('*', '*')} tooltip="Italic" />
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
          <ToolbarButton icon={Heading1} onClick={() => insertLineFormat('# ')} tooltip="Heading 1" />
          <ToolbarButton icon={Heading2} onClick={() => insertLineFormat('## ')} tooltip="Heading 2" />
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
          <ToolbarButton icon={List} onClick={() => insertLineFormat('- ')} tooltip="Bullet List" />
          <ToolbarButton icon={ListOrdered} onClick={() => insertLineFormat('1. ')} tooltip="Numbered List" />
          <ToolbarButton icon={Quote} onClick={() => insertLineFormat('> ')} tooltip="Quote" />
          <ToolbarButton icon={Code} onClick={() => insertFormat('`', '`')} tooltip="Inline Code" />
          <div className="w-px h-6 bg-slate-200 dark:border-slate-700 mx-1" />
          <ToolbarButton icon={LinkIcon} onClick={() => insertFormat('[', '](url)')} tooltip="Link" />
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
          className="w-full p-4 bg-transparent border-none focus:ring-0 min-h-[200px] font-mono text-sm leading-relaxed dark:text-slate-200 resize-y"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};


