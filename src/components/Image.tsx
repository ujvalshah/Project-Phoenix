import React from 'react';

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

export const Image: React.FC<ImageProps> = ({
  src,
  alt,
  className,
  fallbackSrc,
  loading = 'lazy',
  fetchPriority,
  decoding = 'async',
  onError,
  ...props
}) => {
  const [error, setError] = React.useState(false);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (fallbackSrc && !error) {
      setError(true);
      e.currentTarget.src = fallbackSrc;
    }
    onError?.(e);
  };

  // Spread `props` first so explicit `loading`, `fetchPriority`, and `onError` always win
  // (Vitals: above-the-fold callers must not lose priority hints to accidental prop overrides).
  return (
    <img
      {...props}
      src={src}
      alt={alt || 'Image'}
      className={className}
      decoding={decoding}
      loading={loading}
      fetchPriority={fetchPriority}
      onError={handleError}
    />
  );
};


