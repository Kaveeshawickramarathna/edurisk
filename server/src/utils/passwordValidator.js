/**
 * Validates that a password meets strong security requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 digit (0-9)
 * - At least 1 special character (!@#$%^&*...)
 */
function validateStrongPassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  const missing = [];
  if (password.length < 8) missing.push('at least 8 characters');
  if (!/[A-Z]/.test(password)) missing.push('an uppercase letter (A-Z)');
  if (!/[a-z]/.test(password)) missing.push('a lowercase letter (a-z)');
  if (!/[0-9]/.test(password)) missing.push('a number (0-9)');
  if (!/[^A-Za-z0-9]/.test(password)) missing.push('a special character (e.g. @, #, !, $)');

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Password is too weak. Must include ${missing.join(', ')}.`,
    };
  }

  return { valid: true };
}

module.exports = { validateStrongPassword };
