# Rich Content System Details - Project Nuggets

This document describes all the rich content features, libraries, and components used in Project Nuggets for creating and rendering rich text and media content.

---

## 📚 Core Libraries

### Markdown Rendering
- **Library:** `react-markdown` (v10.1.0)
- **Plugin:** `remark-gfm` (v4.0.1) - GitHub Flavored Markdown support
- **Component:** `MarkdownRenderer` (`src/components/MarkdownRenderer.tsx`)

### Rich Text Editing
- **Component:** `RichTextEditor` (`src/components/RichTextEditor.tsx`)
- **Features:** Custom markdown editor with toolbar and HTML-to-markdown paste conversion

---

## ✍️ Rich Text Editor Features

### Toolbar Buttons
The `RichTextEditor` provides a toolbar with the following formatting options:

1. **Bold** - `**text**`
2. **Italic** - `*text*`
3. **Heading 1** - `# text`
4. **Heading 2** - `## text`
5. **Bullet List** - `- item`
6. **Numbered List** - `1. item`
7. **Quote** - `> text`
8. **Inline Code** - `` `code` ``
9. **Link** - `[text](url)`

### Paste Features
- **HTML Paste:** Automatically converts HTML to Markdown when pasting from web pages
- **Image Paste:** Supports pasting images directly from clipboard (screenshots, copied images)
  - Detects multiple images in a single paste operation
  - Handles images without proper MIME types (common with screenshots)
  - Defaults to PNG format for screenshots
  - Triggers `onImagePaste` callback for each image

### HTML to Markdown Conversion
The editor automatically converts pasted HTML to Markdown:
- `<strong>`, `<b>` → `**text**`
- `<em>`, `<i>` → `*text*`
- `<p>` → Paragraphs with newlines
- `<a>` → `[text](url)`
- `<ul>`, `<ol>`, `<li>` → Markdown lists
- `<h1>`, `<h2>`, `<h3>` → `#`, `##`, `###`
- `<blockquote>` → `> text`
- `<code>` → `` `code` ``
- `<pre>` → Code blocks with triple backticks

---

## 📖 Markdown Rendering Features

### Supported Markdown Syntax

#### Text Formatting
- **Bold:** `**text**` or `__text__`
- **Italic:** `*text*` or `_text_`
- **Inline Code:** `` `code` ``
- **Links:** `[text](url)`
- **Hashtags:** `#hashtag` (clickable, triggers `onTagClick` callback)

#### Headers
- `# Heading 1` - Rendered as `text-xs font-bold` (12px, compact)
- `## Heading 2` - Rendered as `text-xs font-bold` (12px, compact)
- `### Heading 3` - Rendered as `text-xs font-bold` (12px, compact)
- `#### Heading 4` - Rendered as `text-xs font-bold` (12px, compact)

#### Lists
- **Unordered:** `- item` or `* item`
- **Ordered:** `1. item`
- Styled with `list-disc` and `list-outside` for unordered
- Styled with `list-decimal` and `list-outside` for ordered

#### Block Elements
- **Blockquote:** `> text` - Left border, italic styling
- **Code Blocks:** Triple backticks with optional language
- **Horizontal Rule:** `---` or `***`

#### Tables (GitHub Flavored Markdown)
- Full GFM table support via `remark-gfm`
- Responsive horizontal scrolling on small screens
- Styled with alternating row backgrounds
- Hover effects on rows
- Dark mode support

**Table Styling:**
- Headers: Bold, background color, border-bottom
- Cells: Padding, border-bottom
- Responsive: Wrapped in scrollable container on mobile
- Hidden in collapsed/truncated content (line-clamp)

### Component Styling

#### Typography
- **Base size:** `text-xs` (12px) for compact cards, `text-sm` (14px) for expanded views
- **Line height:** Inherits from parent (typically `leading-relaxed`)
- **Font:** System fonts, monospace for code

#### Colors (Light/Dark Mode)
- **Text:** `text-slate-900 dark:text-white` (primary)
- **Secondary:** `text-slate-600 dark:text-slate-300`
- **Muted:** `text-slate-500 dark:text-slate-400`
- **Links:** `text-primary-600 dark:text-primary-400`
- **Code:** `text-pink-600 dark:text-pink-400`
- **Code background:** `bg-slate-100 dark:bg-slate-800`

#### Spacing
- **Paragraphs:** `mb-1.5` (6px bottom margin)
- **Lists:** `mb-2` (8px bottom margin), `space-y-1` (4px between items)
- **Headers:** `mt-1.5 mb-1` (6px top, 4px bottom)
- **Blockquotes:** `my-4` (16px vertical margin)

### Security
- **HTML Sanitization:** `skipHtml` prop enabled - prevents raw HTML injection
- **External Links:** All links open in new tab with `rel="noopener noreferrer"`

### Hashtag Support
- Hashtags (`#word`) are automatically detected and made clickable
- Triggers `onTagClick` callback when clicked
- Styled as primary-colored links with hover underline

---

## 🎨 Media Content Types

### Supported Media Types
```typescript
type MediaType = 'image' | 'video' | 'document' | 'link' | 'text' | 'youtube';
```

### 1. Images
- **Direct image URLs:** Rendered as `<img>` tags
- **Image attachments:** Base64 encoded, uploaded via form
- **Paste support:** Can paste images directly into content editor
- **Multiple images:** Supported via image carousel/grid
- **Thumbnails:** Auto-generated or provided via `previewMetadata.imageUrl`

**Components:**
- `EmbeddedMedia` - Main image renderer
- `GenericLinkPreview` - For image URLs
- `ImageCarouselModal` - Lightbox for multiple images
- `CardThumbnailGrid` - Grid layout for multiple thumbnails

### 2. YouTube Videos
- **Type:** `youtube`
- **Detection:** Automatic via URL pattern matching
- **Rendering:** Thumbnail with play button overlay
- **Click behavior:** Opens YouTube URL in new tab
- **Thumbnail:** Uses YouTube thumbnail API or `previewMetadata.imageUrl`

### 3. Documents
- **Supported formats:**
  - PDF (`pdf`)
  - Word (`doc`, `docx`)
  - Excel (`xls`, `xlsx`)
  - PowerPoint (`ppt`, `pptx`)
  - Text (`txt`)
  - Archives (`zip`)

**Component:** `DocumentPreview`
- Icon-based preview (no iframe embedding)
- Color-coded by document type:
  - PDF: Red theme
  - Word: Blue theme
  - Excel: Green theme
  - PowerPoint: Orange theme
  - Text: Gray theme
  - Archives: Purple theme
- Shows filename, file size, and type
- Click opens original URL in new tab
- Optional download button
- Optional PDF thumbnail (first page)

### 4. Link Previews
- **Type:** `link`
- **Component:** `GenericLinkPreview`
- **Features:**
  - Open Graph metadata support
  - Title, description, and image preview
  - Site name display
  - External link icon
  - Hover effects

### 5. Text-Only Content
- **Type:** `text`
- Pure markdown content without media
- Rendered via `MarkdownRenderer`

---

## 🔗 Link Unfurling & Metadata

### Supported Platforms
- **YouTube:** Video metadata, thumbnails
- **Twitter/X:** Post previews (legacy, now renders as link)
- **LinkedIn:** Post previews (legacy, now renders as link)
- **Instagram:** Post previews (legacy, now renders as link)
- **TikTok:** Video previews (legacy, now renders as link)
- **Generic URLs:** Open Graph metadata extraction

### Metadata Structure
```typescript
interface PreviewMetadata {
  url: string;
  finalUrl?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  providerName?: string;
}
```

### Unfurling Service
- **Component:** `unfurlService` (`src/services/unfurlService.ts`)
- **Backend:** `fetchUrlMetadata` in `server/src/services/metadata.ts`
- **Caching:** Redis caching for metadata
- **Fallbacks:** Graceful degradation if metadata unavailable

---

## 🖼️ Media Components

### EmbeddedMedia
**Location:** `src/components/embeds/EmbeddedMedia.tsx`

Main component for rendering media in cards and detail views.

**Features:**
- Detects document types (Google Drive, file extensions)
- Renders images, YouTube videos, documents
- Fallback to `GenericLinkPreview` for unsupported types
- Click handlers for interaction
- Responsive image sizing

### GenericLinkPreview
**Location:** `src/components/embeds/GenericLinkPreview.tsx`

Renders link previews with metadata.

**Features:**
- Image preview support
- Title and description display
- Site name with external link icon
- Hover effects
- Direct image URL handling

### DocumentPreview
**Location:** `src/components/embeds/DocumentPreview.tsx`

Specialized component for document files.

**Features:**
- Icon-based preview (no iframe)
- Color-coded by document type
- Filename truncation
- File size formatting
- Download button support
- Optional PDF thumbnail
- Click to open in new tab

### ImageCarouselModal
**Location:** `src/components/shared/ImageCarouselModal.tsx`

Lightbox modal for viewing multiple images.

**Features:**
- Full-screen image viewing
- Navigation between images
- Close button
- Keyboard navigation (arrow keys, Escape)
- Touch/swipe support

---

## 📝 Content Editor Integration

### ContentEditor Component
**Location:** `src/components/CreateNuggetModal/ContentEditor.tsx`

Wrapper around `RichTextEditor` with additional features:

**Props:**
- `value`: Markdown content string
- `onChange`: Callback when content changes
- `onImagePaste`: Callback when image is pasted
- `error`: Error message display
- `warning`: Warning message display
- `onTouchedChange`: Callback when field is touched
- `onErrorChange`: Callback when error state changes

**Features:**
- Image paste handling
- Error/warning display
- Touch state tracking
- Auto error clearing on input

---

## 🎯 Content Rendering Locations

### Card Views
- **GridVariant:** Uses `CardContent` → `MarkdownRenderer`
- **FeedVariant:** Uses `CardContent` → `MarkdownRenderer`
- **MasonryVariant:** Uses `CardContent` → `MarkdownRenderer`
- **UtilityVariant:** Uses `CardContent` → `MarkdownRenderer`

### Detail Views
- **ArticleDetail:** Uses `MarkdownRenderer` for both title and content
- **ArticleModal:** Uses `MarkdownRenderer` for content
- **DetailViewBottomSheet:** Uses `MarkdownRenderer` for content

### Media Rendering
- **CardMedia:** Uses `EmbeddedMedia` for media display
- **MasonryMediaToggle:** Uses `EmbeddedMedia` for masonry layout
- **SupportingMediaSection:** Uses `ImageCarouselModal` for image galleries

---

## 🔍 Content Processing

### Table Detection
Utility function `contentHasTable()` detects if content contains markdown tables:
- Checks for pipe characters (`|`)
- Validates table separator rows
- Used to decide whether to force content expansion

### Content Truncation
- Uses CSS `line-clamp` for visual truncation
- Tables are hidden in truncated state
- "Read more" functionality for expanding content

### Hashtag Processing
- Automatic detection of `#hashtag` patterns
- Converted to clickable links
- Triggers navigation or filter actions

---

## 🎨 Styling Details

### Markdown Content Container
```css
.markdown-content {
  /* Base container */
}

.markdown-content.prose {
  /* Prose styling for expanded/drawer views */
  /* Uses Tailwind Typography plugin classes */
}
```

### Table Styling
```css
.markdown-table-wrapper {
  /* Horizontal scroll container */
  overflow-x: auto;
}

.markdown-table {
  /* Table base styles */
  border-collapse: collapse;
}

/* Responsive: Hide tables in truncated content */
.line-clamp-3 .markdown-table-wrapper,
.line-clamp-4 .markdown-table-wrapper {
  display: none;
}
```

### Code Styling
- **Inline code:** Pink text, slate background, rounded corners
- **Code blocks:** Full-width, slate background, padding, monospace font
- **Syntax highlighting:** Not currently implemented (can be added via `rehype-highlight`)

---

## 📦 Dependencies

```json
{
  "react-markdown": "^10.1.0",
  "remark-gfm": "^4.0.1"
}
```

### Optional Enhancements (Not Currently Used)
- `rehype-highlight` - Syntax highlighting for code blocks
- `rehype-sanitize` - Additional HTML sanitization
- `remark-breaks` - Convert line breaks to `<br>`
- `remark-emoji` - Emoji support

---

## 🚀 Usage Examples

### Basic Markdown Rendering
```tsx
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

<MarkdownRenderer 
  content={article.content}
  onTagClick={(tag) => handleTagClick(tag)}
/>
```

### Rich Text Editor
```tsx
import { RichTextEditor } from '@/components/RichTextEditor';

<RichTextEditor
  value={content}
  onChange={setContent}
  placeholder="Enter markdown content..."
  onImagePaste={(file) => handleImagePaste(file)}
/>
```

### Media Rendering
```tsx
import { EmbeddedMedia } from '@/components/embeds/EmbeddedMedia';

<EmbeddedMedia 
  media={article.media}
  onClick={() => handleMediaClick()}
/>
```

### Document Preview
```tsx
import { DocumentPreview } from '@/components/embeds/DocumentPreview';

<DocumentPreview
  url={document.url}
  filename={document.filename}
  fileType="pdf"
  fileSize="2.4 MB"
  thumbnailUrl={document.thumbnailUrl}
  showDownloadButton={true}
/>
```

---

## 🔐 Security Considerations

1. **HTML Sanitization:** `skipHtml` prevents raw HTML injection
2. **External Links:** All links use `rel="noopener noreferrer"`
3. **Image Sources:** Images are validated before rendering
4. **Content Validation:** Backend validates markdown content length and structure

---

## 📊 Content Limits

- **Title:** Max 80 characters, single-line, no markdown
- **Content:** No hard limit (backend may have limits)
- **Images:** Size limits enforced by backend
- **Documents:** Size limits enforced by backend

---

## 🎯 Best Practices

1. **Always use MarkdownRenderer** for rendering user content
2. **Validate content** before saving to database
3. **Handle errors gracefully** when metadata fetching fails
4. **Provide fallbacks** for missing images/metadata
5. **Use appropriate components** for different media types
6. **Respect user preferences** for content display (truncation, expansion)

---

This rich content system provides a comprehensive solution for creating, editing, and displaying rich text and media content with full markdown support, media embedding, and responsive design.
