import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parseCsvProducts } from '@/lib/csv-product';
import { csvProductToProduct } from '@/lib/csv-to-product';

/**
 * GET /api/inbox/catalog/products
 * Returns products from CSV in Product format for catalog/promotions
 */
export async function GET() {
  try {
    const csvPath = path.join(process.cwd(), 'public', 'data', 'cnypharmacyz.csv');
    const text = fs.readFileSync(csvPath, 'utf-8');
    const csvProducts = parseCsvProducts(text);
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
