import { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import todoistApi from "../services/todoist-api";
import { TodoistTask } from '../types';
import { fetchTasks } from '../context/taskUtils';

export const useTodoistOperations = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [tasks, setTasks] = useState<TodoistTask[]>([]);
  const [apiKeySet, setApiKeySet] = useState<boolean>(true); // Always true since Edge Function handles it
  const { toast } = useToast();

  // Function to set the API key - simplified since Edge Function handles it
  const setApiKey = async (key: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Verify the Edge Function works by fetching tasks
      const response = await todoistApi.getTasks();
      
      if (response.success) {
        setApiKeySet(true);
        setTasks(response.data || []);
        
        toast({
          title: "Success",
          description: "Connected to Todoist successfully!",
        });
        
        return true;
      } else {
        setApiKeySet(false);
        
        // Show specific message for rate limiting
        if (response.error && response.error.includes('Rate limited')) {
          toast({
            title: "Rate Limited",
            description: response.error,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to connect to Todoist. Please check your setup.",
            variant: "destructive",
          });
        }
        return false;
      }
    } catch (error) {
      console.error("Error testing Todoist connection:", error);
      setApiKeySet(false);
      toast({
        title: "Error",
        description: "Failed to connect to Todoist. Please check your setup.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to refresh tasks from Todoist with rate limiting protection
  const refreshTasks = async (): Promise<void> => {
    if (!todoistApi.hasApiKey()) {
      console.log("No Todoist API key set, skipping task refresh");
      return;
    }
    
    if (isLoading) {
      console.log("Already loading, skipping duplicate refresh");
      return;
    }
    
    setIsLoading(true);
    try {
      console.log("Attempting to fetch tasks from Todoist...");
      const fetchedTasks = await fetchTasks();
      console.log("Successfully fetched tasks:", fetchedTasks);
      setTasks(fetchedTasks);
    } catch (error) {
      console.error("Error refreshing tasks:", error);
      
      // Check if it's a rate limiting error
      if (error instanceof Error && (error.message.includes('429') || error.message.includes('Rate limited'))) {
        toast({
          title: "Rate Limited",
          description: "Too many requests to Todoist. Please wait a moment before trying again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch your tasks. Please check your internet connection.",
          variant: "destructive",
        });
      }
      // Don't clear tasks on error, keep the existing ones
    } finally {
      setIsLoading(false);
    }
  };

  // Function to create a new task
  const createTask = async (content: string, due?: string, priority?: number, labels?: string[]): Promise<boolean> => {
    if (isLoading) {
      console.log("Already loading, skipping task creation");
      return false;
    }
    
    setIsLoading(true);
    try {
      const response = await todoistApi.createTask(content, due, priority, labels);
      
      if (response.success) {
        toast({
          title: "Success",
          description: "Task created successfully!",
        });
        return true;
      } else {
        // Show specific message for rate limiting
        if (response.error && response.error.includes('Rate limited')) {
          toast({
            title: "Rate Limited",
            description: response.error,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to create task.",
            variant: "destructive",
          });
        }
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
    if (isLoading) {
      console.log("Already loading, skipping task completion");
      return false;
    }
    
    setIsLoading(true);
    try {
      const response = await todoistApi.completeTask(taskId);
      
      if (response.success) {
        // Manually remove the completed task from state instead of refreshing
        setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
        
        toast({
          title: "Success",
          description: "Task completed!",
        });
        return true;
      } else {
        // Show specific message for rate limiting
        if (response.error && response.error.includes('Rate limited')) {
          toast({
            title: "Rate Limited",
            description: response.error,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to complete task.",
            variant: "destructive",
          });
        }
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

  return {
    isLoading,
    setIsLoading,
    tasks,
    apiKeySet,
    setApiKey,
    refreshTasks,
    createTask,
    completeTask,
  };
};
