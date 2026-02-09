'use client';

/**
 * Partner Card Component
 * Displays Odoo partner/customer information
 */

import type { OdooPartner } from '@/types/odoo';

interface PartnerCardProps {
    partner: OdooPartner;
    onSelect?: (partner: OdooPartner) => void;
}

export function PartnerCard({ partner, onSelect }: PartnerCardProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
        }).format(amount);
    };

    return (
        <div
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onSelect?.(partner)}
        >
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{partner.name}</h3>
                    <p className="text-sm text-gray-500 font-mono">{partner.partner_code}</p>
                </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-2 text-sm">
                {partner.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>{partner.phone}</span>
                    </div>
                )}
                {partner.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">{partner.email}</span>
                    </div>
                )}
                {partner.street && (
                    <div className="flex items-start gap-2 text-gray-600">
                        <svg className="w-4 h-4 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="line-clamp-2">
                            {partner.street}
                            {partner.street2 && `, ${partner.street2}`}
                            {partner.city && `, ${partner.city}`}
                            {partner.zip && ` ${partner.zip}`}
                        </span>
                    </div>
                )}
            </div>

            {/* Financial Info */}
            {(partner.credit_limit || partner.total_due) && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
                    {partner.credit_limit !== undefined && (
                        <div>
                            <span className="text-gray-500">วงเงิน:</span>
                            <span className="ml-1 font-medium">{formatCurrency(partner.credit_limit)}</span>
                        </div>
                    )}
                    {partner.total_due !== undefined && (
                        <div>
                            <span className="text-gray-500">ค้างชำระ:</span>
                            <span className={`ml-1 font-medium ${partner.total_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(partner.total_due)}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default PartnerCard;
