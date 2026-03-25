/**
 * OrderDetailModal Component
 * Large modal for desktop screens
 */

'use client';

import { useEffect, useState } from 'react';
import { Order, OrderStatus } from '@/lib/orders/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  X,
  Clock,
  Package,
  Truck,
  CheckCircle,
  User,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  Edit,
  Printer,
  MessageSquare,
  Save,
  Copy,
  ExternalLink,
} from 'lucide-react';

interface OrderDetailModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (status: OrderStatus) => void;
  onSaveNote?: (note: string) => void;
  onPrint?: () => void;
  onSendMessage?: () => void;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  pending: { 
    label: 'รอดำเนินการ', 
    color: '#F59E0B', 
    bgColor: '#FEF3C7',
    icon: <Clock className="h-5 w-5" />,
  },
  processing: { 
    label: 'กำลังจัดส่ง', 
    color: '#F97316', 
    bgColor: '#FFEDD5',
    icon: <Package className="h-5 w-5" />,
  },
  shipped: { 
    label: 'จัดส่งแล้ว', 
    color: '#3B82F6', 
    bgColor: '#DBEAFE',
    icon: <Truck className="h-5 w-5" />,
  },
  delivered: { 
    label: 'สำเร็จ', 
    color: '#22C55E', 
    bgColor: '#DCFCE7',
    icon: <CheckCircle className="h-5 w-5" />,
  },
  cancelled: { 
    label: 'ยกเลิก', 
    color: '#6B7280', 
    bgColor: '#F3F4F6',
    icon: <X className="h-5 w-5" />,
  },
};

export function OrderDetailModal({
  order,
  isOpen,
  onClose,
  onStatusChange,
  onSaveNote,
  onPrint,
  onSendMessage,
}: OrderDetailModalProps) {
  const [adminNote, setAdminNote] = useState(order?.adminNote || '');
  const [isEditingNote, setIsEditingNote] = useState(false);

  useEffect(() => {
    if (order) {
      setAdminNote(order.adminNote || '');
    }
  }, [order]);

  if (!order) return null;

  const statusConfig = STATUS_CONFIG[order.status];

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('th-TH', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatAmount = (amount: number) => {
    return `฿${amount.toLocaleString()}`;
  };

  const handleSaveNote = () => {
    onSaveNote?.(adminNote);
    setIsEditingNote(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl font-bold">
                  ออเดอร์ #{order.orderNumber}
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="font-medium"
                  style={{
                    borderColor: statusConfig.color,
                    color: statusConfig.color,
                    backgroundColor: statusConfig.bgColor,
                  }}
                >
                  <span className="flex items-center gap-1">
                    {statusConfig.icon}
                    {statusConfig.label}
                  </span>
                </Badge>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                สร้างเมื่อ {formatDate(order.createdAt)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onPrint}>
                <Printer className="h-4 w-4 mr-1" />
                พิมพ์
              </Button>
              <Button variant="outline" size="sm" onClick={onSendMessage}>
                <MessageSquare className="h-4 w-4 mr-1" />
                ส่งข้อความ
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex flex-col">
          {/* Tabs */}
          <TabsList className="px-6 justify-start rounded-none border-b bg-transparent h-10">
            <TabsTrigger value="details" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500">
              รายละเอียด
            </TabsTrigger>
            <TabsTrigger value="items" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500">
              รายการสินค้า
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500">
              ประวัติ
            </TabsTrigger>
          </TabsList>

          <div className="overflow-auto max-h-[calc(90vh-180px)]">
            <TabsContent value="details" className="p-6 m-0 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Customer Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    ข้อมูลลูกค้า
                  </h3>
                  
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div>
                      <p className="text-sm text-gray-500">ชื่อ</p>
                      <p className="font-medium">{order.customerName}</p>
                    </div>
                    
                    {order.customerPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <p>{order.customerPhone}</p>
                      </div>
                    )}

                    {order.shippingAddress && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                        <p className="text-sm">{order.shippingAddress}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    ข้อมูลการชำระเงิน
                  </h3>
                  
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">วิธีชำระเงิน</span>
                      <span className="font-medium">{order.paymentMethod || 'ไม่ระบุ'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">สถานะ</span>
                      <Badge variant={order.paymentStatus === 'paid' ? 'default' : 'secondary'}>
                        {order.paymentStatus === 'paid' ? 'ชำระแล้ว' : 'รอชำระ'}
                      </Badge>
                    </div>
                    
                    <hr className="border-gray-200" />
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">ยอดรวม</span>
                      <span>{formatAmount(order.totalAmount)}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">ค่าจัดส่ง</span>
                      <span>{formatAmount(order.shippingFee)}</span>
                    </div>
                    
                    {order.discountAmount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>ส่วนลด</span>
                        <span>-{formatAmount(order.discountAmount)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>ยอดสุทธิ</span>
                      <span>{formatAmount(order.grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Actions */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">เปลี่ยนสถานะ</h3>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(STATUS_CONFIG) as OrderStatus[]).map((status) => (
                    <Button
                      key={status}
                      variant={order.status === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onStatusChange(status)}
                      disabled={order.status === status}
                      className={cn(
                        order.status === status && 'opacity-50 cursor-not-allowed'
                      )}
                      style={
                        order.status === status
                          ? {
                              backgroundColor: STATUS_CONFIG[status].color,
                              borderColor: STATUS_CONFIG[status].color,
                            }
                          : undefined
                      }
                    >
                      {STATUS_CONFIG[status].icon}
                      <span className="ml-1">{STATUS_CONFIG[status].label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Admin Note */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    บันทึกสำหรับแอดมิน
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => isEditingNote ? handleSaveNote() : setIsEditingNote(true)}
                  >
                    {isEditingNote ? (
                      <>
                        <Save className="h-4 w-4 mr-1" />
                        บันทึก
                      </>
                    ) : (
                      <>
                        <Edit className="h-4 w-4 mr-1" />
                        แก้ไข
                      </>
                    )}
                  </Button>
                </div>
                
                {isEditingNote ? (
                  <Textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="เพิ่มบันทึก..."
                    className="min-h-[100px]"
                  />
                ) : (
                  <div className="bg-yellow-50 rounded-lg p-4 min-h-[100px]">
                    {order.adminNote ? (
                      <p className="text-gray-700">{order.adminNote}</p>
                    ) : (
                      <p className="text-gray-400 italic">ไม่มีบันทึก</p>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="items" className="p-6 m-0">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-500 text-center py-8">
                  รายการสินค้าจะแสดงที่นี่
                </p>
              </div>
            </TabsContent>

            <TabsContent value="history" className="p-6 m-0">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                  <div>
                    <p className="text-sm font-medium">สร้างออเดอร์</p>
                    <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                  </div>
                </div>
                
                {order.shippedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                    <div>
                      <p className="text-sm font-medium">จัดส่งสินค้า</p>
                      <p className="text-xs text-gray-500">{formatDate(order.shippedAt)}</p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
