/**
 * Client-Side Image Compression Utility
 * 
 * Compresses images before upload to reduce:
 * - Network transfer time
 * - Database storage (MongoDB 16MB limit)
 * - Memory usage
 * 
 * Strategy: Resize to max 1280px width, convert to JPEG at 80% quality
 * Result: ~5MB PNG → ~200KB JPEG (25x reduction)
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  outputFormat?: 'image/jpeg' | 'image/png' | 'image/webp';
  maxSizeKB?: number; // Target max size in KB
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1280,
  maxHeight: 1280,
  quality: 0.8,
  outputFormat: 'image/jpeg',
  maxSizeKB: 500 // 500KB max
};

/**
 * Compress an image file
 * @param file - Original image file
 * @param options - Compression options
 * @returns Compressed File object
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          // Calculate new dimensions while maintaining aspect ratio
          let { width, height } = img;
          
          if (width > opts.maxWidth || height > opts.maxHeight) {
            const aspectRatio = width / height;
            
            if (width > height) {
              width = Math.min(width, opts.maxWidth);
              height = width / aspectRatio;
            } else {
              height = Math.min(height, opts.maxHeight);
              width = height * aspectRatio;
            }
          }

          // Create canvas and draw resized image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Use high-quality image rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob with compression
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }

              // If still too large, reduce quality further
              const sizeKB = blob.size / 1024;
              
              if (sizeKB > opts.maxSizeKB && opts.quality > 0.5) {
                // Recursively compress with lower quality
                const lowerQuality = Math.max(0.5, opts.quality - 0.1);
                compressImage(file, { ...opts, quality: lowerQuality })
                  .then(resolve)
                  .catch(reject);
              } else {
                // Create new File object with original name (but compressed)
                const compressedFile = new File(
                  [blob],
                  file.name.replace(/\.[^/.]+$/, '') + '.jpg',
                  {
                    type: opts.outputFormat,
                    lastModified: Date.now()
                  }
                );
                
                resolve(compressedFile);
              }
            },
            opts.outputFormat,
            opts.quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    // CRITICAL: readAsDataURL is used ONLY for temporary image processing (compression)
    // The Base64 data is NEVER persisted - it's only used to load the image into a canvas
    // All compressed images are uploaded to Cloudinary via useMediaUpload hook
    reader.readAsDataURL(file);
  });
}

/**
 * Check if a file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Compress image if it's an image file, otherwise return original
 * This is a convenience function that handles both images and other files
 */
export async function optimizeFileForUpload(
  file: File,
  options?: CompressionOptions
): Promise<File> {
  if (isImageFile(file)) {
    return compressImage(file, options);
  }
  return file;
}












