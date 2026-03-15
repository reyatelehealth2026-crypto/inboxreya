'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CsvProduct } from '@/lib/csv-product';

interface ProductCardProps {
  product: CsvProduct;
  selected: boolean;
  onToggle: () => void;
}

export function ProductCard({ product, selected, onToggle }: ProductCardProps) {
  const hasPromo = product.promoCond1.trim() !== '' || product.promoCond2.trim() !== '';

  return (
    <div
      className={cn(
        'relative rounded-xl border bg-white shadow-sm cursor-pointer transition-all duration-200',
        'hover:shadow-md hover:-translate-y-0.5',
        selected
          ? 'ring-2 ring-green-500 ring-offset-2 border-green-500'
          : 'border-gray-200 hover:border-green-300'
      )}
      onClick={onToggle}
    >
      {/* Selection indicator */}
      <div className="absolute top-2 right-2 z-10">
        <div
          className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors',
            selected
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 bg-white'
          )}
        >
          {selected && <Check className="w-4 h-4" />}
        </div>
      </div>

      {/* Product Image */}
      <div className="rounded-t-xl overflow-hidden bg-gray-50 aspect-square">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.productName}
            className="w-full h-full object-contain"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
            {product.sku}
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        {/* SPECIAL OFFER banner */}
        {product.offerHeader && (
          <div className="bg-red-500 text-white text-center py-0.5 px-2 rounded text-[10px] font-bold">
            {product.offerHeader}
          </div>
        )}

        {/* SKU */}
        <p className="text-[10px] text-gray-500 text-center font-medium">
          {product.skuLabel} {product.sku}
        </p>

        {/* Product name */}
        <p className="text-xs font-semibold text-blue-600 line-clamp-2 text-center leading-snug">
          {product.productName}
        </p>

        {/* Promo condition */}
        {hasPromo && (
          <div className="border border-red-200 rounded px-2 py-1 text-[10px] text-red-600 bg-red-50 text-center">
            {product.promoCond1 && <p>{product.promoCond1}</p>}
            {product.promoCond2 && <p>{product.promoCond2}</p>}
          </div>
        )}

        {/* Price */}
        <div className="text-center pt-1">
          <p className="text-sm font-bold text-red-600">
            {product.pricePerUnit}
          </p>
          {product.priceAfterDiscount && (
            <p className="text-[10px] text-green-600">
              {product.priceAfterDiscount}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
