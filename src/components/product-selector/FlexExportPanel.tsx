'use client';

import { useState } from 'react';
import { Copy, Download, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ExportGlobalConfig, ExportThemeKey } from '@/lib/flex-builder';
import { useFlexExport } from './hooks/useFlexExport';
import type { CsvProduct } from '@/lib/csv-product';

const THEME_OPTIONS: { value: ExportThemeKey; label: string; color: string }[] = [
  { value: 'rose', label: 'แดง', color: '#E53E3E' },
  { value: 'violet', label: 'ม่วง', color: '#805AD5' },
  { value: 'emerald', label: 'เขียว', color: '#38A169' },
  { value: 'amber', label: 'ส้ม', color: '#D69E2E' },
  { value: 'sky', label: 'ฟ้า', color: '#4299E1' },
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
  const [config, setConfig] = useState<ExportGlobalConfig>({
    template: 'promotion',
    title: 'โปรโมชันพิเศษ',
    intro: 'รวมสินค้าราคาพิเศษ คัดมาให้พร้อมโปรเด่น',
    footerText: 'สนใจตัวไหน แจ้งรหัสส่งกลับมาได้เลย',
    ctaLabel: 'ซื้อเลย',
    theme: 'rose',
  });
  const [minify, setMinify] = useState(false);
  const [copied, setCopied] = useState(false);

  const { flexJsonPretty, flexJsonMinified, sizePretty, sizeMinified } = useFlexExport(
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
    a.download = 'flex-promotion.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-slate-900">ตั้งค่า Flex Message</h3>

      <div className="space-y-3">
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
          <Label className="text-xs">ธีมสี</Label>
          <div className="flex gap-2">
            {THEME_OPTIONS.map((t) => (
              <button
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

        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-sm">Minify JSON</span>
          </div>
          <button
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
      </div>
    </div>
  );
}
