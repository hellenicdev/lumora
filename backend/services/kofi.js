import { timingSafeEqual } from 'crypto';
import config from '../config/index.js';

export function getPlans() {
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
      price: 2,
      currency: 'USD',
      interval: 'month',
      kofiUrl: 'https://ko-fi.com/summary/5aedaf60-a4fe-4d85-acfa-e7f79768a5ab',
      features: [
        'Unlimited repositories',
        '10,000 AI questions/month',
        '100 doc generations/month',
        '30 security scans/month',
        'API access via API keys',
        'Priority support',
      ],
      popular: true,
    },
    {
      id: 'team',
      name: 'Team',
      price: 6,
      currency: 'USD',
      interval: 'month',
      kofiUrl: 'https://ko-fi.com/summary/08184d07-a235-497a-95b6-9c1d734f2a5f',
      features: [
        'Unlimited everything',
        'Up to 10 team members',
        'API access via API keys',
        'Priority support',
        'Advanced security scans',
      ],
    },
  ];
}

export function normalizeWebhookBody(body) {
  const source = body && typeof body === 'object' ? body : {};
  let data = source.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      data = {};
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  return {
    ...source,
    data,
    type: source.type || source.event || data.type || '',
    verification_token: data.verification_token || source.verification_token || '',
  };
}

export function verifyWebhook(body) {
  const expected = config.kofi.webhookToken;
  if (!expected) return false;

  const normalized = normalizeWebhookBody(body);
  const provided = String(normalized.verification_token || '');

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return timingSafeEqual(expectedBuf, providedBuf);
}
