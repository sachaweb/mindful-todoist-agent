import { Message, TodoistTask, ConversationContext } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "../utils/logger";
import { validateUserInput } from "../utils/validators";
import { intentService, type IntentResult } from "./intentService";
import { contentSanitizer } from "../utils/contentSanitizer";
import { conversationState } from "../utils/stateMachine";

export class AiService {
  private readonly MAX_CONTEXT_MESSAGES = 10;
  private context: ConversationContext = {
    recentMessages: [],
    openTasks: [],
    taskCreationState: null,
  };

  constructor() {
    this.loadContext();
    logger.info('AI_SERVICE', 'AiService initialized with intent-based architecture');
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
  }> {
    logger.logUserInput(message);
    
    // Validate user input
    const inputValidation = validateUserInput({ input: message });
    if (!inputValidation.success) {
      logger.error('AI_SERVICE', 'Invalid user input', inputValidation.errors);
      return {
        response: "I'm sorry, but your message couldn't be processed. Please try rephrasing it.",
        requiresTaskAction: false
      };
    }

    const validatedInput = inputValidation.data!.input;
    
    // Handle conversation state and filter artifacts
    const stateResult = conversationState.handleUserInput(validatedInput);
    const processedInput = stateResult.filteredInput;
    
    logger.info('AI_SERVICE', 'Processing message with intent analysis', { 
      original: message, 
      validated: validatedInput,
      processed: processedInput,
      currentState: conversationState.getCurrentState()
    });
    
    // Add user message to context
    this.addMessageToContext({
      id: this.generateId(),
      content: processedInput,
      role: "user",
      timestamp: new Date(),
    });

    // Update tasks in context
    this.context.openTasks = [...tasks];
    this.context.lastQuery = processedInput;
    this.saveContext();

    try {
      // Analyze intent using Claude
      const conversationHistory = this.context.recentMessages
        .slice(-5)
        .map(msg => msg.content);
        
      const intent = await intentService.analyzeIntent(processedInput, conversationHistory);
      logger.info('AI_SERVICE', 'Intent analysis complete', intent);

      // Handle state-specific responses
      if (stateResult.isConfirmation) {
        conversationState.transition('processing_task');
        return {
          response: "Processing your confirmation...",
          intent,
          requiresTaskAction: true
        };
      }

      if (stateResult.isCancel) {
        conversationState.reset();
        return {
          response: "Task creation cancelled.",
          intent,
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
          intent,
          requiresTaskAction: true
        };
      }

      // For low confidence or non-task intents, fall back to conversational AI
      const aiResponse = await this.generateConversationalResponse(processedInput, tasks);
      
      // Reset state for non-task interactions
      if (intent.action === 'none') {
        conversationState.reset();
      }

      // Add AI response to context
      this.addMessageToContext({
        id: this.generateId(),
        content: aiResponse,
        role: "assistant",
        timestamp: new Date(),
      });

      this.saveContext();
      
      return {
        response: aiResponse,
        intent,
        requiresTaskAction: false
      };
    } catch (error) {
      logger.error('AI_SERVICE', 'Error in processMessage', error);
      conversationState.reset();
      
      return {
        response: "I'm having trouble processing your request right now. Please try again.",
        requiresTaskAction: false
      };
    }
  }

  private generateTaskActionResponse(intent: IntentResult): string {
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

  private async generateConversationalResponse(message: string, tasks: TodoistTask[]): Promise<string> {
    const systemPrompt = this.buildConversationalPrompt(tasks);
    const conversationHistory = this.buildConversationHistory();

    logger.logClaudeRequest({
      message,
      tasksCount: tasks.length,
      systemPromptLength: systemPrompt.length,
      conversationHistoryLength: conversationHistory.length
    });

    const { data, error } = await supabase.functions.invoke('claude-proxy', {
      body: {
        message,
        tasks: [...tasks],
        systemPrompt,
        conversationHistory
      }
    });

    if (error) {
      logger.error('AI_SERVICE', 'Edge Function error', error);
      throw new Error(`Edge Function error: ${error.message}`);
    }

    if (!data.success) {
      logger.error('AI_SERVICE', 'Claude proxy error', data.error);
      throw new Error(`Claude API error: ${data.error}`);
    }

    logger.logClaudeResponse(data);
    return data.response;
  }

  private buildConversationHistory(): Array<{ role: string; content: string }> {
    return this.context.recentMessages
      .slice(-5) // Keep last 5 messages for context
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
  }

  private buildConversationalPrompt(tasks: TodoistTask[]): string {
    const taskList = tasks.length > 0 
      ? tasks.map(t => `- ${t.content}${t.due ? ` (due: ${t.due.string || t.due.date})` : ''} [Priority: ${t.priority}]`).join('\n')
      : "No open tasks";

    return `You are a helpful Todoist task management assistant. You can help users manage their tasks using natural language.

Current open tasks:
${taskList}

You should be conversational and helpful. Answer questions about tasks, provide productivity advice, and help users understand their workload. 

DO NOT provide task creation instructions in your responses - the system handles task operations separately.

Keep responses concise but friendly.`;
  }

  public analyzeTasks(tasks: TodoistTask[]): string[] {
    const suggestions: string[] = [];

    if (!tasks || tasks.length === 0) {
      return ["You don't have any open tasks. Would you like to create one?"];
    }

    const urgentTasks = tasks.filter(t => t.priority === 4);
    const dueTodayTasks = tasks.filter(t => {
      if (!t.due) return false;
      const today = new Date().toDateString();
      const taskDate = new Date(t.due.date).toDateString();
      return today === taskDate;
    });

    if (urgentTasks.length > 0) {
      suggestions.push(`You have ${urgentTasks.length} high-priority tasks to focus on.`);
    }

    if (dueTodayTasks.length > 0) {
      suggestions.push(`You have ${dueTodayTasks.length} tasks due today.`);
    }

    if (tasks.length > 10) {
      suggestions.push("You have quite a few open tasks. Would you like help prioritizing them?");
    }

    if (suggestions.length === 0) {
      suggestions.push("What would you like to do with your tasks today?");
    }

    return suggestions;
  }

  public getContext(): ConversationContext {
    return this.context;
  }

  public async processIntent(intent: IntentResult, tasks: TodoistTask[]): Promise<any> {
    logger.info('AI_SERVICE', 'Processing intent for task operations', intent);

    // Map intent to Todoist format
    const todoistData = intentService.mapToTodoistFormat(intent);
    
    // Apply sanitization as final safety net
    if (todoistData.action === 'create') {
      const sanitized = contentSanitizer.sanitizeForTodoist({
        content: todoistData.content,
        due_string: todoistData.due_string,
        labels: todoistData.labels
      });
      
      return {
        action: 'create',
        ...sanitized
      };
    }

    if (todoistData.action === 'create_multiple') {
      const sanitizedTasks = todoistData.tasks.map((task: any) => 
        contentSanitizer.sanitizeForTodoist(task)
      );
      
      return {
        action: 'create_multiple',
        tasks: sanitizedTasks
      };
    }

    return todoistData;
  }

  private addMessageToContext(message: Message): void {
    logger.debug('AI_SERVICE', 'Adding message to context', message);
    this.context.recentMessages.push(message);
    
    if (this.context.recentMessages.length > this.MAX_CONTEXT_MESSAGES) {
      this.context.recentMessages = this.context.recentMessages.slice(
        this.context.recentMessages.length - this.MAX_CONTEXT_MESSAGES
      );
    }
  }

  private saveContext(): void {
    try {
      localStorage.setItem("ai_context", JSON.stringify({
        recentMessages: this.context.recentMessages,
        lastSuggestion: this.context.lastSuggestion,
        lastQuery: this.context.lastQuery,
        taskCreationState: this.context.taskCreationState,
      }));
      logger.debug('AI_SERVICE', 'Context saved successfully');
    } catch (error) {
      logger.error('AI_SERVICE', 'Error saving context', error);
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
        logger.debug('AI_SERVICE', 'Context loaded successfully', this.context);
      }
    } catch (error) {
      logger.error('AI_SERVICE', 'Error loading context', error);
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}

const aiService = new AiService();
export default aiService;
