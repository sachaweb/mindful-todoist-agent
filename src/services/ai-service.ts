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
      logger.info('AI_SERVICE', 'MESSAGE RECEIVED IN AI SERVICE - Starting processing pipeline', { 
        message, 
        messageType: typeof message,
        messageLength: message.length,
        tasksCount: tasks.length,
        timestamp: new Date().toISOString()
      });

      // Validate input
      if (!message || message.trim() === '') {
        logger.error('AI_SERVICE', 'Empty or invalid message received', { message });
        return {
          response: "Please provide a valid message.",
          requiresTaskAction: false
        };
      }

      // Process user input
      logger.info('AI_SERVICE', 'ROUTING TO MESSAGE PROCESSOR for input processing', { message });
      const { processedInput, isConfirmation, isCancel } = await this.messageProcessor.processUserInput(message);
      
      logger.info('AI_SERVICE', 'MESSAGE PROCESSOR completed input processing', { 
        originalMessage: message,
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
        
      logger.info('AI_SERVICE', 'ROUTING TO INTENT ANALYSIS', { 
        processedInput, 
        conversationHistoryLength: conversationHistory.length 
      });
      
      const intent = await this.messageProcessor.analyzeIntent(processedInput, conversationHistory);

      logger.info('AI_SERVICE', 'INTENT ANALYSIS COMPLETED', {
        originalMessage: message,
        processedInput,
        intentAction: intent.action,
        intentConfidence: intent.confidence,
        requiresTaskAction: intent.action !== 'none' && intent.confidence > 0.7
      });

      // Log priority specifically if it's a create action
      if (intent.action === 'create' && 'entities' in intent && intent.entities.priority) {
        logger.info('AI_SERVICE', 'TASK CREATION INTENT WITH PRIORITY DETECTED', {
          priority: intent.entities.priority,
          taskContent: intent.entities.taskContent,
          dueDate: intent.entities.dueDate,
          confidence: intent.confidence
        });
      }

      // Handle state transitions
      const stateResult = { isConfirmation, isCancel };
      const transitionResult = this.messageProcessor.handleStateTransitions(stateResult, intent);
      
      if (transitionResult.response) {
        logger.info('AI_SERVICE', 'STATE TRANSITION RESPONSE generated', {
          response: transitionResult.response,
          requiresTaskAction: transitionResult.requiresTaskAction
        });
        return {
          response: transitionResult.response,
          intent,
          requiresTaskAction: transitionResult.requiresTaskAction
        };
      }

      // For high confidence task intents, return the intent for external handling
      if (intent.confidence > 0.7 && intent.action !== 'none') {
        logger.info('AI_SERVICE', 'HIGH CONFIDENCE TASK INTENT - Delegating to external task handler', {
          action: intent.action,
          confidence: intent.confidence,
          willTriggerTaskCreation: true
        });
        
        // Log the mapped Todoist format for debugging
        if (intent.action === 'create') {
          const todoistData = this.intentProcessor.processIntent(intent, tasks);
          logger.info('AI_SERVICE', 'MAPPED INTENT TO TODOIST FORMAT for task creation', await todoistData);
        }
        
        return {
          response: this.messageProcessor.generateTaskActionResponse(intent),
          intent,
          requiresTaskAction: true
        };
      }

      // For low confidence or non-task intents, fall back to conversational AI
      logger.info('AI_SERVICE', 'LOW CONFIDENCE OR NON-TASK INTENT - Generating conversational response', {
        action: intent.action,
        confidence: intent.confidence,
        fallbackToConversational: true
      });
      
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
      
      logger.info('AI_SERVICE', 'CONVERSATIONAL RESPONSE generated and context updated', {
        responseLength: aiResponse.length
      });
      
      return {
        response: aiResponse,
        intent,
        requiresTaskAction: false
      };
    } catch (error) {
      logger.error('AI_SERVICE', 'CRITICAL ERROR in processMessage pipeline', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        originalMessage: message,
        stage: 'unknown'
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
