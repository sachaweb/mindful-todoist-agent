
# Package.json Scripts to Add

Add these scripts to your package.json file:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch", 
    "test:coverage": "jest --coverage",
    "test:unit": "jest --testPathPattern=\"__tests__\"",
    "test:integration": "jest --testPathPattern=\"integration.test\"",
    "test:regression": "jest --testPathPattern=\"regression.test\"",
    "test:all": "ts-node src/test/testRunner.ts all"
  }
}
```

## Setup Instructions

1. **Install Dependencies**: All testing dependencies have been added automatically
2. **Add Scripts**: Copy the scripts above to your package.json
3. **Run Tests**: Use `npm test` to run all tests or specific commands for targeted testing

## Quick Start

```bash
# Run all tests with coverage
npm run test:coverage

# Run only unit tests during development
npm run test:unit

# Watch mode for continuous testing
npm run test:watch
```

The coverage report will be generated in `./coverage/index.html` and can be opened in your browser.
