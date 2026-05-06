# WA Blast Test Suite

This directory contains comprehensive tests for the WA Blast feature, including integration tests and RBAC (Role-Based Access Control) verification.

## Test Files

### 1. `WaBlastCreatePage.test.tsx`
Integration tests for the WA Blast creation page using React Testing Library.

**Test Coverage:**
- Form rendering and validation
- Empty field validation (title, message body)
- Recipient preview functionality
- Template selection
- PDF file upload validation
- Form submission (immediate and scheduled)
- API error handling
- Recipient removal from preview

**Key Test Scenarios:**
- ✅ Validates empty title field
- ✅ Validates empty message body
- ✅ Previews recipients successfully
- ✅ Handles template selection
- ✅ Validates PDF file upload
- ✅ Submits form with immediate send
- ✅ Submits form with scheduled send
- ✅ Handles API errors gracefully
- ✅ Allows removing recipients from preview
- ✅ Shows warning when config is missing

### 2. `WaBlastRBAC.test.tsx`
Role-based access control tests to verify proper authorization.

**Test Coverage:**
- Operator role restrictions
- Admin Yayasan role permissions
- Super Admin full access
- Unauthenticated user redirects
- Role transition scenarios
- API endpoint protection

**Key Test Scenarios:**

#### Operator Role:
- ❌ Cannot access WA Blast list page (403)
- ❌ Cannot access WA Blast create page (403)
- ❌ Cannot access WA Blast config page (403)

#### Admin Yayasan Role:
- ✅ Can access WA Blast list page
- ✅ Can access WA Blast create page
- ✅ Can manage templates
- ❌ Cannot access WA Blast config page (403)

#### Super Admin Role:
- ✅ Can access all WA Blast pages
- ✅ Can access WA Blast config page
- ✅ Full access to all features

## Running the Tests

### Run All Frontend Tests
```bash
npm run test
```

### Run Specific Test File
```bash
npm run test WaBlastCreatePage.test.tsx
npm run test WaBlastRBAC.test.tsx
```

### Run Tests in Watch Mode
```bash
npm run test -- --watch
```

### Run Tests with Coverage
```bash
npm run test -- --coverage
```

## E2E Tests

E2E tests are located in `/e2e/wa-blast.spec.ts` and use Playwright.

### Run E2E Tests
```bash
npm run test:e2e
```

### Run Specific E2E Test
```bash
npx playwright test wa-blast.spec.ts
```

### Run E2E Tests in UI Mode
```bash
npx playwright test --ui
```

### E2E Test Coverage:
- ✅ Full workflow: config → create → monitor → detail
- ✅ Configure Go-WA and test connection
- ✅ Create scheduled blast
- ✅ List all blasts with filters
- ✅ Retry failed blast
- ✅ Cancel scheduled blast
- ✅ Template management (create, edit, delete)
- ✅ Use template in blast creation
- ✅ RBAC verification for all roles
- ✅ Error handling scenarios

## Test Data Setup

For E2E tests, ensure you have test users with the following credentials:

```javascript
// Super Admin
username: "superadmin"
password: "password123"

// Admin Yayasan
username: "admin_yayasan"
password: "password123"

// Operator
username: "operator"
password: "password123"
```

You can set up test data using:
```bash
cd backend
php artisan db:seed --class=TestUserSeeder
```

## Mocking Strategy

### Integration Tests (React Testing Library)
- Services are mocked using Vitest's `vi.mock()`
- Auth helpers are mocked to simulate different user roles
- API responses are mocked to test various scenarios

### E2E Tests (Playwright)
- Tests run against a real or staging environment
- No mocking - tests actual user flows
- Requires backend API to be running

## CI/CD Integration

These tests are automatically run in the CI/CD pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Frontend Tests
  run: npm run test

- name: Run E2E Tests
  run: npm run test:e2e
```

## Debugging Tests

### Debug Integration Tests
```bash
npm run test -- --reporter=verbose
```

### Debug E2E Tests
```bash
npx playwright test --debug
```

### View E2E Test Report
```bash
npx playwright show-report
```

## Test Maintenance

When updating the WA Blast feature:

1. **Update integration tests** if component props or behavior changes
2. **Update RBAC tests** if role permissions change
3. **Update E2E tests** if user flows or UI elements change
4. **Run all tests** before committing changes

## Known Issues

- File upload tests may need adjustment based on the actual `AttachmentUploader` component implementation
- Template picker modal tests assume a specific UI structure
- E2E tests require proper test data seeding

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Use descriptive test names
3. Add comments for complex test scenarios
4. Ensure tests are isolated and don't depend on each other
5. Mock external dependencies appropriately
6. Update this README with new test coverage

## Related Documentation

- [WA Blast Requirements](../.kiro/specs/wa-blast/requirements.md)
- [WA Blast Design](../.kiro/specs/wa-blast/design.md)
- [WA Blast Tasks](../.kiro/specs/wa-blast/tasks.md)
