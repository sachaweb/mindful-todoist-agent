
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
  const { isLoading, setIsLoading, apiKeySet, setApiKey, refreshTasks: originalRefreshTasks, createTask, completeTask, tasks, setTasks } = useTodoistOperations();
  
  // Use refs to prevent multiple initializations
  const isInitialized = useRef(false);
  const lastTaskCount = useRef<number>(0);

  // Wrap refreshTasks to prevent spam
  const refreshTasks = useCallback(async () => {
    if (isLoading) {
      console.log("Skipping refresh - already loading");
      return;
    }
    
    console.log("Refreshing tasks...");
    await originalRefreshTasks();
  }, [originalRefreshTasks, isLoading]);

  // Initialize only once
  useEffect(() => {
    if (!isInitialized.current) {
      console.log("Initializing TodoistAgentProvider...");
      isInitialized.current = true;
      initializeMessages();
      refreshTasks();
    }
  }, [initializeMessages, refreshTasks]);

  // Generate suggestions only when task count changes (not on every task array change)
  useEffect(() => {
    if (tasks.length !== lastTaskCount.current) {
      console.log(`Task count changed from ${lastTaskCount.current} to ${tasks.length}, generating suggestions`);
      lastTaskCount.current = tasks.length;
      generateSuggestions(tasks);
    }
  }, [tasks.length, generateSuggestions]);

  const sendMessage = useCallback(async (content: string) => {
    if (isLoading) {
      console.log("Already processing a message, ignoring new message");
      return;
    }

    console.log("TodoistAgentProvider - sendMessage called with:", content);

    setIsLoading(true);
    const userMessageId = Math.random().toString(36).substring(2, 11);
    const aiMessageId = Math.random().toString(36).substring(2, 11);

    // Optimistically add user message to the chat
    const userMessage: Message = {
      id: userMessageId,
      content: content,
      role: "user",
      timestamp: new Date(),
    };
    addMessage(userMessage);

    // Add temporary AI message with "sending" status
    const aiMessage: Message = {
      id: aiMessageId,
      content: "Thinking...",
      role: "assistant",
      timestamp: new Date(),
      status: "sending",
    };
    addMessage(aiMessage);

    try {
      // Generate AI response
      console.log("Generating AI response for:", content);
      const aiResponse = await aiService.processMessage(content, tasks);
      console.log("Generated AI response:", aiResponse);

      // Update the AI message with the response
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === aiMessageId 
            ? { ...msg, content: aiResponse, status: undefined }
            : msg
        )
      );

      // Only generate suggestions if this was a task-related message
      if (content.toLowerCase().includes('task') || content.toLowerCase().includes('create') || content.toLowerCase().includes('add')) {
        // Small delay to prevent suggestion generation conflicts
        setTimeout(() => {
          generateSuggestions(tasks);
        }, 500);
      }
    } catch (error) {
      console.error("Error in sendMessage:", error);
      // Update AI message with error
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
  }, [isLoading, addMessage, tasks, generateSuggestions, setMessages, setIsLoading]);

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
