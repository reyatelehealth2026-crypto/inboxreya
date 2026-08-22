import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CNY_PRODUCTS_ENDPOINT = 'https://www.cnypharmacy.com/api/getDataProductIsGroup';
const DEFAULT_GROUP = '0';
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGES = 300;
const FETCH_CONCURRENCY = 8;

function getPositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function buildCnyUrl(page: number, pageSize: number, requestUrl: URL): string {
  const params = new URLSearchParams({
    page: String(page),
    sort_product_name: requestUrl.searchParams.get('sort_product_name') || 'asc',
    sort_product_sku: requestUrl.searchParams.get('sort_product_sku') || '',
    isPageGroup: requestUrl.searchParams.get('group') || requestUrl.searchParams.get('isPageGroup') || DEFAULT_GROUP,
    paginate_num: String(pageSize),
    search_barcode: requestUrl.searchParams.get('search_barcode') || '',
    product_sub_type: requestUrl.searchParams.get('product_sub_type') || '',
    supplier: requestUrl.searchParams.get('supplier') || '0',
    see_query: '0',
    new_sort_type: requestUrl.searchParams.get('new_sort_type') || '0',
  });

  return `${CNY_PRODUCTS_ENDPOINT}?${params.toString()}`;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const pageSize = getPositiveInt(requestUrl.searchParams.get('paginate_num'), DEFAULT_PAGE_SIZE, 25);
  const maxPages = getPositiveInt(requestUrl.searchParams.get('max_pages'), MAX_PAGES, MAX_PAGES);
  const allProducts: unknown[] = [];

  try {
    const fetchPage = async (page: number) => {
      const response = await fetch(buildCnyUrl(page, pageSize, requestUrl), {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`CNY product API returned ${response.status} on page ${page}`);
      }

      return response.json();
    };

    const firstPayload = await fetchPage(1);
    const firstProducts = Array.isArray(firstPayload?.product) ? firstPayload.product : [];
    const lastPageRaw = Number.parseInt(String(firstPayload?.paginate?.last_page || '1'), 10);
    const lastPage = Math.min(
      Number.isFinite(lastPageRaw) && lastPageRaw > 0 ? lastPageRaw : 1,
      maxPages
    );
    allProducts.push(...firstProducts);

    for (let start = 2; start <= lastPage; start += FETCH_CONCURRENCY) {
      const pages = Array.from(
        { length: Math.min(FETCH_CONCURRENCY, lastPage - start + 1) },
        (_, index) => start + index
      );
      const payloads = await Promise.all(pages.map(fetchPage));
      for (const payload of payloads) {
      const products = Array.isArray(payload?.product) ? payload.product : [];
      allProducts.push(...products);
      }
    }

    const seen = new Set<string>();
    const uniqueProducts = allProducts.filter((product: any) => {
      const data = product?.product_data?.[0];
      const key = String(data?.id || data?.sku || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({
      success: true,
      product: uniqueProducts,
      meta: {
        pagesFetched: lastPage,
        productCount: uniqueProducts.length,
        pageSize,
        total: firstPayload?.paginate?.total ?? uniqueProducts.length,
        lastPage,
        source: CNY_PRODUCTS_ENDPOINT,
        fetchedAt: new Date().toISOString(),
        truncated: lastPage < lastPageRaw,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch CNY products',
      },
      { status: 502 }
    );
  }
}
