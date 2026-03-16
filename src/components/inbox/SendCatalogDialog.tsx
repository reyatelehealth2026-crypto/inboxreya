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
  MessageSquareText,
  ImageIcon,
  Code2,
} from 'lucide-react';
import { FlexPreview } from './FlexPreview';
import {
  buildPromoCarouselContents,
  buildPromoMessages,
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
  { key: 'flex-settings', label: 'ตั้งค่า', icon: Settings2 },
  { key: 'preview', label: 'Preview', icon: Eye },
  { key: 'select-tags', label: 'Tags', icon: Tag },
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

// ─── Carousel split helper ────────────────────────────────────────────────────

interface CarouselSplit {
  products: ExportPreviewProduct[];
  isFirst: boolean;
  startBubbleNum: number;
}

function computeCarouselSplits(
  products: ExportPreviewProduct[],
  productsPerBubble: number,
  hasClosingText: boolean
): CarouselSplit[] {
  const perBubble = Math.min(Math.max(1, productsPerBubble), 6);
  const maxCarousels = hasClosingText ? 4 : 5;
  const splits: CarouselSplit[] = [];
  let productIndex = 0;
  let carouselIdx = 0;
  let bubbleNum = 1;

  while (carouselIdx < maxCarousels && productIndex < products.length) {
    const isFirst = carouselIdx === 0;
    const maxGridSlots = 12 - (isFirst ? 1 : 0);
    const maxProductsThisCarousel = maxGridSlots * perBubble;
    const chunk = products.slice(productIndex, productIndex + maxProductsThisCarousel);
    splits.push({ products: chunk, isFirst, startBubbleNum: bubbleNum });
    bubbleNum += Math.ceil(chunk.length / perBubble);
    productIndex += chunk.length;
    carouselIdx++;
  }
  return splits;
}

// ─── JSON validator ───────────────────────────────────────────────────────────

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateFlexMessages(messages: object[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!messages.length) {
    errors.push('ไม่มี message objects');
    return { valid: false, errors, warnings };
  }
  if (messages.length > 5) {
    errors.push(`มี ${messages.length} payloads — เกินขีดจำกัด LINE API (สูงสุด 5 ต่อ call)`);
  }

  messages.forEach((msg: any, i) => {
    const n = i + 1;
    if (msg.type === 'flex') {
      if (!msg.altText) warnings.push(`Payload ${n}: ควรมี altText`);
      if (!msg.contents) { errors.push(`Payload ${n}: ไม่มี contents`); return; }
      const c = msg.contents;
      if (c.type !== 'carousel') { errors.push(`Payload ${n}: contents.type ต้องเป็น "carousel"`); return; }
      const bubbles: any[] = Array.isArray(c.contents) ? c.contents : [];
      if (!bubbles.length) { errors.push(`Payload ${n}: carousel ไม่มี bubble`); return; }
      if (bubbles.length > 12) errors.push(`Payload ${n}: มี ${bubbles.length} bubbles — เกินขีดจำกัด 12`);

      const sizes = [...new Set(bubbles.map((b) => b.size).filter(Boolean))];
      if (sizes.length > 1)
        errors.push(`Payload ${n}: bubbles มีหลายขนาด (${sizes.join(', ')}) — LINE กำหนดให้ทุก bubble ในCarousel ต้องขนาดเดียวกัน`);
      const nonGiga = bubbles.filter((b) => b.size && b.size !== 'giga');
      if (nonGiga.length) warnings.push(`Payload ${n}: ${nonGiga.length} bubble ไม่ได้ใช้ size=giga`);
      const noSize = bubbles.filter((b) => !b.size);
      if (noSize.length) warnings.push(`Payload ${n}: ${noSize.length} bubble ไม่ได้ระบุ size`);
    } else if (msg.type === 'text') {
      if (!msg.text) errors.push(`Payload ${n}: text message ไม่มีข้อความ`);
    } else {
      errors.push(`Payload ${n}: type "${msg.type}" ไม่รู้จัก`);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
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
    totalMessages?: number;
    successCount?: number;
    failCount?: number;
    errors?: string[];
    error?: string;
  } | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [jsonValidated, setJsonValidated] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

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
    heroImageUrl: '',
    ...defaultConfig,
  });
  const [productsPerBubble, setProductsPerBubble] = useState(6);
  const [closingText, setClosingText] = useState(
    'ด่วน! โปรโมชั่นนี้มีจำนวนจำกัด ทักแชทสั่งซื้อได้เลยค่ะ 👇'
  );
  const [includeClosingText, setIncludeClosingText] = useState(true);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('flex-settings');
      setSelectedTagIds(new Set());
      setSendResult(null);
      setJsonValidated(false);
      setValidationResult(null);
      setShowJson(false);
    }
  }, [open]);

  // Fetch tags on reaching tag step
  useEffect(() => {
    if (step === 'select-tags' && tags.length === 0) {
      setLoadingTags(true);
      fetch('/api/inbox/catalog/send')
        .then((r) => r.json())
        .then((data) => { if (data.success) setTags(data.data); })
        .catch(console.error)
        .finally(() => setLoadingTags(false));
    }
  }, [step, tags.length]);

  // Carousel splits
  const carouselSplits = useMemo(
    () => computeCarouselSplits(products, productsPerBubble, includeClosingText && !!closingText.trim()),
    [products, productsPerBubble, includeClosingText, closingText]
  );

  // Per-carousel payloads for preview
  const carouselPayloads = useMemo(() => {
    return carouselSplits.map((split) =>
      buildPromoCarouselContents(split.products, config, {
        includeCover: split.isFirst,
        productsPerBubble: Math.min(Math.max(1, productsPerBubble), 6),
        startBubbleNum: split.startBubbleNum,
        totalProducts: products.length,
        heroImageUrl: config.heroImageUrl || undefined,
      })
    );
  }, [carouselSplits, config, productsPerBubble, products.length]);

  // Full message objects for JSON validation
  const allMessages = useMemo(() => {
    return buildPromoMessages(products, config, {
      productsPerBubble: Math.min(Math.max(1, productsPerBubble), 6),
      closingText: includeClosingText && closingText.trim() ? closingText.trim() : undefined,
      maxCarousels: 3,
    });
  }, [products, config, productsPerBubble, includeClosingText, closingText]);

  const totalPayloads = carouselSplits.length + (includeClosingText && closingText.trim() ? 1 : 0);

  const totalTargetUsers = useMemo(
    () => tags.filter((t) => selectedTagIds.has(t.id)).reduce((s, t) => s + t.userCount, 0),
    [tags, selectedTagIds]
  );

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

  const runValidation = useCallback(() => {
    const result = validateFlexMessages(allMessages);
    setValidationResult(result);
    setJsonValidated(result.valid);
  }, [allMessages]);

  // Re-validate whenever messages change (mark as un-validated)
  useEffect(() => {
    setJsonValidated(false);
    setValidationResult(null);
  }, [allMessages]);

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
          productsPerBubble: Math.min(Math.max(1, productsPerBubble), 6),
          closingText: includeClosingText && closingText.trim() ? closingText.trim() : undefined,
          tagIds: Array.from(selectedTagIds),
        }),
      });
      const data = await resp.json();
      setSendResult(
        data.success
          ? { success: true, ...data.data }
          : { success: false, error: data.error }
      );
      if (data.success) setStep('confirm');
    } catch (err) {
      setSendResult({ success: false, error: (err as Error).message });
    } finally {
      setSending(false);
    }
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const canGoNext =
    step === 'flex-settings' ? products.length > 0
    : step === 'preview' ? true
    : step === 'select-tags' ? selectedTagIds.size > 0
    : false;

  const goNext = () => { const n = STEPS[stepIndex + 1]; if (n) setStep(n.key); };
  const goPrev = () => { const p = STEPS[stepIndex - 1]; if (p) setStep(p.key); };

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
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors',
                      isActive ? 'bg-green-600 border-green-600 text-white'
                        : isDone ? 'bg-green-100 border-green-400 text-green-700'
                        : 'bg-white border-gray-300 text-gray-400'
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={cn(
                      'text-[10px] font-medium hidden sm:block',
                      isActive ? 'text-green-700' : isDone ? 'text-green-600' : 'text-gray-400'
                    )}>
                      {s.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={cn(
                      'flex-1 h-0.5 mx-2 transition-colors',
                      idx < stepIndex ? 'bg-green-400' : 'bg-gray-200'
                    )} />
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
                  ตั้งค่า Flex Message (Grid Layout · size: giga)
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">เทมเพลต</Label>
                    <Select value={config.template} onValueChange={(v) => handleTemplateChange(v as FlexMessageTemplate)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">สินค้าต่อ Bubble (สูงสุด 6)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" min={1} max={6}
                        value={productsPerBubble}
                        onChange={(e) => setProductsPerBubble(Math.min(6, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="h-9 text-sm w-20"
                      />
                      <span className="text-xs text-gray-500">→ {carouselSplits.length} carousel{carouselSplits.length > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>

                {/* Payload counter */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                  <div className="flex items-start gap-2 text-sm text-blue-800">
                    <Package className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <strong>{products.length}</strong> สินค้า · <strong>{carouselSplits.length}</strong> Flex Carousel ·{' '}
                      {includeClosingText && closingText.trim() && <><strong>1</strong> ข้อความปิดท้าย = </>}
                      <strong className={totalPayloads >= 5 ? 'text-red-600' : 'text-blue-800'}>
                        {totalPayloads} payload{totalPayloads !== 1 ? 's' : ''}
                      </strong>
                      <span className="text-blue-600"> / 5 (LINE limit)</span>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 pl-6">
                    2 คอลัมน์ × 3 แถว = 6 สินค้า/Bubble · ทุก Bubble ใช้ size=<strong>giga</strong>
                  </p>
                </div>

                {/* Cover image URL */}
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                    รูปภาพปก Cover Bubble (URL)
                    <span className="text-gray-400 font-normal">— ถ้าว่างจะใช้พื้นหลังสีธีม</span>
                  </Label>
                  <Input
                    value={config.heroImageUrl ?? ''}
                    onChange={(e) => setConfig({ ...config, heroImageUrl: e.target.value })}
                    placeholder="https://example.com/promo-banner.jpg (ต้องเป็น HTTPS)"
                    className="h-9 text-sm font-mono"
                  />
                  {config.heroImageUrl && (
                    <img
                      src={config.heroImageUrl}
                      alt="preview"
                      className="h-16 rounded border object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">หัวข้อ</Label>
                  <Input value={config.title} onChange={(e) => setConfig({ ...config, title: e.target.value })} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">คำอธิบาย</Label>
                  <Textarea value={config.intro} onChange={(e) => setConfig({ ...config, intro: e.target.value })} className="text-sm min-h-[60px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">ข้อความท้าย Cover</Label>
                  <Textarea value={config.footerText} onChange={(e) => setConfig({ ...config, footerText: e.target.value })} className="text-sm min-h-[52px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">ปุ่ม CTA</Label>
                  <Input value={config.ctaLabel} onChange={(e) => setConfig({ ...config, ctaLabel: e.target.value })} className="h-9 text-sm" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">ธีมสี</Label>
                  <div className="flex gap-2">
                    {THEME_OPTIONS.map((t) => (
                      <button key={t.value} type="button" title={t.label}
                        onClick={() => setConfig({ ...config, theme: t.value })}
                        className={cn('w-8 h-8 rounded-full border-2 transition-transform',
                          config.theme === t.value ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105')}
                        style={{ backgroundColor: t.color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Closing text */}
                <div className="rounded-lg border p-3 space-y-3 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="w-4 h-4 text-slate-500" />
                      <Label className="text-sm font-medium cursor-pointer">ข้อความปิดท้าย (Text Payload)</Label>
                    </div>
                    <button type="button" onClick={() => setIncludeClosingText(!includeClosingText)}
                      className={cn('relative h-5 w-9 rounded-full transition-colors', includeClosingText ? 'bg-green-500' : 'bg-slate-300')}>
                      <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                        includeClosingText ? 'translate-x-4' : 'translate-x-0.5')} />
                    </button>
                  </div>
                  {includeClosingText && (
                    <Textarea
                      value={closingText}
                      onChange={(e) => setClosingText(e.target.value)}
                      placeholder="เช่น ด่วน! โปรโมชั่นนี้มีจำนวนจำกัด ทักแชทสั่งซื้อได้เลยค่ะ 👇"
                      className="text-sm min-h-[60px]"
                    />
                  )}
                </div>
              </div>
            )}

            {/* ── Step 2: Preview ── */}
            {step === 'preview' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Preview — {carouselSplits.length} Flex + {totalPayloads} payload{totalPayloads !== 1 ? 's' : ''} total
                </h3>

                {carouselPayloads.map((payload, idx) => {
                  const split = carouselSplits[idx];
                  return (
                    <div key={idx} className="rounded-lg border bg-slate-50 p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs font-medium">
                          Payload {idx + 1} — Flex Carousel
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {split.products.length} สินค้า{split.isFirst ? ' + Cover bubble' : ''}
                          {split.isFirst && config.heroImageUrl ? ' 🖼️' : ''}
                        </span>
                      </div>
                      <FlexPreview flex={payload} />
                    </div>
                  );
                })}

                {includeClosingText && closingText.trim() && (
                  <div className="rounded-lg border bg-slate-50 p-3 space-y-2">
                    <Badge variant="outline" className="text-xs font-medium">
                      Payload {carouselSplits.length + 1} — Text
                    </Badge>
                    <div className="bg-white rounded-lg border p-3 text-sm text-gray-800 whitespace-pre-wrap">
                      {closingText}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: Tags ── */}
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
                        <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                          className={cn('w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                            selected ? 'border-green-500 bg-green-50 ring-1 ring-green-400' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50')}>
                          <div className="w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center"
                            style={selected ? { backgroundColor: tag.color, borderColor: tag.color } : { borderColor: tag.color }}>
                            {selected && <span className="text-white text-[10px] font-bold">✓</span>}
                          </div>
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
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
                    เลือก <strong className="mx-1">{selectedTagIds.size}</strong> tag ·
                    ประมาณ <strong className="mx-1">{totalTargetUsers.toLocaleString()}</strong> ผู้ใช้
                  </div>
                )}
              </div>
            )}

            {/* ── Step 4: Confirm ── */}
            {step === 'confirm' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  ยืนยันก่อนส่ง
                </h3>

                {/* Send result */}
                {sendResult && (
                  <div className={cn('rounded-lg border p-4 space-y-2',
                    sendResult.success ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300')}>
                    {sendResult.success ? (
                      <>
                        <div className="flex items-center gap-2 text-green-700 font-medium">
                          <CheckCircle2 className="w-5 h-5" /> ส่งสำเร็จ!
                        </div>
                        <div className="text-sm text-green-700 space-y-1">
                          <p>ส่งให้ <strong>{sendResult.totalUsers}</strong> ผู้ใช้ × <strong>{totalPayloads}</strong> payloads</p>
                          <p>สำเร็จ <strong>{sendResult.successCount}</strong> · {sendResult.failCount ? `ล้มเหลว ${sendResult.failCount}` : 'ไม่มีความผิดพลาด'}</p>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start gap-2 text-red-700">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div><p className="font-medium">เกิดข้อผิดพลาด</p><p className="text-sm">{sendResult.error}</p></div>
                      </div>
                    )}
                  </div>
                )}

                {/* Pre-send: JSON validation + summary */}
                {!sendResult && (
                  <div className="space-y-3">
                    {/* ── JSON Validation ── */}
                    <div className="rounded-lg border bg-gray-50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                          <Code2 className="w-4 h-4" />
                          ตรวจสอบ JSON ก่อนส่ง
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={runValidation}>
                            {validationResult ? 'ตรวจใหม่' : 'ตรวจสอบ JSON'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setShowJson(!showJson)}>
                            {showJson ? 'ซ่อน JSON' : 'ดู JSON'}
                          </Button>
                        </div>
                      </div>

                      {validationResult && (
                        <div className={cn('rounded p-2 text-xs space-y-1',
                          validationResult.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                          <p className="font-semibold">
                            {validationResult.valid ? '✅ JSON ถูกต้อง' : `❌ พบปัญหา ${validationResult.errors.length} รายการ`}
                          </p>
                          {validationResult.errors.map((e, i) => (
                            <p key={i} className="pl-2">• {e}</p>
                          ))}
                          {validationResult.warnings.map((w, i) => (
                            <p key={i} className="pl-2 text-amber-600">⚠ {w}</p>
                          ))}
                        </div>
                      )}

                      {!validationResult && (
                        <p className="text-xs text-gray-500">
                          กด "ตรวจสอบ JSON" เพื่อยืนยันว่า LINE Flex Message JSON ถูกต้องก่อนส่ง
                        </p>
                      )}

                      {showJson && (
                        <pre className="bg-gray-900 text-green-400 text-[10px] font-mono rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                          {JSON.stringify(allMessages, null, 2)}
                        </pre>
                      )}
                    </div>

                    {/* ── Summary ── */}
                    <div className="rounded-lg border bg-gray-50 p-4 space-y-2.5 text-sm">
                      {[
                        ['เทมเพลต', TEMPLATE_OPTIONS.find((o) => o.value === config.template)?.label],
                        ['สินค้า', `${products.length} รายการ`],
                        ['สินค้าต่อ Bubble', `${productsPerBubble} (2 col × 3 row grid)`],
                        ['Bubble size', 'giga (LINE spec ✓)'],
                        ['Flex Carousels', String(carouselSplits.length)],
                        ...(includeClosingText && closingText.trim() ? [['ข้อความปิดท้าย', 'มี']] : []),
                        ['Payloads / call', `${totalPayloads} / 5 ✓`],
                        ['Tags ที่เลือก', tags.filter((t) => selectedTagIds.has(t.id)).map((t) => t.name).join(', ') || '—'],
                      ].map(([label, val], i) => (
                        <div key={i} className={cn('flex justify-between', i === 7 ? 'border-t pt-2' : '')}>
                          <span className="text-gray-600">{label}</span>
                          <span className={cn('font-medium', label === 'Payloads / call' ? 'text-green-700 font-bold' : '')}>{val}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-gray-600">ผู้รับโดยประมาณ</span>
                        <span className="font-bold text-green-700">~{totalTargetUsers.toLocaleString()} คน</span>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        ระบบจะส่ง <strong>{totalPayloads} payloads</strong> ใน LINE API call{' '}
                        <strong>1 ครั้ง</strong> ต่อผู้ใช้ · คิดค่าใช้จ่ายตาม LINE Messaging API quota
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 shrink-0 flex items-center justify-between">
          <Button variant="outline" onClick={goPrev}
            disabled={stepIndex === 0 || sending || sendResult?.success === true}>
            <ChevronLeft className="w-4 h-4 mr-1" /> ย้อนกลับ
          </Button>

          <div className="flex items-center gap-2">
            {step !== 'confirm' && (
              <Button onClick={goNext} disabled={!canGoNext} className="bg-green-600 hover:bg-green-700">
                ถัดไป <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}

            {step === 'confirm' && !sendResult && (
              <Button onClick={handleSend} disabled={sending || !jsonValidated} className="bg-green-600 hover:bg-green-700">
                {sending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังส่ง...</>
                ) : !jsonValidated ? (
                  <><AlertCircle className="w-4 h-4 mr-2" /> ตรวจสอบ JSON ก่อนส่ง</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> ยืนยันส่ง ({totalTargetUsers.toLocaleString()} คน)</>
                )}
              </Button>
            )}

            {sendResult?.success && (
              <Button onClick={() => onOpenChange(false)} className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="w-4 h-4 mr-2" /> เสร็จสิ้น
              </Button>
            )}
            {sendResult && !sendResult.success && (
              <Button variant="outline" onClick={() => setSendResult(null)}>ลองใหม่</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
