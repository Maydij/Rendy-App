import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  TrackingPlanSchemas,
  type TrackingEventName,
} from '@/lib/analytics/tracking-plan';

const TelemetryEnvelopeSchema = z
  .object({
    event: z.string().min(1).max(64),
    properties: z.record(z.string(), z.unknown()),
    timestamp: z.string().datetime().optional(),
  })
  .strict();

/**
 * @name POST /api/t
 * @description [Business Logic]: First-party Zero-PII telemetry ingestion proxy for
 * RudderStack and PostHog. Validates incoming product analytics events against the
 * canonical Zod Tracking Plan and forwards sanitized payloads asynchronously.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const rawBody: unknown = await request.json();
    const envelope = TelemetryEnvelopeSchema.safeParse(rawBody);

    if (!envelope.success) {
      return NextResponse.json({ accepted: false }, { status: 400 });
    }

    const eventName = envelope.data.event as TrackingEventName;
    const eventSchema = TrackingPlanSchemas[eventName];

    if (!eventSchema) {
      return NextResponse.json({ accepted: false }, { status: 400 });
    }

    const validatedProps = eventSchema.safeParse(envelope.data.properties);
    if (!validatedProps.success) {
      return NextResponse.json({ accepted: false }, { status: 400 });
    }

    // Forward to RudderStack HTTP Source when configured
    const rudderDataPlaneUrl = process.env.RUDDERSTACK_DATA_PLANE_URL;
    const rudderWriteKey = process.env.RUDDERSTACK_WRITE_KEY;

    if (rudderDataPlaneUrl && rudderWriteKey) {
      const authHeader = Buffer.from(`${rudderWriteKey}:`).toString('base64');
      void fetch(`${rudderDataPlaneUrl.replace(/\/$/, '')}/v1/track`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          anonymousId: 'zero-pii-session',
          event: eventName,
          properties: validatedProps.data,
          timestamp: envelope.data.timestamp ?? new Date().toISOString(),
        }),
      });
    }

    return NextResponse.json({ accepted: true }, { status: 200 });
  } catch {
    return NextResponse.json({ accepted: false }, { status: 400 });
  }
}