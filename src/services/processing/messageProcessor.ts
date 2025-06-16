import { TodoistTask } from "../../types";
import { logger } from "../../utils/logger";
import { validateUserInput } from "../../utils/validators";
import { conversationState } from "../../utils/stateMachine";
import { intentService, type IntentResult } from "../intentService";

export class MessageProcessor {
  public async processUserInput(message: string): Promise<{
    processedInput: string;
    isConfirmation: boolean;
    isCancel: boolean;
  }> {
    logger.logUserInput(message);
    
    logger.info('MESSAGE_PROCESSOR', 'STARTING MESSAGE PROCESSING', {
      originalMessage: message,
      messageLength: message.length,
      timestamp: new Date().toISOString()
    });
    
    // Add detailed logging for debugging
    logger.debug('MESSAGE_PROCESSOR', 'About to validate user input', { 
      message, 
      messageType: typeof message,
      messageLength: message.length 
    });
    
    // Validate user input - pass the string directly, not wrapped in object
    const inputValidation = validateUserInput(message);
    
    logger.debug('MESSAGE_PROCESSOR', 'Validation result', { 
      success: inputValidation.success,
      data: inputValidation.data,
      errors: inputValidation.errors 
    });
    
    if (!inputValidation.success) {
      logger.error('MESSAGE_PROCESSOR', 'Invalid user input', inputValidation.errors);
      throw new Error("Invalid user input");
    }

    const validatedInput = inputValidation.data!.input;
    
    // Handle conversation state and filter artifacts
    const stateResult = conversationState.handleUserInput(validatedInput);
    
    logger.info('MESSAGE_PROCESSOR', 'Processing message with intent analysis', { 
      original: message, 
      validated: validatedInput,
      processed: stateResult.filteredInput,
      currentState: conversationState.getCurrentState(),
      isConfirmation: stateResult.isConfirmation,
      isCancel: stateResult.isCancel
    });

    return {
      processedInput: stateResult.filteredInput,
      isConfirmation: stateResult.isConfirmation,
      isCancel: stateResult.isCancel
    };
  }

  public async analyzeIntent(processedInput: string, conversationHistory: string[]): Promise<IntentResult> {
    logger.info('MESSAGE_PROCESSOR', 'STARTING INTENT ANALYSIS', {
      processedInput,
      inputLength: processedInput.length,
      historyLength: conversationHistory.length,
      timestamp: new Date().toISOString()
    });

    try {
      const intent = await intentService.analyzeIntent(processedInput, conversationHistory);
      
      logger.info('MESSAGE_PROCESSOR', 'INTENT ANALYSIS COMPLETED', {
        intent,
        action: intent.action,
        confidence: intent.confidence,
        hasTaskContent: intent.action === 'create' && 'entities' in intent ? !!intent.entities.taskContent : false,
        extractedPriority: intent.action === 'create' && 'entities' in intent ? intent.entities.priority : null,
        extractedDueDate: intent.action === 'create' && 'entities' in intent ? intent.entities.dueDate : null
      });

      // Additional validation logging for task creation intents
      if (intent.action === 'create' && 'entities' in intent) {
        if (!intent.entities.taskContent || intent.entities.taskContent.trim() === '') {
          logger.warn('MESSAGE_PROCESSOR', 'TASK CREATION INTENT WITH EMPTY CONTENT', {
            intent,
            taskContent: intent.entities.taskContent,
            inputThatCausedThis: processedInput
          });
        } else {
          logger.info('MESSAGE_PROCESSOR', 'VALID TASK CREATION INTENT DETECTED', {
            taskContent: intent.entities.taskContent,
            priority: intent.entities.priority,
            dueDate: intent.entities.dueDate,
            confidence: intent.confidence,
            reasoning: intent.reasoning
          });
        }
      }

      return intent;
    } catch (error) {
      logger.error('MESSAGE_PROCESSOR', 'INTENT ANALYSIS FAILED', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        processedInput,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  public generateTaskActionResponse(intent: IntentResult, createdTask?: TodoistTask): string {
    switch (intent.action) {
      case 'create':
        if (createdTask) {
          return this.formatTaskCreationMessage(createdTask);
        }
        if ('entities' in intent && intent.entities.taskContent) {
          return this.formatTaskCreationFromIntent(intent.entities);
        }
        return "I'll create that task for you.";
        
      case 'create_multiple':
        if ('tasks' in intent) {
          const taskList = intent.tasks
            .map(task => this.formatTaskFromIntentTask(task))
            .join('\n');
          return `I'll create the following ${intent.tasks.length} tasks:\n${taskList}`;
        }
        return "I'll create those tasks for you.";
        
      case 'update':
        return "I'll update that task for you.";
        
      case 'complete':
        return "I'll mark that task as completed.";
        
      case 'list':
        return "Here are your current tasks:";
        
      default:
        return "Processing your request...";
    }
  }

  private formatTaskCreationMessage(task: TodoistTask): string {
    let message = `Created task: "${task.content}"`;
    
    const details: string[] = [];
    
    // Add due date if available
    if (task.due) {
      if (task.due.string) {
        details.push(`due ${task.due.string}`);
      } else if (task.due.date) {
        const date = new Date(task.due.date);
        details.push(`due ${date.toLocaleDateString()}`);
      }
    }
    
    // Add priority if not default (1)
    if (task.priority > 1) {
      const priorityMap = { 2: 'P3', 3: 'P2', 4: 'P1' };
      details.push(priorityMap[task.priority as keyof typeof priorityMap] || `P${5 - task.priority}`);
    }
    
    // Add labels if available
    if (task.labels && task.labels.length > 0) {
      const labelText = task.labels.length === 1 
        ? `label: ${task.labels[0]}` 
        : `labels: ${task.labels.join(', ')}`;
      details.push(labelText);
    }
    
    if (details.length > 0) {
      message += ` (${details.join(', ')})`;
    }
    
    return message;
  }

  private formatTaskCreationFromIntent(entities: any): string {
    let message = `I'll create task: "${entities.taskContent}"`;
    
    const details: string[] = [];
    
    if (entities.dueDate) {
      details.push(`due ${entities.dueDate}`);
    }
    
    if (entities.priority) {
      const priorityMap = { 
        'low': 'P4', 
        'medium': 'P3', 
        'high': 'P2', 
        'urgent': 'P1' 
      };
      details.push(priorityMap[entities.priority as keyof typeof priorityMap] || entities.priority);
    }
    
    if (entities.labels && entities.labels.length > 0) {
      const labelText = entities.labels.length === 1 
        ? `label: ${entities.labels[0]}` 
        : `labels: ${entities.labels.join(', ')}`;
      details.push(labelText);
    }
    
    if (details.length > 0) {
      message += ` (${details.join(', ')})`;
    }
    
    return message;
  }

  private formatTaskFromIntentTask(task: any): string {
    let message = `- "${task.content}"`;
    
    const details: string[] = [];
    
    if (task.dueDate) {
      details.push(`due ${task.dueDate}`);
    }
    
    if (task.priority) {
      const priorityMap = { 
        'low': 'P4', 
        'medium': 'P3', 
        'high': 'P2', 
        'urgent': 'P1' 
      };
      details.push(priorityMap[task.priority as keyof typeof priorityMap] || task.priority);
    }
    
    if (task.labels && task.labels.length > 0) {
      const labelText = task.labels.length === 1 
        ? `label: ${task.labels[0]}` 
        : `labels: ${task.labels.join(', ')}`;
      details.push(labelText);
    }
    
    if (details.length > 0) {
      message += ` (${details.join(', ')})`;
    }
    
    return message;
  }

  public handleStateTransitions(stateResult: any, intent: IntentResult, createdTask?: TodoistTask): {
    response?: string;
    requiresTaskAction: boolean;
  } {
    logger.info('MESSAGE_PROCESSOR', 'HANDLING STATE TRANSITIONS', {
      stateResult,
      intentAction: intent.action,
      intentConfidence: intent.confidence,
      isConfirmation: stateResult.isConfirmation,
      isCancel: stateResult.isCancel
    });

    // Handle state-specific responses
    if (stateResult.isConfirmation) {
      conversationState.transition('processing_task');
      logger.info('MESSAGE_PROCESSOR', 'Processing confirmation, transitioning to task processing');
      return {
        response: "Processing your confirmation...",
        requiresTaskAction: true
      };
    }

    if (stateResult.isCancel) {
      conversationState.reset();
      logger.info('MESSAGE_PROCESSOR', 'Processing cancellation, resetting conversation state');
      return {
        response: "Task creation cancelled.",
        requiresTaskAction: false
      };
    }

    // Check if this is a high-confidence task action
    if (intent.confidence > 0.7 && intent.action !== 'none') {
      logger.info('MESSAGE_PROCESSOR', 'HIGH CONFIDENCE TASK ACTION DETECTED', {
        action: intent.action,
        confidence: intent.confidence,
        taskContent: intent.action === 'create' && 'entities' in intent ? intent.entities.taskContent : null
      });

      conversationState.transition('processing_task', {
        pendingAction: intent.action,
        metadata: { intent }
      });

      return {
        response: this.generateTaskActionResponse(intent, createdTask),
        requiresTaskAction: true
      };
    }

    // Reset state for non-task interactions
    if (intent.action === 'none') {
      logger.info('MESSAGE_PROCESSOR', 'Non-task intent detected, resetting conversation state');
      conversationState.reset();
    }

    logger.info('MESSAGE_PROCESSOR', 'No task action required for this message');
    return { requiresTaskAction: false };
  }
}
