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

// Customer 360 Types
export interface Customer360Credit {
    credit_limit: number | null;
    credit_used: number | null;
    credit_remaining: number | null;
    total_due: number | null;
    overdue_amount: number | null;
}

export interface Customer360OrderItem {
    id?: number | null;
    order_id?: number | null;
    name?: string | null;
    order_name?: string | null;
    state?: string | null;
    state_display?: string | null;
    amount_total?: number | null;
    date_order?: string | null;
    order_lines?: unknown[];
}

export interface Customer360TimelineEvent {
    id: number;
    event_type: string | null;
    status: string | null;
    processed_at: string | null;
    order_name: string | null;
    state_display: string | null;
    amount_total: number | null;
    error_message: string | null;
    error_code: string | null;
}

export interface Customer360WebhookSummary {
    total: number;
    success: number;
    failed: number;
    retry: number;
    dead_letter: number;
    duplicate: number;
    last_event_at: string | null;
}

export interface Customer360InvoiceItem {
    id?: number;
    invoice_number?: string | null;
    name?: string | null;
    state?: string | null;
    amount_total?: number | null;
    amount_residual?: number | null;
    invoice_date?: string | null;
    due_date?: string | null;
    is_overdue?: boolean;
    is_paid?: boolean;
}

export interface Customer360Data {
    line_user_id: string | null;
    generated_at: string;
    linked: boolean;
    link: Record<string, unknown> | null;
    profile: Record<string, unknown> | null;
    credit: Customer360Credit;
    latest_order: Customer360OrderItem | null;
    orders: {
        total: number;
        recent: Customer360OrderItem[];
    };
    invoices: {
        total: number;
        recent: Customer360InvoiceItem[];
    };
    timeline: Customer360TimelineEvent[];
    frequent_products: unknown[];
    webhook_summary: Customer360WebhookSummary;
    warnings: string[];
}

export interface Customer360Response {
    success: boolean;
    data?: Customer360Data;
    error?: string;
}

// Webhook Stats Mini
export interface WebhookStatsMini {
    total: number;
    success: number;
    failed: number;
    retry: number;
    last_event_at: string | null;
}

export interface WebhookStatsMiniResponse {
    success: boolean;
    data?: WebhookStatsMini;
    error?: string;
}

// DLQ Types
export interface DlqItem {
    id: number;
    webhook_log_id: number | null;
    error_message: string | null;
    retry_count: number;
    last_retry_at: string | null;
    created_at: string;
    resolved_at: string | null;
    status: 'pending' | 'retrying' | 'resolved' | 'abandoned';
    event_type: string | null;
    delivery_id: string | null;
    order_name: string | null;
    customer_name: string | null;
}

export interface DlqListResponse {
    success: boolean;
    data?: {
        items: DlqItem[];
        total: number;
        limit: number;
        offset: number;
    };
    error?: string;
}

export interface DlqStats {
    available: boolean;
    total: number;
    pending: number;
    retrying: number;
    resolved: number;
    abandoned: number;
    recent_24h?: number;
    top_errors?: Array<{ error_message: string; count: number }>;
}

export interface DlqStatsResponse {
    success: boolean;
    data?: DlqStats;
    error?: string;
}

// Dashboard Stats (from PHP stats action)
export interface WebhookDashboardStats {
    total: number;
    today: number;
    success: number;
    failed: number;
    received: number;
    processing: number;
    retry: number;
    dead_letter: number;
    duplicate: number;
    avg_latency_ms: number | null;
    retried_total: number;
    dlq_total: number;
    unique_orders_today: number;
    notified_today: number;
    last_webhook: string | null;
    events_by_type: Array<{ event_type: string; count: number }>;
    top_failed_events: Array<{ event_type: string; count: number }>;
    hourly_distribution: Array<{ hour: number; count: number }>;
}

export interface WebhookDashboardStatsResponse {
    success: boolean;
    data?: WebhookDashboardStats;
    error?: string;
}
