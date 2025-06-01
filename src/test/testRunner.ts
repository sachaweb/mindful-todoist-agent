
import { execSync } from 'child_process';

export class TestRunner {
  static async runAllTests(): Promise<void> {
    console.log('🧪 Running comprehensive test suite...\n');
    
    try {
      // Run unit tests
      console.log('📋 Running unit tests...');
      execSync('npm test -- --testPathPattern="__tests__" --coverage=false', { stdio: 'inherit' });
      
      // Run integration tests
      console.log('\n🔗 Running integration tests...');
      execSync('npm test -- --testPathPattern="integration.test" --coverage=false', { stdio: 'inherit' });
      
      // Run regression tests
      console.log('\n🐛 Running regression tests...');
      execSync('npm test -- --testPathPattern="regression.test" --coverage=false', { stdio: 'inherit' });
      
      // Generate coverage report
      console.log('\n📊 Generating coverage report...');
      execSync('npm test -- --coverage --coverageReporters=text-summary --coverageReporters=html', { stdio: 'inherit' });
      
      console.log('\n✅ All tests completed successfully!');
      console.log('📈 Coverage report generated in ./coverage/index.html');
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    }
  }
  
  static async runUnitTests(): Promise<void> {
    console.log('🧪 Running unit tests only...\n');
    
    try {
      execSync('npm test -- --testPathPattern="__tests__" --coverage', { stdio: 'inherit' });
      console.log('\n✅ Unit tests completed successfully!');
    } catch (error) {
      console.error('\n❌ Unit tests failed:', error);
      process.exit(1);
    }
  }
  
  static async runIntegrationTests(): Promise<void> {
    console.log('🔗 Running integration tests only...\n');
    
    try {
      execSync('npm test -- --testPathPattern="integration.test"', { stdio: 'inherit' });
      console.log('\n✅ Integration tests completed successfully!');
    } catch (error) {
      console.error('\n❌ Integration tests failed:', error);
      process.exit(1);
    }
  }
  
  static async runRegressionTests(): Promise<void> {
    console.log('🐛 Running regression tests only...\n');
    
    try {
      execSync('npm test -- --testPathPattern="regression.test"', { stdio: 'inherit' });
      console.log('\n✅ Regression tests completed successfully!');
    } catch (error) {
      console.error('\n❌ Regression tests failed:', error);
      process.exit(1);
    }
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'unit':
      TestRunner.runUnitTests();
      break;
    case 'integration':
      TestRunner.runIntegrationTests();
      break;
    case 'regression':
      TestRunner.runRegressionTests();
      break;
    case 'all':
    default:
      TestRunner.runAllTests();
      break;
  }
}
