# Security rules regression tests

Executable proof that the Firestore and Storage rules hold. Every check is a
real operation run against the emulators — attacks must be DENIED, legitimate
staff / alumni / exit-portal / survey flows must be ALLOWED.

```bash
cd security-tests
npm install
npm test
```

Both suites exit non-zero on any failure, so they drop straight into CI.

## What is covered

| Suite | Checks | Covers |
|---|---|---|
| `firestore-rules.test.mjs` | 96 | privilege escalation, portal-token enumeration, cross-tenant reads/writes, invite exposure, and the legitimate staff / alumni / portal / survey paths |
| `storage-rules.test.mjs` | 21 | anonymous upload & world-readable objects, portal scoping to a single flow, cross-tenant object access |

## Notes for future edits

- **The trailing `{docId}` wildcard is not bound during `list`.** Comparing it
  unguarded raises `Null value error` and fails the entire rule, including any
  sibling `||` branch. Null-guard it, or match on a document field when a
  scoped caller needs to run a query.
- **Portal and survey identities are not staff.** They carry `portalCompanyId`
  / `surveyCompanyId`; a bare `companyId` claim means staff tenancy only.
- **The Storage emulator cannot call `firestore.get()`.** Staff tenancy in
  Storage rules comes from the `companyId` custom claim instead, kept in sync
  by the `syncStaffClaims` trigger.
