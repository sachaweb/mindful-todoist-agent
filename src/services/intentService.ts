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
    logger.info('INTENT_SERVICE', 'Starting intent analysis', { 
      userInput, 
      userInputLength: userInput.length,
      contextLength: context?.length,
      timestamp: new Date().toISOString()
    });

    // ENHANCED: Add immediate pattern-based fallback analysis
    const fallbackIntent = this.analyzeIntentLocally(userInput);
    logger.info('INTENT_SERVICE', 'Local pattern analysis result', {
      userInput,
      fallbackAction: fallbackIntent.action,
      fallbackConfidence: fallbackIntent.confidence,
      fallbackEntities: fallbackIntent.action === 'create' && 'entities' in fallbackIntent ? fallbackIntent.entities : null
    });

    try {
      const systemPrompt = this.buildIntentPrompt();
      const conversationHistory = context ? this.buildContextHistory(context) : [];

      logger.debug('INTENT_SERVICE', 'Prepared Claude request data', {
        systemPromptLength: systemPrompt.length,
        conversationHistoryLength: conversationHistory.length,
        hasContext: !!context
      });

      const { data, error } = await supabase.functions.invoke('claude-proxy', {
        body: {
          message: userInput,
          systemPrompt,
          conversationHistory,
          tasks: [] // No tasks needed for intent analysis
        }
      });

      if (error) {
        logger.error('INTENT_SERVICE', 'Edge Function error in analyzeIntent', {
          error: error.message,
          stack: error.stack,
          code: error.code,
          userInput
        });
        logger.info('INTENT_SERVICE', 'Using local pattern analysis as fallback due to Edge Function error', {
          fallbackIntent
        });
        return fallbackIntent;
      }

      if (!data.success) {
        logger.error('INTENT_SERVICE', 'Claude proxy error in analyzeIntent', {
          claudeError: data.error,
          userInput,
          fullResponse: data
        });
        logger.info('INTENT_SERVICE', 'Using local pattern analysis as fallback due to Claude error', {
          fallbackIntent
        });
        return fallbackIntent;
      }

      logger.debug('INTENT_SERVICE', 'Raw Claude response', {
        response: data.response,
        responseLength: data.response?.length,
        responseType: typeof data.response
      });

      // Parse Claude's structured response
      const intent = this.parseClaudeResponse(data.response);
      
      logger.info('INTENT_SERVICE', 'Intent analysis completed successfully', {
        intent,
        action: intent.action,
        confidence: intent.confidence,
        extractedEntities: intent.action === 'create' && 'entities' in intent ? intent.entities : 
                          intent.action === 'create_multiple' ? { taskCount: intent.tasks.length } : {}
      });

      return intent;
    } catch (error) {
      logger.error('INTENT_SERVICE', 'Exception in analyzeIntent', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        userInput
      });
      logger.info('INTENT_SERVICE', 'Using local pattern analysis as fallback due to exception', {
        fallbackIntent
      });
      return fallbackIntent;
    }
  }

  // NEW: Local pattern-based intent analysis as fallback
  private analyzeIntentLocally(userInput: string): IntentResult {
    logger.info('INTENT_SERVICE', 'Starting local pattern analysis', { userInput });
    
    const lowerInput = userInput.toLowerCase().trim();
    
    // Enhanced task creation patterns
    const createPatterns = [
      /^(?:create|add|new|make)\s+(?:a\s+)?(?:new\s+)?(?:task|todo)?\s*:?\s*(.+)/i,
      /^(?:task|todo)\s*:?\s*(.+)/i,
      /^(.+)\s+(?:urgent|high|medium|low|p1|p2|p3|p4)$/i,
      /^(.+)\s+(?:due|on)\s+(.+)/i
    ];

    let isTaskCreation = false;
    let taskContent = '';
    let confidence = 0.1;

    // Check for task creation patterns
    for (const pattern of createPatterns) {
      const match = userInput.match(pattern);
      if (match) {
        isTaskCreation = true;
        taskContent = match[1]?.trim() || '';
        confidence = 0.8;
        logger.info('INTENT_SERVICE', 'Local pattern match found', {
          pattern: pattern.toString(),
          match: match[0],
          extractedContent: taskContent
        });
        break;
      }
    }

    if (!isTaskCreation) {
      logger.info('INTENT_SERVICE', 'No task creation patterns matched locally');
      return {
        action: 'none',
        confidence: 0.1,
        entities: {},
        reasoning: 'No task creation patterns detected in local analysis'
      };
    }

    // Extract priority
    let priority: 'low' | 'medium' | 'high' | 'urgent' | undefined;
    const priorityPatterns = [
      { pattern: /\b(?:urgent|critical|emergency|asap|p1)\b/i, priority: 'urgent' as const },
      { pattern: /\b(?:high|important|p2)\b/i, priority: 'high' as const },
      { pattern: /\b(?:medium|normal|p3)\b/i, priority: 'medium' as const },
      { pattern: /\b(?:low|p4)\b/i, priority: 'low' as const }
    ];

    for (const { pattern, priority: priorityValue } of priorityPatterns) {
      if (pattern.test(userInput)) {
        priority = priorityValue;
        taskContent = taskContent.replace(pattern, '').trim();
        logger.info('INTENT_SERVICE', 'Priority extracted locally', {
          priority: priorityValue,
          pattern: pattern.toString(),
          cleanedContent: taskContent
        });
        break;
      }
    }

    // Extract due date
    let dueDate: string | undefined;
    const dueDatePatterns = [
      /\b(?:on|due)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      /\b(?:on|due)\s+(tomorrow|today|next\s+week)\b/i,
      /\b(?:on|due)\s+(.+?)(?:\s+urgent|\s+high|\s+medium|\s+low|$)/i
    ];

    for (const pattern of dueDatePatterns) {
      const match = userInput.match(pattern);
      if (match) {
        dueDate = match[1]?.trim();
        taskContent = taskContent.replace(match[0], '').trim();
        logger.info('INTENT_SERVICE', 'Due date extracted locally', {
          dueDate,
          pattern: pattern.toString(),
          cleanedContent: taskContent
        });
        break;
      }
    }

    // Clean up task content
    taskContent = taskContent
      .replace(/^(?:create|add|new|make|task|todo)\s*:?\s*/i, '')
      .replace(/\s+(?:urgent|high|medium|low|p[1-4])$/i, '')
      .trim();

    const result: IntentResult = {
      action: 'create',
      confidence,
      entities: {
        taskContent,
        dueDate,
        priority
      },
      reasoning: 'Local pattern-based analysis detected task creation intent'
    };

    logger.info('INTENT_SERVICE', 'Local pattern analysis completed', {
      result,
      extractedTaskContent: taskContent,
      extractedDueDate: dueDate,
      extractedPriority: priority,
      finalConfidence: confidence
    });

    return result;
  }

  private buildIntentPrompt(): string {
    return `You are an intent recognition system for a Todoist task management application. 
Analyze user input and return ONLY a valid JSON object with the user's intent.

IMPORTANT: Your response must be ONLY valid JSON - no explanations, no markdown, no additional text.

PRIORITY MAPPING RULES:
- Extract priority from keywords: urgent/critical/asap/emergency/p1 -> "urgent"
- high/important/p2 -> "high" 
- medium/normal/p3 -> "medium"
- low/p4 -> "low"
- If no priority specified, leave as null

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
- Extract labels from @label format or "with labels X, Y" patterns
- Set confidence based on clarity of intent (clear commands = 0.9+, ambiguous = 0.5-0.7)
- ALWAYS extract priority if any priority keywords are present in the input`;
  }

  private buildContextHistory(context: string[]): Array<{ role: string; content: string }> {
    return context.slice(-3).map((msg, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: msg
    }));
  }

  private parseClaudeResponse(response: string): IntentResult {
    try {
      logger.debug('INTENT_SERVICE', 'Parsing Claude response', {
        responseLength: response.length,
        responsePreview: response.substring(0, 200)
      });

      // Clean the response to ensure it's valid JSON
      let cleanResponse = response.trim();
      
      // Remove any markdown formatting
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        logger.debug('INTENT_SERVICE', 'Removed markdown formatting from response');
      }

      const parsed = JSON.parse(cleanResponse);
      
      // Validate the structure
      if (!parsed.action || typeof parsed.confidence !== 'number') {
        throw new Error('Invalid intent structure');
      }

      // Log extracted entities with detailed info
      if (parsed.action === 'create' && parsed.entities) {
        logger.info('INTENT_SERVICE', 'EXTRACTED ENTITIES FROM INTENT', {
          taskContent: parsed.entities.taskContent,
          dueDate: parsed.entities.dueDate,
          priority: parsed.entities.priority,
          labels: parsed.entities.labels,
          confidence: parsed.confidence,
          reasoning: parsed.reasoning
        });
      }

      if (parsed.action === 'create_multiple' && parsed.tasks) {
        logger.info('INTENT_SERVICE', 'EXTRACTED MULTIPLE TASKS FROM INTENT', {
          taskCount: parsed.tasks.length,
          tasks: parsed.tasks.map((task: any, index: number) => ({
            index,
            content: task.content,
            dueDate: task.dueDate,
            priority: task.priority,
            labels: task.labels
          })),
          confidence: parsed.confidence
        });
      }

      return parsed as IntentResult;
    } catch (error) {
      logger.error('INTENT_SERVICE', 'Failed to parse Claude response', { 
        response, 
        error: error instanceof Error ? error.message : error,
        responseLength: response.length
      });
      throw error;
    }
  }

  private createFallbackIntent(userInput: string): IntentResult {
    logger.warn('INTENT_SERVICE', 'Creating fallback intent due to analysis failure', { userInput });
    
    return {
      action: 'none',
      confidence: 0.1,
      entities: {},
      reasoning: 'Failed to analyze intent - using fallback'
    };
  }

  public mapToTodoistFormat(intent: TaskIntent | MultiTaskIntent): any {
    logger.info('INTENT_SERVICE', 'Starting mapToTodoistFormat', {
      action: intent.action,
      confidence: intent.confidence
    });

    if (intent.action === 'create_multiple') {
      logger.debug('INTENT_SERVICE', 'Processing multiple tasks for mapping', {
        taskCount: intent.tasks.length
      });

      const mappedTasks = intent.tasks.map((task, index) => {
        const priorityValue = this.mapPriorityToTodoist(task.priority);
        
        logger.info('INTENT_SERVICE', `Mapping task ${index + 1} priority`, { 
          taskIndex: index,
          originalPriority: task.priority, 
          mappedPriority: priorityValue,
          taskContent: task.content,
          dueDate: task.dueDate,
          labels: task.labels
        });
        
        const mappedTask: any = {
          content: task.content
        };

        // Add optional fields only if they have values
        if (task.dueDate) {
          mappedTask.due_string = task.dueDate;
        }
        
        if (task.labels && task.labels.length > 0) {
          mappedTask.labels = task.labels;
        }

        // Add priority if it's a valid number
        if (typeof priorityValue === 'number') {
          mappedTask.priority = priorityValue;
          logger.debug('INTENT_SERVICE', `Priority ${priorityValue} added to task ${index + 1}`);
        }

        return mappedTask;
      });

      const result = {
        action: 'create_multiple',
        tasks: mappedTasks
      };

      logger.info('INTENT_SERVICE', 'Multiple tasks mapped successfully', {
        resultTaskCount: mappedTasks.length,
        mappedTasks: mappedTasks.map((task, index) => ({
          index,
          hasPriority: 'priority' in task,
          priority: task.priority,
          content: task.content
        }))
      });

      return result;
    }

    if (intent.action === 'create') {
      const priorityValue = this.mapPriorityToTodoist(intent.entities.priority);
      
      logger.info('INTENT_SERVICE', 'MAPPING SINGLE TASK TO TODOIST FORMAT', { 
        originalPriority: intent.entities.priority, 
        mappedPriority: priorityValue,
        taskContent: intent.entities.taskContent,
        dueDate: intent.entities.dueDate,
        labels: intent.entities.labels,
        priorityType: typeof priorityValue
      });

      const mappedTask: any = {
        action: 'create',
        content: intent.entities.taskContent
      };

      // Add optional fields only if they have values
      if (intent.entities.dueDate) {
        mappedTask.due_string = intent.entities.dueDate;
      }
      
      if (intent.entities.labels && intent.entities.labels.length > 0) {
        mappedTask.labels = intent.entities.labels;
      }

      // CRITICAL FIX: Always add priority if it's a valid number (including 1)
      if (typeof priorityValue === 'number') {
        mappedTask.priority = priorityValue;
        logger.info('INTENT_SERVICE', 'PRIORITY SUCCESSFULLY MAPPED AND ADDED', { 
          priority: priorityValue,
          taskContent: intent.entities.taskContent,
          finalMappedTask: mappedTask
        });
      } else {
        logger.warn('INTENT_SERVICE', 'PRIORITY NOT ADDED - INVALID VALUE', { 
          priorityValue,
          priorityType: typeof priorityValue,
          originalPriority: intent.entities.priority,
          taskContent: intent.entities.taskContent
        });
      }

      logger.info('INTENT_SERVICE', 'FINAL MAPPED TASK OBJECT BEFORE RETURN', {
        mappedTask,
        hasAllFields: {
          content: !!mappedTask.content,
          due_string: mappedTask.due_string !== undefined,
          priority: mappedTask.priority !== undefined,
          labels: mappedTask.labels !== undefined
        },
        priorityValue: mappedTask.priority,
        priorityPresent: 'priority' in mappedTask
      });

      return mappedTask;
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
    logger.debug('INTENT_SERVICE', 'Starting priority mapping', { 
      inputPriority: priority,
      inputType: typeof priority
    });

    if (!priority) {
      logger.debug('INTENT_SERVICE', 'No priority provided, returning undefined');
      return undefined;
    }
    
    // CORRECTED MAPPING: 1=urgent(highest), 2=high, 3=medium, 4=low(lowest)
    const priorityMap: Record<string, number> = {
      'urgent': 1,    // P1 - highest priority (red)
      'high': 2,      // P2 - high priority (orange)  
      'medium': 3,    // P3 - medium priority (blue)
      'low': 4        // P4 - lowest priority (no color)
    };

    const normalizedPriority = priority.toLowerCase();
    const mappedValue = priorityMap[normalizedPriority];
    
    logger.info('INTENT_SERVICE', 'PRIORITY MAPPING RESULT', { 
      inputPriority: priority,
      normalizedPriority,
      mappedValue,
      mappedType: typeof mappedValue,
      availableKeys: Object.keys(priorityMap),
      mappingSuccessful: mappedValue !== undefined,
      todoistMeaning: mappedValue === 1 ? 'P1 (urgent)' : 
                     mappedValue === 2 ? 'P2 (high)' : 
                     mappedValue === 3 ? 'P3 (medium)' : 
                     mappedValue === 4 ? 'P4 (low)' : 'unknown'
    });

    return mappedValue;
  }
}

export const intentService = new IntentService();
