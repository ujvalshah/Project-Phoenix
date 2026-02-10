# Multi-Image Display Implementation Guide

## Quick Reference: Key Changes

### 1. Spacing Improvement
```tsx
// BEFORE
className="grid grid-cols-2 gap-0.5 w-full h-full"

// AFTER
className="grid grid-cols-2 gap-1 w-full h-full"  // or gap-1.5 for more separation
```

### 2. Image Count Badge (Always Visible)
```tsx
// Add to CardThumbnailGrid component
{imageCount > 1 && (
  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full z-10 pointer-events-none">
    {imageCount}
  </div>
)}
```

### 3. Enhanced Hover States
```tsx
// BEFORE
<div className="relative overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
  <Image className="... group-hover/media:scale-105" />
</div>

// AFTER
<div className="relative overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-pointer group/image">
  <Image className="w-full h-full object-contain transition-transform duration-300 group-hover/image:scale-[1.02]" />
  <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 transition-colors duration-200 pointer-events-none" />
</div>
```

### 4. Improved "+N" Overlay
```tsx
// BEFORE
<div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-none">
  <span className="text-white text-sm font-bold">+{remainingCount}</span>
</div>

// AFTER
<div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none z-10">
  <svg className="w-5 h-5 mb-1 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
  <span className="text-white text-base font-bold">+{remainingCount}</span>
  <span className="text-white/80 text-xs mt-0.5">more</span>
</div>
```

### 5. Accessibility Enhancements
```tsx
// Add to each image cell
<div
  role="button"
  tabIndex={0}
  aria-label={`View image ${idx + 1} of ${imageCount}: ${getAltText(idx)}`}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onGridClick?.(e as any);
    }
  }}
  className="..."
>
```

---

## Complete Updated Component Structure

```tsx
export const CardThumbnailGrid: React.FC<CardThumbnailGridProps> = React.memo(({
  images,
  articleTitle,
  onGridClick,
  showLinkBadge = false,
  linkUrl,
}) => {
  if (!images || images.length < 2) return null;

  const imageCount = images.length;
  
  const getAltText = (idx: number): string => {
    return articleTitle
      ? `Image ${idx + 1} of ${imageCount} for ${articleTitle}`
      : `Image ${idx + 1} of ${imageCount}`;
  };

  // Image count badge (always visible for 2+ images)
  const countBadge = imageCount > 1 && (
    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full z-10 pointer-events-none">
      {imageCount}
    </div>
  );

  // Two images layout
  if (imageCount === 2) {
    return (
      <div 
        className="grid grid-cols-2 gap-1 w-full h-full relative"
        onClick={onGridClick}
      >
        {countBadge}
        {images.slice(0, 2).map((imageUrl, idx) => (
          <div
            key={idx}
            role="button"
            tabIndex={0}
            aria-label={`View image ${idx + 1} of ${imageCount}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onGridClick?.(e as any);
              }
            }}
            className="relative overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-pointer group/image"
          >
            <Image
              src={imageUrl}
              alt={getAltText(idx)}
              className="w-full h-full object-contain transition-transform duration-300 group-hover/image:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 transition-colors duration-200 pointer-events-none" />
          </div>
        ))}
      </div>
    );
  }

  // Three images layout
  if (imageCount === 3) {
    return (
      <div 
        className="grid grid-cols-2 grid-rows-2 gap-1 w-full h-full relative"
        onClick={onGridClick}
      >
        {countBadge}
        {/* Left side: First image spans full height */}
        <div
          role="button"
          tabIndex={0}
          aria-label={`View image 1 of ${imageCount}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onGridClick?.(e as any);
            }
          }}
          className="row-span-2 relative overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-pointer group/image"
        >
          <Image
            src={images[0]}
            alt={getAltText(0)}
            className="w-full h-full object-contain transition-transform duration-300 group-hover/image:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 transition-colors duration-200 pointer-events-none" />
        </div>
        
        {/* Right side: Images 2 and 3 stacked */}
        {images.slice(1, 3).map((imageUrl, idx) => (
          <div
            key={idx + 1}
            role="button"
            tabIndex={0}
            aria-label={`View image ${idx + 2} of ${imageCount}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onGridClick?.(e as any);
              }
            }}
            className="relative overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-pointer group/image"
          >
            <Image
              src={imageUrl}
              alt={getAltText(idx + 1)}
              className="w-full h-full object-contain transition-transform duration-300 group-hover/image:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 transition-colors duration-200 pointer-events-none" />
          </div>
        ))}
      </div>
    );
  }

  // Four or more images layout
  const displayImages = images.slice(0, 4);
  const remainingCount = imageCount - 4;

  return (
    <div 
      className="grid grid-cols-2 gap-1 w-full h-full relative"
      onClick={onGridClick}
    >
      {countBadge}
      {displayImages.map((imageUrl, idx) => (
        <div
          key={idx}
          role="button"
          tabIndex={0}
          aria-label={`View image ${idx + 1} of ${imageCount}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onGridClick?.(e as any);
            }
          }}
          className="relative overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-pointer group/image"
        >
          <Image
            src={imageUrl}
            alt={getAltText(idx)}
            className="w-full h-full object-contain transition-transform duration-300 group-hover/image:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 transition-colors duration-200 pointer-events-none" />

          {/* Enhanced "+N" overlay on 4th cell */}
          {idx === 3 && remainingCount > 0 && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none z-10">
              <svg className="w-5 h-5 mb-1 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span className="text-white text-base font-bold">+{remainingCount}</span>
              <span className="text-white/80 text-xs mt-0.5">more</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
});
```

---

## Testing Checklist

- [ ] Verify spacing looks good on desktop (gap-1 or gap-1.5)
- [ ] Test image count badge visibility and positioning
- [ ] Verify hover states work on all image cells
- [ ] Test keyboard navigation (Tab, Enter, Space)
- [ ] Check screen reader announces image count correctly
- [ ] Verify "+N" overlay is visible and readable
- [ ] Test on mobile devices (responsive behavior)
- [ ] Verify dark mode compatibility
- [ ] Check performance (no layout shifts)
- [ ] Test with 2, 3, 4, and 5+ images

---

## Migration Notes

1. **Backward Compatibility**: All changes are additive and don't break existing functionality
2. **Performance**: Minimal impact (only CSS changes and small DOM additions)
3. **Accessibility**: Improvements enhance WCAG compliance
4. **Design System**: Uses existing Tailwind classes and design tokens
