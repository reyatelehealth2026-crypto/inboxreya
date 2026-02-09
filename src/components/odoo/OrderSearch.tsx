'use client';

/**
 * Order Search Component
 * Search and display Odoo sale orders
 */

import { useState } from 'react';
import { useOdooOrder } from '@/hooks/useOdoo';
import { OrderCard } from './OrderCard';

interface OrderSearchProps {
    initialOrderRef?: string;
    onSelectOrder?: (order: unknown) => void;
}

export function OrderSearch({ initialOrderRef, onSelectOrder }: OrderSearchProps) {
    const [searchRef, setSearchRef] = useState(initialOrderRef || '');
    const [searchTerm, setSearchTerm] = useState(initialOrderRef || '');

    const { data: orderData, isLoading, error } = useOdooOrder(searchTerm);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchRef.trim()) {
            setSearchTerm(searchRef.trim());
        }
    };

    const order = orderData?.data?.order;

    return (
        <div className="space-y-4">
            {/* Search Form */}
            <form onSubmit={handleSearch} className="space-y-2">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={searchRef}
                        onChange={(e) => setSearchRef(e.target.value)}
                        placeholder="เลขที่คำสั่งซื้อ เช่น SO-2026-001"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                        type="submit"
                        disabled={!searchRef.trim()}
                        className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        ค้นหา
                    </button>
                </div>
            </form>

            {/* Quick Search Examples */}
            <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-500">ตัวอย่าง:</span>
                {['TEST_API_USER2_001', 'SO-2026-001'].map((ref) => (
                    <button
                        key={ref}
                        onClick={() => { setSearchRef(ref); setSearchTerm(ref); }}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium hover:bg-gray-200 transition-colors"
                    >
                        {ref}
                    </button>
                ))}
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    ไม่สามารถค้นหาได้: {error.message}
                </div>
            )}

            {/* Result */}
            {!isLoading && order && (
                <OrderCard order={order} onSelect={onSelectOrder} />
            )}

            {/* No Result */}
            {!isLoading && !order && searchTerm && (
                <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p>ไม่พบคำสั่งซื้อ &quot;{searchTerm}&quot;</p>
                </div>
            )}
        </div>
    );
}

export default OrderSearch;
