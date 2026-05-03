import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { authService } from '../services/auth.service.js';
import type { User, Session } from '@shared/types';

// Types

// Extend Hono context with user and session
declare module 'hono' {
  interface ContextVariableMap {
    user: User;
    session: Session;
  }
}

// Middleware

/**
 * Authentication middleware
 * Validates session cookie and sets user in context
 */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const sessionId = getCookie(c, 'session');

  if (!sessionId) {
    return c.json(
      { success: false, error: 'UNAUTHORIZED', message: 'Authentication required' },
      401
    );
  }

  const result = await authService.validateSession(sessionId);

  if (!result.success) {
    return c.json(
      { success: false, error: result.code ?? 'UNAUTHORIZED', message: result.error },
      401
    );
  }

  // Set user and session in context
  c.set('user', result.value.user);
  c.set('session', result.value.session);

  return next();
};

/**
 * Role-based authorization middleware
 * Requires authMiddleware to be applied first
 *
 * @param allowedRoles - Array of roles that are allowed to access the route
 */
export function authorize(allowedRoles: Array<'admin' | 'editor' | 'viewer'>): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');

    if (!user) {
      return c.json(
        { success: false, error: 'UNAUTHORIZED', message: 'Authentication required' },
        401
      );
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json(
        { success: false, error: 'FORBIDDEN', message: 'Insufficient permissions' },
        403
      );
    }

    return next();
  };
}

/**
 * Optional authentication middleware
 * Sets user in context if session exists, but doesn't require authentication
 */
export const optionalAuth: MiddlewareHandler = async (c, next) => {
  const sessionId = getCookie(c, 'session');

  if (sessionId) {
    const result = await authService.validateSession(sessionId);

    if (result.success) {
      c.set('user', result.value.user);
      c.set('session', result.value.session);
    }
  }

  return next();
};

/**
 * Admin-only shortcut middleware
 * Combines authMiddleware + authorize(['admin'])
 */
export const adminOnly: MiddlewareHandler = async (c, next) => {
  const sessionId = getCookie(c, 'session');

  if (!sessionId) {
    return c.json(
      { success: false, error: 'UNAUTHORIZED', message: 'Authentication required' },
      401
    );
  }

  const result = await authService.validateSession(sessionId);

  if (!result.success) {
    return c.json(
      { success: false, error: result.code ?? 'UNAUTHORIZED', message: result.error },
      401
    );
  }

  if (result.value.user.role !== 'admin') {
    return c.json({ success: false, error: 'FORBIDDEN', message: 'Admin access required' }, 403);
  }

  c.set('user', result.value.user);
  c.set('session', result.value.session);

  return next();
};
