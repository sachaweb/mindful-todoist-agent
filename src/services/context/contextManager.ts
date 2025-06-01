
import { Message, ConversationContext } from "../../types";
import { logger } from "../../utils/logger";

export class ContextManager {
  private readonly MAX_CONTEXT_MESSAGES = 10;
  private context: ConversationContext = {
    recentMessages: [],
    openTasks: [],
    taskCreationState: null,
  };

  constructor() {
    this.loadContext();
    logger.debug('CONTEXT_MANAGER', 'Context manager initialized');
  }

  public getContext(): ConversationContext {
    return this.context;
  }

  public addMessage(message: Message): void {
    logger.debug('CONTEXT_MANAGER', 'Adding message to context', message);
    this.context.recentMessages.push(message);
    
    if (this.context.recentMessages.length > this.MAX_CONTEXT_MESSAGES) {
      this.context.recentMessages = this.context.recentMessages.slice(
        this.context.recentMessages.length - this.MAX_CONTEXT_MESSAGES
      );
    }
  }

  public updateQuery(query: string): void {
    this.context.lastQuery = query;
  }

  public updateTasks(tasks: any[]): void {
    this.context.openTasks = [...tasks];
  }

  public buildConversationHistory(): Array<{ role: string; content: string }> {
    return this.context.recentMessages
      .slice(-5) // Keep last 5 messages for context
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
  }

  public saveContext(): void {
    try {
      localStorage.setItem("ai_context", JSON.stringify({
        recentMessages: this.context.recentMessages,
        lastSuggestion: this.context.lastSuggestion,
        lastQuery: this.context.lastQuery,
        taskCreationState: this.context.taskCreationState,
      }));
      logger.debug('CONTEXT_MANAGER', 'Context saved successfully');
    } catch (error) {
      logger.error('CONTEXT_MANAGER', 'Error saving context', error);
    }
  }

  private loadContext(): void {
    try {
      const storedContext = localStorage.getItem("ai_context");
      if (storedContext) {
        const parsedContext = JSON.parse(storedContext);
        
        if (parsedContext.recentMessages) {
          parsedContext.recentMessages.forEach((msg: any) => {
            msg.timestamp = new Date(msg.timestamp);
          });
        }
        
        this.context = {
          ...this.context,
          ...parsedContext,
          openTasks: [],
        };
        logger.debug('CONTEXT_MANAGER', 'Context loaded successfully', this.context);
      }
    } catch (error) {
      logger.error('CONTEXT_MANAGER', 'Error loading context', error);
    }
  }
}
