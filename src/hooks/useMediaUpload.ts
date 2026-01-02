import { useState, useCallback, useRef } from 'react';

const AUTH_STORAGE_KEY = 'nuggets_auth_data_v2';

/**
 * Get auth token from localStorage
 */
function getAuthToken(): string | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const { token } = JSON.parse(stored);
      return token || null;
    }
  } catch (e) {
    console.warn('Failed to get auth token:', e);
  }
  return null;
}

export interface MediaUploadResult {
  mediaId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  publicId?: string;
  resourceType?: string;
}

export interface UseMediaUploadOptions {
  purpose?: string;
  entityType?: string;
  entityId?: string;
  onProgress?: (progress: number) => void;
}

export interface UseMediaUploadReturn {
  upload: (file: File | ClipboardItem | DragEvent) => Promise<MediaUploadResult | null>;
  uploadMultiple: (files: File[]) => Promise<MediaUploadResult[]>;
  loading: boolean;
  error: string | null;
  progress: number;
  abort: () => void;
}

/**
 * Unified media upload hook for Cloudinary
 * 
 * CRITICAL: All media must be uploaded to Cloudinary and tracked via MongoDB Media records.
 * Base64 storage is FORBIDDEN beyond temporary previews.
 * 
 * @param options - Upload options including purpose, entityType, entityId
 * @returns Upload function and state
 */
export function useMediaUpload(options: UseMediaUploadOptions = {}): UseMediaUploadReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const upload = useCallback(async (
    fileInput: File | ClipboardItem | DragEvent
  ): Promise<MediaUploadResult | null> => {
    // Extract File from different input types
    let file: File | null = null;

    if (fileInput instanceof File) {
      file = fileInput;
    } else if (fileInput instanceof ClipboardItem) {
      // Convert ClipboardItem to File
      const blob = await fileInput.getType('image/png');
      if (!blob) {
        setError('Failed to extract image from clipboard');
        return null;
      }
      file = new File([blob], `pasted-image-${Date.now()}.png`, { type: 'image/png' });
    } else if (fileInput instanceof DragEvent) {
      // Extract from drag event
      const dt = fileInput.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        file = dt.files[0];
      } else {
        setError('No file found in drag event');
        return null;
      }
    } else {
      setError('Invalid file input type');
      return null;
    }

    if (!file) {
      setError('No file provided');
      return null;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Only image files are supported');
      return null;
    }

    // Validate file size (5MB limit)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
      return null;
    }

    // Create abort controller for this upload
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      if (options.purpose) {
        formData.append('purpose', options.purpose);
      }
      if (options.entityType) {
        formData.append('entityType', options.entityType);
      }
      if (options.entityId) {
        formData.append('entityId', options.entityId);
      }

      // Get auth token for request
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Upload to backend
      const response = await fetch('/api/media/upload/cloudinary', {
        method: 'POST',
        body: formData,
        headers,
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(errorData.message || `Upload failed: ${response.statusText}`);
      }

      const result: MediaUploadResult = await response.json();

      // Validate response has required fields
      if (!result.mediaId || !result.secureUrl) {
        throw new Error('Invalid response from server: missing mediaId or secureUrl');
      }

      setProgress(100);
      return result;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError(null); // Don't show error for aborted uploads
        return null;
      }
      const errorMessage = err.message || 'Failed to upload media';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
      setProgress(0);
      abortControllerRef.current = null;
    }
  }, [options.purpose, options.entityType, options.entityId]);

  const uploadMultiple = useCallback(async (
    files: File[]
  ): Promise<MediaUploadResult[]> => {
    const results: MediaUploadResult[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (options.onProgress) {
        options.onProgress((i / files.length) * 100);
      }
      
      const result = await upload(file);
      if (result) {
        results.push(result);
      }
    }
    
    if (options.onProgress) {
      options.onProgress(100);
    }
    
    return results;
  }, [upload, options.onProgress]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    abort();
  }, [abort]);

  // Note: We can't use useEffect cleanup here because this is a hook
  // The component using this hook should handle cleanup if needed

  return {
    upload,
    uploadMultiple,
    loading,
    error,
    progress,
    abort,
  };
}

