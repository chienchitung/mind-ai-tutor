import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Use environment variables instead of hardcoded values
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Add validation in case environment variables are not set
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables. Please check your .env.local file.');
}

export async function middleware(request: NextRequest) {
  try {
    // Initialize Supabase
    const supabase = createClient<Database>(
      SUPABASE_URL || '',
      SUPABASE_ANON_KEY || '', 
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        },
      }
    );

    // Get the pathname from the URL
    const pathname = request.nextUrl.pathname;
    
    // Redirect /courses to /digital-games
    if (pathname === '/courses' || pathname.startsWith('/courses/')) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.replace('/courses', '/digital-games');
      return NextResponse.redirect(url);
    }
    
    // Skip auth check for public routes
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon.ico') ||
      pathname.startsWith('/public') ||
      pathname === '/login' ||
      pathname === '/signup' ||
      pathname === '/' ||
      pathname === '/auth/callback' ||
      pathname === '/forgot-password' ||
      pathname === '/reset-password'
    ) {
      return NextResponse.next();
    }
    
    // Get all auth cookies instead of looking for a specific one
    const authCookies = request.cookies.getAll().filter(cookie => 
      cookie.name.includes('-auth-token')
    );
    
    // If there are no auth cookies and the route requires auth, redirect to login
    if (authCookies.length === 0 && (pathname.startsWith('/api') || pathname.startsWith('/students') || pathname.startsWith('/dashboard'))) {
      const url = new URL('/login', request.url);
      return NextResponse.redirect(url);
    }
    
    if (authCookies.length > 0 && pathname === '/login') {
      // Redirect to dashboard if auth cookies exist and route is login
      const url = new URL('/dashboard', request.url);
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Middleware error: ', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};