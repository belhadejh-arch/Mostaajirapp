import { useCallback, useState } from 'react';
import { api } from '@/api/client';

interface UseFileUploadOptions {
  maxFiles?: number;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
}

interface UploadResult {
  urls: string[];
  loading: boolean;
  error: string | null;
  uploadFiles: (files: File[]) => Promise<string[]>;
  fileToDataUrl: (file: File) => Promise<string>;
}

export function useFileUpload(options: UseFileUploadOptions = {}): UploadResult {
  const { maxFiles = 10, maxFileSize = 10 * 1024 * 1024 } = options;
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileToDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, []);

  const uploadFiles = useCallback(async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];
    const toUpload = files.slice(0, maxFiles);

    for (const file of toUpload) {
      if (file.size > maxFileSize) {
        setError(`الملف ${file.name} أكبر من الحجم المسموح`);
        return [];
      }
    }

    setLoading(true);
    setError(null);
    try {
      if (toUpload.length === 1) {
        const formData = new FormData();
        formData.append('file', toUpload[0]);
        const { url } = await api.upload<{ url: string }>('/upload/image', formData);
        setUrls([url]);
        return [url];
      } else {
        const formData = new FormData();
        for (const file of toUpload) formData.append('files', file);
        const { urls: uploadedUrls } = await api.upload<{ urls: string[] }>('/upload/images', formData);
        setUrls(uploadedUrls);
        return uploadedUrls;
      }
    } catch (e: unknown) {
      setError((e as Error).message || 'Upload failed');
      return [];
    } finally {
      setLoading(false);
    }
  }, [maxFiles, maxFileSize]);

  return { urls, loading, error, uploadFiles, fileToDataUrl };
}
