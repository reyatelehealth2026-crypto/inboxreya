'use client';

import { useMemo } from 'react';
import {
  csvProductToPreviewProduct,
  buildFlexPayload,
  buildFlexPayloadPretty,
  buildFlexPayloadMinified,
  type ExportGlobalConfig,
} from '@/lib/flex-builder';
import type { CsvProduct } from '@/lib/csv-product';

export function useFlexExport(products: CsvProduct[], config: ExportGlobalConfig) {
  const previewProducts = useMemo(() => {
    return products.map(csvProductToPreviewProduct);
  }, [products]);

  const flexPayload = useMemo(() => {
    return buildFlexPayload(previewProducts, config);
  }, [previewProducts, config]);

  const flexJsonPretty = useMemo(() => {
    return buildFlexPayloadPretty(previewProducts, config);
  }, [previewProducts, config]);

  const flexJsonMinified = useMemo(() => {
    return buildFlexPayloadMinified(previewProducts, config);
  }, [previewProducts, config]);

  const sizePretty = useMemo(() => new Blob([flexJsonPretty]).size, [flexJsonPretty]);
  const sizeMinified = useMemo(() => new Blob([flexJsonMinified]).size, [flexJsonMinified]);

  return {
    previewProducts,
    flexPayload,
    flexJsonPretty,
    flexJsonMinified,
    sizePretty,
    sizeMinified,
  };
}
