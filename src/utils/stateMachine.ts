import { logger } from "./logger";

export type ConversationState = 
  | 'idle'
  | 'awaiting_confirmation'
  | 'awaiting_clarification' 
  | 'processing_task'
  | 'processing_multiple_tasks';

export interface StateContext {
  previousState?: ConversationState;
  pendingAction?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

class ConversationStateMachine {
  private currentState: ConversationState = 'idle';
  private context: StateContext = { timestamp: new Date() };
  private stateHistory: Array<{ state: ConversationState; timestamp: Date }> = [];

  public getCurrentState(): ConversationState {
    return this.currentState;
  }

  public getContext(): StateContext {
    return { ...this.context };
  }

  public transition(
    newState: ConversationState, 
    context?: Partial<StateContext>
  ): void {
    const previousState = this.currentState;
    
    // Add to history
    this.stateHistory.push({
      state: previousState,
      timestamp: new Date()
    });

    // Keep only last 10 state transitions
    if (this.stateHistory.length > 10) {
      this.stateHistory = this.stateHistory.slice(-10);
    }

    // Update state
    this.currentState = newState;
    this.context = {
      ...this.context,
      ...context,
      previousState,
      timestamp: new Date()
    };

    logger.logStateTransition(previousState, newState, this.context);
  }

  public isAwaitingUserResponse(): boolean {
    return this.currentState === 'awaiting_confirmation' || 
           this.currentState === 'awaiting_clarification';
  }

  public shouldFilterConfirmationArtifacts(): boolean {
    return this.context.previousState === 'awaiting_confirmation';
  }

  public reset(): void {
    logger.info('STATE_MACHINE', 'Resetting conversation state');
    
    this.transition('idle', {
      pendingAction: undefined,
      metadata: undefined
    });
  }

  public handleUserInput(input: string): {
    isConfirmation: boolean;
    isCancel: boolean;
    filteredInput: string;
  } {
    const lowerInput = input.toLowerCase().trim();
    
    if (this.currentState === 'awaiting_confirmation') {
      // Check for confirmation patterns
      const confirmationPatterns = [
        /^(?:yes|y|ok|okay|sure|proceed|create anyway|do it)$/i,
        /^create anyway$/i,
        /^proceed$/i
      ];
      
      const cancelPatterns = [
        /^(?:no|n|cancel|stop|abort|nevermind|never mind)$/i
      ];

      const isConfirmation = confirmationPatterns.some(pattern => pattern.test(lowerInput));
      const isCancel = cancelPatterns.some(pattern => pattern.test(lowerInput));

      if (isConfirmation || isCancel) {
        return {
          isConfirmation,
          isCancel,
          filteredInput: input // Return original for processing
        };
      }
    }

    if (this.currentState === 'awaiting_clarification') {
      // For clarification, return the input as-is for processing
      return {
        isConfirmation: false,
        isCancel: false,
        filteredInput: input
      };
    }

    // For other states, check if this looks like a confirmation artifact
    // that should be filtered out
    if (this.shouldFilterConfirmationArtifacts()) {
      const artifactPatterns = [
        /^(?:create anyway|proceed|confirm)\s+(.+)/i,
        /^(?:yes,?\s+)(.+)/i
      ];

      for (const pattern of artifactPatterns) {
        const match = input.match(pattern);
        if (match && match[1]) {
          logger.debug('STATE_MACHINE', 'Filtered confirmation artifact', {
            original: input,
            filtered: match[1]
          });
          
          return {
            isConfirmation: false,
            isCancel: false,
            filteredInput: match[1].trim()
          };
        }
      }
    }

    return {
      isConfirmation: false,
      isCancel: false,
      filteredInput: input
    };
  }
}

export const conversationState = new ConversationStateMachine();
