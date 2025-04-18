'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      
      type SupabaseClientWithAuth = {
        auth: {
          getUser: () => Promise<{data: {user: any}}>;
          updateUser: (options: {password: string}) => Promise<{error: any}>;
        }
      };
      
      const supabaseWithTypes = supabaseClient as unknown as SupabaseClientWithAuth;
      
      const { data: { user } } = await supabaseWithTypes.auth.getUser();
      if (!user) {
        toast({
          title: 'Invalid Reset Link',
          description: 'Please request a new password reset.',
          variant: 'destructive',
        });
        router.push('/forgot-password');
      }
    };
    
    checkUser();
  }, [router, toast]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all fields.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords Do Not Match',
        description: 'Please ensure both passwords are the same.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      
      type SupabaseClientWithAuth = {
        auth: {
          getUser: () => Promise<{data: {user: any}}>;
          updateUser: (options: {password: string}) => Promise<{error: any}>;
        }
      };
      
      const supabaseWithTypes = supabaseClient as unknown as SupabaseClientWithAuth;
      
      const { error } = await supabaseWithTypes.auth.updateUser({
        password: password
      });
      
      if (error) {
        throw error;
      }
      
      toast({
        title: 'Password Updated',
        description: 'You can now login with your new password.',
      });
      
      router.push('/login');
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message || 'Unable to update password. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30">
      <div className="text-center mb-8">
        <div className="inline-block text-4xl font-bold text-primary relative">
          <div className="flex items-center justify-center relative">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 559" className="absolute left-0 md:left-0 h-12 md:h-16 w-auto" style={{ fill: "currentColor" }}>
              <g transform="translate(0.000000,559.000000) scale(0.100000,-0.100000)" fill="#0F172A" stroke="none">
                <path d="M2615 4828 c-2 -7 -11 -51 -20 -98 -49 -255 -124 -380 -273 -458 -62 -33 -269 -92 -321 -92 -36 0 -70 -25 -55 -40 6 -5 49 -17 97 -26 110 -19 206 -48 279 -85 151 -76 222 -194 273 -453 16 -85 25 -112 38 -114 20 -4 20 -4 42 118 63 341 187 466 526 530 63 12 119 26 124 32 16 15 -20 35 -78 42 -147 20 -306 78 -385 143 -90 74 -153 207 -188 398 -21 115 -21 115 -39 115 -9 0 -17 -6 -20 -12z"/>
                <path d="M5036 4818 c-37 -182 -60 -267 -89 -331 -77 -166 -203 -247 -464 -297 -57 -11 -106 -20 -109 -20 -2 0 -4 -9 -4 -19 0 -16 12 -21 68 -31 379 -65 513 -188 576 -525 26 -137 25 -135 45 -135 15 0 20 13 31 78 7 42 23 114 36 160 76 263 207 364 547 423 41 7 71 17 74 26 3 7 4 16 1 18 -2 2 -51 13 -108 25 -362 70 -470 177 -544 538 -16 82 -25 108 -38 110 -11 2 -19 -5 -22 -20z"/>
                <path d="M3905 3448 c-35 -9 -191 -161 -1337 -1307 -1398 -1398 -1331 -1325 -1314 -1413 24 -128 256 -360 384 -384 88 -17 17 -83 1400 1299 796 795 1291 1297 1304 1322 28 54 26 100 -7 165 -59 118 -176 235 -290 292 -65 33 -92 38 -140 26z m61 -392 c41 -40 74 -78 74 -82 0 -5 -105 -115 -234 -243 l-235 -235 -45 38 c-25 20 -62 57 -82 82 l-38 45 235 235 c128 129 238 234 243 234 4 0 42 -33 82 -74z"/>
                <path d="M5045 2578 c-2 -7 -13 -53 -24 -103 -50 -236 -143 -324 -390 -371 -58 -12 -91 -22 -91 -31 0 -7 10 -15 23 -17 142 -30 187 -41 226 -58 139 -58 204 -158 241 -366 12 -67 24 -92 36 -79 3 3 14 49 25 103 50 247 136 333 383 385 89 18 123 34 95 43 -8 3 -56 14 -107 25 -132 29 -203 63 -262 128 -55 60 -83 125 -111 258 -10 50 -19 91 -19 93 0 8 -21 0 -25 -10z"/>
              </g>
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3487 1086" className="h-20 md:h-28 w-auto">
              <g transform="translate(0.000000,1086.000000) scale(0.100000,-0.100000)" fill="currentColor" stroke="none">
                <path d="M17743 7039 c-10 -10 -13 -131 -13 -537 0 -495 -1 -524 -17 -519 -10 3 -54 19 -98 35 -317 117 -655 31 -874 -222 -127 -146 -215 -345 -257 -581 -21 -118 -24 -429 -5 -565 42 -301 150 -547 299 -680 255 -229 705 -203 990 56 l63 57 32 -39 c87 -108 187 -165 336 -190 l93 -15 30 28 c59 55 131 174 162 266 l16 49 -37 42 c-21 24 -47 65 -58 92 -19 48 -20 79 -25 1264 -6 1267 -5 1241 -47 1325 -26 51 -75 94 -132 116 -48 19 -83 22 -251 26 -152 4 -198 2 -207 -8z m-223 -1480 c25 -5 82 -28 128 -50 l82 -40 0 -473 0 -474 -59 -55 c-69 -63 -125 -93 -205 -108 -149 -27 -247 63 -291 271 -23 105 -30 340 -16 487 34 349 149 490 361 442z"/>
                <path d="M13120 6949 c-85 -16 -157 -49 -169 -76 -23 -51 -41 -149 -41 -229 0 -94 32 -233 57 -252 27 -20 108 -41 205 -53 108 -14 268 1 361 34 61 22 62 23 80 76 39 119 40 261 2 388 -13 45 -22 56 -56 74 -23 11 -71 27 -108 35 -72 15 -260 17 -331 3z"/>
                <path d="M21870 6954 c-114 -21 -183 -52 -199 -91 -18 -44 -41 -164 -41 -216 0 -58 26 -191 46 -228 31 -61 237 -101 415 -80 54 6 128 21 164 32 l65 22 23 71 c32 102 31 273 -1 368 l-23 66 -72 27 c-63 24 -89 28 -212 30 -77 2 -151 2 -165 -1z"/>
                <path d="M9775 6845 c-11 -2 -66 -9 -122 -15 -57 -7 -103 -15 -103 -19 0 -3 -52 -661 -114 -1461 -63 -800 -111 -1458 -108 -1462 13 -13 137 -28 272 -34 117 -5 354 7 366 18 7 8 84 1481 96 1841 10 304 14 357 26 355 11 -2 72 -240 226 -880 l211 -877 55 -8 c72 -10 529 -10 600 0 l55 8 134 552 c273 1130 293 1207 306 1207 9 0 14 -47 19 -192 18 -523 29 -753 62 -1353 20 -357 38 -651 39 -653 8 -11 255 -23 365 -18 118 5 268 22 278 31 4 4 -217 2879 -223 2911 -4 19 -16 23 -102 35 -191 27 -763 13 -795 -19 -24 -25 -418 -1736 -418 -1817 0 -8 -8 -15 -19 -15 -14 0 -20 10 -25 38 -35 198 -172 819 -277 1256 -71 297 -130 541 -132 542 -21 18 -593 43 -672 29z"/>
                <path d="M19838 6838 c-86 -4 -167 -12 -180 -17 -20 -8 -75 -167 -496 -1450 -358 -1094 -470 -1446 -463 -1460 12 -21 58 -36 161 -52 92 -14 426 -8 456 8 16 9 35 63 89 245 37 128 79 267 91 308 l23 75 479 0 478 0 53 -180 c99 -341 158 -424 327 -460 79 -17 248 -19 314 -5 74 17 190 61 190 74 0 16 -920 2879 -928 2888 -22 23 -368 38 -594 26z m241 -896 c35 -136 103 -391 152 -567 49 -176 89 -324 89 -330 0 -6 -113 -10 -320 -10 -176 0 -320 2 -320 3 0 2 20 70 44 150 57 188 184 667 228 856 24 108 37 146 48 146 11 0 31 -63 79 -248z"/>
                <path d="M22726 6803 c-19 -48 -29 -276 -18 -396 7 -68 15 -132 18 -141 5 -14 44 -16 365 -16 l359 0 2 -1187 3 -1187 40 -10 c51 -12 535 -12 595 0 l45 10 0 1186 0 1187 265 3 c230 3 272 7 320 23 76 27 142 94 159 160 16 61 15 239 -2 320 l-12 60 -1066 3 c-987 2 -1067 1 -1073 -15z"/>
                <path d="M27482 6669 c-58 -10 -124 -40 -160 -73 -67 -60 -92 -170 -92 -402 l0 -171 -168 5 -169 5 -11 -59 c-19 -105 -24 -207 -13 -296 7 -48 14 -95 17 -103 5 -13 34 -15 175 -15 l169 0 0 -599 c0 -658 4 -715 59 -834 40 -87 83 -141 143 -182 117 -77 236 -97 510 -83 193 9 404 31 416 43 4 3 7 75 7 158 0 132 -3 162 -24 229 l-24 77 -163 3 c-177 3 -190 7 -238 72 -21 27 -21 40 -24 572 l-2 544 254 0 255 0 8 38 c10 49 10 346 0 396 l-8 39 -255 -5 -254 -5 0 312 c0 289 -1 313 -18 328 -16 15 -43 17 -178 16 -87 -1 -183 -5 -212 -10z"/>
                <path d="M29415 6079 c-178 -25 -364 -112 -489 -229 -277 -257 -392 -770 -285 -1265 64 -299 223 -527 454 -653 157 -85 289 -115 500 -115 212 0 344 31 500 115 241 132 393 359 466 698 30 140 34 472 6 620 -102 546 -456 845 -992 839 -55 -1 -127 -5 -160 -10z m271 -504 c89 -28 142 -93 173 -217 60 -232 50 -689 -18 -869 -45 -117 -125 -171 -255 -172 -156 -1 -229 75 -273 283 -26 124 -26 602 0 705 22 88 67 182 105 218 63 60 172 81 268 52z"/>
                <path d="M15388 6059 c-164 -18 -323 -92 -480 -221 l-47 -39 -31 61 c-78 155 -179 199 -456 200 -105 0 -123 -2 -137 -18 -16 -17 -17 -104 -15 -1093 l3 -1073 45 -9 c60 -12 445 -14 543 -4 l77 9 0 723 0 724 66 47 c185 132 380 125 426 -14 8 -27 13 -204 18 -632 6 -578 6 -597 28 -661 45 -136 116 -190 277 -211 145 -20 295 15 412 94 l61 42 -29 58 c-62 124 -62 116 -69 788 -6 521 -10 628 -24 699 -77 376 -321 570 -668 530z"/>
                <path d="M24903 6046 c-62 -15 -177 -70 -221 -106 l-23 -19 26 -51 c15 -29 36 -86 48 -128 20 -73 21 -107 27 -697 8 -681 9 -690 72 -843 101 -244 278 -362 543 -362 186 0 399 95 599 266 22 19 42 34 45 34 3 0 16 -17 28 -38 80 -138 240 -235 424 -256 l56 -6 50 53 c53 56 114 157 139 231 l16 46 -32 37 c-44 50 -68 106 -80 189 -6 41 -10 385 -10 851 l0 782 -57 8 c-75 10 -481 10 -555 0 l-58 -8 0 -724 0 -723 -52 -43 c-90 -71 -149 -94 -248 -94 -146 0 -185 41 -201 213 -4 53 -9 322 -9 597 0 536 -3 566 -52 662 -27 52 -94 105 -156 123 -63 18 -250 21 -319 6z"/>
                <path d="M31006 6009 c-47 -52 -146 -237 -146 -272 0 -10 18 -39 39 -65 48 -58 73 -108 97 -192 16 -59 18 -131 23 -835 l6 -769 45 -10 c58 -12 512 -12 570 0 l45 10 3 674 2 675 44 56 c55 70 136 124 219 146 60 16 70 16 163 0 54 -10 111 -20 125 -23 23 -5 28 0 57 64 69 149 120 350 125 486 l2 70 -80 13 c-44 7 -129 14 -190 14 -122 1 -211 -20 -295 -69 -72 -43 -160 -140 -209 -231 l-44 -83 -32 61 c-57 107 -114 170 -206 231 -62 40 -185 84 -265 95 l-51 6 -47 -52z"/>
                <path d="M12858 6031 c-42 -3 -82 -11 -88 -17 -20 -20 -34 -226 -21 -335 6 -56 13 -105 16 -109 2 -4 34 -10 71 -14 100 -10 145 -40 181 -121 17 -37 18 -94 21 -802 l3 -761 77 -9 c98 -10 483 -8 542 4 l45 9 3 859 c2 591 -1 881 -8 927 -22 127 -96 247 -190 308 -94 61 -147 70 -373 68 -111 -1 -237 -4 -279 -7z"/>
                <path d="M21595 6033 c-104 -5 -102 -4 -115 -85 -12 -71 -9 -320 5 -363 5 -17 20 -23 84 -31 95 -13 135 -38 165 -103 21 -45 21 -58 26 -811 l5 -764 45 -10 c59 -12 522 -12 580 0 l45 10 0 879 c0 803 -2 885 -17 942 -48 172 -144 276 -299 324 -52 16 -89 19 -262 17 -111 -1 -229 -3 -262 -5z"/>
              </g>
            </svg>
          </div>
        </div>
        <p className="mt-2 text-muted-foreground">AI-powered student tracking and tutoring system</p>
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>Enter your new password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input 
                id="password" 
                placeholder="••••••••" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input 
                id="confirmPassword" 
                placeholder="••••••••" 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            Remember your password?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Back to Login
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}