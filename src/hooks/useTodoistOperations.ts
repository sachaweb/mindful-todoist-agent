import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
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
    if (isLoading) {
      console.log("Already loading, skipping API key setup");
      return false;
    }
    
    setIsLoading(true);
    try {
      console.log("Testing Todoist connection...");
      // Verify the Edge Function works by fetching tasks
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
        
        // Show specific message for rate limiting
        if (response.error && response.error.includes('Rate limited')) {
          toast({
            title: "Rate Limited",
            description: response.error,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Connection Failed",
            description: response.error || "Failed to connect to Todoist. Please check your setup.",
            variant: "destructive",
          });
        }
        return false;
      }
    } catch (error) {
      console.error("Error testing Todoist connection:", error);
      setApiKeySet(false);
      toast({
        title: "Connection Error",
        description: "Unable to connect to Todoist. Please check your internet connection and try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to refresh tasks from Todoist - removed toast to prevent spam
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
      console.log("Refreshing tasks from Todoist...");
      const fetchedTasks = await fetchTasks();
      console.log("Successfully refreshed tasks:", fetchedTasks.length, "tasks found");
      setTasks(fetchedTasks);
      
      // Only show toast for manual refresh, not automatic ones
      // This prevents the spam of "Tasks Updated" messages
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
          title: "Refresh Failed",
          description: "Failed to fetch your latest tasks. Your existing tasks are still available.",
          variant: "destructive",
        });
      }
      // Don't clear tasks on error, keep the existing ones
    } finally {
      setIsLoading(false);
    }
  };

  // Function to create a new task with correct parameter names
  const createTask = async (content: string, due?: string, priority?: number, labels?: string[]): Promise<boolean> => {
    if (isLoading) {
      console.log("Already loading, skipping task creation");
      toast({
        title: "Please Wait",
        description: "Another operation is in progress. Please wait and try again.",
        variant: "destructive",
      });
      return false;
    }
    
    setIsLoading(true);
    console.log("Creating task with parameters:", { content, due, priority, labels });
    
    try {
      // Use due_string parameter name for Todoist API
      const response = await todoistApi.createTask(content, due, priority, labels);
      console.log("Create task response:", response);
      
      if (response.success) {
        console.log("Task created successfully:", response.data);
        
        // Build success message with details
        let successMessage = `Successfully created: "${content}"`;
        if (due) successMessage += ` (Due: ${due})`;
        if (priority && priority > 1) {
          const priorityLabel = priority === 4 ? 'P1-Highest' : priority === 3 ? 'P2-High' : priority === 2 ? 'P3-Medium' : 'P4-Low';
          successMessage += ` (Priority: ${priorityLabel})`;
        }
        if (labels && labels.length > 0) successMessage += ` (Labels: ${labels.join(', ')})`;
        
        toast({
          title: "Task Created",
          description: successMessage,
        });
        
        // Optimistically add the new task to local state instead of refreshing
        if (response.data) {
          console.log("Adding new task to local state:", response.data);
          setTasks(prevTasks => [...prevTasks, response.data]);
        } else {
          // If no task data returned, refresh to get the latest state
          console.log("No task data in response, refreshing tasks");
          await refreshTasks();
        }
        
        return true;
      } else {
        console.error("Task creation failed:", response.error);
        
        // Show specific message for rate limiting
        if (response.error && response.error.includes('Rate limited')) {
          toast({
            title: "Rate Limited",
            description: response.error,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Creation Failed",
            description: response.error || "Failed to create task. Please try again.",
            variant: "destructive",
          });
        }
        return false;
      }
    } catch (error) {
      console.error("Error creating task:", error);
      toast({
        title: "Creation Error",
        description: "Unable to create task. Please check your connection and try again.",
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
      toast({
        title: "Please Wait",
        description: "Another operation is in progress. Please wait and try again.",
        variant: "destructive",
      });
      return false;
    }
    
    setIsLoading(true);
    try {
      console.log("Completing task:", taskId);
      
      // Find the task name for better user feedback
      const taskToComplete = tasks.find(task => task.id === taskId);
      const taskName = taskToComplete?.content || "Task";
      
      const response = await todoistApi.completeTask(taskId);
      
      if (response.success) {
        console.log("Task completed successfully");
        // Manually remove the completed task from state instead of refreshing
        setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
        
        toast({
          title: "Task Completed",
          description: `"${taskName}" has been marked as complete!`,
        });
        return true;
      } else {
        console.error("Task completion failed:", response.error);
        
        // Show specific message for rate limiting
        if (response.error && response.error.includes('Rate limited')) {
          toast({
            title: "Rate Limited",
            description: response.error,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Completion Failed",
            description: response.error || "Failed to complete task. Please try again.",
            variant: "destructive",
          });
        }
        return false;
      }
    } catch (error) {
      console.error("Error completing task:", error);
      toast({
        title: "Completion Error",
        description: "Unable to complete task. Please check your connection and try again.",
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
    setTasks, // Expose setTasks for optimistic updates
    apiKeySet,
    setApiKey,
    refreshTasks,
    createTask,
    completeTask,
  };
};
