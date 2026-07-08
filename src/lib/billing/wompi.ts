import { createHash } from 'crypto';
import type { SubscriptionPlan } from '@/types';

export type WompiCheckoutParams = {
  publicKey: string;
  currency: 'COP';
  amountInCents: number;
  reference: string;
  signatureIntegrity: string;
  redirectUrl: string;
  customerEmail?: string;
  customerFullName?: string;
};

export type WompiTransaction = {
  id: string;
  status: string;
  amount_in_cents: number;
  reference: string;
  customer_email?: string;
  currency: string;
};

export type WompiEvent = {
  event: string;
  data: {
    transaction?: WompiTransaction;
  };
  sent_at: string;
  timestamp?: number;
  signature?: {
    properties: string[];
    checksum: string;
  };
};

function wompiEnv() {
  return (process.env.WOMPI_ENV ?? 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox';
}

export function getWompiApiBase(): string {
  return wompiEnv() === 'production'
    ? 'https://production.wompi.co/v1'
    : 'https://sandbox.wompi.co/v1';
}

export function getWompiCheckoutBase(): string {
  return 'https://checkout.wompi.co';
}

export function isWompiConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY
    && process.env.WOMPI_INTEGRITY_SECRET
    && process.env.WOMPI_EVENTS_SECRET
  );
}

export function getWompiPublicKey(): string {
  const key = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_WOMPI_PUBLIC_KEY no configurada');
  return key;
}

export function generatePaymentReference(empresaId: string, plan: SubscriptionPlan): string {
  const slug = empresaId.replace(/-/g, '').slice(0, 8);
  return `BAIOS-${slug}-${plan}-${Date.now()}`;
}

export function generateIntegritySignature(params: {
  reference: string;
  amountInCents: number;
  currency?: string;
  expirationTime?: string;
}): string {
  const secret = process.env.WOMPI_INTEGRITY_SECRET;
  if (!secret) throw new Error('WOMPI_INTEGRITY_SECRET no configurada');

  const currency = params.currency ?? 'COP';
  let payload = `${params.reference}${params.amountInCents}${currency}`;
  if (params.expirationTime) payload += params.expirationTime;
  payload += secret;

  return createHash('sha256').update(payload).digest('hex');
}

export function buildCheckoutParams(params: {
  reference: string;
  amountInCents: number;
  redirectUrl: string;
  customerEmail?: string;
  customerFullName?: string;
}): WompiCheckoutParams {
  return {
    publicKey: getWompiPublicKey(),
    currency: 'COP',
    amountInCents: params.amountInCents,
    reference: params.reference,
    signatureIntegrity: generateIntegritySignature({
      reference: params.reference,
      amountInCents: params.amountInCents,
    }),
    redirectUrl: params.redirectUrl,
    customerEmail: params.customerEmail,
    customerFullName: params.customerFullName,
  };
}

export function verifyWompiEventChecksum(event: WompiEvent): boolean {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret) return false;
  if (process.env.WOMPI_SKIP_CHECKSUM === 'true') return true;

  const tx = event.data.transaction;
  if (!tx || !event.signature?.properties?.length) return false;

  let concatenated = '';
  for (const prop of event.signature.properties) {
    let current: unknown = event.data;
    for (const key of prop.split('.')) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[key];
      } else {
        current = undefined;
        break;
      }
    }
    concatenated += String(current ?? '');
  }

  const timestamp = event.timestamp ?? Math.floor(new Date(event.sent_at).getTime() / 1000);
  concatenated += String(timestamp);
  concatenated += secret;

  const calculated = createHash('sha256').update(concatenated).digest('hex').toUpperCase();
  return calculated === (event.signature.checksum ?? '').toUpperCase();
}

export async function fetchWompiTransaction(transactionId: string): Promise<WompiTransaction | null> {
  const privateKey = process.env.WOMPI_PRIVATE_KEY;
  if (!privateKey) return null;

  const res = await fetch(`${getWompiApiBase()}/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${privateKey}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? null;
}

export function copToCents(amountCOP: number): number {
  return Math.round(amountCOP * 100);
}

export function planExpiresIn30Days(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}
