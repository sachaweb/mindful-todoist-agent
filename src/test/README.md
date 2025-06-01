
# Testing Documentation

This document describes the comprehensive testing setup for the intent-based architecture in the Todoist AI Agent.

## Test Structure

Our testing suite is organized into three main categories:

### 1. Unit Tests (`__tests__` folders)
- **Intent Service Tests** (`src/services/__tests__/intentService.test.ts`)
  - Intent analysis with various input patterns
  - Mapping to Todoist format
  - Error handling and fallback scenarios
  - Priority mapping validation

- **Content Sanitizer Tests** (`src/utils/__tests__/contentSanitizer.test.ts`)
  - Individual sanitization rules
  - Complex nested artifact removal
  - Rule management (add/remove/toggle)
  - Todoist-specific sanitization

- **State Machine Tests** (`src/utils/__tests__/stateMachine.test.ts`)
  - State transitions and context management
  - User input handling (confirmations, cancellations)
  - Artifact filtering based on conversation state
  - Edge cases and rapid state changes

### 2. Integration Tests
- **AI Service Integration** (`src/services/__tests__/ai-service.integration.test.ts`)
  - Full user input → intent analysis → response flow
  - Context management across multiple interactions
  - Task analysis and suggestion generation
  - Error propagation and recovery

### 3. Regression Tests
- **Previously Broken Inputs** (`src/test/regression.test.ts`)
  - Confirmation artifact pollution
  - Nested AI response artifacts
  - Malformed date strings
  - Unicode and special characters
  - Performance with large datasets

## Mock Setup

### Mock Service Worker (MSW)
We use MSW to mock external API calls:

- **Claude API** - Returns structured intent analysis responses
- **Todoist API** - Simulates task creation/retrieval operations

### Mock Responses
- Predefined responses for common input patterns
- Error scenarios for testing resilience
- Edge case responses for boundary testing

## Running Tests

### Prerequisites
```bash
npm install
```

### Commands

#### Run All Tests
```bash
npm test
```

#### Run Specific Test Categories
```bash
# Unit tests only
npm run test:unit

# Integration tests only  
npm run test:integration

# Regression tests only
npm run test:regression
```

#### Run with Coverage
```bash
npm run test:coverage
```

#### Watch Mode (for development)
```bash
npm run test:watch
```

### Custom Test Runner
```bash
# Using the custom test runner
npx ts-node src/test/testRunner.ts all     # All tests
npx ts-node src/test/testRunner.ts unit    # Unit tests only
npx ts-node src/test/testRunner.ts integration  # Integration tests only
npx ts-node src/test/testRunner.ts regression   # Regression tests only
```

## Coverage Targets

We aim for the following coverage thresholds:

- **Statements**: > 80%
- **Branches**: > 75% 
- **Functions**: > 80%
- **Lines**: > 80%

### Critical Components (95%+ coverage required)
- Intent Service
- Content Sanitizer
- State Machine
- AI Service core methods

## Test Data Patterns

### Common Test Inputs
```typescript
// Task creation patterns
'Buy groceries tomorrow'
'create: Schedule team meeting'
'I need to call mom tonight'

// Confirmation responses  
'yes', 'proceed', 'create anyway'
'no', 'cancel', 'nevermind'

// Problematic inputs (regression)
'create anyway "task: Buy groceries"'
'I\'ll create the following 3 tasks:'
'1. First task\n2. Second task'
```

### Mock Intent Responses
```typescript
{
  "action": "create",
  "confidence": 0.95,
  "entities": {
    "taskContent": "Buy groceries",
    "dueDate": "tomorrow",
    "priority": "high"
  },
  "reasoning": "Clear task creation intent"
}
```

## Best Practices

### Test Isolation
- Each test should be independent
- Use `beforeEach` to reset state
- Mock external dependencies consistently

### Assertion Strategies
- Test both positive and negative cases
- Verify error handling paths
- Check edge cases and boundary conditions

### Mock Verification
- Verify mock calls with correct parameters
- Test both success and failure scenarios
- Ensure proper error propagation

### Performance Testing
- Include timing assertions for critical paths
- Test with large datasets to catch performance regressions
- Monitor memory usage in long-running tests

## Continuous Integration

### Pre-commit Hooks
Tests should run automatically before commits:
```bash
# Add to package.json scripts
"precommit": "npm run test:unit && npm run lint"
```

### CI Pipeline
1. Install dependencies
2. Run linting
3. Run unit tests
4. Run integration tests
5. Run regression tests
6. Generate coverage report
7. Upload coverage to coverage service

## Debugging Tests

### Common Issues
1. **Mock not working**: Check import order and mock setup
2. **Async test timeout**: Increase timeout or fix async handling
3. **State bleeding between tests**: Ensure proper cleanup in `beforeEach`

### Debug Commands
```bash
# Run single test file
npm test -- --testPathPattern="intentService.test.ts"

# Run with verbose output
npm test -- --verbose

# Run in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Coverage Report

After running tests with coverage, open `./coverage/index.html` in your browser to view:

- Line-by-line coverage visualization
- Uncovered code paths
- Branch coverage details
- Function coverage statistics

## Future Test Enhancements

### Planned Additions
1. **End-to-End Tests** - Full user interaction flows
2. **Visual Regression Tests** - UI component testing
3. **Load Testing** - Performance under stress
4. **Property-Based Testing** - Generated test cases
5. **Mutation Testing** - Test effectiveness validation

### Test Metrics to Track
- Test execution time trends
- Coverage percentage over time
- Number of regression catches
- False positive/negative rates
