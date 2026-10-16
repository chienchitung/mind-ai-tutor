import { redirect } from 'next/navigation';

// /register used to be a second, slightly diverged copy of the sign-up form.
// Keep the URL working for old links and bookmarks, but send everyone to the
// one maintained page.
export default function RegisterPage() {
  redirect('/signup');
}
