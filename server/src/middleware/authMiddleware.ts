import { Request, Response, NextFunction } from 'express';
import { supabase, useSupabase } from '../config/serverConfig';

import { getDeterministicUuid } from '../utils/uuid';

// Extend Express Request type to include user details
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header is missing or invalid. Format must be "Bearer <token>"' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Bearer token is missing.' });
    }

    // Fallback: If it's a mock token or Supabase is not enabled
    if (token.startsWith('mock-token-') || !useSupabase || !supabase) {
      const mockUserId = token.startsWith('mock-token-') 
        ? getDeterministicUuid(token) 
        : getDeterministicUuid('mock-sandbox-user-id');
      
      // If Supabase is enabled, ensure mock user exists in the public.users table to prevent FK violations
      if (useSupabase) {
        try {
          const { supabaseAdmin } = require('../config/supabase');
          if (supabaseAdmin) {
            const emailValue = token.startsWith('mock-token-') 
              ? `${token.replace('mock-token-', '')}@domain.in` 
              : 'mock.user@domain.in';
            await supabaseAdmin.from('users').upsert({
              id: mockUserId,
              email: emailValue,
              full_name: 'QA Engineer',
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
          }
        } catch (dbErr: any) {
          console.error('⚠️ Failed to upsert mock user profile into public.users:', dbErr.message);
        }
      }

      req.user = {
        id: mockUserId,
        email: 'mock.user@domain.in'
      };
      return next();
    }

    // Verify token with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: error?.message || 'Invalid or expired authentication session.' });
    }

    req.user = {
      id: user.id,
      email: user.email
    };
    return next();
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal authentication middleware error.' });
  }
}
