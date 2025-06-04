
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
      currentState: conversationState.getCurrentState()
    });

    return {
      processedInput: stateResult.filteredInput,
      isConfirmation: stateResult.isConfirmation,
      isCancel: stateResult.isCancel
    };
  }

  public async analyzeIntent(processedInput: string, conversationHistory: string[]): Promise<IntentResult> {
    const intent = await intentService.analyzeIntent(processedInput, conversationHistory);
    logger.info('MESSAGE_PROCESSOR', 'Intent analysis complete', intent);
    return intent;
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
    // Handle state-specific responses
    if (stateResult.isConfirmation) {
      conversationState.transition('processing_task');
      return {
        response: "Processing your confirmation...",
        requiresTaskAction: true
      };
    }

    if (stateResult.isCancel) {
      conversationState.reset();
      return {
        response: "Task creation cancelled.",
        requiresTaskAction: false
      };
    }

    // Check if this is a high-confidence task action
    if (intent.confidence > 0.7 && intent.action !== 'none') {
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
      conversationState.reset();
    }

    return { requiresTaskAction: false };
  }
}
