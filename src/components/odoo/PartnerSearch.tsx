'use client';

/**
 * Partner Search Component
 * Search and display Odoo partners/customers
 */

import { useState, useEffect } from 'react';
import { useOdooPartner, useOdooPartnerDetails } from '@/hooks/useOdoo';
import { PartnerCard } from './PartnerCard';

interface PartnerSearchProps {
    initialPartnerCode?: string;
    onSelectPartner?: (partner: unknown) => void;
}

export function PartnerSearch({ initialPartnerCode, onSelectPartner }: PartnerSearchProps) {
    const [searchCode, setSearchCode] = useState(initialPartnerCode || '');
    const [searchTerm, setSearchTerm] = useState(initialPartnerCode || '');
    const [searchById, setSearchById] = useState(false);
    const [partnerId, setPartnerId] = useState<number | null>(null);

    // Search by code
    const { data: partnerData, isLoading: isSearchingCode, error: codeError } = useOdooPartner(
        !searchById ? searchTerm : ''
    );

    // Search by ID
    const { data: partnerDetailsData, isLoading: isSearchingId, error: idError } = useOdooPartnerDetails(
        searchById ? partnerId : null
    );

    useEffect(() => {
        if (initialPartnerCode) {
            setSearchCode(initialPartnerCode);
            setSearchTerm(initialPartnerCode);
            setSearchById(false);
        }
    }, [initialPartnerCode]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const code = searchCode.trim();
        if (!code) return;

        // Check if it's a numeric ID
        if (/^\d+$/.test(code)) {
            setSearchById(true);
            setPartnerId(parseInt(code, 10));
            setSearchTerm('');
        } else {
            setSearchById(false);
            setSearchTerm(code);
            setPartnerId(null);
        }
    };

    const isLoading = isSearchingCode || isSearchingId;
    const error = codeError || idError;
    const partner = searchById
        ? partnerDetailsData?.data?.partner
        : partnerData?.data?.partner;

    return (
        <div className="space-y-4">
            {/* Search Form */}
            <form onSubmit={handleSearch} className="space-y-2">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={searchCode}
                        onChange={(e) => setSearchCode(e.target.value)}
                        placeholder="รหัสลูกค้า (PC210265) หรือ Partner ID"
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
                <p className="text-xs text-gray-500">
                    ใส่รหัสลูกค้า เช่น PC210265 หรือ Partner ID เช่น 1825
                </p>
            </form>

            {/* Quick Search */}
            <div className="flex flex-wrap gap-2">
                {['1825', '2025'].map((id) => (
                    <button
                        key={id}
                        onClick={() => { setSearchCode(id); setSearchById(true); setPartnerId(parseInt(id, 10)); }}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium hover:bg-gray-200 transition-colors"
                    >
                        Partner #{id}
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
            {!isLoading && partner && (
                <PartnerCard partner={partner} onSelect={onSelectPartner} />
            )}

            {/* No Result */}
            {!isLoading && !partner && (searchTerm || partnerId) && (
                <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <p>ไม่พบลูกค้า</p>
                </div>
            )}
        </div>
    );
}

export default PartnerSearch;
