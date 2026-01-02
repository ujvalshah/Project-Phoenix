import React from 'react';

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

export const Image: React.FC<ImageProps> = ({ src, alt, className, fallbackSrc, ...props }) => {
  const [error, setError] = React.useState(false);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (fallbackSrc && !error) {
      setError(true);
      e.currentTarget.src = fallbackSrc;
    }
  };

  return (
    <img
      src={src}
      alt={alt || 'Image'}
      className={className}
      loading="lazy"
      decoding="async"
      onError={handleError}
      {...props}
    />
  );
};


