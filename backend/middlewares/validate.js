export function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      for (const rule of rules) {
        if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
          errors.push(`${field} is required`);
          break;
        }

        if (value) {
          if (rule.minLength && value.length < rule.minLength) {
            errors.push(`${field} must be at least ${rule.minLength} characters`);
          }
          if (rule.maxLength && value.length > rule.maxLength) {
            errors.push(`${field} must be at most ${rule.maxLength} characters`);
          }
          if (rule.pattern && !rule.pattern.test(value)) {
            errors.push(rule.message || `${field} is invalid`);
          }
          if (rule.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push('Invalid email format');
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: errors[0] });
    }

    next();
  };
}
