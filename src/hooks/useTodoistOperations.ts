import { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import todoistApi from "../services/todoist-api";
import { TodoistTask } from '../types';
import { fetchTasks } from '../context/taskUtils';

export const useTodoistOperations = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [tasks, setTasks] = useState<TodoistTask[]>([]);
  const [apiKeySet, setApiKeySet] = useState<boolean>(todoistApi.hasApiKey());
  const { toast } = useToast();

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
        
        toast({
          title: "Success",
          description: "Todoist API key connected successfully!",
        });
        
        return true;
      } else {
        todoistApi.setApiKey(''); // Clear the invalid API key
        setApiKeySet(false);
        toast({
          title: "Error",
          description: "Invalid Todoist API key. Please check and try again.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error("Error setting API key:", error);
      todoistApi.setApiKey(''); // Clear the API key on error
      setApiKeySet(false);
      toast({
        title: "Error",
        description: "Failed to connect to Todoist. Please check your API key and internet connection.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to refresh tasks from Todoist
  const refreshTasks = async (): Promise<void> => {
    if (!todoistApi.hasApiKey()) {
      console.log("No Todoist API key set, skipping task refresh");
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
      toast({
        title: "Error",
        description: "Failed to fetch your tasks. Please check your internet connection.",
        variant: "destructive",
      });
      // Don't clear tasks on error, keep the existing ones
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
