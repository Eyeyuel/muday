You are implementing the Muday bot pairing code authentication system.

PROJECT LOCATION: /home/eyuel/Desktop/bot

Muday is a Telegram-first personal finance platform. The Telegram bot is
the primary product. The Flutter mobile app is a companion viewer. The
backend uses NestJS, Prisma, PostgreSQL, Redis, BullMQ, and Telegram Bot APIs.

══════════════════════════════════════════════════════════
AUTHORITATIVE DOCUMENTS — READ THESE FIRST, IN ORDER
══════════════════════════════════════════════════════════

1. /home/eyuel/Desktop/bot/docs/plans/BOT_PAIRING_AUTH_PLAN.md
   → The complete implementation plan. Every phase, every checklist item.
   → This is your single source of truth for what to build.

2. /home/eyuel/Desktop/bot/docs/plans/BOT_PAIRING_AUTH_COMMANDS.md
   → Phase-by-phase prompts with exact verification commands.
   → Use this as your execution checklist for each phase.

Supporting references (read only if relevant to the phase you are in):

- apps/backend/prisma/schema.prisma (database schema)
- apps/backend/src/config/environment.ts (env var schema)
- apps/backend/src/customer-auth/ (auth module)
- apps/backend/src/onboarding/ (bot onboarding flow)
- docs/project-handbook.md (developer operations)

══════════════════════════════════════════════════════════
CURRENT STATUS
══════════════════════════════════════════════════════════

The pairing-code authentication implementation is complete. Its plan and command file remain as
the authoritative maintenance and verification record. Do not rerun an implementation phase unless
the user explicitly requests a correction or extension.

WHAT EXISTS AND WORKS:

- All /api/v1/me/* endpoints
- All /api/v1/transactions/* endpoints
- CustomerAuthGuard (Bearer JWT validation + session check)
- CustomerSessionService (create/refresh/revoke sessions)
- CustomerJwtService (sign/verify access tokens)
- CustomerRefreshToken rotation with reuse detection
- ActiveAccountGuard
- AppCodeService (6-char pairing code, bcrypt+pepper, prefix lookup)
- POST /api/v1/auth/code endpoint
- Bot hook: generate code after onboarding consent
- /mycode bot command
- DB migration: app_code_hash + app_code_prefix columns

The earlier Telegram OIDC implementation and endpoints were removed. Its superseded design is
retained only in `docs/archive/plans/` for historical context.

══════════════════════════════════════════════════════════
NON-NEGOTIABLE PROCESS RULES
══════════════════════════════════════════════════════════

1. IMPLEMENT ONE PHASE AT A TIME.
   Never start a phase unless explicitly told to. Never implement
   the next phase automatically after finishing one.

2. STOP AND WAIT FOR USER CONFIRMATION AFTER EVERY PHASE.
   End every phase with: "Phase [X] is complete. Please review and confirm
   before I continue to Phase [next]."

3. MARK CHECKLIST ITEMS IN BOT_PAIRING_AUTH_PLAN.md.
   Change "- [ ]" to "- [x]" for every item you have genuinely verified.
   Mark manual items as "[manual] — description of what user must verify".
   Never mark an item done unless you actually ran and saw it pass.

4. SHOW REAL COMMAND OUTPUT.
   After running any verification command, paste the actual output.
   Do not summarize. Do not say "tests passed" without showing the output.

5. DO NOT COMMIT OR PUSH.
   Never run git commit, git push, or git merge unless the user explicitly asks.

6. DO NOT USE DESTRUCTIVE GIT COMMANDS.
   Never run: git reset --hard, git checkout -- ., git clean -f, or any
   command that discards existing work.

7. DO NOT OVER-TEST.
   Run focused tests during development. Run npm run ci only to verify
   a phase is complete. Do not run the full suite repeatedly while coding.
   Focused test command pattern: npx jest --testPathPattern="pattern" --no-coverage --verbose

8. DO NOT REFORMAT UNRELATED FILES.
   Only touch the files that the current phase requires. Do not fix lint
   warnings, reformat code, or refactor things outside the phase scope.

9. READ BEFORE EDITING.
   Always read a file before modifying it. Understand what is already there.

10. DO NOT INSTALL OR UPGRADE DEPENDENCIES unless the phase explicitly
    requires it. If needed, explain why and what version.

══════════════════════════════════════════════════════════
GIT STATE RULES
══════════════════════════════════════════════════════════

Before starting any phase, run:
git status --short
git diff --stat

Report the output. If there are uncommitted changes:

- Treat them as intentional user work.
- Do not overwrite them.
- If your phase changes overlap with those files, read them first and
  preserve any existing logic.

After completing a phase, always run and show:
git status --short
git diff --stat

══════════════════════════════════════════════════════════
SECURITY RULES — NEVER VIOLATE THESE
══════════════════════════════════════════════════════════

CODES AND SECRETS:

- Never log the plaintext pairing code (rawCode) anywhere.
- Never log the peppered string (rawCode + pepper).
- Never log bcrypt hashes.
- Never log Authorization headers or Bearer tokens.
- Never print or commit .env values.
- Error messages to the client must be generic: "Invalid code" — never
  reveal whether the code was wrong, the user was not found, or the
  account is deleted.

AUTHENTICATION:

- bcrypt saltRounds must be exactly 12 for the pairing code.
- The APP_CODE_PEPPER must be applied: bcrypt(code + pepper, 12).
- Never weaken authentication to make tests pass.
- Never accept a client-provided userId as proof of ownership.
- Rate limiting must run BEFORE bcrypt.compare (fail fast, prevent timing attacks).

SESSIONS:

- Hash refresh tokens before storing (SHA-256 is already used — keep it).
- Never put tokens in URL query parameters.
- Never put tokens in logs.

CROSS-USER:

- All data reads and writes must be scoped by authenticated userId.
- User A must never be able to access User B's data.
- Add a cross-user isolation test in every integration test file you create.

DATABASE:

- All migrations must be additive. Never drop a column in a phase migration.
- Never edit an already-applied migration file.
- Always run: npm run db:validate && npm run db:generate after schema changes.

══════════════════════════════════════════════════════════
NESTJS BEST PRACTICES FOR THIS PROJECT
══════════════════════════════════════════════════════════

MODULE STRUCTURE:

- Every new service must be declared in a @Module providers array.
- Every service used by another module must be in that module's exports array.
- Use @Inject(ServiceClassName) for dependency injection (this project uses
  explicit @Inject decorators, not parameter-name injection).

VALIDATION:

- All request DTOs must use class-validator decorators:
  @IsString(), @Length(), @Matches(), @IsOptional(), @IsIn()
- ValidationPipe is global — DTOs are automatically validated.
- Use precise error messages in validator options.

ERROR HANDLING:

- Throw NestJS built-in exceptions: UnauthorizedException, NotFoundException,
  ForbiddenException, BadRequestException, TooManyRequestsException.
- Never throw raw Error objects from service methods.
- Generic external errors, specific internal logs (no secrets in logs).

SWAGGER:

- All new endpoints need: @ApiOperation, @ApiBody or @ApiQuery, @ApiResponse.
- @ApiBearerAuth() on all protected endpoints.
- @ApiTags() on controller class.

GUARDS:

- CustomerAuthGuard validates the Bearer JWT and attaches user to request.
- ActiveAccountGuard checks user.status === 'ACTIVE' — use on financial routes.
- Apply guards with @UseGuards() on individual endpoints or controller class.

CONFIG:

- Always get config values via ConfigService with { infer: true }:
  config.get('APP_CODE_PEPPER', { infer: true })
- Never hardcode config values in service files.
- All new env vars must be added to environment.ts with Zod schema.

══════════════════════════════════════════════════════════
DATABASE / PRISMA BEST PRACTICES
══════════════════════════════════════════════════════════

- Run in this order after any schema change:
  1. npm run db:validate
  2. npm run db:generate
  3. npm run db:migrate:deploy (or prisma migrate dev for local)

- Use prisma.$transaction() for any operation that must be atomic.

- For the AppCodeService prefix lookup:
  findMany with WHERE app_code_prefix = prefix AND app_code_hash IS NOT NULL.
  Then bcrypt.compare in the application layer — never do bcrypt in SQL.

- Index: @@index([appCodePrefix]) must be in the Prisma schema on the User model.

- After adding nullable columns, handle null in TypeScript:
  field ?? null (not field || null, to avoid 0 or "" being treated as null)

══════════════════════════════════════════════════════════
TESTING RULES — PRACTICAL AND PROPORTIONAL
══════════════════════════════════════════════════════════

DURING DEVELOPMENT:

- Run focused tests: npx jest --testPathPattern="your-file" --no-coverage --verbose
- Fix failures immediately. Do not continue coding if a test is broken.

AFTER EACH PHASE:

- Run: npm run ci
- Show the full output of the final test run.
- Show the test count: "X tests passed, Y total"

TEST REQUIREMENTS PER PHASE (proportional — not exhaustive):

- Phase A (schema): No new tests required. Migration verify commands are enough.
- Phase B (AppCodeService): Unit tests for generate, verify, regenerate, rate limit.
- Phase C (session update): Verify existing tests still pass. No new tests needed.
- Phase D (new endpoint): Unit/controller test for new endpoint. Verify OIDC endpoints removed.
- Phase E (delete OIDC): No new tests. Verify rg returns 0 results for OIDC references.
- Phase F (bot integration): Automated: typecheck + ci. Manual: real Telegram test.
- Phase G (rate limit): Verify rate limit logic exists. Test with integration spec.
- Phase H (integration tests): Full integration test file. This is the main test phase.
- Phase I (docs/cleanup): No new tests. Final npm run ci + npm run prod:config.

FOR PHASE H INTEGRATION TESTS — write these and no more:

- Valid code → 200 + tokens
- Wrong code → 401
- Bad format → 400
- Deleted user → 401
- PENDING_CONSENT user → 401
- Token works on /api/v1/me → 200
- Token refresh → 200
- Logout → session revoked
- Cross-user isolation (User A code ≠ User B session)
- Removed OIDC endpoints → 404

DO NOT write tests for:

- Internal bcrypt behavior (trust the library)
- Every possible malformed input (3-4 representative cases are enough)
- Redis internals (mock it in unit tests)
- Concurrent session creation race conditions (out of scope for this phase)

══════════════════════════════════════════════════════════
COMMUNICATION STYLE
══════════════════════════════════════════════════════════

START OF EACH PHASE:

- State which phase you are implementing.
- List the files you will change and why.
- Note anything that already exists and does not need to change.
- Keep it short — 5 lines max before you start coding.

DURING IMPLEMENTATION:

- Code first, explain after.
- If you hit an error, describe it and fix it immediately.
- Do not ask the user for permission to fix obvious errors.

END OF EACH PHASE:
Show this exact structure:
✅ Phase [X] — [Name] — COMPLETE

Files changed:

- [file] — [what changed and why]

Commands run:

- [command] → [result in one line]

Tests: [X] passed, [Y] total

Checklist items marked [x]: [list them]
Checklist items marked [manual]: [list them with description]

Git status:
[paste git status --short output]

⏸️ Waiting for your confirmation to continue to Phase [next].

══════════════════════════════════════════════════════════
WHAT THE NEW AUTH FLOW LOOKS LIKE (QUICK REFERENCE)
══════════════════════════════════════════════════════════

BOT SIDE:
User → /start → language → consent [Agree]
→ ConsentService.acceptByUserId()
→ AppCodeService.generateForUser(userId) → "aB3kX9"
→ bot sends: "📱 Your app code: aB3kX9"

User → /mycode
→ confirmation inline keyboard
→ User confirms → AppCodeService.regenerateForUser(userId)
→ revokes all mobile sessions → bot sends new code

MOBILE SIDE:
POST /api/v1/auth/code { "code": "aB3kX9" }
→ validate format (6 alphanumeric)
→ rate limit check (Redis, per IP)
→ prefix lookup (users WHERE app_code_prefix = "aB3k")
→ bcrypt.compare(code + PEPPER, hash)
→ CustomerSessionService.createSession({ userId, identityId: null })
→ return { accessToken, refreshToken, user }

All API calls:
Authorization: Bearer <accessToken>
→ CustomerAuthGuard validates → route executes

Token refresh:
POST /api/v1/auth/token/refresh { refreshToken }
→ rotate → new access + refresh tokens

══════════════════════════════════════════════════════════
DEFINITION OF DONE FOR THE ENTIRE IMPLEMENTATION
══════════════════════════════════════════════════════════

The implementation is complete when ALL of these are true:

1. npm run ci passes with 0 failures.
2. npm run prod:config passes (env vars validated).
3. npm run docker:local:up — all containers healthy.
4. rg "TelegramOidcService|TelegramJwksService|OidcAttemptRepository|HandoffCodeRepository" \
   apps/backend/src/ --include="*.ts" returns ZERO results.
5. POST /api/v1/auth/code works with a real bot-issued code.
6. GET /api/v1/auth/telegram/start returns 404 (endpoint removed).
7. Bot sends a pairing code to the user after onboarding completes.
8. /mycode command works and revokes sessions on regeneration.
9. All phase checklists in BOT_PAIRING_AUTH_PLAN.md are marked [x] or [manual].
10. No plaintext codes appear anywhere in application logs.

══════════════════════════════════════════════════════════
START INSTRUCTION
══════════════════════════════════════════════════════════

When given a phase to implement:

1. Run: git status --short && git diff --stat
   Show the output.

2. Read the relevant phase section in BOT_PAIRING_AUTH_PLAN.md.

3. Read all files you will modify before touching them.

4. Implement the phase changes.

5. Run verification commands from BOT_PAIRING_AUTH_COMMANDS.md for that phase.
   Show all output.

6. Mark checklist items in BOT_PAIRING_AUTH_PLAN.md.

7. Show the end-of-phase summary (template above).

8. STOP and wait for user confirmation.

Do not reopen a completed phase unless explicitly told to do so.
