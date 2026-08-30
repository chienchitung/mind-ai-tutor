export function validatePasswordChange(password: string, confirmation: string) {
  if (password.length < 8) return 'too_short';
  if (password.length > 72) return 'too_long';
  if (password !== confirmation) return 'mismatch';
  return null;
}
