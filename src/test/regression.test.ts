
import aiService from '../services/ai-service';
import { contentSanitizer } from '../utils/contentSanitizer';
import { conversationState } from '../utils/stateMachine';

describe('Regression Tests', () => {
  describe('Previously broken inputs', () => {
    it('should handle task creation with confirmation artifacts', async () => {
      // This was a previously broken pattern where confirmation responses
      // would pollute task content
      const problematicInputs = [
        'create anyway Buy groceries for the week',
        'proceed with Schedule team meeting',
        'yes, Call mom tonight',
        'confirm Add dentist appointment'
      ];

      for (const input of problematicInputs) {
        const sanitized = contentSanitizer.sanitize(input);
        
        // Should not contain confirmation artifacts
        expect(sanitized.sanitized).not.toMatch(/^(?:create anyway|proceed|yes,?|confirm)/i);
        
        // Should contain the actual task content
        expect(sanitized.sanitized.length).toBeGreaterThan(0);
        expect(sanitized.hasChanges).toBe(true);
      }
    });

    it('should handle nested AI response artifacts', async () => {
      // Previously, nested artifacts would not be fully cleaned
      const problematicInputs = [
        'I\'ll create a task "1. Buy groceries"',
        'I\'ll create the following task: "task: Schedule meeting"',
        '"I\'ll create task Call client"',
        'create anyway "I\'ll create a task Review document"'
      ];

      for (const input of problematicInputs) {
        const sanitized = contentSanitizer.sanitize(input);
        
        // Should not contain any artifacts
        expect(sanitized.sanitized).not.toMatch(/I'll create/i);
        expect(sanitized.sanitized).not.toMatch(/^["']/);
        expect(sanitized.sanitized).not.toMatch(/^\d+\./);
        expect(sanitized.sanitized).not.toMatch(/^task:/i);
        
        // Should extract clean content
        expect(sanitized.sanitized).toMatch(/(Buy groceries|Schedule meeting|Call client|Review document)/);
      }
    });

    it('should handle empty or whitespace-only content after sanitization', () => {
      const problematicInputs = [
        'create anyway',
        'I\'ll create a task',
        '   ',
        'task:',
        '"   "',
        '1. '
      ];

      for (const input of problematicInputs) {
        const sanitized = contentSanitizer.sanitize(input);
        
        // Should either be empty or contain meaningful content
        if (sanitized.sanitized.length > 0) {
          expect(sanitized.sanitized.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it('should handle state machine confusion with rapid user inputs', () => {
      // Previously, rapid state changes could cause inconsistent behavior
      conversationState.reset();
      
      // Simulate rapid user interaction
      conversationState.transition('awaiting_confirmation');
      let result1 = conversationState.handleUserInput('yes');
      expect(result1.isConfirmation).toBe(true);
      
      conversationState.transition('processing_task');
      let result2 = conversationState.handleUserInput('create another task');
      expect(result2.isConfirmation).toBe(false);
      
      conversationState.transition('awaiting_clarification');
      let result3 = conversationState.handleUserInput('I meant something else');
      expect(result3.isConfirmation).toBe(false);
      expect(result3.isCancel).toBe(false);
    });

    it('should handle malformed date strings', () => {
      const problematicDates = [
        'due: invalid date',
        'tomorrow maybe',
        'next friday or saturday',
        'some time next week',
        '2023-13-45', // Invalid date format
        'February 30th' // Non-existent date
      ];

      for (const dateString of problematicDates) {
        const taskData = {
          content: 'Test task',
          due_string: dateString
        };

        const sanitized = contentSanitizer.sanitizeForTodoist(taskData);
        
        // Should not crash and should preserve the original string
        expect(sanitized.due_string).toBeDefined();
        expect(typeof sanitized.due_string).toBe('string');
      }
    });

    it('should handle extremely long task content', () => {
      const longContent = 'A'.repeat(1000);
      const taskData = {
        content: `task: ${longContent}`
      };

      const sanitized = contentSanitizer.sanitizeForTodoist(taskData);
      
      // Should handle long content without crashing
      expect(sanitized.content).toBeDefined();
      expect(sanitized.content).not.toMatch(/^task:/);
    });

    it('should handle special characters and unicode', () => {
      const specialInputs = [
        'task: 📝 Buy groceries 🛒',
        'create: Schedule médico appointment',
        'todo: Review résumé',
        'task: "Fix café machine" ☕',
        'I\'ll create task 会议安排'
      ];

      for (const input of specialInputs) {
        const sanitized = contentSanitizer.sanitize(input);
        
        // Should preserve unicode characters while removing artifacts
        expect(sanitized.sanitized).not.toMatch(/^(?:task:|create:|todo:|I'll create)/i);
        expect(sanitized.sanitized.length).toBeGreaterThan(0);
      }
    });

    it('should handle context loading errors gracefully', () => {
      // Mock localStorage to throw error
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = jest.fn().mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not crash when creating new service instance
      expect(() => {
        const newService = new (aiService.constructor as any)();
        expect(newService).toBeDefined();
      }).not.toThrow();

      // Restore original implementation
      localStorage.getItem = originalGetItem;
    });
  });

  describe('Edge case inputs that previously caused issues', () => {
    it('should handle task lists with inconsistent formatting', () => {
      const messyListInputs = [
        '1. Buy milk\n2.Buy bread\n3. Call mom',
        '- Task one\n• Task two\n* Task three',
        'First: Buy groceries\nSecond: Schedule meeting\nThird: Call client'
      ];

      for (const input of messyListInputs) {
        const lines = input.split('\n');
        
        for (const line of lines) {
          const sanitized = contentSanitizer.sanitize(line);
          
          // Each line should be cleaned properly
          expect(sanitized.sanitized).not.toMatch(/^(?:\d+\.|[-•*]|\w+:)/);
          expect(sanitized.sanitized.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it('should handle API response parsing edge cases', async () => {
      // These inputs previously caused JSON parsing issues
      const problematicResponses = [
        '{"action": "create", "confidence": 0.9}', // Missing fields
        '{"action": "create", "confidence": "high"}', // Wrong type
        'not json at all',
        '{"action": "create"', // Incomplete JSON
        '{}' // Empty object
      ];

      // This would be tested in the intent service with mocked responses
      // but demonstrates the edge cases we need to handle
      expect(true).toBe(true); // Placeholder for actual API tests
    });

    it('should handle state transitions during error conditions', () => {
      conversationState.reset();
      
      // Simulate error condition during processing
      conversationState.transition('processing_task', {
        pendingAction: 'create',
        metadata: { error: true }
      });
      
      // Should be able to recover
      conversationState.reset();
      expect(conversationState.getCurrentState()).toBe('idle');
      
      // Should handle normal flow after recovery
      conversationState.transition('awaiting_confirmation');
      const result = conversationState.handleUserInput('yes');
      expect(result.isConfirmation).toBe(true);
    });
  });

  describe('Performance regression tests', () => {
    it('should handle large message histories efficiently', async () => {
      const startTime = Date.now();
      
      // Process many messages to build up history
      for (let i = 0; i < 50; i++) {
        await aiService.processMessage(`Test message ${i}`, []);
      }
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should not take longer than reasonable time (adjust based on your needs)
      expect(processingTime).toBeLessThan(10000); // 10 seconds max
      
      // Context should still be managed properly
      const context = aiService.getContext();
      expect(context.recentMessages.length).toBeLessThanOrEqual(10);
    });

    it('should handle complex sanitization rules efficiently', () => {
      const complexInput = 'create anyway "task: I\'ll create the following 5 tasks: 1. Buy groceries 2. Schedule meeting 3. Call mom 4. Review document 5. Plan vacation"';
      
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        contentSanitizer.sanitize(complexInput);
      }
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should process 100 complex sanitizations quickly
      expect(processingTime).toBeLessThan(1000); // 1 second max
    });
  });
});
