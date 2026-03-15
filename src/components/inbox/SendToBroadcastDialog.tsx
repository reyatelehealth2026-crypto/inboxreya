'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FlexPreview } from '@/components/inbox/FlexPreview';
import { useTags } from '@/hooks/use-tags';
import { useCreateBroadcast } from '@/hooks/use-broadcasts';
import {
  generateFlexCarouselsChunked,
  type SelectedProduct,
  type FlexMessageTemplate,
} from '@/types/product-catalog';
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Users,
  Settings,
  Eye,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const TEMPLATE_OPTIONS: { value: FlexMessageTemplate; label: string }[] = [
  { value: 'product_catalog', label: 'แคตตาล็อคสินค้า' },
  { value: 'promotion', label: 'โปรโมชัน' },
  { value: 'flash_sale', label: 'Flash Sale' },
  { value: 'new_arrival', label: 'สินค้าใหม่' },
  { value: 'bestseller', label: 'สินค้าขายดี' },
];

interface SendToBroadcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProducts: SelectedProduct[];
  onSuccess?: () => void;
}

export function SendToBroadcastDialog({
  open,
  onOpenChange,
  selectedProducts,
  onSuccess,
}: SendToBroadcastDialogProps) {
  const [step, setStep] = useState(1);
  const [productsPerCarousel, setProductsPerCarousel] = useState(6);
  const [template, setTemplate] = useState<FlexMessageTemplate>('promotion');
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
  const [sendAll, setSendAll] = useState(true);

  const { data: tagsData } = useTags();
  const createBroadcast = useCreateBroadcast();
  const tags = Array.isArray(tagsData) ? tagsData : [];

  const carousels = useMemo(
    () =>
      generateFlexCarouselsChunked(selectedProducts, template, {
        productsPerCarousel,
        title: template === 'promotion' ? 'โปรโมชันพิเศษ' : 'แคตตาล็อคสินค้า',
        subtitle: 'รวมสินค้าพร้อมส่งให้ลูกค้า',
      }),
    [selectedProducts, template, productsPerCarousel]
  );

  const toggleTag = (tagId: string | number) => {
    const numId = typeof tagId === 'string' ? parseInt(tagId, 10) : tagId;
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(numId)) next.delete(numId);
      else next.add(numId);
      return next;
    });
  };

  const handleSend = async () => {
    let targetCustomerIds: number[] | undefined;
    if (!sendAll && selectedTagIds.size > 0) {
      const tagIds = Array.from(selectedTagIds).join(',');
      const res = await fetch(`/api/inbox/customers/by-tags?tagIds=${tagIds}`);
      if (res.ok) {
        const { userIds } = await res.json();
        targetCustomerIds = userIds;
      }
    }

    try {
      for (let i = 0; i < carousels.length; i++) {
        const flexContent = {
          type: 'flex' as const,
          altText: `สินค้า ${i + 1}/${carousels.length}`,
          contents: carousels[i] as import('@/types/broadcast').FlexCarousel,
        };
        await createBroadcast.mutateAsync({
          flexContent,
          targetCustomerIds,
        });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Broadcast failed:', err);
    }
  };

  const totalSteps = 4;
  const canProceed =
    (step === 1 && productsPerCarousel >= 1) ||
    (step === 2) ||
    (step === 3 && (sendAll || selectedTagIds.size > 0)) ||
    (step === 4);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            ส่งสินค้าไป Broadcast
          </DialogTitle>
          <div className="flex gap-2 mt-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                  step > s ? 'bg-green-500 text-white' : step === s ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}
              >
                {step > s ? '✓' : s}
              </div>
            ))}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4 min-h-[200px]">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Settings className="w-4 h-4" />
                ตั้งค่า Flex
              </h3>
              <div className="space-y-2">
                <Label>จำนวนสินค้าต่อบับเบิ้ล (Carousel)</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={productsPerCarousel}
                  onChange={(e) => setProductsPerCarousel(Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 6)))}
                />
                <p className="text-xs text-muted-foreground">
                  LINE จำกัดสูงสุด 12 สินค้าต่อ Carousel (เลือก {selectedProducts.length} สินค้า ={' '}
                  {carousels.length} ข้อความ)
                </p>
              </div>
              <div className="space-y-2">
                <Label>เทมเพลต</Label>
                <Select value={template} onValueChange={(v) => setTemplate(v as FlexMessageTemplate)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Eye className="w-4 h-4" />
                ตัวอย่างก่อนส่ง
              </h3>
              <div className="space-y-4">
                {carousels.map((carousel, i) => (
                  <div key={i} className="border rounded-lg p-3 bg-slate-50">
                    <p className="text-xs font-medium text-slate-600 mb-2">
                      ข้อความที่ {i + 1} / {carousels.length}
                    </p>
                    <FlexPreview flex={carousel} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                เลือกกลุ่มเป้าหมาย
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="send-all"
                    checked={sendAll}
                    onCheckedChange={(v) => setSendAll(!!v)}
                  />
                  <label htmlFor="send-all" className="text-sm cursor-pointer">
                    ส่งถึงลูกค้าทั้งหมด
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="send-tags"
                    checked={!sendAll}
                    onCheckedChange={(v) => setSendAll(!v)}
                  />
                  <label htmlFor="send-tags" className="text-sm cursor-pointer">
                    ส่งถึงลูกค้าที่มี Tag ที่เลือก
                  </label>
                </div>
                {!sendAll && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map((tag) => {
                      const tagIdNum = typeof tag.id === 'string' ? parseInt(tag.id, 10) : tag.id;
                      return (
                        <Button
                          key={tag.id}
                          variant={selectedTagIds.has(tagIdNum) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleTag(tag.id)}
                        >
                          {tag.name}
                          {'usageCount' in tag && tag.usageCount != null && (
                            <span className="ml-1 text-xs opacity-80">({tag.usageCount})</span>
                          )}
                        </Button>
                      );
                    })}
                    {tags.length === 0 && (
                      <p className="text-sm text-muted-foreground">ไม่มี Tag ในระบบ</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                ยืนยันการส่ง
              </h3>
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">สินค้า:</span>{' '}
                  {selectedProducts.length} รายการ
                </p>
                <p>
                  <span className="text-muted-foreground">จำนวนข้อความ:</span> {carousels.length}{' '}
                  ข้อความ
                </p>
                <p>
                  <span className="text-muted-foreground">กลุ่มเป้าหมาย:</span>{' '}
                  {sendAll
                    ? 'ลูกค้าทั้งหมด'
                    :                   selectedTagIds.size > 0
                    ? `${Array.from(selectedTagIds)
                        .map((id) => tags.find((t) => (typeof t.id === 'string' ? parseInt(t.id, 10) : t.id) === id)?.name)
                        .filter(Boolean)
                        .join(', ')}`
                      : 'ยังไม่ได้เลือก'}
                </p>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              ย้อนกลับ
            </Button>
          ) : (
            <div />
          )}
          {step < totalSteps ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed}>
              ถัดไป
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={createBroadcast.isPending || !canProceed}
            >
              {createBroadcast.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังส่ง...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  ยืนยันส่ง Broadcast
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
