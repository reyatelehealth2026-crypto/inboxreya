/**
 * Odoo ERP TypeScript Types
 */

// Product Types
export interface OdooTierPrice {
    min_qty: number;
    list_price: number;
}

export interface OdooPriceLevel {
    price_name: string;
    price_code: string;
    price: number;
}

export interface OdooProduct {
    id: number;
    name: string;
    name_th?: string;
    generic_name?: string;
    product_code: string;
    barcode?: string;
    list_price: number;
    tier_prices?: OdooTierPrice[];
    product_price_ids?: OdooPriceLevel[];
    qty_available: number;
    saleable_qty?: number;
    uom_name?: string;
    categ_name?: string;
    description_sale?: string;
}

export interface OdooProductResponse {
    success: boolean;
    data?: {
        products: OdooProduct[];
    };
    error?: string;
}

export interface OdooProductListResponse {
    success: boolean;
    data?: {
        products: OdooProduct[];
        offset: number;
        limit: number;
        count: number;
    };
    error?: string;
}

// Partner Types
export interface OdooPartner {
    id: number;
    name: string;
    partner_code: string;
    phone?: string;
    mobile?: string;
    email?: string;
    street?: string;
    street2?: string;
    city?: string;
    zip?: string;
    country_id?: number;
    country_name?: string;
    credit_limit?: number;
    total_due?: number;
    total_overdue?: number;
}

export interface OdooPartnerResponse {
    success: boolean;
    data?: {
        partner: OdooPartner;
    };
    error?: string;
}

// Order Types
export interface OdooOrderLine {
    product_id: number;
    product_name?: string;
    product_code?: string;
    qty: number;
    price_unit: number;
    discount?: number;
    price_subtotal: number;
}

export interface OdooOrder {
    id: number;
    name: string;
    order_ref: string;
    partner_id: number;
    partner_name?: string;
    date_order: string;
    state: 'draft' | 'sent' | 'sale' | 'done' | 'cancel';
    amount_total: number;
    amount_untaxed: number;
    amount_tax: number;
    order_line: OdooOrderLine[];
}

export interface OdooOrderResponse {
    success: boolean;
    data?: {
        order: OdooOrder;
    };
    error?: string;
}

export interface OdooOrderListResponse {
    success: boolean;
    data?: {
        orders: OdooOrder[];
        offset: number;
        limit: number;
        count: number;
    };
    error?: string;
}

// Invoice Types
export interface OdooInvoice {
    id: number;
    number: string;
    invoice_number: string;
    partner_id: number;
    partner_name?: string;
    date_invoice: string;
    date_due?: string;
    state: 'draft' | 'open' | 'paid' | 'cancel';
    amount_total: number;
    residual: number;
}

export interface OdooInvoiceResponse {
    success: boolean;
    data?: {
        invoice: OdooInvoice;
    };
    error?: string;
}

export interface OdooInvoiceListResponse {
    success: boolean;
    data?: {
        invoices: OdooInvoice[];
        offset: number;
        limit: number;
        count: number;
    };
    error?: string;
}

// Delivery Fee Types
export interface OdooDeliveryFee {
    province: string;
    weight: number;
    fee: number;
}

export interface OdooDeliveryFeeResponse {
    success: boolean;
    data?: OdooDeliveryFee;
    error?: string;
}

// API Info Types
export interface OdooApiEndpoint {
    name: string;
    path: string;
    method: string;
}

export interface OdooApiInfo {
    name: string;
    version: string;
    base_url: string;
    api_user: string;
    endpoints: OdooApiEndpoint[];
}

export interface OdooApiInfoResponse {
    success: boolean;
    data?: OdooApiInfo;
    error?: string;
}

// Connection Test
export interface OdooConnectionResponse {
    success: boolean;
    message: string;
    base_url?: string;
    api_user?: string;
    error?: string;
}

// Create Order Types
export interface CreateOrderItem {
    product_id: number;
    qty: number;
    price_unit: number;
    discount?: number;
}

export interface CreateOrderRequest {
    order_ref: string;
    partner_id: number;
    partner_code: string;
    items: CreateOrderItem[];
    marketplace?: string;
    marketplace_shop_name?: string;
    payment_data?: string;
    discount_amount?: number;
    shipping_address_id?: number;
    shipping_address_code?: string;
}

export interface CreateOrderResponse {
    success: boolean;
    data?: {
        order_id: number;
        order_name: string;
    };
    error?: string;
}
