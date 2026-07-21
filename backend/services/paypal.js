import config from '../config/index.js';

function baseUrl() {
  return config.paypal.mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken() {
  const res = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json.access_token;
}

async function api(path, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal API error ${res.status}: ${err}`);
  }

  return res.json();
}

export async function createSubscription({ planId, userId, userEmail, userName }) {
  const body = {
    plan_id: planId,
    subscriber: {
      name: { given_name: userName || 'User' },
      email_address: userEmail,
    },
    custom_id: userId,
    application_context: {
      brand_name: 'Lumora',
      locale: 'en-US',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      return_url: config.paypal.returnUrl,
      cancel_url: config.paypal.cancelUrl,
    },
  };

  const result = await api('/v1/billing/subscriptions', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const approvalUrl = (result.links || []).find(l => l.rel === 'approve')?.href;
  if (!approvalUrl) throw new Error('No approval URL returned from PayPal');

  return {
    url: approvalUrl,
    subscriptionId: result.id,
    status: result.status,
  };
}

export async function getSubscription(subscriptionId) {
  try {
    const result = await api(`/v1/billing/subscriptions/${subscriptionId}`);
    return {
      id: result.id,
      status: result.status,
      planId: result.plan_id,
      startTime: result.start_time,
      nextBillingTime: result.billing_info?.next_billing_time,
      lastPayment: result.billing_info?.last_payment?.amount?.value,
      failedPayments: result.billing_info?.failed_payments_count || 0,
    };
  } catch {
    return null;
  }
}

export async function cancelSubscription(subscriptionId) {
  await api(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Cancelled by user' }),
  });
}

export async function verifyWebhook(headers, rawBody) {
  if (!config.paypal.webhookId) return true;

  const transmissionId = headers['paypal-transmission-id'];
  const transmissionSig = headers['paypal-transmission-sig'];
  const timestamp = headers['paypal-transmission-time'];
  const certUrl = headers['paypal-cert-url'];
  const authAlgo = headers['paypal-auth-algo'];

  if (!transmissionId || !transmissionSig) return false;

  try {
    const result = await api('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_time: timestamp,
        webhook_id: config.paypal.webhookId,
        webhook_event: typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody,
      }),
    });

    return result.verification_status === 'SUCCESS';
  } catch {
    return false;
  }
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
      currency: 'USD',
      interval: 'month',
      planId: config.paypal.planPro,
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
      currency: 'USD',
      interval: 'month',
      planId: config.paypal.planTeam,
      features: [
        'Unlimited everything',
        'Up to 10 team members',
        'Priority support',
        'Advanced security scans',
      ],
    },
  ];
}
