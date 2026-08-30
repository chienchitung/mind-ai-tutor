import { expect, it } from 'vitest';
import { validatePasswordChange } from './password-validation';

it('validates password bounds and matching confirmation without trimming secrets', () => {
  expect(validatePasswordChange('short', 'short')).toBe('too_short');
  expect(validatePasswordChange('a'.repeat(73), 'a'.repeat(73))).toBe('too_long');
  expect(validatePasswordChange('password 123', 'password123')).toBe('mismatch');
  expect(validatePasswordChange('long password', 'long password')).toBeNull();
});
