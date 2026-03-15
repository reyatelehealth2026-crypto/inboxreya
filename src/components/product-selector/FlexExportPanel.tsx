'use client';

import { useState, useMemo } from 'react';
import { Copy, Download, Zap, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FlexPreview } from '@/components/inbox/FlexPreview';
import { SendCatalogDialog } from '@/components/inbox/SendCatalogDialog';
import type {
  ExportGlobalConfig,
  ExportThemeKey,
  FlexMessageTemplate,
} from '@/lib/flex-builder';
import { getTemplateDefaults, csvProductToPreviewProduct } from '@/lib/flex-builder';
import { useFlexExport } from './hooks/useFlexExport';
import type { CsvProduct } from '@/lib/csv-product';

const THEME_OPTIONS: { value: ExportThemeKey; label: string; color: string }[] = [
  { value: 'rose', label: 'แดง', color: '#E53E3E' },
  { value: 'violet', label: 'ม่วง', color: '#805AD5' },
  { value: 'emerald', label: 'เขียว', color: '#38A169' },
  { value: 'amber', label: 'ส้ม', color: '#D69E2E' },
  { value: 'sky', label: 'ฟ้า', color: '#4299E1' },
];

const TEMPLATE_OPTIONS: { value: FlexMessageTemplate; label: string }[] = [
  { value: 'promotion', label: 'โปรโมชัน' },
  { value: 'flash_sale', label: 'Flash Sale' },
  { value: 'new_arrival', label: 'สินค้าใหม่' },
  { value: 'bestseller', label: 'สินค้าขายดี' },
  { value: 'product_catalog', label: 'แคตตาล็อคสินค้า' },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

interface FlexExportPanelProps {
  selectedProducts: CsvProduct[];
}

export function FlexExportPanel({ selectedProducts }: FlexExportPanelProps) {
  const initialDefaults = getTemplateDefaults('promotion');
  const [config, setConfig] = useState<ExportGlobalConfig>({
    template: 'promotion',
    title: initialDefaults.title,
    intro: initialDefaults.intro,
    footerText: initialDefaults.footerText,
    ctaLabel: initialDefaults.ctaLabel,
    theme: initialDefaults.theme,
  });
  const [minify, setMinify] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);

  const previewProducts = useMemo(
    () => selectedProducts.map(csvProductToPreviewProduct),
    [selectedProducts]
  );

  const { flexPayload, flexJsonPretty, flexJsonMinified, sizePretty, sizeMinified } = useFlexExport(
    selectedProducts,
    config
  );

  const flexJson = minify ? flexJsonMinified : flexJsonPretty;
  const size = minify ? sizeMinified : sizePretty;
  const isLarge = size > 500 * 1024;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(flexJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const blob = new Blob([flexJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flex-${config.template}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-slate-900">ตั้งค่า Flex Message</h3>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">เทมเพลต</Label>
          <Select
            value={config.template}
            onValueChange={(value) => {
              const nextTemplate = value as FlexMessageTemplate;
              const defaults = getTemplateDefaults(nextTemplate);
              setConfig({
                ...config,
                template: nextTemplate,
                title: defaults.title,
                intro: defaults.intro,
                footerText: defaults.footerText,
                ctaLabel: defaults.ctaLabel,
                theme: defaults.theme,
              });
            }}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">หัวข้อ</Label>
          <Input
            value={config.title}
            onChange={(e) => setConfig({ ...config, title: e.target.value })}
            className="h-8 text-sm"
          />
        </div>

        <div>
          <Label className="text-xs">คำอธิบาย</Label>
          <Textarea
            value={config.intro}
            onChange={(e) => setConfig({ ...config, intro: e.target.value })}
            className="min-h-[60px] text-sm"
          />
        </div>

        <div>
          <Label className="text-xs">ข้อความท้ายการ์ด</Label>
          <Textarea
            value={config.footerText}
            onChange={(e) => setConfig({ ...config, footerText: e.target.value })}
            className="min-h-[56px] text-sm"
          />
        </div>

        <div>
          <Label className="text-xs">ข้อความปุ่ม CTA</Label>
          <Input
            value={config.ctaLabel}
            onChange={(e) => setConfig({ ...config, ctaLabel: e.target.value })}
            className="h-8 text-sm"
          />
        </div>

        <div>
          <Label className="text-xs">ธีมสี</Label>
          <div className="flex gap-2">
            {THEME_OPTIONS.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => setConfig({ ...config, theme: t.value })}
                className={`w-8 h-8 rounded-full border-2 ${
                  config.theme === t.value ? 'border-slate-900' : 'border-transparent'
                }`}
                style={{ backgroundColor: t.color }}
                title={t.label}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Preview</Label>
          <div className="rounded-lg border bg-slate-50 p-3">
            <FlexPreview flex={flexPayload} />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-sm">Minify JSON</span>
          </div>
          <button
            type="button"
            onClick={() => setMinify(!minify)}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              minify ? 'bg-violet-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                minify ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {isLarge && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertDescription className="text-xs text-amber-800">
              JSON ขนาด {formatBytes(size)} - แนะนำให้ Download
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            variant={isLarge ? 'secondary' : 'outline'}
            size="sm"
            onClick={handleCopy}
            disabled={copied}
          >
            <Copy className="mr-2 h-4 w-4" />
            {copied ? 'คัดลอกแล้ว!' : `Copy (${formatBytes(size)})`}
          </Button>
          <Button variant={isLarge ? 'default' : 'outline'} size="sm" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>

        <Button
          className="w-full bg-green-600 hover:bg-green-700 text-white"
          onClick={() => setShowSendDialog(true)}
        >
          <Send className="mr-2 h-4 w-4" />
          ส่งไปยัง LINE
        </Button>
      </div>

      <SendCatalogDialog
        open={showSendDialog}
        onOpenChange={setShowSendDialog}
        products={previewProducts}
        defaultConfig={config}
      />
    </div>
  );
}
