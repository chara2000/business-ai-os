import webpush from 'web-push';

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function ensureVapidConfigured() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys no configuradas');
  }
  webpush.setVapidDetails(
    `mailto:admin@${process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') ?? 'business-ai-os.vercel.app'}`,
    publicKey,
    privateKey,
  );
}

export async function sendWebPush(
  subscription: PushSubscriptionRow,
  payload: PushPayload,
): Promise<void> {
  ensureVapidConfigured();
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? '/dashboard',
    }),
  );
}
