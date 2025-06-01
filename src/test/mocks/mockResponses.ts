
export const mockClaudeResponses = {
  // Intent analysis responses
  intentResponses: {
    createTask: {
      "action": "create",
      "confidence": 0.95,
      "entities": {
        "taskContent": "Buy groceries",
        "dueDate": "tomorrow",
        "priority": "medium",
        "labels": ["shopping"]
      },
      "reasoning": "Clear task creation intent with specific content and due date"
    },
    
    createMultipleTasks: {
      "action": "create_multiple",
      "confidence": 0.9,
      "tasks": [
        {
          "content": "Buy milk",
          "dueDate": "today",
          "priority": "high"
        },
        {
          "content": "Buy bread", 
          "dueDate": "today",
          "priority": "medium"
        }
      ],
      "reasoning": "Multiple task creation identified from list format"
    },
    
    generalQuestion: {
      "action": "none",
      "confidence": 0.8,
      "entities": {},
      "reasoning": "General conversation, not a task-related request"
    }
  },

  // Conversational responses
  conversationalResponses: {
    greeting: "Hello! I'm here to help you manage your tasks. What would you like to do today?",
    taskHelp: "I can help you create, update, and manage your tasks. Just tell me what you need to do!",
    productivity: "Based on your current tasks, I'd suggest focusing on the high-priority items first."
  },

  getResponseForInput(input: string): string {
    const lowerInput = input.toLowerCase();
    
    // Check if this is an intent analysis request
    if (lowerInput.includes('buy groceries')) {
      return JSON.stringify(this.intentResponses.createTask);
    }
    
    if (lowerInput.includes('buy milk') && lowerInput.includes('buy bread')) {
      return JSON.stringify(this.intentResponses.createMultipleTasks);
    }
    
    if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
      return this.conversationalResponses.greeting;
    }
    
    if (lowerInput.includes('help') || lowerInput.includes('how')) {
      return this.conversationalResponses.taskHelp;
    }
    
    // Default to general question intent
    return JSON.stringify(this.intentResponses.generalQuestion);
  }
};
