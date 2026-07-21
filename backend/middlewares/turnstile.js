import config from '../config/index.js';

export async function verifyTurnstile(req, res, next) {
  if (config.nodeEnv === 'development') {
    return next();
  }

  const token = req.body.turnstileToken;

  if (!token) {
    return res.status(400).json({ success: false, error: 'Turnstile token required' });
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', config.turnstile.secret);
    formData.append('response', token);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!data.success) {
      return res.status(400).json({ success: false, error: 'Turnstile verification failed' });
    }

    next();
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Turnstile verification error' });
  }
}
