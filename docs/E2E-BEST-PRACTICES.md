# E2E Testing Best Practices & Pitfalls

This guide covers best practices and common pitfalls when writing and maintaining E2E tests for Solstice.

## Running E2E Tests

### Pre-commit Testing

Before committing changes to main, run the full Chromium E2E test suite:

```bash
pnpm test:e2e --reporter=html --output=e2e-test-results --workers 1 --project=chromium-unauthenticated --project=chromium-authenticated
```

### Development Testing

For faster iteration during development:

```bash
# Run specific test file
pnpm test:e2e path/to/test.spec.ts

# Run in UI mode for debugging
pnpm test:e2e:ui

# Run only failed tests
pnpm test:e2e --last-failed
```

## Best Practices

### 1. Test Data Isolation

- Always clean up test data before and after tests
- Use unique test users for different scenarios
- Never rely on data from previous test runs

```typescript
test.beforeEach(async ({ page }) => {
  await clearUserTeams(page, process.env.E2E_TEST_EMAIL!);
});

test.afterEach(async ({ page }) => {
  try {
    await clearUserTeams(page, process.env.E2E_TEST_EMAIL!);
  } catch (error) {
    console.warn("Cleanup failed:", error);
  }
});
```

### 2. Selector Best Practices

- Use semantic selectors: `getByRole`, `getByLabel`, `getByText`
- Avoid CSS selectors unless absolutely necessary
- Use exact text matching when needed to avoid ambiguity

```typescript
// Good
await page.getByRole("button", { name: "Submit" }).click();
await page.getByLabel("Email").fill("test@example.com");

// Avoid
await page.locator(".submit-btn").click();
```

### 3. Wait Strategies

- Use proper wait conditions instead of arbitrary timeouts
- Wait for specific elements or navigation events
- Use `waitForLoadState` sparingly

```typescript
// Good
await page.waitForURL("/dashboard");
await expect(page.getByRole("heading")).toBeVisible();

// Avoid
await page.waitForTimeout(5000);
```

### 4. Test Structure

- Keep tests focused on user journeys
- Test one feature per test file
- Use descriptive test names

```typescript
test.describe("Team Management", () => {
  test("should create a new team", async ({ page }) => {
    // Test implementation
  });

  test("should edit team details", async ({ page }) => {
    // Test implementation
  });
});
```

### 5. Feature Journeys Catalog

- `e2e/tests/authenticated/events-flow.auth.spec.ts` covers the full events journey:
  admin creates an event, a member registers, and an admin manages the resulting
  registration. Run the spec with `pnpm test:e2e e2e/tests/authenticated/events-
flow.auth.spec.ts` while iterating on events.
- `scripts/seed-e2e-data.ts` now seeds sample events plus a confirmed registration;
  rerun the seed script after resetting the database so event flows stay predictable.

## Common Pitfalls & Solutions

### 1. Strict Mode Violations

**Problem**: Multiple elements match a selector

```typescript
// Error: strict mode violation
await page.getByText("Active").click();
```

**Solution**: Use exact matching or more specific selectors

```typescript
await page.getByText("Active", { exact: true }).click();
// or
await page.getByRole("status").filter({ hasText: "Active" }).click();
```

### 2. Race Conditions

**Problem**: Test fails intermittently due to timing issues

```typescript
await page.click("button");
// May fail if navigation hasn't completed
await expect(page.getByRole("heading")).toBeVisible();
```

**Solution**: Wait for navigation or state changes

```typescript
await page.click("button");
await page.waitForURL("/new-page");
await expect(page.getByRole("heading")).toBeVisible();
```

### 3. Shared Authentication State

**Problem**: Tests interfere with each other's auth state

**Solution**: Use separate storage states or test users

```typescript
// For tests needing fresh auth
test.use({ storageState: undefined });

// Use different test users for different scenarios
const TEST_USERS = {
  general: "test@example.com",
  teamCreator: "teamcreator@example.com",
  profileEdit: "profile-edit@example.com",
};
```

### 4. Database State Dependencies

**Problem**: Tests fail when database state changes

**Solution**: Always seed required data in test setup

```typescript
test.beforeEach(async () => {
  // Seed required data
  await seedTestData();
});
```

### 5. Form Validation Timing

**Problem**: Form validation happens asynchronously

**Solution**: Wait for validation messages

```typescript
await page.getByLabel("Email").fill("invalid");
await page.getByRole("button", { name: "Submit" }).click();
// Wait for validation
await expect(page.getByText("Invalid email")).toBeVisible();
```

## Using MCP Playwright for Debugging

Before writing or updating E2E tests, use MCP Playwright to verify behavior:

1. Check if dev server is running: `curl -s http://localhost:5173/api/health`
2. If browser already in use, close it: `mcp__playwright__browser_close`
3. Navigate and interact: `mcp__playwright__browser_navigate`, `mcp__playwright__browser_snapshot`

This ensures tests match actual application behavior.

## Test User Management

Dedicated test users are seeded via `scripts/seed-e2e-data.ts`:

- `test@example.com` - General authenticated tests
- `teamcreator@example.com` - Team creation (no existing teams)
- `profile-edit@example.com` - Profile editing tests

Each user has specific data states to support different test scenarios.

## Performance Considerations

- Run tests with `--workers 1` for consistent execution
- Use `--reporter=html` for detailed failure analysis
- Output results to `e2e-test-results` for easy inspection
- Firefox tests are currently excluded due to compatibility issues

## Maintenance Tips

1. **Regular Updates**: Update selectors when UI changes
2. **Seed Script**: Keep `seed-e2e-data.ts` in sync with test expectations
3. **Route Changes**: Update navigation assertions when routes change
4. **Validation Changes**: Update error message assertions when validation rules change
5. **New Features**: Add E2E tests for all new user-facing features
