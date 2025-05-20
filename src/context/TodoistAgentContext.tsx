
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Message, TodoistTask } from "../types";
import todoistApi from "../services/todoist-api";
import aiService from "../services/ai-service";
import { useToast } from "@/components/ui/use-toast";

interface TodoistAgentContextProps {
  messages: Message[];
  isLoading: boolean;
  apiKeySet: boolean;
  suggestions: string[];
  tasks: TodoistTask[];
  setApiKey: (key: string) => Promise<boolean>;
  sendMessage: (content: string) => Promise<void>;
  refreshTasks: () => Promise<void>;
  createTask: (content: string, due?: string, priority?: number, labels?: string[]) => Promise<boolean>;
  completeTask: (taskId: string) => Promise<boolean>;
}

interface TodoistAgentProviderProps {
  children: ReactNode;
}

// Make sure to export the context
export const TodoistAgentContext = createContext<TodoistAgentContextProps | undefined>(undefined);

export const TodoistAgentProvider: React.FC<TodoistAgentProviderProps> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<TodoistTask[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiKeySet, setApiKeySet] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const { toast } = useToast();

  // Check if API key is set on mount
  useEffect(() => {
    const hasApiKey = todoistApi.hasApiKey();
    setApiKeySet(hasApiKey);
    
    console.log("TodoistAgentProvider initialized");
    
    // Load initial messages from AI service context
    const context = aiService.getContext();
    console.log("Initial context:", context);
    
    if (context.recentMessages && context.recentMessages.length > 0) {
      console.log("Setting initial messages from context:", context.recentMessages);
      setMessages(context.recentMessages);
    } else {
      // Add welcome message if no previous context
      const welcomeMessage: Message = {
        id: "welcome",
        content: "Hi! I'm your Todoist assistant. I can help you manage tasks using natural language. To get started, please set your Todoist API key.",
        role: "assistant",
        timestamp: new Date(),
      };
      console.log("Adding welcome message:", welcomeMessage);
      setMessages([welcomeMessage]);
    }
    
    // If API key is set, fetch tasks
    if (hasApiKey) {
      refreshTasks();
    }
  }, []);

  // Function to set the API key
  const setApiKey = async (key: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      todoistApi.setApiKey(key);
      
      // Verify the key works by fetching tasks
      const response = await todoistApi.getTasks();
      
      if (response.success) {
        setApiKeySet(true);
        await refreshTasks();
        
        // Add confirmation message
        const newMessage: Message = {
          id: Math.random().toString(36).substring(2, 11),
          content: "API key set successfully! I can now help you manage your Todoist tasks.",
          role: "assistant",
          timestamp: new Date(),
        };
        
        console.log("Adding API key success message:", newMessage);
        setMessages(prev => [...prev, newMessage]);
        
        toast({
          title: "Success",
          description: "Todoist API key connected successfully!",
        });
        
        return true;
      } else {
        toast({
          title: "Error",
          description: "Invalid Todoist API key. Please check and try again.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error("Error setting API key:", error);
      toast({
        title: "Error",
        description: "Failed to set Todoist API key. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to send a message to the AI
  const sendMessage = async (content: string): Promise<void> => {
    console.log("sendMessage called with:", content);
    if (!content.trim()) {
      console.log("Message content empty, not sending");
      return;
    }
    
    setIsLoading(true);
    
    // Add user message to state
    const userMessage: Message = {
      id: Math.random().toString(36).substring(2, 11),
      content,
      role: "user",
      timestamp: new Date(),
    };
    
    console.log("Adding user message to state:", userMessage);
    setMessages(prev => {
      console.log("Previous messages:", prev);
      const updatedMessages = [...prev, userMessage];
      console.log("Updated messages:", updatedMessages);
      return updatedMessages;
    });
    
    try {
      // Process message with AI service
      console.log("Calling AI service with:", content);
      const response = await aiService.processMessage(content, tasks);
      console.log("AI service response:", response);
      
      // Add AI response to state
      const aiMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: response,
        role: "assistant",
        timestamp: new Date(),
      };
      
      console.log("Adding AI response message:", aiMessage);
      setMessages(prev => [...prev, aiMessage]);
      
      // Refresh tasks in case the message resulted in changes
      if (apiKeySet) {
        await refreshTasks();
      }
    } catch (error) {
      console.error("Error processing message:", error);
      toast({
        title: "Error",
        description: "Failed to process your message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to refresh tasks from Todoist
  const refreshTasks = async (): Promise<void> => {
    if (!todoistApi.hasApiKey()) return;
    
    setIsLoading(true);
    try {
      const response = await todoistApi.getTasks();
      
      if (response.success && response.data) {
        setTasks(response.data);
        
        // Generate suggestions based on tasks
        const newSuggestions = aiService.analyzeTasks(response.data);
        setSuggestions(newSuggestions);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch tasks from Todoist.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error refreshing tasks:", error);
      toast({
        title: "Error",
        description: "Failed to fetch your tasks. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to create a new task
  const createTask = async (content: string, due?: string, priority?: number, labels?: string[]): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await todoistApi.createTask(content, due, priority, labels);
      
      if (response.success) {
        await refreshTasks();
        toast({
          title: "Success",
          description: "Task created successfully!",
        });
        return true;
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to create task.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error("Error creating task:", error);
      toast({
        title: "Error",
        description: "Failed to create task. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to complete a task
  const completeTask = async (taskId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await todoistApi.completeTask(taskId);
      
      if (response.success) {
        await refreshTasks();
        toast({
          title: "Success",
          description: "Task completed!",
        });
        return true;
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to complete task.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error("Error completing task:", error);
      toast({
        title: "Error",
        description: "Failed to complete task. Please try again.",
        variant: "destructive",
      });
      return false;
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
