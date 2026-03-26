import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { callPhpApiFormData } from '@/lib/php-bridge';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });

    const phpFormData = new FormData();
    phpFormData.append('file', file);
    phpFormData.append('type', 'image');

    const result = await callPhpApiFormData<{ mediaUrl?: string }>('/api/line/upload-only.php', phpFormData);

    if (!result.success || !result.data?.mediaUrl) {
      return NextResponse.json({ success: false, error: result.error || 'Upload failed' }, { status: 500 });
    }

    const url = result.data.mediaUrl;
    if (!url.startsWith('https://')) {
      return NextResponse.json({ success: false, error: 'Uploaded URL is not HTTPS' }, { status: 500 });
    }

    return NextResponse.json({ success: true, url });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
