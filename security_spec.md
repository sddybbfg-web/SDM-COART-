# Security Specification — राजस्व न्यायालय केस डायरी

## 1. Data Invariants
1. **Strict Private Case Isolation**: Every document in `/cases/{caseId}`, `/cases/{caseId}/dailyEntries/{entryId}`, `/cases/{caseId}/documents/{docId}`, `/courts/{courtId}`, `/reminders/{reminderId}`, and `/contacts/{contactId}` MUST carry `ownerId == request.auth.uid` and is readable/writable ONLY by its verified owner.
2. **Admin Non-Intrusion on Private Cases & Contacts**: Administrators (`/admins/{uid}` or bootstrapped verified admin email `uk3190156@gmail.com`) can manage user accounts (`/users/{userId}`) and global settings (`/settings/{settingId}`), but MUST NOT automatically read, list, modify, or delete any user's private `/cases`, `/dailyEntries`, `/documents`, or `/contacts`.
3. **Master Gate Relational Sync**: Every subcollection write or read under `/cases/{caseId}/dailyEntries/{entryId}` and `/cases/{caseId}/documents/{docId}` MUST verify via `get()` that the parent `/cases/{caseId}` exists and belongs to `request.auth.uid`.
4. **PII Isolation**: `/users/{userId}` contains mobile numbers, addresses, and emails. `get` is restricted strictly to `isOwner(userId)` or `isAdmin()`; `list` is restricted strictly to `isAdmin()`. Blanket `isSignedIn()` reads are forbidden.
5. **Privilege Escalation Prevention**: Users creating `/users/{userId}` MUST set `role == 'user'` and `isBlocked == false`. Users updating their own profile CANNOT modify `role`, `isBlocked`, `uid`, or `createdAt`.
6. **Temporal Integrity**: `createdAt == request.time` on create; `updatedAt == request.time` on update; `createdAt` and `ownerId` are immutable after creation.
7. **Path & Payload Hardening**: All document IDs on single-doc operations satisfy `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars). Every string field enforces an explicit `.size()` ceiling matching `firebase-blueprint.json`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-User Case Read (`GET /cases/victimCase`)**: Attacker attempts to read another user's case record. Expected: `PERMISSION_DENIED`.
2. **Admin Snooping on Private Case (`GET /cases/userCase` as Admin)**: Admin attempts to read a user's private case or attached document. Expected: `PERMISSION_DENIED`.
3. **Self-Assigned Admin Role (`CREATE /users/attackerUid` with `role: 'admin'`)**: Attacker attempts to register themselves as admin. Expected: `PERMISSION_DENIED`.
4. **Profile Privilege Escalation (`UPDATE /users/userUid` modifying `isBlocked: false` or `role: 'admin'`)**: User attempts to unblock themselves or elevate role. Expected: `PERMISSION_DENIED`.
5. **Shadow Ghost Field Injection (`CREATE /cases/c1` with extra key `isVerified: true`)**: Attacker appends undocumented keys to bypass `hasOnly()`. Expected: `PERMISSION_DENIED`.
6. **Spoofed Owner ID (`CREATE /cases/c2` with `ownerId: 'victimUid'`)**: Attacker tries to plant a case in another user's diary. Expected: `PERMISSION_DENIED`.
7. **Orphaned Daily Entry (`CREATE /cases/nonExistentCase/dailyEntries/e1`)**: Attacker writes a daily diary entry under a nonexistent or foreign parent case. Expected: `PERMISSION_DENIED`.
8. **Backdated Server Timestamp (`CREATE /cases/c3` with `createdAt: Timestamp(2020-01-01)`)**: Attacker attempts to spoof `createdAt != request.time`. Expected: `PERMISSION_DENIED`.
9. **ID Poisoning Attack (`CREATE /cases/../../evil$id*1500chars`)**: Attacker supplies malformed or oversized document ID. Expected: `PERMISSION_DENIED`.
10. **Denial-of-Wallet Oversized String (`UPDATE /cases/c1` with `notes` > 1000 chars)**: Attacker attempts to stuff 100KB payload into `notes`. Expected: `PERMISSION_DENIED`.
11. **Invalid Case Status Injection (`UPDATE /cases/c1` with `status: 'FAKE_STATUS'`)**: Attacker injects status outside the 11 official Hindi statuses. Expected: `PERMISSION_DENIED`.
12. **Unverified Email Admin Spoof (`LIST /users` with `email: 'uk3190156@gmail.com', email_verified: false`)**: Unverified account spoofs admin email. Expected: `PERMISSION_DENIED`.
