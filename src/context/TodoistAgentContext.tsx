
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
import { useTaskOperations } from "@/hooks/useTaskOperations";
import aiService from "../services/ai-service";

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
  const { processUserInput, isProcessing } = useTaskOperations();
  
  const isInitialized = useRef(false);

  // Initialize only once
  useEffect(() => {
    if (!isInitialized.current) {
      console.log("Initializing TodoistAgentProvider...");
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
    if (isLoading || isProcessing) {
      console.log("Already processing, ignoring new message");
      return;
    }

    console.log("TodoistAgentProvider - sendMessage called with:", content);

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

    // Check if this is a task operation first
    try {
      await processUserInput(content, tasks, addMessage, createTask);
    } catch (error) {
      console.error("Error processing task operation:", error);
      
      // Fall back to AI service for non-task messages
      setIsLoading(true);
      
      const aiMessage: Message = {
        id: aiMessageId,
        content: "Thinking...",
        role: "assistant",
        timestamp: new Date(),
        status: "sending",
      };
      addMessage(aiMessage);

      try {
        const aiResponse = await aiService.processMessage(content, tasks);
        
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, content: aiResponse, status: undefined }
              : msg
          )
        );
      } catch (aiError) {
        console.error("Error in AI service:", aiError);
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === aiMessageId
              ? {
                ...msg,
                content: "Sorry, I encountered an error. Please try again.",
                status: "error",
              }
              : msg
          )
        );
      } finally {
        setIsLoading(false);
      }
    }
  }, [isLoading, isProcessing, addMessage, tasks, createTask, setMessages, setIsLoading, processUserInput]);

  const value: TodoistAgentContextProps = {
    messages,
    suggestions,
    isLoading: isLoading || isProcessing,
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
