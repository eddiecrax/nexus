const jwt = require("jsonwebtoken");

// Fail fast on startup if JWT_SECRET is missing — never hardcode a fallback secret.
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const COOKIE_NAME = "nexus_token";

/**
 * Signs a short-lived JWT containing the user's identity & role, and stores it
 * in an HttpOnly cookie.
 *
 * Concept: HttpOnly cookies cannot be read by browser JavaScript (document.cookie),
 * which protects the session token from XSS attacks while still being sent
 * automatically by the browser on every API request.
 */
function setAuthCookie(res, user) {
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Authentication middleware: verifies the JWT from the HttpOnly cookie and
 * attaches `req.user` (`{ id, username, role }`). Rejects with 401 if missing/invalid.
 */
function requireAuth(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    const err = new Error("Authentication required");
    err.status = 401;
    err.code = "UNAUTHORIZED";
    return next(err);
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, username: payload.username, role: payload.role };
    next();
  } catch {
    const err = new Error("Invalid or expired session");
    err.status = 401;
    err.code = "UNAUTHORIZED";
    next(err);
  }
}

/**
 * Role-Based Access Control (RBAC) middleware: ensures the authenticated user
 * has one of the allowed roles (e.g., 'librarian' or 'admin').
 * Rejects unauthorized roles with 403 Forbidden.
 */
function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      const err = new Error("You do not have permission to perform this action");
      err.status = 403;
      err.code = "FORBIDDEN";
      return next(err);
    }
    next();
  };
}

module.exports = {
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  requireRole,
};

