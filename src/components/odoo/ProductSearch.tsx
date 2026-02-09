'use client';

/**
 * Product Search Component
 * Search and display Odoo products
 */

import { useState } from 'react';
import { useOdooProduct, useOdooProducts } from '@/hooks/useOdoo';
import { ProductCard } from './ProductCard';
import type { OdooProduct } from '@/types/odoo';

interface ProductSearchProps {
    onSelectProduct?: (product: OdooProduct) => void;
}

export function ProductSearch({ onSelectProduct }: ProductSearchProps) {
    const [searchCode, setSearchCode] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [offset, setOffset] = useState(1);
    const [mode, setMode] = useState<'search' | 'browse'>('search');

    // Search by code
    const { data: productData, isLoading: isSearching, error: searchError } = useOdooProduct(searchTerm);

    // Browse products
    const { data: listData, isLoading: isBrowsing } = useOdooProducts(offset, 10);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchCode.trim()) {
            setSearchTerm(searchCode.trim());
            setMode('search');
        }
    };

    const handleBrowse = () => {
        setMode('browse');
        setSearchTerm('');
    };

    const products = mode === 'search'
        ? productData?.data?.products || []
        : listData?.data?.products || [];

    const isLoading = mode === 'search' ? isSearching : isBrowsing;

    return (
        <div className="space-y-4">
            {/* Search Form */}
            <form onSubmit={handleSearch} className="space-y-2">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={searchCode}
                        onChange={(e) => setSearchCode(e.target.value)}
                        placeholder="รหัสสินค้า เช่น 0001, UNISON..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                        type="submit"
                        disabled={!searchCode.trim()}
                        className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        ค้นหา
                    </button>
                </div>
            </form>

            {/* Quick Browse */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={handleBrowse}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${mode === 'browse' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    ดูทั้งหมด
                </button>
                {[1, 11, 21].map((start) => (
                    <button
                        key={start}
                        onClick={() => { setOffset(start); setMode('browse'); setSearchTerm(''); }}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium hover:bg-gray-200 transition-colors"
                    >
                        #{String(start).padStart(4, '0')}-{String(start + 9).padStart(4, '0')}
                    </button>
                ))}
            </div>

            {/* Pagination for browse mode */}
            {mode === 'browse' && (
                <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>แสดง #{offset} - #{offset + 9}</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setOffset(Math.max(1, offset - 10))}
                            disabled={offset <= 1}
                            className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            ← ก่อนหน้า
                        </button>
                        <button
                            onClick={() => setOffset(offset + 10)}
                            className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                        >
                            ถัดไป →
                        </button>
                    </div>
                </div>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
            )}

            {/* Error */}
            {searchError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    ไม่สามารถค้นหาได้: {searchError.message}
                </div>
            )}

            {/* Results */}
            {!isLoading && products.length > 0 && (
                <div className="space-y-3">
                    {products.map((product, index) => (
                        <ProductCard
                            key={`${product.product_code}-${index}`}
                            product={product}
                            onSelect={onSelectProduct}
                        />
                    ))}
                </div>
            )}

            {/* No Results */}
            {!isLoading && mode === 'search' && searchTerm && products.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>ไม่พบสินค้ารหัส &quot;{searchTerm}&quot;</p>
                </div>
            )}
        </div>
    );
}

export default ProductSearch;
