import { NextResponse } from 'next/server';
import { fetchCsvProducts } from '@/lib/csv-product';
import { csvProductToProduct } from '@/lib/csv-to-product';

/**
 * GET /api/inbox/catalog/products
 * Returns products from CSV in Product format for catalog/promotions
 */
export async function GET() {
  try {
    const csvProducts = await fetchCsvProducts();
    const products = csvProducts.map((csv, i) => csvProductToProduct(csv, i));
    return NextResponse.json({ products });
  } catch (error) {
    console.error('Failed to fetch catalog products:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
