# WA Blast Testing Guide

## Quick Start

### Run All Tests
```bash
# From project root
npm run test
```

### Run WA Blast Tests Only
```bash
npm run test src/features/wa-blast/__tests__
```

### Run Specific Test File
```bash
npm run test WaBlastCreatePage.test.tsx
npm run test WaBlastRBAC.test.tsx
```

### Run E2E Tests
```bash
npm run test:e2e e2e/wa-blast.spec.ts
```

## Test Structure

```
src/features/wa-blast/__tests__/
├── WaBlastCreatePage.test.tsx    # Integration tests for create page
├── WaBlastRBAC.test.tsx          # Role-based access control tests
├── README.md                      # Test documentation
└── TESTING_GUIDE.md              # This file

e2e/
└── wa-blast.spec.ts              # End-to-end tests with Playwright
```

## Test Coverage Summary

### Integration Tests (React Testing Library)

#### WaBlastCreatePage.test.tsx
- ✅ Form rendering
- ✅ Field validation (title, message)
- ✅ Recipient preview
- ✅ Template selection
- ✅ File upload validation
- ✅ Form submission (immediate & scheduled)
- ✅ Error handling
- ✅ Recipient removal

#### WaBlastRBAC.test.tsx
- ✅ Operator access denial (all pages)
- ✅ Admin Yayasan permissions (list, create, templates)
- ✅ Admin Yayasan config denial
- ✅ Super Admin full access
- ✅ Unauthenticated redirects
- ✅ Role transitions

### E2E Tests (Playwright)

#### wa-blast.spec.ts
- ✅ Full workflow: config → create → monitor → detail
- ✅ Go-WA configuration
- ✅ Connection testing
- ✅ Scheduled blast creation
- ✅ Blast listing with filters
- ✅ Retry failed blasts
- ✅ Cancel scheduled blasts
- ✅ Template CRUD operations
- ✅ Template usage in blasts
- ✅ RBAC verification for all roles
- ✅ Error handling scenarios

## Running Tests in Different Modes

### Watch Mode (Development)
```bash
npm run test -- --watch
```
Automatically reruns tests when files change.

### Coverage Report
```bash
npm run test -- --coverage
```
Generates a coverage report in `coverage/` directory.

### UI Mode (Playwright)
```bash
npx playwright test --ui
```
Opens Playwright's interactive UI for debugging E2E tests.

### Debug Mode
```bash
# Integration tests
npm run test -- --reporter=verbose

# E2E tests
npx playwright test --debug
```

## Test Data Requirements

### For Integration Tests
- No special setup required
- All services are mocked
- Auth helpers are mocked

### For E2E Tests
Requires test users in the database:

```sql
-- Super Admin
INSERT INTO users (username, password, role, email) 
VALUES ('superadmin', '$2y$10$...', 'super_admin', 'superadmin@test.com');

-- Admin Yayasan
INSERT INTO users (username, password, role, email) 
VALUES ('admin_yayasan', '$2y$10$...', 'admin_yayasan', 'admin@test.com');

-- Operator
INSERT INTO users (username, password, role, email, school_id) 
VALUES ('operator', '$2y$10$...', 'operator', 'operator@test.com', 1);
```

Or use the seeder:
```bash
cd backend
php artisan db:seed --class=TestUserSeeder
```

## Continuous Integration

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Manual workflow dispatch

### GitHub Actions Workflow
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm run test
      - name: Run E2E tests
        run: npm run test:e2e
```

## Troubleshooting

### Common Issues

#### 1. Tests fail with "Cannot find module"
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

#### 2. E2E tests timeout
```bash
# Increase timeout in playwright.config.ts
timeout: 60000  // 60 seconds
```

#### 3. Mock not working
```bash
# Ensure mocks are cleared between tests
beforeEach(() => {
  vi.clearAllMocks()
})
```

#### 4. File upload test fails
```bash
# Check if AttachmentUploader component has correct test IDs
<input data-testid="file-upload" type="file" />
```

### Debug Tips

1. **Use screen.debug()** to see current DOM state:
```typescript
import { screen } from "@testing-library/react"
screen.debug()
```

2. **Check what's rendered**:
```typescript
console.log(screen.getByRole("button").outerHTML)
```

3. **Wait for async operations**:
```typescript
await waitFor(() => {
  expect(screen.getByText("Success")).toBeInTheDocument()
}, { timeout: 5000 })
```

4. **View Playwright traces**:
```bash
npx playwright show-trace trace.zip
```

## Best Practices

### Writing Tests

1. **Use semantic queries** (in order of preference):
   - `getByRole`
   - `getByLabelText`
   - `getByPlaceholderText`
   - `getByText`
   - `getByTestId` (last resort)

2. **Test user behavior, not implementation**:
   ```typescript
   // ❌ Bad
   expect(component.state.isOpen).toBe(true)
   
   // ✅ Good
   expect(screen.getByText("Modal Content")).toBeVisible()
   ```

3. **Use waitFor for async operations**:
   ```typescript
   await waitFor(() => {
     expect(screen.getByText("Loaded")).toBeInTheDocument()
   })
   ```

4. **Clean up after tests**:
   ```typescript
   afterEach(() => {
     vi.clearAllMocks()
     cleanup()
   })
   ```

### Maintaining Tests

1. **Update tests when features change**
2. **Keep tests isolated** (no dependencies between tests)
3. **Use descriptive test names**
4. **Add comments for complex scenarios**
5. **Mock external dependencies**

## Performance Tips

### Speed Up Tests

1. **Run tests in parallel**:
```bash
npm run test -- --reporter=verbose --threads
```

2. **Run only changed tests**:
```bash
npm run test -- --changed
```

3. **Skip slow tests during development**:
```typescript
test.skip("slow test", async () => {
  // ...
})
```

4. **Use test.concurrent for independent tests**:
```typescript
test.concurrent("test 1", async () => { /* ... */ })
test.concurrent("test 2", async () => { /* ... */ })
```

## Resources

- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest Docs](https://vitest.dev/)
- [Playwright Docs](https://playwright.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Support

For issues or questions:
1. Check this guide first
2. Review test output and error messages
3. Check the main README.md in this directory
4. Consult the WA Blast spec documents in `.kiro/specs/wa-blast/`
