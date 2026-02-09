'use client';

/**
 * Product Card Component
 * Displays Odoo product information
 */

import type { OdooProduct } from '@/types/odoo';

interface ProductCardProps {
    product: OdooProduct;
    onSelect?: (product: OdooProduct) => void;
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
    // Handle both field names for stock quantity
    const stockQty = product.saleable_qty ?? product.qty_available ?? 0;

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
        }).format(price);
    };

    return (
        <div
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onSelect?.(product)}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                    {product.name_th && (
                        <p className="text-sm text-gray-600 truncate">{product.name_th}</p>
                    )}
                    {product.generic_name && (
                        <p className="text-xs text-gray-500 italic truncate">{product.generic_name}</p>
                    )}
                </div>
            </div>

            {/* Codes */}
            <div className="flex flex-wrap gap-2 mb-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-700">
                    #{product.product_code}
                </span>
                {product.barcode && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-500">
                        {product.barcode}
                    </span>
                )}
            </div>

            {/* Price & Stock */}
            <div className="flex items-center justify-between">
                <div>
                    <span className="text-lg font-bold text-green-600">
                        {formatPrice(product.list_price)}
                    </span>
                    {product.uom_name && (
                        <span className="text-sm text-gray-500 ml-1">/{product.uom_name}</span>
                    )}
                </div>
                <div className="text-right">
                    <span className={`text-sm font-medium ${stockQty > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {stockQty > 0 ? `คงเหลือ ${stockQty}` : 'หมด'}
                    </span>
                </div>
            </div>

            {/* Price Levels by Gen */}
            {product.product_price_ids && product.product_price_ids.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-blue-600 font-medium mb-1.5">ราคาตามประเภท:</p>
                    <div className="flex flex-wrap gap-1">
                        {product.product_price_ids.map((priceLevel, idx) => (
                            <span
                                key={idx}
                                className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100"
                                title={priceLevel.price_name}
                            >
                                {priceLevel.price_name.replace(/^\d+-/, '')}: ฿{priceLevel.price}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProductCard;
