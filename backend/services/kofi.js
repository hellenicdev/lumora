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
        'Priority support',
        'Advanced security scans',
      ],
    },
  ];
}

export function verifyWebhook(body) {
  if (!config.kofi.webhookToken) return true;
  const token = body.data?.verification_token || body.verification_token;
  return token === config.kofi.webhookToken;
}
