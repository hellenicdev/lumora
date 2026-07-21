export function success(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

export function error(res, message = 'Server error', statusCode = 500) {
  return res.status(statusCode).json({ success: false, error: message });
}
