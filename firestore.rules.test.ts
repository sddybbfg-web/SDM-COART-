/**
 * Firestore Security Rules Verification Suite — राजस्व न्यायालय केस डायरी
 * Verifies all 12 "Dirty Dozen" adversarial payloads return PERMISSION_DENIED.
 *
 * Run with Firebase Emulator Suite:
 *   firebase emulators:exec "npx tsx firestore.rules.test.ts"
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  actor: 'attacker' | 'victim' | 'admin' | 'unverifiedAdmin';
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Cross-user private case read',
    operation: 'get',
    path: '/cases/victim_case_01',
    actor: 'attacker',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Admin unauthorized access to user private case document',
    operation: 'get',
    path: '/cases/victim_case_01/documents/doc_01',
    actor: 'admin',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Self-assigned admin role during profile creation',
    operation: 'create',
    path: '/users/attacker_uid',
    actor: 'attacker',
    payload: {
      uid: 'attacker_uid',
      name: 'Attacker',
      mobileNumber: '+919999999999',
      address: 'Lucknow',
      designation: 'Advocate',
      district: 'लखनऊ',
      tehsil: 'सदर',
      role: 'admin',
      isBlocked: false,
      caseCount: 0,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'User attempting to unblock self or escalate role',
    operation: 'update',
    path: '/users/attacker_uid',
    actor: 'attacker',
    payload: {
      role: 'admin',
      isBlocked: false,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow ghost field injection on case create',
    operation: 'create',
    path: '/cases/case_shadow_01',
    actor: 'attacker',
    payload: {
      ownerId: 'attacker_uid',
      caseNumber: 'T202601',
      ghostField: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Identity spoofing via foreign ownerId on case create',
    operation: 'create',
    path: '/cases/case_spoof_01',
    actor: 'attacker',
    payload: {
      ownerId: 'victim_uid',
      caseNumber: 'T202602',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Orphaned daily diary entry under foreign parent case',
    operation: 'create',
    path: '/cases/victim_case_01/dailyEntries/entry_01',
    actor: 'attacker',
    payload: {
      ownerId: 'attacker_uid',
      caseId: 'victim_case_01',
      entryDate: '2026-11-19',
      proceedings: 'Unauthorized write',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Client-forged createdAt timestamp instead of request.time',
    operation: 'create',
    path: '/cases/case_time_01',
    actor: 'attacker',
    payload: {
      ownerId: 'attacker_uid',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Path variable ID poisoning with invalid characters',
    operation: 'create',
    path: '/cases/bad$id!poison',
    actor: 'attacker',
    payload: {
      ownerId: 'attacker_uid',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Denial-of-wallet oversized notes payload (> 1000 chars)',
    operation: 'update',
    path: '/cases/attacker_case_01',
    actor: 'attacker',
    payload: {
      notes: 'अ'.repeat(2500),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Invalid status enum injection outside official Hindi statuses',
    operation: 'update',
    path: '/cases/attacker_case_01',
    actor: 'attacker',
    payload: {
      status: 'INVALID_STATUS',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unverified email spoofing bootstrapped admin account',
    operation: 'list',
    path: '/users',
    actor: 'unverifiedAdmin',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 13,
    name: 'Cross-user contact PII read on /contacts/{contactId}',
    operation: 'get',
    path: '/contacts/victim_contact_01',
    actor: 'attacker',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 14,
    name: 'Invalid contact role enum injection on /contacts/{contactId}',
    operation: 'create',
    path: '/contacts/contact_bad_role',
    actor: 'attacker',
    payload: {
      ownerId: 'attacker_uid',
      name: 'Test Contact',
      role: 'INVALID_ROLE',
      phone: '+919876543210',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 15,
    name: 'Malicious javascript: URI injection into /settings/app apkDownloadUrl',
    operation: 'update',
    path: '/settings/app',
    actor: 'admin',
    payload: {
      apkDownloadUrl: 'javascript:alert(1)',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];
