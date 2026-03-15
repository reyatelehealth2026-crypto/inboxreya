import { ProductSelector } from '@/components/product-selector';

export default function PromotionsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">สร้างโปรโมชัน</h1>
          <p className="text-slate-500">เลือกสินค้าและสร้าง Flex Message สำหรับส่งโปรโมชัน</p>
        </div>
        <ProductSelector />
      </div>
    </div>
  );
}
