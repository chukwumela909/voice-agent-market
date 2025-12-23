import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Verify user authentication from request headers
 * Returns user ID if authenticated, null otherwise
 */
export async function verifyAuth(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }
  
  return user.id;
}

/**
 * Require authentication middleware
 * Returns unauthorized response if not authenticated
 */
export async function requireAuth(request: Request): Promise<{ userId: string } | NextResponse> {
  const userId = await verifyAuth(request);
  
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Valid authentication token required' },
      { status: 401 }
    );
  }
  
  return { userId };
}

/**
 * Optional authentication - returns userId or null
 */
export async function optionalAuth(request: Request): Promise<string | null> {
  return verifyAuth(request);
}
