import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
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
  const { isLoading, setIsLoading, apiKeySet, setApiKey, refreshTasks, createTask, completeTask, tasks, setTasks } = useTodoistOperations();

  useEffect(() => {
    initializeMessages();
    refreshTasks();
  }, [initializeMessages, refreshTasks]);

  useEffect(() => {
    generateSuggestions(tasks);
  }, [tasks, generateSuggestions]);

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

      // Handle task creation intent with existing tasks
      console.log("Checking for task creation intent...");
      // await handleTaskCreationIntent(
      //   aiResponse,
      //   content,
      //   createTask,
      //   addMessage,
      //   tasks // Pass current tasks for duplicate detection
      // );

      generateSuggestions(tasks);
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
  }, [isLoading, createTask, addMessage, tasks, generateSuggestions, setMessages, setIsLoading]);

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
