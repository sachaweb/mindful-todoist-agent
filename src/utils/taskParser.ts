
import { TodoistTask } from '../types';

export interface ParsedTaskDetails {
  content: string;
  dueDate?: string;
  priority: number;
  labels: string[];
  isTaskCreation: boolean;
  isTaskUpdate: boolean;
  updateTaskName?: string;
  newDueDate?: string;
}

export const parseUserInput = (input: string, existingTasks: TodoistTask[] = []): ParsedTaskDetails => {
  console.log('🔍 Parsing user input:', input);
  
  const lowerInput = input.toLowerCase();
  
  // Check for task update intent
  const updatePatterns = [
    /(?:change|update|modify|set)\s+(?:task\s+)?"([^"]+)"\s+(?:to be\s+)?(?:due\s+)?(?:to\s+)?(.+)/i,
    /(?:change|update|modify|set)\s+(.+?)\s+(?:to be\s+)?(?:due\s+)?(?:to\s+)?(.+)/i
  ];
  
  for (const pattern of updatePatterns) {
    const match = input.match(pattern);
    if (match) {
      return {
        content: '',
        priority: 1,
        labels: [],
        isTaskCreation: false,
        isTaskUpdate: true,
        updateTaskName: match[1].trim(),
        newDueDate: match[2].trim()
      };
    }
  }
  
  // Check for task creation intent
  const creationKeywords = ['create', 'add', 'new', 'make'];
  const hasCreationKeyword = creationKeywords.some(keyword => lowerInput.includes(keyword));
  
  // If it contains task creation keywords or looks like a task description
  const isTaskCreation = hasCreationKeyword || 
    lowerInput.includes('task') || 
    lowerInput.includes('due') ||
    lowerInput.includes('priority') ||
    lowerInput.includes('label');
  
  if (!isTaskCreation) {
    return {
      content: '',
      priority: 1,
      labels: [],
      isTaskCreation: false,
      isTaskUpdate: false
    };
  }
  
  // Extract task content
  let taskContent = input;
  
  // Remove creation keywords
  taskContent = taskContent.replace(/^(?:create|add|new|make)\s+(?:a\s+)?(?:task\s+)?/i, '').trim();
  taskContent = taskContent.replace(/^task\s+/i, '').trim();
  
  // Remove quotes if present
  taskContent = taskContent.replace(/^["'](.+)["']$/, '$1');
  
  // Extract due date
  let dueDate: string | undefined;
  const dueDatePatterns = [
    /\s+due\s+(.+?)(?:\s+with|\s+priority|\s+label|$)/i,
    /\s+due\s+(.+)$/i
  ];
  
  for (const pattern of dueDatePatterns) {
    const match = taskContent.match(pattern);
    if (match) {
      dueDate = match[1].trim();
      taskContent = taskContent.replace(match[0], '').trim();
      break;
    }
  }
  
  // Extract priority
  let priority = 1; // Default to lowest priority
  
  const priorityPatterns = [
    { pattern: /\b(?:critical|emergency|p1)\b/i, priority: 4 },
    { pattern: /\b(?:high|p2)\b/i, priority: 3 },
    { pattern: /\b(?:medium|normal|p3)\b/i, priority: 2 },
    { pattern: /\b(?:low|p4)\b/i, priority: 1 }
  ];
  
  for (const { pattern, priority: priorityValue } of priorityPatterns) {
    if (pattern.test(input)) {
      priority = priorityValue;
      // Remove priority keywords from content
      taskContent = taskContent.replace(pattern, '').trim();
      break;
    }
  }
  
  // Extract labels
  let labels: string[] = [];
  const labelPatterns = [
    /\s+with\s+labels?\s+([\w\s,\-&]+?)(?:\s+due|\s*$)/i,
    /\s+labels?\s+([\w\s,\-&]+?)(?:\s+due|\s*$)/i
  ];
  
  for (const pattern of labelPatterns) {
    const match = taskContent.match(pattern);
    if (match) {
      const labelText = match[1];
      labels = labelText
        .split(/[,\s]+/)
        .map(label => label.trim().toLowerCase())
        .filter(label => label.length > 0 && !['and', 'with', 'labels', 'label'].includes(label));
      
      taskContent = taskContent.replace(match[0], '').trim();
      break;
    }
  }
  
  // Clean up task content
  taskContent = taskContent.trim();
  
  console.log('📋 Parsed task details:', {
    content: taskContent,
    dueDate,
    priority,
    labels,
    isTaskCreation,
    isTaskUpdate: false
  });
  
  return {
    content: taskContent,
    dueDate,
    priority,
    labels,
    isTaskCreation: true,
    isTaskUpdate: false
  };
};

export const checkForDuplicates = (taskContent: string, existingTasks: TodoistTask[]): TodoistTask[] => {
  return existingTasks.filter(task => 
    task.content.toLowerCase().includes(taskContent.toLowerCase()) ||
    taskContent.toLowerCase().includes(task.content.toLowerCase())
  );
};

export const hasAmbiguousPriority = (content: string): boolean => {
  const ambiguousTerms = /\b(important|urgent|asap|immediately)\b/i;
  return ambiguousTerms.test(content);
};
