'use client';

/**
 * Order Search Component
 * Search and display Odoo sale orders
 * Supports customer-scoped mode via partnerId prop
 */

import { useState } from 'react';
import { useOdooOrder, useOdooOrdersByPartner } from '@/hooks/useOdoo';
import { OrderCard } from './OrderCard';

interface OrderSearchProps {
    initialOrderRef?: string;
    partnerId?: number;
    onSelectOrder?: (order: unknown) => void;
}

export function OrderSearch({ initialOrderRef, partnerId, onSelectOrder }: OrderSearchProps) {
    const [searchRef, setSearchRef] = useState(initialOrderRef || '');
    const [searchTerm, setSearchTerm] = useState(initialOrderRef || '');
    const [offset, setOffset] = useState(0);

    // Single order search (manual)
    const { data: orderData, isLoading: isSearching, error: searchError } = useOdooOrder(searchTerm);

    // Customer-scoped order list (auto when partnerId is provided)
    const { data: partnerOrders, isLoading: isLoadingPartnerOrders, error: partnerError } = useOdooOrdersByPartner(
        partnerId ?? null,
        offset,
        20
    );

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchRef.trim()) {
            setSearchTerm(searchRef.trim());
        }
    };

    const order = orderData?.data?.order;
    const ordersList = partnerOrders?.data?.orders || [];
    const isCustomerScoped = !!partnerId;

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

            {/* Customer-scoped orders list */}
            {isCustomerScoped && !searchTerm && (
                <>
                    {isLoadingPartnerOrders && (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        </div>
                    )}

                    {partnerError && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            ไม่สามารถโหลดคำสั่งซื้อได้: {partnerError.message}
                        </div>
                    )}

                    {!isLoadingPartnerOrders && ordersList.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs text-gray-500 font-medium">
                                คำสั่งซื้อของลูกค้า ({ordersList.length} รายการ)
                            </p>
                            {ordersList.map((o, idx) => (
                                <OrderCard
                                    key={`${o.name}-${idx}`}
                                    order={o}
                                    compact
                                    onSelect={onSelectOrder}
                                />
                            ))}
                            {/* Pagination */}
                            <div className="flex items-center justify-between text-sm text-gray-500 pt-2">
                                <button
                                    onClick={() => setOffset(Math.max(0, offset - 20))}
                                    disabled={offset <= 0}
                                    className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                >
                                    ← ก่อนหน้า
                                </button>
                                <button
                                    onClick={() => setOffset(offset + 20)}
                                    disabled={ordersList.length < 20}
                                    className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                >
                                    ถัดไป →
                                </button>
                            </div>
                        </div>
                    )}

                    {!isLoadingPartnerOrders && ordersList.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <p>ยังไม่มีคำสั่งซื้อ</p>
                        </div>
                    )}
                </>
            )}

            {/* Manual search results */}
            {searchTerm && (
                <>
                    {/* Loading */}
                    {isSearching && (
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

                    {/* Result */}
                    {!isSearching && order && (
                        <OrderCard order={order} onSelect={onSelectOrder} />
                    )}

                    {/* No Result */}
                    {!isSearching && !order && (
                        <div className="text-center py-8 text-gray-500">
                            <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <p>ไม่พบคำสั่งซื้อ &quot;{searchTerm}&quot;</p>
                        </div>
                    )}

                    {/* Back to customer orders */}
                    {isCustomerScoped && (
                        <button
                            onClick={() => { setSearchTerm(''); setSearchRef(''); }}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                            ← กลับไปดูคำสั่งซื้อของลูกค้า
                        </button>
                    )}
                </>
            )}

            {/* Quick Search Examples — only show when no partnerId and no search */}
            {!isCustomerScoped && !searchTerm && (
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
            )}
        </div>
    );
}

export default OrderSearch;
