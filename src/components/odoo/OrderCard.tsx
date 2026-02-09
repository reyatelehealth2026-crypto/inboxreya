'use client';

/**
 * Order Card Component
 * Displays Odoo sale order information
 */

import type { OdooOrder } from '@/types/odoo';

interface OrderCardProps {
    order: OdooOrder;
    compact?: boolean;
    onSelect?: (order: OdooOrder) => void;
}

const stateLabels: Record<string, { label: string; color: string }> = {
    draft: { label: 'ร่าง', color: 'bg-gray-100 text-gray-700' },
    sent: { label: 'ส่งแล้ว', color: 'bg-blue-100 text-blue-700' },
    sale: { label: 'ยืนยัน', color: 'bg-green-100 text-green-700' },
    done: { label: 'เสร็จสิ้น', color: 'bg-emerald-100 text-emerald-700' },
    cancel: { label: 'ยกเลิก', color: 'bg-red-100 text-red-700' },
};

export function OrderCard({ order, compact = false, onSelect }: OrderCardProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
        }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const stateInfo = stateLabels[order.state] || { label: order.state, color: 'bg-gray-100 text-gray-700' };

    if (compact) {
        return (
            <div
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => onSelect?.(order)}
            >
                <div className="flex items-center gap-3">
                    <div>
                        <span className="font-medium text-gray-900">{order.name}</span>
                        <span className="text-sm text-gray-500 ml-2">{formatDate(order.date_order)}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${stateInfo.color}`}>
                        {stateInfo.label}
                    </span>
                    <span className="font-semibold text-gray-900">{formatCurrency(order.amount_total)}</span>
                </div>
            </div>
        );
    }

    return (
        <div
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onSelect?.(order)}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div>
                    <h3 className="font-semibold text-gray-900">{order.name}</h3>
                    {order.order_ref && order.order_ref !== order.name && (
                        <p className="text-sm text-gray-500 font-mono">{order.order_ref}</p>
                    )}
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${stateInfo.color}`}>
                    {stateInfo.label}
                </span>
            </div>

            {/* Date & Customer */}
            <div className="space-y-1 text-sm text-gray-600 mb-3">
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{formatDate(order.date_order)}</span>
                </div>
                {order.partner_name && (
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>{order.partner_name}</span>
                    </div>
                )}
            </div>

            {/* Order Lines */}
            {order.order_line && order.order_line.length > 0 && (
                <div className="border-t border-gray-100 pt-3 mb-3">
                    <div className="space-y-1">
                        {order.order_line.slice(0, 3).map((line, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                                <span className="text-gray-600 truncate flex-1">
                                    {line.product_name || line.product_code || `Product #${line.product_id}`}
                                    <span className="text-gray-400 ml-1">x{line.qty}</span>
                                </span>
                                <span className="text-gray-900 ml-2">{formatCurrency(line.price_subtotal)}</span>
                            </div>
                        ))}
                        {order.order_line.length > 3 && (
                            <p className="text-xs text-gray-500">+{order.order_line.length - 3} รายการเพิ่มเติม</p>
                        )}
                    </div>
                </div>
            )}

            {/* Totals */}
            <div className="border-t border-gray-200 pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">ก่อน VAT</span>
                    <span>{formatCurrency(order.amount_untaxed)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">VAT</span>
                    <span>{formatCurrency(order.amount_tax)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg pt-1">
                    <span>รวมทั้งสิ้น</span>
                    <span className="text-green-600">{formatCurrency(order.amount_total)}</span>
                </div>
            </div>
        </div>
    );
}

export default OrderCard;
