'use client';

import { useState, useEffect } from 'react';
import { fetchCsvProducts, type CsvProduct } from '@/lib/csv-product';

export function useCsvProducts() {
  const [products, setProducts] = useState<CsvProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchCsvProducts();
        if (!cancelled) {
          setProducts(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load products');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { products, loading, error };
}
