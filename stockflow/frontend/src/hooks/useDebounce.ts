import { useEffect, useState } from 'react';

/**
 * useDebounce hook untuk menunda eksekusi perubahan nilai (search query)
 * @param value Nilai yang ingin di-debounce
 * @param delay Waktu tunda dalam milidetik (default 300ms)
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
