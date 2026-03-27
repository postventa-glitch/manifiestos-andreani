import { list } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // List ALL blobs in the store
    const allBlobs = await list({ limit: 50 });

    const blobInfo = allBlobs.blobs.map(b => ({
      pathname: b.pathname,
      url: b.url.substring(0, 80) + '...',
      size: b.size,
      uploadedAt: b.uploadedAt,
    }));

    return NextResponse.json({
      totalBlobs: allBlobs.blobs.length,
      blobs: blobInfo,
      storeVersion: 'v3-single-key',
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
