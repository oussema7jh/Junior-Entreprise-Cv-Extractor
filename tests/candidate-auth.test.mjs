import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAuth, authErrorCode, candidateDestination } from '../lib/candidate-auth.ts';

test('signup and reset enforce minimum password and matching confirmation', () => {
  for (const action of ['signup', 'reset']) {
    assert.equal(validateAuth(action, 'candidate@example.com', 'short', 'short'), 'weakPassword');
    assert.equal(validateAuth(action, 'candidate@example.com', 'strong-secret', 'different'), 'passwordMismatch');
    assert.equal(validateAuth(action, 'candidate@example.com', 'strong-secret', 'strong-secret'), null);
  }
});
test('email validation applies to signup, login and reset requests, not password changes', () => {
  for (const action of ['signup', 'login', 'forgot']) assert.equal(validateAuth(action, 'not-email', 'strong-secret', 'strong-secret'), 'invalidEmail');
  assert.equal(validateAuth('reset', '', 'strong-secret', 'strong-secret'), null);
  assert.equal(validateAuth('login', 'candidate@example.com', '', ''), 'invalidCredentials');
  assert.equal(validateAuth('login', 'candidate@example.com', 'old', ''), null); // Existing passwords may predate the new minimum.
});
test('provider failures map to the requested distinct, translatable messages', () => {
  for (const [code, expected] of [['invalid_credentials','invalidCredentials'], ['email_not_confirmed','emailNotConfirmed'], ['user_already_exists','emailUsed'], ['email_exists','emailUsed'], ['weak_password','weakPassword'], ['otp_expired','invalidLink'], ['over_email_send_rate_limit','rateLimit'], ['internal_error','failed']]) assert.equal(authErrorCode(code),expected);
  assert.equal(authErrorCode(undefined,429),'rateLimit');
});
test('login destination follows profile presence', () => {
  assert.equal(candidateDestination(false),'/candidate/upload');
  assert.equal(candidateDestination(true),'/candidate/profile');
});
