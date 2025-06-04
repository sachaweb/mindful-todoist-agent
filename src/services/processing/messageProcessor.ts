
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
    
    // Validate user input - fix the parameter structure
    const inputValidation = validateUserInput({ input: message });
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

  public generateTaskActionResponse(intent: IntentResult): string {
    switch (intent.action) {
      case 'create':
        if ('entities' in intent && intent.entities.taskContent) {
          return `I'll create a task "${intent.entities.taskContent}".`;
        }
        return "I'll create that task for you.";
        
      case 'create_multiple':
        if ('tasks' in intent) {
          const taskList = intent.tasks
            .map(task => `"${task.content}"`)
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

  public handleStateTransitions(stateResult: any, intent: IntentResult): {
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
        response: this.generateTaskActionResponse(intent),
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
