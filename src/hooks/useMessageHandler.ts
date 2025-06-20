
import { useState, useCallback } from 'react';
import { Message } from '../types';
import aiService from '../services/ai-service';
import { logger } from '../utils/logger';

export const useMessageHandler = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const addMessage = useCallback((message: Message) => {
    logger.info('MESSAGE_HANDLER', 'Adding message to conversation', {
      messageId: message.id,
      role: message.role,
      contentPreview: message.content.substring(0, 100),
      contentLength: message.content.length,
      timestamp: message.timestamp
    });

    setMessages(prev => {
      // Check if this message already exists to prevent duplicates
      const messageExists = prev.some(m => m.id === message.id || 
        (m.content === message.content && m.role === message.role));
      if (messageExists) {
        logger.warn('MESSAGE_HANDLER', 'Duplicate message detected, not adding', {
          messageId: message.id,
          content: message.content
        });
        return prev;
      }
      const updatedMessages = [...prev, message];
      logger.info('MESSAGE_HANDLER', 'Message added successfully', {
        totalMessages: updatedMessages.length,
        newMessageId: message.id
      });
      return updatedMessages;
    });
  }, []);
  
  const generateSuggestions = useCallback((tasks: any[]) => {
    logger.info('MESSAGE_HANDLER', 'Generating suggestions based on tasks', {
      taskCount: tasks.length
    });
    const newSuggestions = aiService.analyzeTasks(tasks);
    logger.info('MESSAGE_HANDLER', 'Suggestions generated', {
      suggestionCount: newSuggestions.length,
      suggestions: newSuggestions
    });
    setSuggestions(newSuggestions);
  }, []);
  
  const initializeMessages = useCallback(() => {
    logger.info('MESSAGE_HANDLER', 'Initializing message handler');
    
    // Load initial messages from AI service context
    const context = aiService.getContext();
    logger.info('MESSAGE_HANDLER', 'Retrieved AI service context', {
      hasRecentMessages: !!(context.recentMessages && context.recentMessages.length > 0),
      messageCount: context.recentMessages?.length || 0
    });
    
    if (context.recentMessages && context.recentMessages.length > 0) {
      logger.info('MESSAGE_HANDLER', 'Setting initial messages from context', {
        messageCount: context.recentMessages.length,
        messages: context.recentMessages.map(m => ({
          id: m.id,
          role: m.role,
          contentPreview: m.content.substring(0, 50)
        }))
      });
      setMessages(context.recentMessages);
    } else {
      // Add welcome message if no previous context
      const welcomeMessage: Message = {
        id: "welcome",
        content: "Hi! I'm your Todoist assistant. I can help you manage tasks using natural language. To get started, please set your Todoist API key.",
        role: "assistant",
        timestamp: new Date(),
      };
      logger.info('MESSAGE_HANDLER', 'Adding welcome message', { welcomeMessage });
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
