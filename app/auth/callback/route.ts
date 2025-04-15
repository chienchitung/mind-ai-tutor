import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');

    if (code) {
      const cookieStore = cookies();
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
      
      // Exchange the code for a session
      await supabase.auth.exchangeCodeForSession(code);
      
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Check if user has subscription_plan metadata
        if (!user.user_metadata?.subscription_plan) {
          // Update the user metadata with subscription plan for Google logins
          await supabase.auth.updateUser({
            data: {
              subscription_plan: 'Free plan'
            }
          });
        }
        
        // If user doesn't have a full name but has Google profile info, set it
        if (!user.user_metadata?.full_name && user.user_metadata?.name) {
          const nameParts = user.user_metadata.name.split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          await supabase.auth.updateUser({
            data: {
              first_name: firstName,
              last_name: lastName,
              full_name: user.user_metadata.name,
            }
          });
        }
      }
    }

    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=callback_error', request.url));
  }
} 