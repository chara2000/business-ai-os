'use client';

import { useEffect, useRef } from 'react';
import type { WompiCheckoutParams } from '@/lib/billing/wompi';

type WidgetCheckoutInstance = {
  open: (cb: (result: { transaction: { id: string; status: string } }) => void) => void;
};

declare global {
  interface Window {
    WidgetCheckout?: new (config: Record<string, unknown>) => WidgetCheckoutInstance;
  }
}

type Props = {
  checkout: WompiCheckoutParams;
  onComplete?: (transactionId: string, status: string) => void;
  onClose?: () => void;
};

export function WompiCheckout({ checkout, onComplete, onClose }: Props) {
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;

    const scriptId = 'wompi-widget-script';
    const loadWidget = () => {
      if (!window.WidgetCheckout) return;
      const instance = new window.WidgetCheckout({
        currency: checkout.currency,
        amountInCents: checkout.amountInCents,
        reference: checkout.reference,
        publicKey: checkout.publicKey,
        redirectUrl: checkout.redirectUrl,
        signature: { integrity: checkout.signatureIntegrity },
        customerData: {
          email: checkout.customerEmail,
          fullName: checkout.customerFullName,
        },
      });
      instance.open((result) => {
        onComplete?.(result.transaction.id, result.transaction.status);
        onClose?.();
      });
    };

    if (window.WidgetCheckout) {
      loadWidget();
      return;
    }

    const existing = document.getElementById(scriptId);
    if (existing) {
      existing.addEventListener('load', loadWidget);
      return () => existing.removeEventListener('load', loadWidget);
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://checkout.wompi.co/widget.js';
    script.async = true;
    script.onload = loadWidget;
    document.body.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [checkout, onComplete, onClose]);

  return null;
}
