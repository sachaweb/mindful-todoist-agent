
import aiService from '../ai-service';
import { TodoistTask } from '../../types';

// Mock the dependencies
jest.mock('@/integrations/supabase/client');
jest.mock('../intentService');
jest.mock('../../utils/contentSanitizer');

import { intentService } from '../intentService';
import { contentSanitizer } from '../../utils/contentSanitizer';

describe('AiService Integration Tests', () => {
  const mockTasks: TodoistTask[] = [
    {
      id: '1',
      content: 'Existing task',
      priority: 2,
      due: null,
      labels: [],
      completed: false
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    (intentService.analyzeIntent as jest.Mock).mockResolvedValue({
      action: 'create',
      confidence: 0.9,
      entities: {
        taskContent: 'Buy groceries',
        dueDate: 'tomorrow',
        priority: 'high'
      },
      reasoning: 'Clear task creation intent'
    });

    (contentSanitizer.sanitizeForTodoist as jest.Mock).mockImplementation((data) => data);
  });

  describe('full user input flow', () => {
    it('should process high-confidence task creation intent', async () => {
      const result = await aiService.processMessage('Buy groceries tomorrow', mockTasks);

      expect(result.response).toContain('Buy groceries');
      expect(result.intent).toBeDefined();
      expect(result.requiresTaskAction).toBe(true);
      expect(intentService.analyzeIntent).toHaveBeenCalledWith(
        'Buy groceries tomorrow',
        expect.any(Array)
      );
    });

    it('should handle low-confidence intents with conversational fallback', async () => {
      (intentService.analyzeIntent as jest.Mock).mockResolvedValue({
        action: 'none',
        confidence: 0.3,
        entities: {},
        reasoning: 'Unclear intent'
      });

      const result = await aiService.processMessage('How are you?', mockTasks);

      expect(result.requiresTaskAction).toBe(false);
      expect(result.intent?.action).toBe('none');
    });

    it('should handle multiple task creation', async () => {
      (intentService.analyzeIntent as jest.Mock).mockResolvedValue({
        action: 'create_multiple',
        confidence: 0.95,
        tasks: [
          { content: 'Buy milk', priority: 'high' },
          { content: 'Buy bread', priority: 'medium' }
        ],
        reasoning: 'Multiple tasks identified'
      });

      const result = await aiService.processMessage('Buy milk and bread', mockTasks);

      expect(result.response).toContain('2 tasks');
      expect(result.requiresTaskAction).toBe(true);
      expect(result.intent?.action).toBe('create_multiple');
    });

    it('should handle intent analysis errors gracefully', async () => {
      (intentService.analyzeIntent as jest.Mock).mockRejectedValue(new Error('API Error'));

      const result = await aiService.processMessage('test message', mockTasks);

      expect(result.response).toContain('trouble processing');
      expect(result.requiresTaskAction).toBe(false);
    });
  });

  describe('processIntent', () => {
    it('should process single task creation intent', async () => {
      const intent = {
        action: 'create' as const,
        confidence: 0.9,
        entities: {
          taskContent: 'Test task',
          dueDate: 'tomorrow',
          priority: 'high' as const
        },
        reasoning: 'test'
      };

      (intentService.mapToTodoistFormat as jest.Mock).mockReturnValue({
        action: 'create',
        content: 'Test task',
        due_string: 'tomorrow',
        priority: 3
      });

      (contentSanitizer.sanitizeForTodoist as jest.Mock).mockReturnValue({
        content: 'Test task',
        due_string: 'tomorrow',
        priority: 3
      });

      const result = await aiService.processIntent(intent, mockTasks);

      expect(result).toEqual({
        action: 'create',
        content: 'Test task',
        due_string: 'tomorrow',
        priority: 3
      });

      expect(intentService.mapToTodoistFormat).toHaveBeenCalledWith(intent);
      expect(contentSanitizer.sanitizeForTodoist).toHaveBeenCalled();
    });

    it('should process multiple task creation intent', async () => {
      const intent = {
        action: 'create_multiple' as const,
        confidence: 0.9,
        tasks: [
          { content: 'Task 1' },
          { content: 'Task 2' }
        ],
        reasoning: 'test'
      };

      (intentService.mapToTodoistFormat as jest.Mock).mockReturnValue({
        action: 'create_multiple',
        tasks: [
          { content: 'Task 1' },
          { content: 'Task 2' }
        ]
      });

      (contentSanitizer.sanitizeForTodoist as jest.Mock)
        .mockReturnValueOnce({ content: 'Task 1' })
        .mockReturnValueOnce({ content: 'Task 2' });

      const result = await aiService.processIntent(intent, mockTasks);

      expect(result).toEqual({
        action: 'create_multiple',
        tasks: [
          { content: 'Task 1' },
          { content: 'Task 2' }
        ]
      });
    });
  });

  describe('context management', () => {
    it('should maintain conversation context across messages', async () => {
      // Send first message
      await aiService.processMessage('Hello', mockTasks);
      
      // Check context contains the message
      const context = aiService.getContext();
      expect(context.recentMessages).toHaveLength(2); // user + assistant
      expect(context.recentMessages[0].content).toBe('Hello');
      expect(context.recentMessages[0].role).toBe('user');
    });

    it('should update task context', async () => {
      await aiService.processMessage('List my tasks', mockTasks);
      
      const context = aiService.getContext();
      expect(context.openTasks).toEqual(mockTasks);
    });

    it('should limit context message history', async () => {
      // Send many messages to test limit
      for (let i = 0; i < 15; i++) {
        await aiService.processMessage(`Message ${i}`, mockTasks);
      }
      
      const context = aiService.getContext();
      expect(context.recentMessages.length).toBeLessThanOrEqual(10);
    });
  });

  describe('task analysis', () => {
    it('should analyze empty task list', () => {
      const suggestions = aiService.analyzeTasks([]);
      
      expect(suggestions).toContain("You don't have any open tasks. Would you like to create one?");
    });

    it('should identify urgent tasks', () => {
      const urgentTasks: TodoistTask[] = [
        {
          id: '1',
          content: 'Urgent task',
          priority: 4,
          due: null,
          labels: [],
          completed: false
        }
      ];

      const suggestions = aiService.analyzeTasks(urgentTasks);
      
      expect(suggestions.some(s => s.includes('high-priority'))).toBe(true);
    });

    it('should identify tasks due today', () => {
      const today = new Date().toISOString().split('T')[0];
      const dueTodayTasks: TodoistTask[] = [
        {
          id: '1',
          content: 'Due today task',
          priority: 2,
          due: { date: today, string: 'today' },
          labels: [],
          completed: false
        }
      ];

      const suggestions = aiService.analyzeTasks(dueTodayTasks);
      
      expect(suggestions.some(s => s.includes('due today'))).toBe(true);
    });

    it('should handle large task lists', () => {
      const manyTasks: TodoistTask[] = Array.from({ length: 15 }, (_, i) => ({
        id: `${i}`,
        content: `Task ${i}`,
        priority: 1,
        due: null,
        labels: [],
        completed: false
      }));

      const suggestions = aiService.analyzeTasks(manyTasks);
      
      expect(suggestions.some(s => s.includes('quite a few open tasks'))).toBe(true);
    });
  });
});
