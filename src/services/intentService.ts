
import { supabase } from "@/integrations/supabase/client";
import { logger } from "../utils/logger";

export interface TaskIntent {
  action: 'create' | 'update' | 'complete' | 'list' | 'none';
  confidence: number;
  entities: {
    taskContent?: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    labels?: string[];
    taskId?: string;
    updateField?: string;
    updateValue?: string;
  };
  reasoning: string;
}

export interface MultiTaskIntent {
  action: 'create_multiple';
  confidence: number;
  tasks: Array<{
    content: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    labels?: string[];
  }>;
  reasoning: string;
}

export type IntentResult = TaskIntent | MultiTaskIntent;

class IntentService {
  private readonly CONFIDENCE_THRESHOLD = 0.7;

  async analyzeIntent(userInput: string, context?: string[]): Promise<IntentResult> {
    logger.info('INTENT_SERVICE', 'Analyzing user intent', { userInput, contextLength: context?.length });

    try {
      const systemPrompt = this.buildIntentPrompt();
      const conversationHistory = context ? this.buildContextHistory(context) : [];

      const { data, error } = await supabase.functions.invoke('claude-proxy', {
        body: {
          message: userInput,
          systemPrompt,
          conversationHistory,
          tasks: [] // No tasks needed for intent analysis
        }
      });

      if (error) {
        logger.error('INTENT_SERVICE', 'Edge Function error', error);
        return this.createFallbackIntent(userInput);
      }

      if (!data.success) {
        logger.error('INTENT_SERVICE', 'Claude proxy error', data.error);
        return this.createFallbackIntent(userInput);
      }

      // Parse Claude's structured response
      const intent = this.parseClaudeResponse(data.response);
      logger.info('INTENT_SERVICE', 'Intent analyzed successfully', intent);

      return intent;
    } catch (error) {
      logger.error('INTENT_SERVICE', 'Error analyzing intent', error);
      return this.createFallbackIntent(userInput);
    }
  }

  private buildIntentPrompt(): string {
    return `You are an intent recognition system for a Todoist task management application. 
Analyze user input and return ONLY a valid JSON object with the user's intent.

IMPORTANT: Your response must be ONLY valid JSON - no explanations, no markdown, no additional text.

For single task creation, return:
{
  "action": "create",
  "confidence": 0.0-1.0,
  "entities": {
    "taskContent": "cleaned task description",
    "dueDate": "due date string or null",
    "priority": "low|medium|high|urgent or null",
    "labels": ["label1", "label2"] or null
  },
  "reasoning": "brief explanation"
}

For multiple task creation, return:
{
  "action": "create_multiple", 
  "confidence": 0.0-1.0,
  "tasks": [
    {
      "content": "task 1",
      "dueDate": "date or null",
      "priority": "priority or null", 
      "labels": ["labels"] or null
    }
  ],
  "reasoning": "brief explanation"
}

For task updates, return:
{
  "action": "update",
  "confidence": 0.0-1.0,
  "entities": {
    "taskId": "task identifier or null",
    "updateField": "due_date|content|priority|labels",
    "updateValue": "new value"
  },
  "reasoning": "brief explanation"
}

For task completion, return:
{
  "action": "complete",
  "confidence": 0.0-1.0, 
  "entities": {
    "taskContent": "task to complete"
  },
  "reasoning": "brief explanation"
}

For listing/querying tasks, return:
{
  "action": "list",
  "confidence": 0.0-1.0,
  "entities": {},
  "reasoning": "brief explanation"
}

For non-task input (general questions, confirmations, etc.), return:
{
  "action": "none",
  "confidence": 0.0-1.0,
  "entities": {},
  "reasoning": "brief explanation"
}

EXTRACTION RULES:
- Remove any prefixes like "task:", "create:", "Title:", etc.
- Extract clean task content without formatting artifacts
- Parse natural language dates (tomorrow, next friday, etc.)
- Map priority keywords: urgent/critical/asap -> "urgent", important/high -> "high", normal/medium -> "medium", low -> "low"
- Extract labels from "with labels X, Y" or similar patterns
- Set confidence based on clarity of intent (clear commands = 0.9+, ambiguous = 0.5-0.7)`;
  }

  private buildContextHistory(context: string[]): Array<{ role: string; content: string }> {
    return context.slice(-3).map((msg, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: msg
    }));
  }

  private parseClaudeResponse(response: string): IntentResult {
    try {
      // Clean the response to ensure it's valid JSON
      let cleanResponse = response.trim();
      
      // Remove any markdown formatting
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(cleanResponse);
      
      // Validate the structure
      if (!parsed.action || typeof parsed.confidence !== 'number') {
        throw new Error('Invalid intent structure');
      }

      return parsed as IntentResult;
    } catch (error) {
      logger.error('INTENT_SERVICE', 'Failed to parse Claude response', { response, error });
      throw error;
    }
  }

  private createFallbackIntent(userInput: string): IntentResult {
    logger.warn('INTENT_SERVICE', 'Creating fallback intent for input', { userInput });
    
    return {
      action: 'none',
      confidence: 0.1,
      entities: {},
      reasoning: 'Failed to analyze intent - using fallback'
    };
  }

  public mapToTodoistFormat(intent: TaskIntent | MultiTaskIntent): any {
    logger.debug('INTENT_SERVICE', 'Mapping intent to Todoist format', intent);

    if (intent.action === 'create_multiple') {
      return {
        action: 'create_multiple',
        tasks: intent.tasks.map(task => ({
          content: task.content,
          due_string: task.dueDate || undefined,
          priority: this.mapPriorityToTodoist(task.priority),
          labels: task.labels || undefined
        }))
      };
    }

    if (intent.action === 'create') {
      return {
        action: 'create',
        content: intent.entities.taskContent,
        due_string: intent.entities.dueDate || undefined,
        priority: this.mapPriorityToTodoist(intent.entities.priority),
        labels: intent.entities.labels || undefined
      };
    }

    if (intent.action === 'update') {
      return {
        action: 'update',
        taskId: intent.entities.taskId,
        field: intent.entities.updateField,
        value: intent.entities.updateValue
      };
    }

    return {
      action: intent.action,
      ...intent.entities
    };
  }

  private mapPriorityToTodoist(priority?: string): number | undefined {
    if (!priority) return undefined;
    
    switch (priority.toLowerCase()) {
      case 'urgent': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return undefined;
    }
  }
}

export const intentService = new IntentService();
