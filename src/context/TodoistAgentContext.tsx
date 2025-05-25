
import React, { createContext, useContext, useEffect } from "react";
import { Message } from "../types";
import aiService from "../services/ai-service";
import { TodoistAgentContextProps, TodoistAgentProviderProps } from "./types";
import { handleTaskCreationIntent } from "./taskUtils";
import { useTodoistOperations } from "../hooks/useTodoistOperations";
import { useMessageHandler } from "../hooks/useMessageHandler";

// Create the context
export const TodoistAgentContext = createContext<TodoistAgentContextProps | undefined>(undefined);

export const TodoistAgentProvider: React.FC<TodoistAgentProviderProps> = ({ children }) => {
  const {
    isLoading, 
    setIsLoading,
    tasks, 
    apiKeySet, 
    setApiKey: setTodoistApiKey, 
    refreshTasks, 
    createTask, 
    completeTask
  } = useTodoistOperations();
  
  const {
    messages,
    suggestions,
    addMessage,
    setMessages,
    generateSuggestions,
    initializeMessages
  } = useMessageHandler();

  // Initialize on mount - but only once
  useEffect(() => {
    console.log("TodoistAgentProvider initialized");
    initializeMessages();
    // Remove automatic task fetching on initialization to prevent rate limiting
    setIsLoading(false);
  }, []);

  // Update suggestions when tasks change
  useEffect(() => {
    if (tasks.length > 0) {
      generateSuggestions(tasks);
    }
  }, [tasks, generateSuggestions]);

  // Function to set the API key with a confirmation message
  const setApiKey = async (key: string): Promise<boolean> => {
    const success = await setTodoistApiKey(key);
    
    if (success) {
      // Add confirmation message
      const newMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: "Connected to Todoist successfully! I can now help you manage your tasks.",
        role: "assistant",
        timestamp: new Date(),
      };
      
      console.log("Adding API key success message:", newMessage);
      addMessage(newMessage);
    }
    
    return success;
  };

  // Function to send a message to the AI
  const sendMessage = async (content: string): Promise<void> => {
    console.log("sendMessage called with:", content);
    if (!content.trim()) {
      console.log("Message content empty, not sending");
      return;
    }
    
    setIsLoading(true);
    
    // Generate unique ID for this message
    const messageId = Math.random().toString(36).substring(2, 11);
    
    // Add user message to state
    const userMessage: Message = {
      id: messageId,
      content,
      role: "user",
      timestamp: new Date(),
    };
    
    console.log("Adding user message to state:", userMessage);
    addMessage(userMessage);
    
    // Prepare AI response message with sending status
    const pendingAiMessage: Message = {
      id: Math.random().toString(36).substring(2, 11),
      content: "",
      role: "assistant",
      timestamp: new Date(),
      status: "sending"
    };
    
    addMessage(pendingAiMessage);
    
    try {
      // Process message with AI service
      console.log("Calling AI service with:", content);
      const response = await aiService.processMessage(content, tasks);
      console.log("AI service response:", response);
      
      // Remove the pending message and add the real response
      setMessages(prev => prev.filter(msg => msg.id !== pendingAiMessage.id));
      
      // Add AI response to state
      const aiMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: response,
        role: "assistant",
        timestamp: new Date(),
      };
      
      console.log("Adding AI response message:", aiMessage);
      addMessage(aiMessage);
      
      // Check if the AI intended to create a task or update a task
      if (apiKeySet) {
        await handleTaskCreationIntent(response, content, createTask, addMessage);
        
        // Remove automatic task refresh after operations to prevent rate limiting
        // Tasks will be updated via manual refresh or when user explicitly requests it
      }
    } catch (error) {
      console.error("Error processing message:", error);
      
      // Remove the pending message
      setMessages(prev => prev.filter(msg => msg.id !== pendingAiMessage.id));
      
      // Add error message
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: "Sorry, I encountered an error processing your message. Please try again.",
        role: "assistant",
        timestamp: new Date(),
      };
      
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const contextValue: TodoistAgentContextProps = {
    messages,
    isLoading,
    apiKeySet,
    suggestions,
    tasks,
    setApiKey,
    sendMessage,
    refreshTasks,
    createTask,
    completeTask,
  };

  // Standard Context.Provider pattern
  return (
    <TodoistAgentContext.Provider value={contextValue}>
      {children}
    </TodoistAgentContext.Provider>
  );
};

export const useTodoistAgent = (): TodoistAgentContextProps => {
  const context = useContext(TodoistAgentContext);
  if (!context) {
    throw new Error("useTodoistAgent must be used within a TodoistAgentProvider");
  }
  return context;
};
