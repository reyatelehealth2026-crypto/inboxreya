export interface CsvProduct {
  productUrl: string;
  imageUrl: string;
  minQtyLabel: string;
  maxQtyLabel: string;
  offerHeader: string;
  offerStart: string;
  offerEnd: string;
  skuLabel: string;
  sku: string;
  productName: string;
  promoCond1: string;
  promoCond2: string;
  pricePerUnit: string;
  btnLabel: string;
  priceNumber: string;
  priceUnit: string;
  priceAfterDiscount: string;
  specName: string;
  bulkPrice: string;
  bulkUnit: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  result.push(current);
  return result;
}

export function parseCsvProducts(text: string): CsvProduct[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const products: CsvProduct[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);

    const productUrl = cols[0]?.trim() ?? '';
    const imageUrl = cols[1]?.trim() ?? '';

    if (!productUrl && !imageUrl) continue;

    products.push({
      productUrl,
      imageUrl,
      minQtyLabel: cols[2]?.trim() ?? '',
      maxQtyLabel: cols[3]?.trim() ?? '',
      offerHeader: cols[4]?.trim() ?? '',
      offerStart: cols[5]?.trim() ?? '',
      offerEnd: cols[6]?.trim() ?? '',
      skuLabel: cols[7]?.trim() ?? '',
      sku: cols[8]?.trim() ?? '',
      productName: cols[9]?.trim() ?? '',
      promoCond1: cols[10]?.trim() ?? '',
      promoCond2: cols[11]?.trim() ?? '',
      pricePerUnit: cols[12]?.trim() ?? '',
      btnLabel: cols[13]?.trim() ?? 'ซื้อเลย',
      priceNumber: cols[14]?.trim() ?? '',
      priceUnit: cols[15]?.trim() ?? '',
      priceAfterDiscount: cols[16]?.trim() ?? '',
      specName: cols[17]?.trim() ?? '',
      bulkPrice: cols[18]?.trim() ?? '',
      bulkUnit: cols[19]?.trim() ?? '',
    });
  }

  return products;
}

export async function fetchCsvProducts(): Promise<CsvProduct[]> {
  const response = await fetch('/data/cnypharmacyz.csv');
  if (!response.ok) {
    throw new Error('Failed to fetch CSV data');
  }
  const text = await response.text();
  return parseCsvProducts(text);
}
