/**
 * Role-Based Authorization Middleware
 * 
 * Enforces strict role access controls.
 * Usage:
 *   router.get('/customer-only', authenticate, authorizeRole('customer'), handler);
 *   router.get('/admin-only', authenticate, authorizeRole('admin'), handler);
 *   router.get('/management', authenticate, authorizeRole('admin', 'provider'), handler);
 * 
 * Verifies that the authenticated `req.user.role` matches one of the allowed roles.
 */
export const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication is required before checking authorization.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Resource requires role [${allowedRoles.join(' or ')}], but your current role is [${req.user.role}].`
      });
    }

    next();
  };
};

export default authorizeRole;
