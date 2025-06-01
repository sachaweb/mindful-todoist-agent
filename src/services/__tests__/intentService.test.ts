
import { intentService } from '../intentService';
import { mockClaudeResponses } from '../../test/mocks/mockResponses';

// Mock the supabase client
jest.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: jest.fn()
    }
  }
}));

import { supabase } from '@/integrations/supabase/client';

describe('IntentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeIntent', () => {
    it('should analyze task creation intent correctly', async () => {
      const mockResponse = {
        data: {
          success: true,
          response: JSON.stringify(mockClaudeResponses.intentResponses.createTask)
        },
        error: null
      };
      
      (supabase.functions.invoke as jest.Mock).mockResolvedValue(mockResponse);

      const result = await intentService.analyzeIntent('Buy groceries tomorrow');

      expect(result).toEqual({
        action: 'create',
        confidence: 0.95,
        entities: {
          taskContent: 'Buy groceries',
          dueDate: 'tomorrow',
          priority: 'medium',
          labels: ['shopping']
        },
        reasoning: 'Clear task creation intent with specific content and due date'
      });
    });

    it('should analyze multiple task creation intent', async () => {
      const mockResponse = {
        data: {
          success: true,
          response: JSON.stringify(mockClaudeResponses.intentResponses.createMultipleTasks)
        },
        error: null
      };
      
      (supabase.functions.invoke as jest.Mock).mockResolvedValue(mockResponse);

      const result = await intentService.analyzeIntent('Buy milk and bread today');

      expect(result).toEqual({
        action: 'create_multiple',
        confidence: 0.9,
        tasks: [
          {
            content: 'Buy milk',
            dueDate: 'today',
            priority: 'high'
          },
          {
            content: 'Buy bread',
            dueDate: 'today', 
            priority: 'medium'
          }
        ],
        reasoning: 'Multiple task creation identified from list format'
      });
    });

    it('should handle API errors gracefully', async () => {
      const mockResponse = {
        data: null,
        error: { message: 'API Error' }
      };
      
      (supabase.functions.invoke as jest.Mock).mockResolvedValue(mockResponse);

      const result = await intentService.analyzeIntent('test input');

      expect(result).toEqual({
        action: 'none',
        confidence: 0.1,
        entities: {},
        reasoning: 'Failed to analyze intent - using fallback'
      });
    });

    it('should handle invalid JSON responses', async () => {
      const mockResponse = {
        data: {
          success: true,
          response: 'invalid json'
        },
        error: null
      };
      
      (supabase.functions.invoke as jest.Mock).mockResolvedValue(mockResponse);

      const result = await intentService.analyzeIntent('test input');

      expect(result).toEqual({
        action: 'none',
        confidence: 0.1,
        entities: {},
        reasoning: 'Failed to analyze intent - using fallback'
      });
    });
  });

  describe('mapToTodoistFormat', () => {
    it('should map single task creation intent to Todoist format', () => {
      const intent = {
        action: 'create' as const,
        confidence: 0.9,
        entities: {
          taskContent: 'Buy groceries',
          dueDate: 'tomorrow',
          priority: 'high' as const,
          labels: ['shopping']
        },
        reasoning: 'test'
      };

      const result = intentService.mapToTodoistFormat(intent);

      expect(result).toEqual({
        action: 'create',
        content: 'Buy groceries',
        due_string: 'tomorrow',
        priority: 3, // high priority maps to 3
        labels: ['shopping']
      });
    });

    it('should map multiple task creation intent to Todoist format', () => {
      const intent = {
        action: 'create_multiple' as const,
        confidence: 0.9,
        tasks: [
          {
            content: 'Task 1',
            priority: 'urgent' as const
          },
          {
            content: 'Task 2',
            dueDate: 'today'
          }
        ],
        reasoning: 'test'
      };

      const result = intentService.mapToTodoistFormat(intent);

      expect(result).toEqual({
        action: 'create_multiple',
        tasks: [
          {
            content: 'Task 1',
            due_string: undefined,
            priority: 4, // urgent maps to 4
            labels: undefined
          },
          {
            content: 'Task 2',
            due_string: 'today',
            priority: undefined,
            labels: undefined
          }
        ]
      });
    });

    it('should handle priority mapping correctly', () => {
      const priorities = [
        { input: 'urgent', expected: 4 },
        { input: 'high', expected: 3 },
        { input: 'medium', expected: 2 },
        { input: 'low', expected: 1 },
        { input: undefined, expected: undefined }
      ];

      priorities.forEach(({ input, expected }) => {
        const intent = {
          action: 'create' as const,
          confidence: 0.9,
          entities: {
            taskContent: 'Test task',
            priority: input as any
          },
          reasoning: 'test'
        };

        const result = intentService.mapToTodoistFormat(intent);
        expect(result.priority).toBe(expected);
      });
    });
  });
});
