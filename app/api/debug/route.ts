import { list } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Search for manifiestos data blobs specifically
    const searches = ['manifiestos-v3.json', 'mdata-', 'manifiestos-data.json', ''];
    const results: Record<string, any[]> = {};

    for (const prefix of searches) {
      const { blobs } = await list({ prefix, limit: 20 });
      results[prefix || 'ALL'] = blobs.map(b => ({
        pathname: b.pathname,
        size: b.size,
        uploadedAt: b.uploadedAt,
      }));
    }

    return NextResponse.json({
      searches: results,
      storeVersion: 'v3-single-key',
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
