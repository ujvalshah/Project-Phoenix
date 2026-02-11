import React, { useEffect, useRef, useState } from 'react';
import { FolderPlus, MoreVertical, Flag, Trash2, Edit2, Globe, Lock } from 'lucide-react';
import { ShareMenu } from '@/components/shared/ShareMenu';
import { BookmarkButton } from '@/components/bookmarks';
import { twMerge } from 'tailwind-merge';

interface CardActionsProps {
  articleId: string;
  articleTitle: string;
  articleExcerpt: string;
  authorName: string;
  isOwner: boolean;
  isAdmin: boolean;
  visibility?: 'public' | 'private';
  onAddToCollection?: () => void;
  onReport?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleVisibility?: () => void;
  showMenu: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
  isPreview?: boolean; // Add preview flag to hide ShareMenu
  variant?: 'grid' | 'feed' | 'masonry' | 'utility'; // Variant for feed-specific styling
  onBookmarkChangeCollection?: (bookmarkId: string) => void; // Callback when user wants to change folder
}

export const CardActions: React.FC<CardActionsProps> = ({
  articleId,
  articleTitle,
  articleExcerpt,
  authorName,
  isOwner,
  isAdmin,
  visibility,
  onAddToCollection,
  onReport,
  onEdit,
  onDelete,
  onToggleVisibility,
  showMenu,
  onToggleMenu,
  menuRef,
  className,
  isPreview = false,
  variant = 'grid',
  onBookmarkChangeCollection,
}) => {
  // Mobile UX: Minimum 44px tap targets for better touch ergonomics
  const buttonSize = 'min-h-[44px] min-w-[44px]';
  const iconSize = 16;
  const textColor = 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300';
  const hoverBg = 'hover:bg-slate-100 dark:hover:bg-slate-800';
  const transitionClass = 'transition-colors duration-150';

  return (
    // PHASE 2: 8-pt gap between action buttons
    <div className={twMerge('flex items-center gap-0.5', className)}>
      {/* Hide ShareMenu in preview mode (preview IDs are invalid) */}
      {!isPreview && (
        <ShareMenu
          data={{
            type: 'nugget',
            id: articleId,
            title: articleTitle,
            shareUrl: `${window.location.origin}/article/${articleId}`,
          }}
          meta={{
            author: authorName,
            text: articleExcerpt,
          }}
        />
      )}

      {/* Bookmark Button - Personal save feature */}
      {!isPreview && (
        <BookmarkButton
          itemId={articleId}
          itemType="nugget"
          size="md"
          onChangeCollection={onBookmarkChangeCollection}
          className={twMerge(
            buttonSize,
            'flex items-center justify-center rounded-full',
            hoverBg,
            transitionClass
          )}
        />
      )}

      {onAddToCollection && (
        <button
          onClick={onAddToCollection}
          className={twMerge(
            buttonSize,
            'flex items-center justify-center rounded-full',
            hoverBg,
            textColor,
            transitionClass
          )}
          aria-label="Add to collection"
          title="Add to collection"
        >
          <FolderPlus size={iconSize} aria-hidden="true" />
        </button>
      )}

      <div className="relative" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu(e);
          }}
          className={twMerge(
            buttonSize,
            'flex items-center justify-center rounded-full',
            hoverBg,
            textColor,
            transitionClass,
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
          )}
          aria-label="More options"
          aria-expanded={showMenu}
          aria-haspopup="menu"
          title="More options"
        >
          <MoreVertical size={iconSize} aria-hidden="true" />
        </button>
        {showMenu && (
          <MenuDropdown
            isOwner={isOwner}
            isAdmin={isAdmin}
            visibility={visibility}
            onEdit={onEdit}
            onToggleVisibility={onToggleVisibility}
            onReport={onReport}
            onDelete={onDelete}
            onClose={(e?: React.MouseEvent) => {
              if (e) {
                onToggleMenu(e);
              } else {
                // Create synthetic event for programmatic close
                const syntheticEvent = new MouseEvent('click', { bubbles: true }) as unknown as React.MouseEvent;
                onToggleMenu(syntheticEvent);
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

// Menu Dropdown Component with Arrow Key Navigation
interface MenuDropdownProps {
  isOwner: boolean;
  isAdmin: boolean;
  visibility?: 'public' | 'private';
  onEdit?: () => void;
  onToggleVisibility?: () => void;
  onReport?: () => void;
  onDelete?: () => void;
  onClose: (e?: React.MouseEvent) => void;
}

const MenuDropdown: React.FC<MenuDropdownProps> = ({
  isOwner,
  isAdmin,
  visibility,
  onEdit,
  onToggleVisibility,
  onReport,
  onDelete,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Build menu items array
  const menuItems: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    className?: string;
    visible: boolean;
  }> = [];

  if (isOwner || isAdmin) {
    if (onEdit) {
      menuItems.push({
        id: 'edit',
        label: 'Edit',
        icon: <Edit2 size={12} aria-hidden="true" />,
        onClick: onEdit,
        visible: true,
      });
    }
  }

  if (isOwner && onToggleVisibility) {
    menuItems.push({
      id: 'visibility',
      label: visibility === 'private' ? 'Make Public' : 'Make Private',
      icon: visibility === 'private' ? (
        <Globe size={12} className="text-blue-500" aria-hidden="true" />
      ) : (
        <Lock size={12} className="text-amber-500" aria-hidden="true" />
      ),
      onClick: onToggleVisibility,
      visible: true,
    });
  }

  if (onReport) {
    menuItems.push({
      id: 'report',
      label: 'Report',
      icon: <Flag size={12} aria-hidden="true" />,
      onClick: onReport,
      visible: true,
    });
  }

  if ((isOwner || isAdmin) && onDelete) {
    menuItems.push({
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 size={12} aria-hidden="true" />,
      onClick: onDelete,
      className: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20',
      visible: true,
    });
  }

  const visibleItems = menuItems.filter(item => item.visible);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!menuRef.current) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => 
            prev < visibleItems.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => 
            prev > 0 ? prev - 1 : visibleItems.length - 1
          );
          break;
        case 'Enter':
        case ' ':
          if (focusedIndex >= 0 && focusedIndex < visibleItems.length) {
            e.preventDefault();
            visibleItems[focusedIndex].onClick();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose(undefined);
          break;
        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setFocusedIndex(visibleItems.length - 1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Focus first item when menu opens
    setFocusedIndex(0);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusedIndex, visibleItems, onClose]);

  // Focus the focused item
  useEffect(() => {
    if (focusedIndex >= 0 && menuRef.current) {
      const items = menuRef.current.querySelectorAll('[role="menuitem"]');
      if (items[focusedIndex]) {
        (items[focusedIndex] as HTMLElement).focus();
      }
    }
  }, [focusedIndex]);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Article actions"
      className="absolute right-0 bottom-full mb-1 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-20 overflow-hidden"
      onKeyDown={(e) => {
        // Prevent default arrow key behavior
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
        }
      }}
    >
      {visibleItems.map((item, index) => (
        <button
          key={item.id}
          role="menuitem"
          tabIndex={index === focusedIndex ? 0 : -1}
          onClick={(e) => {
            e.stopPropagation();
            item.onClick();
            onClose(e);
          }}
          className={twMerge(
            'w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2',
            'focus:outline-none focus:bg-slate-50 dark:focus:bg-slate-700',
            item.className
          )}
          aria-label={item.label}
        >
          {item.icon} {item.label}
        </button>
      ))}
    </div>
  );
};

