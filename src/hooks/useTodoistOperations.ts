
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import todoistApi from "../services/todoist-api";
import { TodoistTask } from '../types';

export const useTodoistOperations = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [tasks, setTasks] = useState<TodoistTask[]>([]);
  const [apiKeySet, setApiKeySet] = useState<boolean>(true);
  const { toast } = useToast();

  const setApiKey = async (key: string): Promise<boolean> => {
    if (isLoading) {
      console.log("Already loading, skipping API key setup");
      return false;
    }
    
    setIsLoading(true);
    try {
      console.log("Testing Todoist connection...");
      const response = await todoistApi.getTasks();
      
      if (response.success) {
        console.log("Todoist connection successful");
        setApiKeySet(true);
        setTasks(response.data || []);
        
        toast({
          title: "Success",
          description: "Connected to Todoist successfully!",
        });
        
        return true;
      } else {
        console.error("Todoist connection failed:", response.error);
        setApiKeySet(false);
        
        toast({
          title: "Connection Failed",
          description: response.error || "Failed to connect to Todoist.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error("Error testing Todoist connection:", error);
      setApiKeySet(false);
      toast({
        title: "Connection Error",
        description: "Unable to connect to Todoist.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTasks = async (): Promise<void> => {
    if (!todoistApi.hasApiKey() || isLoading) {
      console.log("Cannot refresh tasks - no API key or already loading");
      return;
    }
    
    setIsLoading(true);
    try {
      console.log("Refreshing tasks from Todoist...");
      const response = await todoistApi.getTasks();
      
      if (response.success) {
        const fetchedTasks = response.data || [];
        console.log("Successfully refreshed tasks:", fetchedTasks.length, "tasks found");
        setTasks(fetchedTasks);
      } else {
        throw new Error(response.error || "Failed to fetch tasks");
      }
    } catch (error) {
      console.error("Error refreshing tasks:", error);
      
      if (error instanceof Error && error.message.includes('429')) {
        toast({
          title: "Rate Limited",
          description: "Too many requests. Please wait a moment.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Refresh Failed",
          description: "Failed to fetch your latest tasks.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const createTask = async (content: string, due?: string, priority?: number, labels?: string[]): Promise<boolean> => {
    if (isLoading) {
      console.log("Already loading, skipping task creation");
      return false;
    }
    
    setIsLoading(true);
    console.log("Creating task:", { content, due, priority, labels });
    
    try {
      const response = await todoistApi.createTask(content, due, priority, labels);
      console.log("Create task response:", response);
      
      if (response.success) {
        console.log("Task created successfully");
        
        // Optimistically add task or refresh
        if (response.data) {
          setTasks(prevTasks => [...prevTasks, response.data]);
        } else {
          await refreshTasks();
        }
        
        return true;
      } else {
        console.error("Task creation failed:", response.error);
        return false;
      }
    } catch (error) {
      console.error("Error creating task:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const completeTask = async (taskId: string): Promise<boolean> => {
    if (isLoading) {
      console.log("Already loading, skipping task completion");
      return false;
    }
    
    setIsLoading(true);
    try {
      console.log("Completing task:", taskId);
      
      const taskToComplete = tasks.find(task => task.id === taskId);
      const taskName = taskToComplete?.content || "Task";
      
      const response = await todoistApi.completeTask(taskId);
      
      if (response.success) {
        console.log("Task completed successfully");
        setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
        
        toast({
          title: "Task Completed",
          description: `"${taskName}" has been completed!`,
        });
        return true;
      } else {
        console.error("Task completion failed:", response.error);
        return false;
      }
    } catch (error) {
      console.error("Error completing task:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    setIsLoading,
    tasks,
    setTasks,
    apiKeySet,
    setApiKey,
    refreshTasks,
    createTask,
    completeTask,
  };
};
