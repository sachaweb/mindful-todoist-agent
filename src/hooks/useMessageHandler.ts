
import { useState, useCallback } from 'react';
import { Message } from '../types';
import aiService from '../services/ai-service';

export const useMessageHandler = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const addMessage = useCallback((message: Message) => {
    setMessages(prev => {
      // Check if this message already exists to prevent duplicates
      const messageExists = prev.some(m => m.id === message.id || 
        (m.content === message.content && m.role === message.role));
      if (messageExists) {
        console.log("Message already exists, not adding duplicate");
        return prev;
      }
      const updatedMessages = [...prev, message];
      console.log("Updated messages:", updatedMessages);
      return updatedMessages;
    });
  }, []);
  
  const generateSuggestions = useCallback((tasks: any[]) => {
    const newSuggestions = aiService.analyzeTasks(tasks);
    setSuggestions(newSuggestions);
  }, []);
  
  const initializeMessages = useCallback(() => {
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
  }, []);

  return {
    messages,
    suggestions,
    addMessage,
    setMessages,
    generateSuggestions,
    initializeMessages
  };
};
