/**
 * Unit tests for src/utils/validation.ts
 */

import {
  isValidEmail,
  isValidPhone,
  isValidPassword,
  getPasswordErrors,
  isNotEmpty,
  isValidName,
} from '../../src/utils/validation';

// ---------------------------------------------------------------------------
// isValidEmail
// ---------------------------------------------------------------------------

describe('isValidEmail', () => {
  it('accepts standard email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('name.last@domain.co')).toBe(true);
    expect(isValidEmail('test+tag@mail.org')).toBe(true);
  });

  it('rejects addresses without @ symbol', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('rejects addresses without domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('rejects addresses without local part', () => {
    expect(isValidEmail('@example.com')).toBe(false);
  });

  it('rejects addresses with spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
    expect(isValidEmail('user@ example.com')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('trims whitespace before validating', () => {
    expect(isValidEmail('  user@example.com  ')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isValidPhone
// ---------------------------------------------------------------------------

describe('isValidPhone', () => {
  it('accepts standard phone numbers', () => {
    expect(isValidPhone('+1234567890')).toBe(true);
    expect(isValidPhone('123-456-7890')).toBe(true);
    expect(isValidPhone('+1 (234) 567-8900')).toBe(true);
    expect(isValidPhone('0412345678')).toBe(true);
  });

  it('rejects too-short numbers', () => {
    expect(isValidPhone('123')).toBe(false);
    expect(isValidPhone('+1234')).toBe(false);
  });

  it('rejects strings with letters', () => {
    expect(isValidPhone('123-ABC-7890')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidPhone('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidPassword
// ---------------------------------------------------------------------------

describe('isValidPassword', () => {
  it('accepts a strong password', () => {
    expect(isValidPassword('Passw0rd')).toBe(true);
    expect(isValidPassword('Str0ngP@ss!')).toBe(true);
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(isValidPassword('Ab1')).toBe(false);
    expect(isValidPassword('Ab1defg')).toBe(false);
  });

  it('rejects passwords without uppercase letter', () => {
    expect(isValidPassword('password1')).toBe(false);
  });

  it('rejects passwords without lowercase letter', () => {
    expect(isValidPassword('PASSWORD1')).toBe(false);
  });

  it('rejects passwords without digit', () => {
    expect(isValidPassword('Password')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getPasswordErrors
// ---------------------------------------------------------------------------

describe('getPasswordErrors', () => {
  it('returns empty array for a valid password', () => {
    expect(getPasswordErrors('Passw0rd')).toEqual([]);
  });

  it('returns all relevant errors for empty string', () => {
    const errors = getPasswordErrors('');
    expect(errors.length).toBe(4);
    expect(errors).toContain('Password must be at least 8 characters');
    expect(errors).toContain('Password must contain at least one uppercase letter');
    expect(errors).toContain('Password must contain at least one lowercase letter');
    expect(errors).toContain('Password must contain at least one number');
  });

  it('returns specific missing-uppercase error', () => {
    const errors = getPasswordErrors('password1');
    expect(errors).toContain('Password must contain at least one uppercase letter');
    expect(errors).not.toContain('Password must contain at least one lowercase letter');
  });
});

// ---------------------------------------------------------------------------
// isNotEmpty
// ---------------------------------------------------------------------------

describe('isNotEmpty', () => {
  it('returns true for non-empty strings', () => {
    expect(isNotEmpty('hello')).toBe(true);
    expect(isNotEmpty(' a ')).toBe(true);
  });

  it('returns false for empty or whitespace-only strings', () => {
    expect(isNotEmpty('')).toBe(false);
    expect(isNotEmpty('   ')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidName
// ---------------------------------------------------------------------------

describe('isValidName', () => {
  it('accepts valid names', () => {
    expect(isValidName('John')).toBe(true);
    expect(isValidName('Mary Jane')).toBe(true);
    expect(isValidName("O'Brien")).toBe(true);
    expect(isValidName('Anne-Marie')).toBe(true);
  });

  it('rejects names shorter than 2 characters', () => {
    expect(isValidName('J')).toBe(false);
    expect(isValidName('')).toBe(false);
  });

  it('rejects names with numbers', () => {
    expect(isValidName('John3')).toBe(false);
  });

  it('rejects names with special characters', () => {
    expect(isValidName('John@Doe')).toBe(false);
  });

  it('trims whitespace before validating', () => {
    expect(isValidName('  Jo  ')).toBe(true);
  });
});
