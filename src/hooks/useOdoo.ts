/**
 * Odoo ERP React Query Hooks
 * Data fetching hooks with caching and optimistic updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { odooApi } from '@/lib/odoo-api';
import type { CreateOrderRequest } from '@/types/odoo';

// Query Keys
export const odooKeys = {
    all: ['odoo'] as const,
    connection: () => [...odooKeys.all, 'connection'] as const,
    info: () => [...odooKeys.all, 'info'] as const,
    products: () => [...odooKeys.all, 'products'] as const,
    product: (code: string) => [...odooKeys.products(), code] as const,
    productList: (offset: number, limit: number) => [...odooKeys.products(), 'list', offset, limit] as const,
    partners: () => [...odooKeys.all, 'partners'] as const,
    partner: (code: string) => [...odooKeys.partners(), code] as const,
    partnerDetails: (id: number) => [...odooKeys.partners(), 'details', id] as const,
    orders: () => [...odooKeys.all, 'orders'] as const,
    order: (ref: string) => [...odooKeys.orders(), ref] as const,
    invoices: () => [...odooKeys.all, 'invoices'] as const,
    invoice: (number: string) => [...odooKeys.invoices(), number] as const,
};

// Connection & Info Hooks
export function useOdooConnection() {
    return useQuery({
        queryKey: odooKeys.connection(),
        queryFn: () => odooApi.testConnection(),
        staleTime: 30 * 1000, // 30 seconds
        retry: 1,
    });
}

export function useOdooApiInfo() {
    return useQuery({
        queryKey: odooKeys.info(),
        queryFn: () => odooApi.getApiInfo(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

// Product Hooks
export function useOdooProduct(productCode: string) {
    return useQuery({
        queryKey: odooKeys.product(productCode),
        queryFn: () => odooApi.getProduct(productCode),
        enabled: !!productCode && productCode.length > 0,
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
}

export function useOdooProducts(offset: number = 1, limit: number = 10) {
    return useQuery({
        queryKey: odooKeys.productList(offset, limit),
        queryFn: () => odooApi.searchProducts(offset, limit),
        staleTime: 2 * 60 * 1000,
    });
}

// Partner Hooks
export function useOdooPartner(partnerCode: string) {
    return useQuery({
        queryKey: odooKeys.partner(partnerCode),
        queryFn: () => odooApi.getPartner(partnerCode),
        enabled: !!partnerCode && partnerCode.length > 0,
        staleTime: 2 * 60 * 1000,
    });
}

export function useOdooPartnerDetails(partnerId: number | null) {
    return useQuery({
        queryKey: odooKeys.partnerDetails(partnerId ?? 0),
        queryFn: () => odooApi.getPartnerDetails(partnerId!),
        enabled: !!partnerId && partnerId > 0,
        staleTime: 2 * 60 * 1000,
    });
}

// Order Hooks
export function useOdooOrder(orderRef: string) {
    return useQuery({
        queryKey: odooKeys.order(orderRef),
        queryFn: () => odooApi.getSaleOrder(orderRef),
        enabled: !!orderRef && orderRef.length > 0,
        staleTime: 30 * 1000, // 30 seconds (orders can change frequently)
    });
}

export function useCreateOdooOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateOrderRequest) => odooApi.createSimpleOrder(data),
        onSuccess: (result, variables) => {
            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: odooKeys.orders() });
            // Optionally prefetch the new order
            if (result.success && result.data?.order_name) {
                queryClient.setQueryData(
                    odooKeys.order(variables.order_ref),
                    result
                );
            }
        },
    });
}

// Invoice Hooks
export function useOdooInvoice(invoiceNumber: string) {
    return useQuery({
        queryKey: odooKeys.invoice(invoiceNumber),
        queryFn: () => odooApi.getSaleInvoice(invoiceNumber),
        enabled: !!invoiceNumber && invoiceNumber.length > 0,
        staleTime: 60 * 1000, // 1 minute
    });
}

// Delivery Fee Hook
export function useOdooDeliveryFee(province: string, weight: number) {
    return useQuery({
        queryKey: [...odooKeys.all, 'delivery', province, weight],
        queryFn: () => odooApi.calculateDeliveryFee(province, weight),
        enabled: !!province && weight > 0,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}
