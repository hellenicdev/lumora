const ROLE_HIERARCHY = {
  guest: 0,
  user: 1,
  pro: 2,
  team_admin: 3,
  system_admin: 4,
};

export function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] ?? -1;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    next();
  };
}
