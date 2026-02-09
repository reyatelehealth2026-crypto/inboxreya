/**
 * Odoo ERP API Client
 * Type-safe API client for Odoo operations
 */

import type {
    OdooProductResponse,
    OdooProductListResponse,
    OdooPartnerResponse,
    OdooOrderResponse,
    OdooInvoiceResponse,
    OdooOrderListResponse,
    OdooInvoiceListResponse,
    OdooDeliveryFeeResponse,
    OdooApiInfoResponse,
    OdooConnectionResponse,
    CreateOrderRequest,
    CreateOrderResponse,
} from '@/types/odoo';

const API_BASE = '/api/odoo';

async function fetchOdoo<T>(
    action: string,
    params?: Record<string, string | number>,
    body?: Record<string, unknown>
): Promise<T> {
    const searchParams = new URLSearchParams({ action });

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            searchParams.append(key, String(value));
        });
    }

    const url = `${API_BASE}?${searchParams.toString()}`;

    const response = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

export const odooApi = {
    // Connection & Info
    testConnection: () =>
        fetchOdoo<OdooConnectionResponse>('test'),

    getApiInfo: () =>
        fetchOdoo<OdooApiInfoResponse>('info'),

    // Products
    getProduct: (productCode: string) =>
        fetchOdoo<OdooProductResponse>('get_product', { product_code: productCode }),

    searchProducts: (offset: number = 1, limit: number = 10) =>
        fetchOdoo<OdooProductListResponse>('search_products', { offset, limit }),

    getSku: (productCode: string) =>
        fetchOdoo<OdooProductResponse>('get_sku', { product_code: productCode }),

    // Partners
    getPartner: (partnerCode: string) =>
        fetchOdoo<OdooPartnerResponse>('get_partner', { partner_code: partnerCode }),

    getPartnerDetails: (partnerId: number) =>
        fetchOdoo<OdooPartnerResponse>('get_partner_details', { partner_id: partnerId }),

    // Orders
    getSaleOrder: (orderRef: string) =>
        fetchOdoo<OdooOrderResponse>('get_sale_order', { order_ref: orderRef }),

    createSimpleOrder: (data: CreateOrderRequest) =>
        fetchOdoo<CreateOrderResponse>('create_simple_order', undefined, data as unknown as Record<string, unknown>),

    // Invoices
    getSaleInvoice: (invoiceNumber: string) =>
        fetchOdoo<OdooInvoiceResponse>('get_sale_invoice', { invoice_number: invoiceNumber }),

    // Lists - local DB-backed endpoints
    listOrdersByPartner: (partnerId: number, offset: number = 0, limit: number = 20) =>
        fetchOdoo<OdooOrderListResponse>('list_orders_by_partner', { partner_id: partnerId, offset, limit }),

    listInvoicesByPartner: (partnerId: number, offset: number = 0, limit: number = 20) =>
        fetchOdoo<OdooInvoiceListResponse>('list_invoices_by_partner', { partner_id: partnerId, offset, limit }),

    // Delivery
    calculateDeliveryFee: (province: string, weight: number) =>
        fetchOdoo<OdooDeliveryFeeResponse>('calculate_delivery_fee', { province, weight: weight.toString() }),
};

export default odooApi;
