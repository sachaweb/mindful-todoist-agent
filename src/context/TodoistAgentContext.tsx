
import React, { createContext, useContext, useEffect, useState } from "react";
import { Message } from "../types";
import aiService from "../services/ai-service";
import { TodoistAgentContextProps, TodoistAgentProviderProps } from "./types";
import { handleTaskCreationIntent } from "./taskUtils";
import { useTodoistOperations } from "../hooks/useTodoistOperations";
import { useMessageHandler } from "../hooks/useMessageHandler";
import LoadingWrapper from "../components/LoadingWrapper";
import ErrorBoundary from "../components/ErrorBoundary";

// Create the context
export const TodoistAgentContext = createContext<TodoistAgentContextProps | undefined>(undefined);

export const TodoistAgentProvider: React.FC<TodoistAgentProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  
  const {
    isLoading, 
    setIsLoading,
    tasks, 
    setTasks,
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
    const initialize = async () => {
      try {
        console.log("TodoistAgentProvider initializing...");
        setIsLoading(true);
        
        // Initialize messages
        initializeMessages();
        
        // Check if we can connect to Todoist
        if (apiKeySet) {
          await refreshTasks();
        }
        
        console.log("TodoistAgentProvider initialization complete");
        setIsInitialized(true);
      } catch (error) {
        console.error("Error during TodoistAgentProvider initialization:", error);
        setInitializationError(error instanceof Error ? error.message : "Failed to initialize");
        setIsInitialized(true); // Still mark as initialized to prevent infinite loading
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  // Update suggestions when tasks change
  useEffect(() => {
    if (tasks.length > 0 && isInitialized) {
      generateSuggestions(tasks);
    }
  }, [tasks, generateSuggestions, isInitialized]);

  // Function to set the API key with a confirmation message
  const setApiKey = async (key: string): Promise<boolean> => {
    try {
      setIsLoading(true);
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
        
        // Refresh tasks after successful connection
        await refreshTasks();
      }
      
      return success;
    } catch (error) {
      console.error("Error setting API key:", error);
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: "Failed to connect to Todoist. Please check your API key and try again.",
        role: "assistant",
        timestamp: new Date(),
      };
      addMessage(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to send a message to the AI
  const sendMessage = async (content: string): Promise<void> => {
    console.log("=== SEND MESSAGE CALLED ===");
    console.log("Message content:", content);
    
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
        console.log("=== PROCESSING TASK CREATION INTENT ===");
        console.log("API Key is set, checking for task operations");
        console.log("Response to analyze:", response);
        console.log("User message:", content);
        
        await handleTaskCreationIntent(
          response, 
          content, 
          createTask, 
          addMessage
        );
      } else {
        console.log("❌ API key not set, skipping task operations");
      }
    } catch (error) {
      console.error("Error processing message:", error);
      
      // Remove the pending message
      setMessages(prev => prev.filter(msg => msg.id !== pendingAiMessage.id));
      
      // Add error message with user-friendly feedback
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: "I'm having trouble processing your request right now. Please check your internet connection and try again. If the problem persists, there might be an issue with the AI service.",
        role: "assistant",
        timestamp: new Date(),
      };
      
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // If there's an initialization error, show it
  if (initializationError) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg border">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-yellow-600 text-xl">⚠️</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Initialization Error
              </h2>
              <p className="text-gray-600 mb-4">
                {initializationError}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Don't render children until initialized
  if (!isInitialized) {
    return (
      <LoadingWrapper 
        isLoading={true} 
        loadingMessage="Initializing Todoist Assistant..."
      >
        <div></div>
      </LoadingWrapper>
    );
  }

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
    <ErrorBoundary>
      <TodoistAgentContext.Provider value={contextValue}>
        {children}
      </TodoistAgentContext.Provider>
    </ErrorBoundary>
  );
};

export const useTodoistAgent = (): TodoistAgentContextProps => {
  const context = useContext(TodoistAgentContext);
  if (!context) {
    throw new Error("useTodoistAgent must be used within a TodoistAgentProvider");
  }
  return context;
};
