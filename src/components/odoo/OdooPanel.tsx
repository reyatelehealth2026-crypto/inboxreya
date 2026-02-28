'use client';

/**
 * Odoo Panel Component
 * Main panel with tabs for Products, Partners, Orders
 */

import { useState } from 'react';
import { useOdooConnection } from '@/hooks/useOdoo';
import { ProductSearch } from './ProductSearch';
import { PartnerSearch } from './PartnerSearch';
import { OrderSearch } from './OrderSearch';

type TabType = 'products' | 'partners' | 'orders';

interface OdooPanelProps {
    customerPartnerCode?: string;
    customerPartnerId?: number | null;
    embedded?: boolean;
    onClose?: () => void;
}

const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
        id: 'products',
        label: 'สินค้า',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
        ),
    },
    {
        id: 'partners',
        label: 'ลูกค้า',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        ),
    },
    {
        id: 'orders',
        label: 'คำสั่งซื้อ',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
        ),
    },
];

export function OdooPanel({ customerPartnerCode, customerPartnerId, embedded, onClose }: OdooPanelProps) {
    const [activeTab, setActiveTab] = useState<TabType>('products');
    const { data: connectionData, isLoading: isConnecting } = useOdooConnection();

    const isConnected = connectionData?.success;

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header — hidden in embedded mode */}
            {!embedded && (
                <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span className="font-semibold text-gray-800">CNY ERP</span>
                        {isConnecting ? (
                            <span className="text-xs text-gray-400">กำลังเชื่อมต่อ...</span>
                        ) : isConnected ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                เชื่อมต่อแล้ว
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                ไม่สามารถเชื่อมต่อ
                            </span>
                        )}
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            )}

            {/* Tabs */}
            <div className="flex bg-white border-b border-gray-200">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === tab.id
                                ? 'text-gray-900 border-b-2 border-gray-900'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'products' && <ProductSearch />}
                {activeTab === 'partners' && <PartnerSearch initialPartnerCode={customerPartnerCode} />}
                {activeTab === 'orders' && <OrderSearch partnerId={customerPartnerId ?? undefined} />}
            </div>
        </div>
    );
}

export default OdooPanel;
