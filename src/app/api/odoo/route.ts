/**
 * Odoo ERP API Route
 * Proxies requests to PHP odoo-api.php backend
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Odoo API Actions
type OdooAction =
    | 'test'
    | 'info'
    | 'get_product'
    | 'search_products'
    | 'get_sku'
    | 'get_partner'
    | 'get_partner_details'
    | 'create_sale_order'
    | 'create_simple_order'
    | 'get_sale_order'
    | 'get_sale_invoice'
    | 'update_delivery_fee'
    | 'calculate_delivery_fee';

// Local DB list actions
type LocalListAction = 'list_orders_by_partner' | 'list_invoices_by_partner';

// extend union
export type ExtendedOdooAction = OdooAction | LocalListAction;

export async function GET(request: NextRequest) {
    return handleRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
    return handleRequest(request, 'POST');
}

async function handleRequest(request: NextRequest, method: string) {
    try {
        const { searchParams } = new URL(request.url);
        const action = (searchParams.get('action') || '') as ExtendedOdooAction;

        if (!action) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Missing action parameter',
                    available_actions: [
                        'test', 'info', 'get_product', 'search_products', 'get_sku',
                        'get_partner', 'get_partner_details', 'create_sale_order',
                        'create_simple_order', 'get_sale_order', 'get_sale_invoice',
                        'update_delivery_fee', 'calculate_delivery_fee'
                    ]
                },
                { status: 400 }
            );
        }

        // Build params object from search params
        const params: Record<string, string> = {};
        searchParams.forEach((value, key) => {
            if (key !== 'action') {
                params[key] = value;
            }
        });

        // Get request body for POST
        let body: Record<string, unknown> = {};
        if (method === 'POST') {
            try {
                const text = await request.text();
                if (text) {
                    body = JSON.parse(text);
                }
            } catch {
                // No body or invalid JSON
            }
        }

        // Merge params and body
        const data = { ...params, ...body };

        // Handle local list actions (query local DB via Prisma)
        if (action === 'list_orders_by_partner') {
            const partnerId = Number(data['partner_id'] ?? data['partnerId'] ?? data['partner']);
            const offset = Math.max(0, Number(data['offset'] ?? 0));
            const limit = Math.min(Math.max(1, Number(data['limit'] ?? 20)), 100);

            if (!partnerId) {
                return NextResponse.json({ success: false, error: 'partner_id is required' }, { status: 400 });
            }

            const orders = await prisma.orders.findMany({
                where: { user_id: partnerId },
                orderBy: { created_at: 'desc' },
                skip: offset,
                take: limit,
            });

            return NextResponse.json({ success: true, data: { orders, offset, limit, count: orders.length } });
        }

        if (action === 'list_invoices_by_partner') {
            const partnerId = Number(data['partner_id'] ?? data['partnerId'] ?? data['partner']);
            const offset = Math.max(0, Number(data['offset'] ?? 0));
            const limit = Math.min(Math.max(1, Number(data['limit'] ?? 20)), 100);

            if (!partnerId) {
                return NextResponse.json({ success: false, error: 'partner_id is required' }, { status: 400 });
            }

            const invoices = await prisma.account_receivables.findMany({
                where: { user_id: partnerId },
                orderBy: { created_at: 'desc' },
                skip: offset,
                take: limit,
            });

            return NextResponse.json({ success: true, data: { invoices, offset, limit, count: invoices.length } });
        }

        // Build PHP API URL
        const phpBackendUrl = process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com';
        const odooApiUrl = `${phpBackendUrl}/api/odoo-api.php?action=${action}`;

        console.log('[Odoo API] Action:', action);
        console.log('[Odoo API] Data:', data);
        console.log('[Odoo API] URL:', odooApiUrl);

        // Call PHP backend
        const response = await fetch(odooApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'InboxReya-Odoo-Proxy/1.0',
            },
            body: JSON.stringify(data),
            cache: 'no-store',
        });

        console.log('[Odoo API] Response status:', response.status);

        // Check content type
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('[Odoo API] Non-JSON response:', text.substring(0, 500));

            return NextResponse.json(
                {
                    success: false,
                    error: 'PHP backend returned non-JSON response',
                    preview: text.substring(0, 200),
                },
                { status: 500 }
            );
        }

        // Forward JSON response
        const result = await response.json();
        console.log('[Odoo API] Result:', result);

        return NextResponse.json(result, { status: response.status });

    } catch (error) {
        console.error('[Odoo API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Odoo API request failed',
            },
            { status: 500 }
        );
    }
}
