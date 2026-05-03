# AGENTS.md

## TL;DR

BugPin is a self-hosted bug reporting widget. Bun runtime, SQLite only, single instance.
Read [CODING-PRINCIPLES.md](./docs/CODING-PRINCIPLES.md) for architecture. Never commit to git. Never use `any`.

---

This file provides guidance to Codex when working with the BugPin repository.

## Development Environment

**Development workflow:**

- BugPin uses **Bun runtime** for fast development and production
- Changes to code are reflected via `bun --watch` for hot reload
- Widget uses build step: `bun run build` in `src/widget/`
- Admin uses Vite HMR for instant updates

**When to rebuild:**

- After adding new dependencies to `package.json`
- After changing build configuration
- Widget code changes (requires rebuild)
- Server and admin changes hot-reload automatically

## Critical Rules (NEVER VIOLATE)

1. **Git Operations**: NEVER commit or push to git. The user handles all git operations manually.
2. **Read CODING-PRINCIPLES.md**: All architecture, naming conventions, file structure, and coding standards are defined in [CODING-PRINCIPLES.md](./docs/CODING-PRINCIPLES.md).
3. **Architecture**: Simple layered architecture (Routes → Services → Repositories)
4. **TypeScript**: Code must pass strict TypeScript compilation (`tsc`) - no `any`, proper types
5. **Language**: American English only (color, center, organize)
6. **SQLite Only**: NEVER suggest PostgreSQL, MySQL, or other databases
7. **Bun Runtime**: Use Bun-specific APIs and patterns, not Node.js-specific ones
8. **Result Pattern**: All service methods return `Result<T>` type for error handling
9. **Single Instance Only**: BugPin is self-hosted, single instance (no clustering, no replication)
10. **No File-Level JSDoc**: Files should start directly with imports or code
11. **No Checkbox Lists**: Use regular bullet points or numbered lists, not `- [ ]` or `- [x]`
12. **Conventional Commits**: Always use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)

## Quick Decision Guide

### "I need to..."

- **Understand codebase structure** → [ARCHITECTURE-OVERVIEW.md](./docs/ARCHITECTURE-OVERVIEW.md)
- **Understand coding standards** → [CODING-PRINCIPLES.md](./docs/CODING-PRINCIPLES.md)
- **Check database schema** → `src/server/database/migrations/`
- **Add an API endpoint** → `src/server/routes/`
- **User-facing docs** → [../bugpin-docs/](../bugpin-docs/)

## Quick Commands

```bash
# Development
make dev                  # Start server + Admin Console (both with hot reload)
make dev-server           # Server only with hot reload
make dev-admin            # Admin Console only (Vite HMR)
make dev-widget           # Widget in watch mode

# Production builds
make build                # Build all (server, admin, widget)
make build-server         # Build server only
make build-admin          # Build admin only
make build-widget         # Build widget only

# Type checking
make typecheck            # Type check all components
make typecheck-server     # Type check server
make typecheck-admin      # Type check admin
make typecheck-widget     # Type check widget

# Testing
make test                 # Run all tests
make test-server          # Server tests only
make test-admin           # Admin tests only
make test-widget          # Widget tests only

# Code quality
make knip                 # Run knip (unused code/deps)
make format               # Format code with Prettier

# Database
cd src/server && bun run migrate   # Run migrations
```

## Package Management

```bash
# ✅ CORRECT: Edit package.json in the appropriate directory, then:
cd src/server && bun install
cd src/admin && bun install
cd src/widget && bun install

# ❌ NEVER: npm install, or install packages globally
```

## Project Overview

**Tech Stack:**

- **Server**: Bun runtime, Hono framework, SQLite database
- **Admin Console**: React 18, TypeScript, Vite, TanStack Query
- **Widget**: Preact, TypeScript, Shadow DOM, <50KB bundle
- **Auth**: Session-based with bcrypt, role-based access (Admin, Viewer)
- **Storage**: Local filesystem for screenshots and attachments

**Server Directory Structure:**

- **`/src/server/database/`** - Database layer:
  - `database.ts` - SQLite connection and initialization
  - `migrations/` - SQL migration files
  - `repositories/` - Data access layer
  - `repositories/interfaces.ts` - Repository interfaces
- **`/src/server/storage/`** - File operations:
  - `files.ts` - File storage (save, read, delete)
- **`/data/`** - Runtime data (git-ignored):
  - `bugpin.db` - SQLite database file
  - `uploads/` - User-uploaded files

**Key Patterns:**

- Repository Pattern (data access abstraction)
- Result Pattern (see [CODING-PRINCIPLES.md](./docs/CODING-PRINCIPLES.md))
- Service Layer (business logic separation)
- Dependency Injection (constructor-based)

## Common Mistakes to Avoid

**Architecture:**

- Business logic in routes → use services
- Database queries in services → use repositories
- Modifying existing handlers → create new ones (OCP)

**TypeScript:**

- Using `any` type → define proper interfaces
- Ignoring TypeScript errors → code must compile

**Project-specific:**

- Suggesting PostgreSQL/MySQL → SQLite only
- Suggesting clustering/replication → single-instance only
- Committing to git → user handles all git operations

## Authentication & Authorization

**Roles:** Admin (full access), Viewer (read-only)

**Bootstrap:** First user created via `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars. Subsequent users created by admins through UI.

## Database Guidelines

**SQLite Best Practices:**

- Use prepared statements (parameterized queries)
- Enable WAL mode for better concurrency
- Use PRAGMA foreign_keys = ON
- Use transactions for multi-step operations
- Keep database file in `data/bugpin.db`

```typescript
// ✅ GOOD - Parameterized query
const report = db.query('SELECT * FROM reports WHERE id = ?').get(id);

// ❌ BAD - String concatenation (SQL injection risk)
const report = db.query(`SELECT * FROM reports WHERE id = '${id}'`).get();
```

## Documentation

- **[ARCHITECTURE-OVERVIEW.md](./docs/ARCHITECTURE-OVERVIEW.md)** - Codebase structure overview
- **[CODING-PRINCIPLES.md](./docs/CODING-PRINCIPLES.md)** - Coding standards, patterns, conventions
- **[../bugpin-docs/](../bugpin-docs/)** - User-facing documentation (Docusaurus)
