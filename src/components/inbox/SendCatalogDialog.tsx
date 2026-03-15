'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Send,
  ChevronLeft,
  ChevronRight,
  Settings2,
  Eye,
  Tag,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Users,
  Package,
  LayoutTemplate,
} from 'lucide-react';
import { FlexPreview } from './FlexPreview';
import {
  buildFlexPayload,
  getTemplateDefaults,
  type ExportPreviewProduct,
  type ExportGlobalConfig,
  type ExportThemeKey,
  type FlexMessageTemplate,
} from '@/lib/flex-builder';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TagInfo {
  id: number;
  name: string;
  color: string;
  userCount: number;
}

type Step = 'flex-settings' | 'preview' | 'select-tags' | 'confirm';

const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: 'flex-settings', label: 'ตั้งค่า Flex', icon: Settings2 },
  { key: 'preview', label: 'Preview', icon: Eye },
  { key: 'select-tags', label: 'เลือก Tags', icon: Tag },
  { key: 'confirm', label: 'ยืนยัน', icon: CheckCircle2 },
];

const TEMPLATE_OPTIONS: { value: FlexMessageTemplate; label: string }[] = [
  { value: 'promotion', label: 'โปรโมชัน' },
  { value: 'flash_sale', label: 'Flash Sale' },
  { value: 'new_arrival', label: 'สินค้าใหม่' },
  { value: 'bestseller', label: 'สินค้าขายดี' },
  { value: 'product_catalog', label: 'แคตตาล็อคสินค้า' },
];

const THEME_OPTIONS: { value: ExportThemeKey; label: string; color: string }[] = [
  { value: 'rose', label: 'แดง', color: '#E53E3E' },
  { value: 'violet', label: 'ม่วง', color: '#805AD5' },
  { value: 'emerald', label: 'เขียว', color: '#38A169' },
  { value: 'amber', label: 'ส้ม', color: '#D69E2E' },
  { value: 'sky', label: 'ฟ้า', color: '#4299E1' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface SendCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ExportPreviewProduct[];
  defaultConfig?: Partial<ExportGlobalConfig>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SendCatalogDialog({
  open,
  onOpenChange,
  products,
  defaultConfig,
}: SendCatalogDialogProps) {
  const [step, setStep] = useState<Step>('flex-settings');
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    totalUsers?: number;
    totalCarousels?: number;
    successCount?: number;
    failCount?: number;
    errors?: string[];
    error?: string;
  } | null>(null);

  // Flex config
  const initialDefaults = getTemplateDefaults(
    (defaultConfig?.template as FlexMessageTemplate) ?? 'promotion'
  );
  const [config, setConfig] = useState<ExportGlobalConfig>({
    template: 'promotion',
    title: initialDefaults.title,
    intro: initialDefaults.intro,
    footerText: initialDefaults.footerText,
    ctaLabel: initialDefaults.ctaLabel,
    theme: initialDefaults.theme,
    includeIntroBubble: true,
    ...defaultConfig,
  });
  const [productsPerCarousel, setProductsPerCarousel] = useState(6);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('flex-settings');
      setSelectedTagIds(new Set());
      setSendResult(null);
    }
  }, [open]);

  // Fetch tags when reaching select-tags step
  useEffect(() => {
    if (step === 'select-tags' && tags.length === 0) {
      setLoadingTags(true);
      fetch('/api/inbox/catalog/send')
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setTags(data.data);
        })
        .catch(console.error)
        .finally(() => setLoadingTags(false));
    }
  }, [step, tags.length]);

  // Split products into carousels
  const carousels = useMemo(() => {
    const perCarousel = Math.min(Math.max(1, productsPerCarousel), 12);
    const chunks: ExportPreviewProduct[][] = [];
    for (let i = 0; i < products.length; i += perCarousel) {
      chunks.push(products.slice(i, i + perCarousel));
    }
    return chunks;
  }, [products, productsPerCarousel]);

  // Build flex payloads for preview
  const carouselPayloads = useMemo(() => {
    return carousels.map((chunk, idx) =>
      buildFlexPayload(chunk, {
        ...config,
        includeIntroBubble: idx === 0 && config.includeIntroBubble !== false,
      })
    );
  }, [carousels, config]);

  const totalTargetUsers = useMemo(() => {
    return tags
      .filter((t) => selectedTagIds.has(t.id))
      .reduce((sum, t) => sum + t.userCount, 0);
  }, [tags, selectedTagIds]);

  const handleTemplateChange = useCallback((template: FlexMessageTemplate) => {
    const defaults = getTemplateDefaults(template);
    setConfig((prev) => ({
      ...prev,
      template,
      title: defaults.title,
      intro: defaults.intro,
      footerText: defaults.footerText,
      ctaLabel: defaults.ctaLabel,
      theme: defaults.theme,
      includeIntroBubble: template !== 'product_catalog',
    }));
  }, []);

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const handleSend = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const resp = await fetch('/api/inbox/catalog/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products,
          config,
          productsPerCarousel,
          tagIds: Array.from(selectedTagIds),
          altText: config.title,
        }),
      });
      const data = await resp.json();
      setSendResult(data.success ? { success: true, ...data.data } : { success: false, error: data.error });
      if (data.success) setStep('confirm');
    } catch (err) {
      setSendResult({ success: false, error: (err as Error).message });
    } finally {
      setSending(false);
    }
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const canGoNext = () => {
    if (step === 'flex-settings') return products.length > 0;
    if (step === 'preview') return true;
    if (step === 'select-tags') return selectedTagIds.size > 0;
    return false;
  };

  const goNext = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next.key);
  };

  const goPrev = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev.key);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 border-b bg-gray-50 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <Send className="w-5 h-5 text-green-600" />
            ส่งสินค้าไปยัง LINE
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="px-6 pt-4 pb-2 shrink-0">
          <div className="flex items-center justify-between">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const isActive = s.key === step;
              const isDone = idx < stepIndex;
              return (
                <React.Fragment key={s.key}>
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors',
                        isActive
                          ? 'bg-green-600 border-green-600 text-white'
                          : isDone
                          ? 'bg-green-100 border-green-400 text-green-700'
                          : 'bg-white border-gray-300 text-gray-400'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-medium hidden sm:block',
                        isActive ? 'text-green-700' : isDone ? 'text-green-600' : 'text-gray-400'
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-2 transition-colors',
                        idx < stepIndex ? 'bg-green-400' : 'bg-gray-200'
                      )}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4">
            {/* ── Step 1: Flex Settings ── */}
            {step === 'flex-settings' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <LayoutTemplate className="w-4 h-4" />
                  ตั้งค่า Flex Message
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">เทมเพลต</Label>
                    <Select
                      value={config.template}
                      onValueChange={(v) => handleTemplateChange(v as FlexMessageTemplate)}
                    >
                      <SelectTrigger className="h-9 text-sm">
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

                  <div className="space-y-1.5">
                    <Label className="text-xs">สินค้าต่อ Carousel</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={12}
                        value={productsPerCarousel}
                        onChange={(e) =>
                          setProductsPerCarousel(Math.min(12, Math.max(1, parseInt(e.target.value) || 1)))
                        }
                        className="h-9 text-sm w-20"
                      />
                      <span className="text-xs text-gray-500">
                        → {carousels.length} carousel
                        {carousels.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Carousel count summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 flex items-start gap-2">
                  <Package className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <strong>{products.length}</strong> สินค้า จะถูกแบ่งเป็น{' '}
                    <strong>{carousels.length}</strong> carousel message
                    {carousels.length > 1
                      ? ` (${productsPerCarousel} สินค้า/carousel, carousel สุดท้ายมี ${((products.length - 1) % productsPerCarousel) + 1} สินค้า)`
                      : ''}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">หัวข้อ</Label>
                  <Input
                    value={config.title}
                    onChange={(e) => setConfig({ ...config, title: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">คำอธิบาย</Label>
                  <Textarea
                    value={config.intro}
                    onChange={(e) => setConfig({ ...config, intro: e.target.value })}
                    className="text-sm min-h-[64px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">ข้อความท้ายการ์ด</Label>
                  <Textarea
                    value={config.footerText}
                    onChange={(e) => setConfig({ ...config, footerText: e.target.value })}
                    className="text-sm min-h-[56px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">ข้อความปุ่ม CTA</Label>
                  <Input
                    value={config.ctaLabel}
                    onChange={(e) => setConfig({ ...config, ctaLabel: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">ธีมสี</Label>
                  <div className="flex gap-2">
                    {THEME_OPTIONS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        title={t.label}
                        onClick={() => setConfig({ ...config, theme: t.value })}
                        className={cn(
                          'w-8 h-8 rounded-full border-2 transition-transform',
                          config.theme === t.value
                            ? 'border-gray-800 scale-110'
                            : 'border-transparent hover:scale-105'
                        )}
                        style={{ backgroundColor: t.color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Preview ── */}
            {step === 'preview' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Preview Flex Message ({carousels.length} carousel
                  {carousels.length > 1 ? 's' : ''})
                </h3>

                {carouselPayloads.map((payload, idx) => (
                  <div key={idx} className="rounded-lg border bg-slate-50 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Carousel {idx + 1} / {carousels.length}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {carousels[idx].length} สินค้า
                        {idx === 0 && config.includeIntroBubble !== false ? ' + Intro bubble' : ''}
                      </span>
                    </div>
                    <FlexPreview flex={payload} />
                  </div>
                ))}
              </div>
            )}

            {/* ── Step 3: Select Tags ── */}
            {step === 'select-tags' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  เลือก Tags ผู้ใช้ที่จะส่ง
                </h3>

                {loadingTags ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : tags.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Tag className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">ไม่พบ Tags ในระบบ</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tags.map((tag) => {
                      const selected = selectedTagIds.has(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                            selected
                              ? 'border-green-500 bg-green-50 ring-1 ring-green-400'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          )}
                        >
                          <div
                            className="w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center"
                            style={
                              selected
                                ? { backgroundColor: tag.color, borderColor: tag.color }
                                : { borderColor: tag.color }
                            }
                          >
                            {selected && <span className="text-white text-[10px] font-bold">✓</span>}
                          </div>
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="flex-1 text-sm font-medium text-gray-800">{tag.name}</span>
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Users className="w-3 h-3" />
                            {tag.userCount.toLocaleString()} คน
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedTagIds.size > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
                    <Users className="w-4 h-4 shrink-0" />
                    เลือก <strong>{selectedTagIds.size}</strong> tag • ประมาณ{' '}
                    <strong>{totalTargetUsers.toLocaleString()}</strong> ผู้ใช้
                  </div>
                )}
              </div>
            )}

            {/* ── Step 4: Confirm ── */}
            {step === 'confirm' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  ยืนยันการส่ง
                </h3>

                {/* Result after sending */}
                {sendResult && (
                  <div
                    className={cn(
                      'rounded-lg border p-4 space-y-2',
                      sendResult.success
                        ? 'bg-green-50 border-green-300'
                        : 'bg-red-50 border-red-300'
                    )}
                  >
                    {sendResult.success ? (
                      <>
                        <div className="flex items-center gap-2 text-green-700 font-medium">
                          <CheckCircle2 className="w-5 h-5" />
                          ส่งสำเร็จ!
                        </div>
                        <div className="text-sm text-green-700 space-y-1">
                          <p>ส่งให้ <strong>{sendResult.totalUsers}</strong> ผู้ใช้</p>
                          <p>
                            <strong>{sendResult.totalCarousels}</strong> carousel × {sendResult.totalUsers} ผู้ใช้
                            = <strong>{sendResult.successCount}</strong> ข้อความสำเร็จ
                            {sendResult.failCount ? ` | ${sendResult.failCount} ล้มเหลว` : ''}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start gap-2 text-red-700">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">เกิดข้อผิดพลาด</p>
                          <p className="text-sm">{sendResult.error}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Summary (before sending) */}
                {!sendResult && (
                  <div className="space-y-3">
                    <div className="rounded-lg border bg-gray-50 p-4 space-y-2.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">เทมเพลต</span>
                        <span className="font-medium">
                          {TEMPLATE_OPTIONS.find((o) => o.value === config.template)?.label}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">จำนวนสินค้า</span>
                        <span className="font-medium">{products.length} รายการ</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">จำนวน Carousel messages</span>
                        <span className="font-medium">{carousels.length} ข้อความ</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tags ที่เลือก</span>
                        <span className="font-medium">
                          {tags
                            .filter((t) => selectedTagIds.has(t.id))
                            .map((t) => t.name)
                            .join(', ')}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-gray-600">ผู้รับโดยประมาณ</span>
                        <span className="font-bold text-green-700">
                          ~{totalTargetUsers.toLocaleString()} คน
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">ข้อความทั้งหมด</span>
                        <span className="font-bold text-green-700">
                          ~{(totalTargetUsers * carousels.length).toLocaleString()} ข้อความ
                        </span>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        ข้อความจะถูกส่งทันที คิดค่าใช้จ่ายตาม LINE Messaging API quota
                        ของบัญชี
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t bg-gray-50 shrink-0 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={stepIndex === 0 || sending || sendResult?.success === true}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            ย้อนกลับ
          </Button>

          <div className="flex items-center gap-2">
            {step !== 'confirm' && (
              <Button
                onClick={goNext}
                disabled={!canGoNext()}
                className="bg-green-600 hover:bg-green-700"
              >
                ถัดไป
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}

            {step === 'confirm' && !sendResult && (
              <Button
                onClick={handleSend}
                disabled={sending}
                className="bg-green-600 hover:bg-green-700"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    กำลังส่ง...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    ยืนยันส่ง ({totalTargetUsers.toLocaleString()} คน)
                  </>
                )}
              </Button>
            )}

            {sendResult?.success && (
              <Button
                onClick={() => onOpenChange(false)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                เสร็จสิ้น
              </Button>
            )}

            {sendResult && !sendResult.success && (
              <Button
                variant="outline"
                onClick={() => setSendResult(null)}
              >
                ลองใหม่
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
