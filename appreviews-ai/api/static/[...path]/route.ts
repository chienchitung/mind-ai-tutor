import { NextResponse } from 'next/server';
import { existsSync, createReadStream } from 'fs';
import { join } from 'path';
import { stat } from 'fs/promises';

export async function GET(request: Request) {
  try {
    // Extract path from URL
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    // Remove 'api' and 'static' from the path
    const filePath = join(process.cwd(), 'temp', ...pathSegments.slice(2));
    
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stats = await stat(filePath);
    const stream = createReadStream(filePath);

    return new NextResponse(stream as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `attachment; filename="${pathSegments[pathSegments.length - 1]}"`,
      },
    });
  } catch (error) {
    console.error('Error serving static file:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 