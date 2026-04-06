# Testing Guide

This guide covers testing strategies, tools, and best practices for TitanClip.

## Table of Contents

- [Testing Architecture Overview](#testing-architecture-overview)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [E2E Testing Strategy](#e2e-testing-strategy)
- [Testing Commands and Scripts](#testing-commands-and-scripts)
- [Test Coverage Guidelines](#test-coverage-guidelines)
- [CI/CD Testing Integration](#cicd-testing-integration)
- [Writing Effective Tests](#writing-effective-tests)

## Testing Architecture Overview

TitanClip uses a multi-layered testing approach:

```
┌─────────────────────────────────────────┐
│         E2E Tests (Manual)              │
│    Full application workflow tests      │
└─────────────────────────────────────────┘
                  │
┌─────────────────────────────────────────┐
│       Integration Tests (Service)       │
│    API routes, database, adapters       │
└─────────────────────────────────────────┘
                  │
┌─────────────────────────────────────────┐
│         Unit Tests (Vitest)             │
│    Functions, utilities, components     │
└─────────────────────────────────────────┘
```

### Test Locations

| Layer | Location | Framework |
|-------|----------|-----------|
| **Unit** | `server/src/__tests__/` | Vitest |
| **Unit** | `ui/src/**/*.test.ts` | Vitest |
| **Unit** | `packages/*/src/**/*.test.ts` | Vitest |
| **Integration** | `server/src/__tests__/` | Vitest + Supertest |
| **E2E** | Manual testing | Dev mode |

### Testing Principles

1. **Test pyramid**: More unit tests, fewer integration tests, minimal E2E tests
2. **Fast feedback**: Unit tests should run in milliseconds
3. **Isolation**: Tests should not depend on external services
4. **Repeatability**: Same test should produce same result every time
5. **Meaningful assertions**: Test behavior, not implementation

## Unit Testing

### Framework

TitanClip uses **Vitest** for unit testing across all packages.

### Configuration

**Server** (`server/vitest.config.ts`):
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

**UI** (`ui/vitest.config.ts`):
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
  },
});
```

### Writing Unit Tests

**Example: Utility Function Test**

```typescript
// server/src/__tests__/log-redaction.test.ts
import { describe, it, expect } from 'vitest';
import { redactSecrets } from '../log-redaction';

describe('redactSecrets', () => {
  it('should redact API keys in logs', () => {
    const input = 'Authorization: Bearer sk-abc123xyz';
    const result = redactSecrets(input);
    expect(result).toBe('Authorization: Bearer [REDACTED]');
  });

  it('should redact multiple secrets', () => {
    const input = 'key=secret123 token=abc456';
    const result = redactSecrets(input);
    expect(result).toContain('[REDACTED]');
  });
});
```

**Example: React Component Test**

```typescript
// ui/src/lib/normalize-markdown.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeMarkdown } from './normalize-markdown';

describe('normalizeMarkdown', () => {
  it('should convert headings correctly', () => {
    const input = '# Hello\n## World';
    const result = normalizeMarkdown(input);
    expect(result).toContain('<h1>');
    expect(result).toContain('<h2>');
  });

  it('should handle empty input', () => {
    expect(normalizeMarkdown('')).toBe('');
  });
});
```

### Test File Naming

- **Server**: `server/src/__tests__/*.test.ts`
- **UI**: Co-located with source (`*.test.ts` next to `*.ts`)
- **Packages**: `packages/*/src/**/*.test.ts`

### Mocking

**Mocking Modules**:
```typescript
import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';

vi.mock('fs', () => ({
  readFileSync: vi.fn(() => '{"key": "value"}'),
}));

describe('myFunction', () => {
  it('should use mocked fs', () => {
    // Test uses mocked fs.readFileSync
  });
});
```

**Mocking Database**:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('userService', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    mockDb = new MockDatabase();
    // Seed test data
    mockDb.users.create({ id: '1', name: 'Test' });
  });

  it('should find user by id', async () => {
    const user = await userService.findById(mockDb, '1');
    expect(user.name).toBe('Test');
  });
});
```

## Integration Testing

### API Route Testing

Use Supertest for HTTP integration tests:

```typescript
// server/src/__tests__/agent-skills-routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { db } from '../db';

describe('Agent Skills Routes', () => {
  let authToken: string;
  let agentId: string;

  beforeAll(async () => {
    // Setup test data
    authToken = await getTestAuthToken();
    agentId = await createTestAgent();
  });

  afterAll(async () => {
    // Cleanup
    await cleanupTestData();
  });

  it('GET /api/agents/:id/skills should return skills', async () => {
    const response = await request(app)
      .get(`/api/agents/${agentId}/skills`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('skills');
    expect(Array.isArray(response.body.skills)).toBe(true);
  });

  it('POST /api/agents/:id/skills/sync should assign skills', async () => {
    const response = await request(app)
      .post(`/api/agents/${agentId}/skills/sync`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ skillIds: ['skill-1', 'skill-2'] })
      .expect(200);

    expect(response.body.skills).toHaveLength(2);
  });
});
```

### Database Integration Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { migrate } from '../db/migrate';

describe('Issue Repository', () => {
  beforeEach(async () => {
    // Run migrations
    await migrate(db);
    // Seed test data
    await db.insert(testData);
  });

  it('should create issue with correct fields', async () => {
    const issue = await issues.create(db, {
      title: 'Test Issue',
      status: 'todo',
    });

    expect(issue.id).toBeDefined();
    expect(issue.createdAt).toBeDefined();
  });
});
```

### Adapter Integration Tests

```typescript
import { describe, it, expect } from 'vitest';
import { createClaudeLocalAdapter } from '../adapters/claude-local';

describe('Claude Local Adapter', () => {
  it('should execute commands safely', async () => {
    const adapter = createClaudeLocalAdapter({ cwd: '/tmp' });
    
    const result = await adapter.execute('echo "hello"');
    expect(result.stdout).toContain('hello');
  });
});
```

## E2E Testing Strategy

### Current Approach

TitanClip currently relies on **manual E2E testing** in development mode:

1. **Start the app**: `pnpm dev`
2. **Test workflows manually**:
   - Agent hiring
   - Task creation and assignment
   - Issue status transitions
   - Chat interactions
   - File uploads
   - Settings changes

### Recommended E2E Setup

For automated E2E testing, consider:

**Playwright** (Recommended):
```typescript
// e2e/tests/agent-hiring.spec.ts
import { test, expect } from '@playwright/test';

test('should hire an agent', async ({ page }) => {
  await page.goto('http://localhost:3100');
  
  // Navigate to agent gallery
  await page.click('[data-testid="agents-nav"]');
  
  // Hire backend engineer
  await page.click('[data-testid="hire-backend-engineer"]');
  
  // Verify agent appears in list
  await expect(page.locator('[data-testid="agent-list"]'))
    .toContainText('Backend Engineer');
});
```

### Manual E2E Test Checklist

**Core Workflows**:
- [ ] Company onboarding
- [ ] Agent hiring (all templates)
- [ ] Task creation and assignment
- [ ] Issue status transitions (todo → in_progress → done)
- [ ] Agent checkout flow
- [ ] Comment creation
- [ ] File attachment
- [ ] Project creation
- [ ] Routine setup
- [ ] Goal tracking

**Edge Cases**:
- [ ] Concurrent task checkout (conflict handling)
- [ ] Budget limit enforcement
- [ ] Approval workflow
- [ ] Agent error handling
- [ ] Network disconnection recovery

## Testing Commands and Scripts

### Root Level

```bash
# Type-check all packages (includes test compilation)
pnpm typecheck
```

### Server

```bash
# Run tests
cd server && pnpm vitest

# Run tests in watch mode
cd server && pnpm vitest --watch

# Run tests with coverage
cd server && pnpm vitest --coverage

# Run specific test file
cd server && pnpm vitest src/__tests__/log-redaction.test.ts

# Run tests matching pattern
cd server && pnpm vitest -t "redaction"
```

### UI

```bash
# Run tests
cd ui && pnpm vitest

# Run tests in watch mode
cd ui && pnpm vitest --watch

# Run tests with coverage
cd ui && pnpm vitest --coverage
```

### Packages

```bash
# Run tests in specific package
cd packages/db && pnpm vitest

# Run tests in all packages
pnpm -r vitest
```

### CI Command (Recommended)

Add to `package.json`:
```json
{
  "scripts": {
    "test": "pnpm -r vitest run",
    "test:coverage": "pnpm -r vitest run --coverage",
    "test:ci": "pnpm test -- --reporter=junit --outputFile=report.xml"
  }
}
```

## Test Coverage Guidelines

### Coverage Targets

| Package | Lines | Branches | Functions |
|---------|-------|----------|-----------|
| **Server** | 70% | 60% | 70% |
| **UI** | 60% | 50% | 60% |
| **Packages** | 80% | 70% | 80% |

### Critical Coverage Areas

**Must Test** (100% coverage expected):
- Authentication and authorization
- Data validation
- Security-sensitive code (secret redaction, input sanitization)
- Cost calculation and billing
- Issue state transitions

**Should Test** (80% coverage):
- API route handlers
- Service layer business logic
- Utility functions
- Database queries

**Nice to Test** (50% coverage):
- UI components (visual)
- Error messages
- Logging

### Running Coverage

```bash
# Server coverage
cd server && pnpm vitest --coverage

# View coverage report
open server/coverage/index.html
```

### Coverage Configuration

Add to `vitest.config.ts`:
```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.ts',
      ],
      thresholds: {
        global: {
          lines: 70,
          branches: 60,
        },
      },
    },
  },
});
```

## CI/CD Testing Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9.15
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Type check
        run: pnpm typecheck
      
      - name: Run tests
        run: pnpm test:ci
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### Pre-commit Hooks

Using Husky:

```bash
# .husky/pre-commit
#!/bin/sh
pnpm typecheck
pnpm test -- --changed
```

### Test Environment Variables

```bash
# .env.test
PAPERCLIP_COMPANY_ID=test-company-id
PAPERCLIP_API_KEY=test-api-key
PAPERCLIP_DATABASE_URL=sqlite:test.db
```

## Writing Effective Tests

### Test Structure (AAA Pattern)

```typescript
describe('functionName', () => {
  it('should do something when condition', () => {
    // Arrange
    const input = { key: 'value' };
    
    // Act
    const result = functionName(input);
    
    // Assert
    expect(result).toEqual(expected);
  });
});
```

### Test Naming

**Good**:
```typescript
it('should return empty array when no issues found')
it('should reject invalid email format')
it('should increment retry count on failure')
```

**Bad**:
```typescript
it('test 1')
it('should work')
it('handles stuff')
```

### Testing Edge Cases

```typescript
describe('parseAgentMention', () => {
  it('should handle valid mention', () => {
    expect(parseAgentMention('@cto')).toBe('cto');
  });

  it('should handle mention with special chars', () => {
    expect(parseAgentMention('@backend-engineer')).toBe('backend-engineer');
  });

  it('should return null for invalid mention', () => {
    expect(parseAgentMention('not-a-mention')).toBeNull();
  });

  it('should handle empty string', () => {
    expect(parseAgentMention('')).toBeNull();
  });

  it('should handle whitespace', () => {
    expect(parseAgentMention('  @cto  ')).toBe('cto');
  });
});
```

### Avoiding Common Mistakes

**Don't test implementation details**:
```typescript
// Bad
it('should call processArray with correct args', () => {
  const mock = vi.fn();
  processArray = mock;
  // Testing internal implementation
});

// Good
it('should process array items correctly', () => {
  const result = processArray([1, 2, 3]);
  expect(result).toEqual([2, 4, 6]);
});
```

**Don't over-mock**:
```typescript
// Bad - mocking everything
it('should do something', () => {
  vi.mock('everything');
  // Test has no real value
});

// Good - mock only external dependencies
it('should save user to database', () => {
  const mockDb = createMockDb();
  await saveUser(mockDb, user);
  expect(mockDb.users.create).toHaveBeenCalledWith(user);
});
```

---

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright](https://playwright.dev/)
- [Supertest](https://github.com/ladjs/supertest)
