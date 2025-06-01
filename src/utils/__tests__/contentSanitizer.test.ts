
import { contentSanitizer } from '../contentSanitizer';

describe('ContentSanitizer', () => {
  describe('sanitize', () => {
    it('should remove task prefixes', () => {
      const testCases = [
        'task: Buy groceries',
        'create: New project',
        'title: Important meeting',
        'todo: Call mom'
      ];

      testCases.forEach(input => {
        const result = contentSanitizer.sanitize(input);
        expect(result.sanitized).not.toMatch(/^(?:task:|create:|title:|todo:)/i);
        expect(result.hasChanges).toBe(true);
        expect(result.rulesApplied).toContain('remove_task_prefix');
      });
    });

    it('should remove confirmation artifacts', () => {
      const testCases = [
        'create anyway Buy groceries',
        'proceed with scheduling meeting',
        'confirm Add to calendar',
        'yes, buy milk'
      ];

      testCases.forEach(input => {
        const result = contentSanitizer.sanitize(input);
        expect(result.sanitized).not.toMatch(/^(?:create anyway|proceed|confirm|yes,?\s*)/i);
        expect(result.hasChanges).toBe(true);
      });
    });

    it('should remove list markers', () => {
      const testCases = [
        '1. First task',
        '2. Second task',
        '- Bullet point task',
        '* Another bullet',
        '• Unicode bullet'
      ];

      testCases.forEach(input => {
        const result = contentSanitizer.sanitize(input);
        expect(result.sanitized).not.toMatch(/^(?:\d+\.\s*|[-*•]\s*)/);
        expect(result.hasChanges).toBe(true);
        expect(result.rulesApplied).toContain('remove_list_markers');
      });
    });

    it('should remove quote wrapping', () => {
      const testCases = [
        '"Buy groceries"',
        "'Schedule meeting'",
        '"Call client"'
      ];

      testCases.forEach(input => {
        const result = contentSanitizer.sanitize(input);
        expect(result.sanitized).not.toMatch(/^["'].*["']$/);
        expect(result.hasChanges).toBe(true);
        expect(result.rulesApplied).toContain('remove_quote_wrapping');
      });
    });

    it('should normalize whitespace', () => {
      const input = 'Task   with    multiple     spaces';
      const result = contentSanitizer.sanitize(input);
      
      expect(result.sanitized).toBe('Task with multiple spaces');
      expect(result.hasChanges).toBe(true);
      expect(result.rulesApplied).toContain('normalize_whitespace');
    });

    it('should remove AI response artifacts', () => {
      const testCases = [
        "I'll create a task Buy groceries",
        'I\'ll create task "Schedule meeting"',
        "I'll create the following 3 tasks:",
        "I'll create the following task:"
      ];

      testCases.forEach(input => {
        const result = contentSanitizer.sanitize(input);
        expect(result.sanitized).not.toMatch(/^(?:I'll create)/i);
        expect(result.hasChanges).toBe(true);
      });
    });

    it('should handle complex nested artifacts', () => {
      const input = 'create anyway "1. I\'ll create a task Buy groceries tomorrow"';
      const result = contentSanitizer.sanitize(input);
      
      expect(result.sanitized).toBe('Buy groceries tomorrow');
      expect(result.hasChanges).toBe(true);
      expect(result.rulesApplied.length).toBeGreaterThan(1);
    });

    it('should handle empty or invalid input', () => {
      const testCases = ['', null, undefined, '   '];

      testCases.forEach(input => {
        const result = contentSanitizer.sanitize(input as any);
        expect(result.hasChanges).toBe(false);
        expect(result.rulesApplied).toEqual([]);
      });
    });

    it('should apply only specified rules when provided', () => {
      const input = 'task: "Buy groceries"';
      const result = contentSanitizer.sanitize(input, ['remove_quote_wrapping']);
      
      // Should only remove quotes, not the task prefix
      expect(result.sanitized).toBe('task: Buy groceries');
      expect(result.rulesApplied).toEqual(['remove_quote_wrapping']);
    });
  });

  describe('sanitizeForTodoist', () => {
    it('should sanitize task content and preserve other fields', () => {
      const input = {
        content: 'task: "Buy groceries"',
        due_string: 'tomorrow',
        labels: ['"shopping"', 'urgent']
      };

      const result = contentSanitizer.sanitizeForTodoist(input);

      expect(result.content).toBe('Buy groceries');
      expect(result.due_string).toBe('tomorrow');
      expect(result.labels).toEqual(['shopping', 'urgent']);
    });

    it('should handle missing fields gracefully', () => {
      const input = {
        content: 'task: Clean room'
      };

      const result = contentSanitizer.sanitizeForTodoist(input);

      expect(result.content).toBe('Clean room');
      expect(result.due_string).toBeUndefined();
      expect(result.labels).toBeUndefined();
    });

    it('should filter out empty labels', () => {
      const input = {
        content: 'Test task',
        labels: ['valid', '', '   ', 'another']
      };

      const result = contentSanitizer.sanitizeForTodoist(input);

      expect(result.labels).toEqual(['valid', 'another']);
    });
  });

  describe('rule management', () => {
    it('should add new rules', () => {
      const newRule = {
        name: 'test_rule',
        pattern: /test/g,
        replacement: 'TEST',
        description: 'Test rule',
        enabled: true
      };

      contentSanitizer.addRule(newRule);
      const rules = contentSanitizer.getRules();
      
      expect(rules.find(r => r.name === 'test_rule')).toEqual(newRule);
    });

    it('should toggle rules on/off', () => {
      const result = contentSanitizer.toggleRule('remove_task_prefix', false);
      
      expect(result).toBe(true);
      
      const input = 'task: Test content';
      const sanitized = contentSanitizer.sanitize(input);
      
      // Should not apply the disabled rule
      expect(sanitized.rulesApplied).not.toContain('remove_task_prefix');
      
      // Re-enable for other tests
      contentSanitizer.toggleRule('remove_task_prefix', true);
    });
  });
});
