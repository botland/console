import { NextResponse } from 'next/server';

import { getTicket, SupportServiceError } from '@/lib/support/client';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ticket = await getTicket(id);
    return NextResponse.json(ticket);
  } catch (error) {
    if (error instanceof SupportServiceError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to load support ticket';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}