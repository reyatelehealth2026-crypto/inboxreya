import { NextRequest, NextResponse } from 'next/server';
import { generateFlexMessageByTemplate, generateFlexCarousel, FlexMessageTemplate } from '@/types/product-catalog';

/**
 * POST /api/inbox/catalog/flex-message
 * Generate LINE Flex Message from selected products
 * 
 * Request Body:
 * {
 *   products: SelectedProduct[],
 *   template?: 'product_catalog' | 'promotion' | 'flash_sale' | 'new_arrival' | 'bestseller',
 *   options?: {
 *     title?: string,
 *     subtitle?: string,
 *     headerColor?: string
 *   }
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   flexMessage: object,
 *   preview?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { products, template = 'product_catalog', options = {} } = body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'กรุณาระบุสินค้าอย่างน้อย 1 รายการ' 
        },
        { status: 400 }
      );
    }

    // Validate product data
    const invalidProducts = products.filter((p: any) => {
      if (!p.product || !p.product.product_data || !p.product.product_data[0]) {
        return true;
      }
      const data = p.product.product_data[0];
      return !data.name || !data.sku;
    });

    if (invalidProducts.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `พบสินค้าที่ข้อมูลไม่สมบูรณ์ ${invalidProducts.length} รายการ` 
        },
        { status: 400 }
      );
    }

    // Generate Flex Message
    let flexMessage: object;

    if (template === 'product_catalog' || !template) {
      // Use simple carousel for product catalog
      flexMessage = generateFlexCarousel(products);
    } else {
      // Use template with header/footer
      flexMessage = generateFlexMessageByTemplate(
        products, 
        template as FlexMessageTemplate, 
        options
      );
    }

    return NextResponse.json({
      success: true,
      flexMessage,
      meta: {
        productCount: products.length,
        template,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error generating Flex Message:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'เกิดข้อผิดพลาดในการสร้าง Flex Message',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/inbox/catalog/flex-message/templates
 * Get available Flex Message templates
 */
export async function GET() {
  const templates = [
    {
      id: 'product_catalog',
      name: 'แคตตาล็อคสินค้า',
      description: 'แสดงสินค้าแบบ Carousel แบบเรียบง่าย',
      icon: '📋',
      defaultHeaderColor: '#15803D'
    },
    {
      id: 'promotion',
      name: 'โปรโมชั่นพิเศษ',
      description: 'แสดงสินค้าโปรโมชั่นพร้อมหัวข้อสีส้ม',
      icon: '🔥',
      defaultHeaderColor: '#EA580C'
    },
    {
      id: 'flash_sale',
      name: 'Flash Sale',
      description: 'แสดงสินค้า Flash Sale สีแดง',
      icon: '⚡',
      defaultHeaderColor: '#DC2626'
    },
    {
      id: 'new_arrival',
      name: 'สินค้าใหม่',
      description: 'แสดงสินค้าใหม่สีม่วง',
      icon: '✨',
      defaultHeaderColor: '#7C3AED'
    },
    {
      id: 'bestseller',
      name: 'สินค้าขายดี',
      description: 'แสดงสินค้าขายดีสีเหลือง/ทอง',
      icon: '🏆',
      defaultHeaderColor: '#CA8A04'
    }
  ];

  return NextResponse.json({
    success: true,
    templates
  });
}
