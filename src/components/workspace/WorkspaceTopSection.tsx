import React from 'react';

interface WorkspaceTopSectionProps {
  header: React.ReactNode;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  toolbarClassName?: string;
  footerClassName?: string;
}

/**
 * Shared top-of-page structure used by Collections, Library, and Bookmarks.
 * Keeps hierarchy consistent: context first, controls second, helpers third.
 */
export const WorkspaceTopSection: React.FC<WorkspaceTopSectionProps> = ({
  header,
  toolbar,
  footer,
  className,
  headerClassName,
  toolbarClassName,
  footerClassName,
}) => {
  return (
    <section
      className={[
        'rounded-xl border border-slate-200/70 bg-white/75 p-3 shadow-sm backdrop-blur-md',
        'dark:border-slate-800/70 dark:bg-slate-950/55',
        className ?? '',
      ].join(' ')}
      aria-label="Workspace section header"
    >
      <div className={['flex flex-col gap-2.5', headerClassName ?? ''].join(' ')}>
        <div>{header}</div>
        {toolbar ? <div className={toolbarClassName}>{toolbar}</div> : null}
        {footer ? <div className={footerClassName}>{footer}</div> : null}
      </div>
    </section>
  );
};
