
import { Message, TodoistTask, ConversationContext } from "../types";
import { logger } from "../utils/logger";
import { ContextManager } from "./context/contextManager";
import { MessageProcessor } from "./processing/messageProcessor";
import { ResponseGenerator } from "./response/responseGenerator";
import { IntentProcessor } from "./intent/intentProcessor";
import type { IntentResult } from "./intentService";

export class AiService {
  private contextManager: ContextManager;
  private messageProcessor: MessageProcessor;
  private responseGenerator: ResponseGenerator;
  private intentProcessor: IntentProcessor;

  constructor() {
    this.contextManager = new ContextManager();
    this.messageProcessor = new MessageProcessor();
    this.responseGenerator = new ResponseGenerator();
    this.intentProcessor = new IntentProcessor();
    
    logger.info('AI_SERVICE', 'AiService initialized with modular architecture');
  }

  public hasApiKey(): boolean {
    return true;
  }

  public setApiKey(apiKey: string): void {
    logger.info('AI_SERVICE', 'API key management is now handled by Edge Function');
  }

  public async processMessage(message: string, tasks: TodoistTask[] = []): Promise<{
    response: string;
    intent?: IntentResult;
    requiresTaskAction?: boolean;
    createdTask?: TodoistTask;
  }> {
    try {
      logger.info('AI_SERVICE', 'Starting message processing', { 
        message, 
        messageType: typeof message,
        tasksCount: tasks.length 
      });

      // Process user input
      const { processedInput, isConfirmation, isCancel } = await this.messageProcessor.processUserInput(message);
      
      logger.info('AI_SERVICE', 'User input processed successfully', { 
        processedInput, 
        isConfirmation, 
        isCancel 
      });
      
      // Add user message to context
      this.contextManager.addMessage({
        id: this.generateId(),
        content: processedInput,
        role: "user",
        timestamp: new Date(),
      });

      // Update context
      this.contextManager.updateTasks(tasks);
      this.contextManager.updateQuery(processedInput);
      this.contextManager.saveContext();

      // Analyze intent using Claude
      const conversationHistory = this.contextManager.getContext().recentMessages
        .slice(-5)
        .map(msg => msg.content);
        
      logger.info('AI_SERVICE', 'About to analyze intent', { 
        processedInput, 
        conversationHistoryLength: conversationHistory.length 
      });
      
      const intent = await this.messageProcessor.analyzeIntent(processedInput, conversationHistory);

      logger.info('AI_SERVICE', 'Intent analyzed', intent);

      // Log priority specifically if it's a create action
      if (intent.action === 'create' && 'entities' in intent && intent.entities.priority) {
        logger.info('AI_SERVICE', 'Task creation intent with priority detected', {
          priority: intent.entities.priority,
          taskContent: intent.entities.taskContent
        });
      }

      // Handle state transitions
      const stateResult = { isConfirmation, isCancel };
      const transitionResult = this.messageProcessor.handleStateTransitions(stateResult, intent);
      
      if (transitionResult.response) {
        logger.info('AI_SERVICE', 'Returning state transition response', transitionResult);
        return {
          response: transitionResult.response,
          intent,
          requiresTaskAction: transitionResult.requiresTaskAction
        };
      }

      // For high confidence task intents, return the intent for external handling
      if (intent.confidence > 0.7 && intent.action !== 'none') {
        logger.info('AI_SERVICE', 'High confidence task intent detected, delegating to external handler');
        
        // Log the mapped Todoist format for debugging
        if (intent.action === 'create') {
          const todoistData = this.intentProcessor.processIntent(intent, tasks);
          logger.info('AI_SERVICE', 'Mapped intent to Todoist format', await todoistData);
        }
        
        return {
          response: this.messageProcessor.generateTaskActionResponse(intent),
          intent,
          requiresTaskAction: true
        };
      }

      // For low confidence or non-task intents, fall back to conversational AI
      logger.info('AI_SERVICE', 'Generating conversational response');
      const aiResponse = await this.responseGenerator.generateConversationalResponse(
        processedInput, 
        tasks, 
        this.contextManager.buildConversationHistory()
      );

      // Add AI response to context
      this.contextManager.addMessage({
        id: this.generateId(),
        content: aiResponse,
        role: "assistant",
        timestamp: new Date(),
      });

      this.contextManager.saveContext();
      
      return {
        response: aiResponse,
        intent,
        requiresTaskAction: false
      };
    } catch (error) {
      logger.error('AI_SERVICE', 'Error in processMessage', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        message 
      });
      
      return {
        response: "I'm having trouble processing your request right now. Please try again.",
        requiresTaskAction: false
      };
    }
  }

  public generateDetailedTaskResponse(intent: IntentResult, createdTask?: TodoistTask): string {
    return this.messageProcessor.generateTaskActionResponse(intent, createdTask);
  }

  public analyzeTasks(tasks: TodoistTask[]): string[] {
    return this.responseGenerator.analyzeTasks(tasks);
  }

  public getContext(): ConversationContext {
    return this.contextManager.getContext();
  }

  public async processIntent(intent: IntentResult, tasks: TodoistTask[]): Promise<any> {
    return this.intentProcessor.processIntent(intent, tasks);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}

const aiService = new AiService();
export default aiService;
