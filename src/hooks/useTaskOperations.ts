
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Message, TodoistTask } from '../types';
import { parseUserInput, checkForDuplicates, hasAmbiguousPriority } from '../utils/taskParser';
import todoistApi from '../services/todoist-api';

export const useTaskOperations = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const processUserInput = async (
    input: string,
    existingTasks: TodoistTask[],
    addMessage: (message: Message) => void,
    createTask: (content: string, due?: string, priority?: number, labels?: string[]) => Promise<boolean>
  ): Promise<void> => {
    if (isProcessing) {
      console.log('Already processing, ignoring new input');
      return;
    }

    setIsProcessing(true);
    
    try {
      console.log('🚀 Processing user input:', input);
      
      const parsed = parseUserInput(input, existingTasks);
      
      if (!parsed.isTaskCreation && !parsed.isTaskUpdate) {
        console.log('❌ No task operation detected');
        setIsProcessing(false);
        return;
      }
      
      if (parsed.isTaskUpdate) {
        await handleTaskUpdate(parsed.updateTaskName!, parsed.newDueDate!, addMessage, existingTasks);
        setIsProcessing(false);
        return;
      }
      
      if (parsed.isTaskCreation) {
        await handleTaskCreation(parsed, addMessage, createTask, existingTasks);
        setIsProcessing(false);
        return;
      }
      
    } catch (error) {
      console.error('❌ Error processing user input:', error);
      
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: `❌ Error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        role: "assistant",
        timestamp: new Date(),
      };
      
      addMessage(errorMessage);
      setIsProcessing(false);
    }
  };

  const handleTaskCreation = async (
    parsed: any,
    addMessage: (message: Message) => void,
    createTask: (content: string, due?: string, priority?: number, labels?: string[]) => Promise<boolean>,
    existingTasks: TodoistTask[]
  ): Promise<void> => {
    console.log('📝 Handling task creation:', parsed);
    
    if (!parsed.content || parsed.content.trim() === '') {
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: '❌ Cannot create task: No task content provided',
        role: "assistant",
        timestamp: new Date(),
      };
      addMessage(errorMessage);
      return;
    }
    
    // Check for duplicates
    const duplicates = checkForDuplicates(parsed.content, existingTasks);
    if (duplicates.length > 0) {
      let duplicateMessage = `🔍 DUPLICATE TASK DETECTED:\n\n`;
      duplicateMessage += `You want to create: "${parsed.content}"\n\n`;
      duplicateMessage += `But I found ${duplicates.length} similar task${duplicates.length > 1 ? 's' : ''}:\n`;
      
      duplicates.forEach((task, index) => {
        duplicateMessage += `${index + 1}. "${task.content}"`;
        if (task.due) duplicateMessage += ` (Due: ${task.due.string || task.due.date})`;
        duplicateMessage += `\n`;
      });
      
      duplicateMessage += `\n❓ Say "create anyway" to proceed or "cancel" to stop.`;
      
      const duplicateWarning: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: duplicateMessage,
        role: "assistant",
        timestamp: new Date(),
      };
      
      addMessage(duplicateWarning);
      return;
    }
    
    // Check for ambiguous priority
    if (hasAmbiguousPriority(parsed.content)) {
      let priorityMessage = `⚡ PRIORITY CLARIFICATION NEEDED:\n\n`;
      priorityMessage += `You used an ambiguous priority term for: "${parsed.content}"\n\n`;
      priorityMessage += `📊 Todoist Priority Guide:\n`;
      priorityMessage += `• P1 (Urgent & Important): Critical deadlines, emergencies\n`;
      priorityMessage += `• P2 (Important, Not Urgent): Strategic work, planning\n`;
      priorityMessage += `• P3 (Urgent, Not Important): Interruptions, some emails\n`;
      priorityMessage += `• P4 (Neither): Everything else, routine tasks\n\n`;
      priorityMessage += `❓ Please specify: "make it P1", "make it P2", "make it P3", or "proceed" for P4`;
      
      const priorityQuestion: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: priorityMessage,
        role: "assistant",
        timestamp: new Date(),
      };
      
      addMessage(priorityQuestion);
      return;
    }
    
    // Proceed with task creation
    await executeTaskCreation(parsed, addMessage, createTask);
  };

  const executeTaskCreation = async (
    parsed: any,
    addMessage: (message: Message) => void,
    createTask: (content: string, due?: string, priority?: number, labels?: string[]) => Promise<boolean>
  ): Promise<void> => {
    let statusMessage = `🎯 CREATING TASK:\n\n`;
    statusMessage += `📋 Task: "${parsed.content}"\n`;
    statusMessage += `📅 Due: ${parsed.dueDate || 'None'}\n`;
    statusMessage += `⚡ Priority: P${5 - parsed.priority}\n`;
    statusMessage += `🏷️ Labels: ${parsed.labels.length > 0 ? parsed.labels.join(', ') : 'None'}\n\n`;
    statusMessage += `⏳ Creating task...`;
    
    const statusMsg: Message = {
      id: Math.random().toString(36).substring(2, 11),
      content: statusMessage,
      role: "assistant",
      timestamp: new Date(),
    };
    
    addMessage(statusMsg);
    
    try {
      const success = await createTask(
        parsed.content,
        parsed.dueDate,
        parsed.priority,
        parsed.labels
      );
      
      if (success) {
        const successMessage: Message = {
          id: Math.random().toString(36).substring(2, 11),
          content: `✅ SUCCESS: Task "${parsed.content}" created successfully!`,
          role: "assistant",
          timestamp: new Date(),
        };
        addMessage(successMessage);
      } else {
        const failMessage: Message = {
          id: Math.random().toString(36).substring(2, 11),
          content: `❌ FAILED: Could not create task "${parsed.content}". Please check your connection and try again.`,
          role: "assistant",
          timestamp: new Date(),
        };
        addMessage(failMessage);
      }
    } catch (error) {
      console.error('Error creating task:', error);
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: `💥 ERROR: ${error instanceof Error ? error.message : 'Unknown error creating task'}`,
        role: "assistant",
        timestamp: new Date(),
      };
      addMessage(errorMessage);
    }
  };

  const handleTaskUpdate = async (
    taskName: string,
    newDueDate: string,
    addMessage: (message: Message) => void,
    existingTasks: TodoistTask[]
  ): Promise<void> => {
    console.log('🔄 Handling task update:', { taskName, newDueDate });
    
    let updateMessage = `🔄 UPDATING TASK:\n\n`;
    updateMessage += `🔍 Searching for: "${taskName}"\n`;
    updateMessage += `📅 New due date: "${newDueDate}"\n\n`;
    
    const matchingTasks = existingTasks.filter(task => 
      task.content.toLowerCase().includes(taskName.toLowerCase())
    );
    
    if (matchingTasks.length === 0) {
      updateMessage += `❌ No task found containing "${taskName}"`;
      
      const notFoundMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: updateMessage,
        role: "assistant",
        timestamp: new Date(),
      };
      
      addMessage(notFoundMessage);
      return;
    }
    
    if (matchingTasks.length > 1) {
      updateMessage += `⚠️ Found ${matchingTasks.length} matching tasks:\n`;
      matchingTasks.forEach((task, index) => {
        updateMessage += `${index + 1}. "${task.content}"\n`;
      });
      updateMessage += `\nPlease specify which task to update.`;
      
      const multipleMatchMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: updateMessage,
        role: "assistant",
        timestamp: new Date(),
      };
      
      addMessage(multipleMatchMessage);
      return;
    }
    
    // Single match - proceed with update
    const taskToUpdate = matchingTasks[0];
    updateMessage += `✅ Found: "${taskToUpdate.content}"\n`;
    updateMessage += `⏳ Updating due date...`;
    
    const statusMsg: Message = {
      id: Math.random().toString(36).substring(2, 11),
      content: updateMessage,
      role: "assistant",
      timestamp: new Date(),
    };
    
    addMessage(statusMsg);
    
    try {
      const updateResponse = await todoistApi.updateTask(taskToUpdate.id, {
        due_string: newDueDate
      });
      
      if (updateResponse.success) {
        const successMessage: Message = {
          id: Math.random().toString(36).substring(2, 11),
          content: `✅ SUCCESS: Task due date updated to "${newDueDate}"`,
          role: "assistant",
          timestamp: new Date(),
        };
        addMessage(successMessage);
      } else {
        const failMessage: Message = {
          id: Math.random().toString(36).substring(2, 11),
          content: `❌ FAILED: ${updateResponse.error || 'Could not update task'}`,
          role: "assistant",
          timestamp: new Date(),
        };
        addMessage(failMessage);
      }
    } catch (error) {
      console.error('Error updating task:', error);
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: `💥 ERROR: ${error instanceof Error ? error.message : 'Unknown error updating task'}`,
        role: "assistant",
        timestamp: new Date(),
      };
      addMessage(errorMessage);
    }
  };

  return {
    processUserInput,
    isProcessing
  };
};
