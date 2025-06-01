
import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Message, TodoistTask } from "../types";
import { useMessageHandler } from "@/hooks/useMessageHandler";
import { useTodoistOperations } from "@/hooks/useTodoistOperations";
import aiService from "../services/ai-service";
import { logger } from "../utils/logger";

interface TodoistAgentContextProps {
  messages: Message[];
  suggestions: string[];
  isLoading: boolean;
  apiKeySet: boolean;
  tasks: TodoistTask[];
  setApiKey: (apiKey: string) => Promise<boolean>;
  sendMessage: (content: string) => void;
  refreshTasks: () => void;
  completeTask: (taskId: string) => Promise<boolean>;
}

const TodoistAgentContext = createContext<TodoistAgentContextProps | undefined>(
  undefined
);

interface TodoistAgentProviderProps {
  children: React.ReactNode;
}

export const TodoistAgentProvider: React.FC<TodoistAgentProviderProps> = ({
  children,
}) => {
  const { messages, suggestions, addMessage, setMessages, generateSuggestions, initializeMessages } = useMessageHandler();
  const { isLoading, setIsLoading, apiKeySet, setApiKey, refreshTasks, createTask, completeTask, tasks } = useTodoistOperations();
  
  const isInitialized = useRef(false);

  // Initialize only once
  useEffect(() => {
    if (!isInitialized.current) {
      logger.info('TODOIST_CONTEXT', 'Initializing TodoistAgentProvider with intent-based architecture');
      isInitialized.current = true;
      initializeMessages();
      refreshTasks();
    }
  }, [initializeMessages, refreshTasks]);

  // Generate suggestions when tasks change
  useEffect(() => {
    if (tasks.length > 0) {
      generateSuggestions(tasks);
    }
  }, [tasks, generateSuggestions]);

  const sendMessage = useCallback(async (content: string) => {
    if (isLoading) {
      logger.warn('TODOIST_CONTEXT', 'Already processing, ignoring new message');
      return;
    }

    logger.info('TODOIST_CONTEXT', 'Processing message with new intent architecture', { content });

    const userMessageId = Math.random().toString(36).substring(2, 11);
    const aiMessageId = Math.random().toString(36).substring(2, 11);

    // Add user message
    const userMessage: Message = {
      id: userMessageId,
      content: content,
      role: "user",
      timestamp: new Date(),
    };
    addMessage(userMessage);

    setIsLoading(true);
    
    // Add thinking message
    const thinkingMessage: Message = {
      id: aiMessageId,
      content: "Analyzing your request...",
      role: "assistant",
      timestamp: new Date(),
      status: "sending",
    };
    addMessage(thinkingMessage);

    try {
      // Process message through new intent-based architecture
      const result = await aiService.processMessage(content, tasks);
      
      logger.info('TODOIST_CONTEXT', 'AI processing complete', {
        hasIntent: !!result.intent,
        requiresTaskAction: result.requiresTaskAction,
        intentAction: result.intent?.action
      });

      // Update the AI message with the response
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === aiMessageId 
            ? { ...msg, content: result.response, status: undefined }
            : msg
        )
      );

      // Handle task actions if required
      if (result.requiresTaskAction && result.intent) {
        await handleTaskAction(result.intent, addMessage, createTask);
      }

    } catch (error) {
      logger.error('TODOIST_CONTEXT', 'Error processing message', error);
      
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: "Sorry, I encountered an error processing your request. Please try again.",
                status: "error",
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, addMessage, tasks, createTask, setMessages, setIsLoading]);

  const handleTaskAction = async (
    intent: any,
    addMessage: (message: Message) => void,
    createTask: (content: string, due?: string, priority?: number, labels?: string[]) => Promise<boolean>
  ): Promise<void> => {
    try {
      // Process the intent through AI service to get sanitized Todoist data
      const todoistData = await aiService.processIntent(intent, tasks);
      
      if (todoistData.action === 'create') {
        logger.info('TODOIST_CONTEXT', 'Creating single task from intent', todoistData);
        
        const success = await createTask(
          todoistData.content,
          todoistData.due_string,
          todoistData.priority,
          todoistData.labels
        );

        const resultMessage: Message = {
          id: Math.random().toString(36).substring(2, 11),
          content: success 
            ? `✅ Task "${todoistData.content}" created successfully!`
            : `❌ Failed to create task "${todoistData.content}". Please try again.`,
          role: "assistant",
          timestamp: new Date(),
        };
        addMessage(resultMessage);
      }

      if (todoistData.action === 'create_multiple') {
        logger.info('TODOIST_CONTEXT', 'Creating multiple tasks from intent', {
          taskCount: todoistData.tasks.length
        });
        
        let successCount = 0;
        
        for (const task of todoistData.tasks) {
          const success = await createTask(
            task.content,
            task.due_string,
            task.priority,
            task.labels
          );
          if (success) successCount++;
        }

        const resultMessage: Message = {
          id: Math.random().toString(36).substring(2, 11),
          content: successCount === todoistData.tasks.length
            ? `✅ Successfully created all ${todoistData.tasks.length} tasks!`
            : `⚠️ Created ${successCount} out of ${todoistData.tasks.length} tasks. Some failed to create.`,
          role: "assistant",
          timestamp: new Date(),
        };
        addMessage(resultMessage);
      }

    } catch (error) {
      logger.error('TODOIST_CONTEXT', 'Error handling task action', error);
      
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: "❌ Error processing task action. Please try again.",
        role: "assistant",
        timestamp: new Date(),
      };
      addMessage(errorMessage);
    }
  };

  const value: TodoistAgentContextProps = {
    messages,
    suggestions,
    isLoading,
    apiKeySet,
    tasks,
    setApiKey,
    sendMessage,
    refreshTasks,
    completeTask,
  };

  return (
    <TodoistAgentContext.Provider value={value}>
      {children}
    </TodoistAgentContext.Provider>
  );
};

export const useTodoistAgent = () => {
  const context = useContext(TodoistAgentContext);
  if (!context) {
    throw new Error(
      "useTodoistAgent must be used within a TodoistAgentProvider"
    );
  }
  return context;
};
