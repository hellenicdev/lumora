import config from '../config/index.js';

const LS_API = 'https://api.lemonsqueezy.com/v1';

function headers() {
  return {
    'Accept': 'application/json',
    'Authorization': `Bearer ${config.lemonsqueezy.apiKey}`,
    'Content-Type': 'application/json',
  };
}

export async function createCheckout({ variantId, userId, userEmail, userName }) {
  const body = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          custom: { user_id: userId },
          email: userEmail,
          name: userName || userEmail,
        },
        product_options: {
          redirect_url: config.lemonsqueezy.successUrl,
        },
      },
      relationships: {
        variant: { data: { type: 'variants', id: variantId } },
      },
    },
  };

  const res = await fetch(`${LS_API}/checkouts`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Lemon Squeezy API error: ${res.status} ${err}`);
  }

  const json = await res.json();
  const url = json.data?.attributes?.url;
  if (!url) throw new Error('No checkout URL returned from Lemon Squeezy');

  return { url, id: json.data.id };
}

export async function getSubscriptionStatus(subscriptionId) {
  if (!subscriptionId) return null;

  try {
    const res = await fetch(`${LS_API}/subscriptions/${subscriptionId}`, { headers: headers() });
    if (!res.ok) return null;
    const json = await res.json();
    const attrs = json.data?.attributes || {};
    return {
      id: json.data.id,
      status: attrs.status,
      renewsAt: attrs.renews_at,
      endsAt: attrs.ends_at,
      cancelled: attrs.cancelled,
      cardBrand: attrs.card_brand,
      cardLastFour: attrs.card_last_four,
    };
  } catch {
    return null;
  }
}

export async function verifyWebhookSignature(rawBody, signature) {
  if (!config.lemonsqueezy.webhookSecret) return true;
  const { createHmac } = await import('crypto');
  const expected = createHmac('sha256', config.lemonsqueezy.webhookSecret)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
}

export async function getPlans() {
  return [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      features: [
        '1 repository',
        '100 AI questions/month',
        '5 doc generations/month',
        '4 security scans/month',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 4,
      currency: 'usd',
      interval: 'month',
      variantId: config.lemonsqueezy.variantPro,
      features: [
        'Unlimited repositories',
        '10,000 AI questions/month',
        '100 doc generations/month',
        '30 security scans/month',
        'Priority support',
      ],
      popular: true,
    },
    {
      id: 'team',
      name: 'Team',
      price: 9,
      currency: 'usd',
      interval: 'month',
      variantId: config.lemonsqueezy.variantTeam,
      features: [
        'Unlimited everything',
        'Up to 10 team members',
        'Priority support',
        'Advanced security scans',
      ],
    },
  ];
}
