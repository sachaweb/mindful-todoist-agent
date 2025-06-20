
import React, { useRef, useEffect, useState } from "react";
import Message from "./Message";
import MessageInput from "./MessageInput";
import Suggestions from "./Suggestions";
import DebugPanel from "./DebugPanel";
import { useTodoistAgent } from "../context/TodoistAgentContext";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { logger } from "../utils/logger";

const ChatInterface: React.FC = () => {
  const { messages, isLoading, sendMessage, suggestions } = useTodoistAgent();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [shouldClearInput, setShouldClearInput] = useState(false);
  
  // Log messages for debugging
  useEffect(() => {
    logger.debug('CHAT_INTERFACE', 'Messages updated', { count: messages.length });
  }, [messages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Monitor for successful task creation to trigger input clearing
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && 
        lastMessage.role === 'assistant' && 
        (lastMessage.content.includes('created successfully') || 
         lastMessage.content.includes('SUCCESS: Task') ||
         lastMessage.content.includes('✅ SUCCESS'))) {
      logger.info('CHAT_INTERFACE', 'Task creation success detected, triggering input clear', {
        messageId: lastMessage.id,
        contentPreview: lastMessage.content.substring(0, 100)
      });
      setShouldClearInput(true);
    }
  }, [messages]);

  const handleSendMessage = (content: string) => {
    logger.info('CHAT_INTERFACE', 'RECEIVED USER COMMAND - Starting message handling flow', { 
      content,
      contentLength: content.length,
      timestamp: new Date().toISOString()
    });
    
    // Validate input
    if (!content || content.trim() === '') {
      logger.warn('CHAT_INTERFACE', 'Empty message received, not processing', { content });
      return;
    }

    const trimmedContent = content.trim();
    logger.info('CHAT_INTERFACE', 'ROUTING MESSAGE TO AI SERVICE for intent recognition', {
      originalContent: content,
      trimmedContent,
      willPassToSendMessage: true
    });

    setShouldClearInput(false); // Reset clear state when sending new message
    
    try {
      // Route ALL messages through the AI service for intent recognition
      sendMessage(trimmedContent);
      logger.info('CHAT_INTERFACE', 'Message successfully routed to AI service', {
        content: trimmedContent
      });
    } catch (error) {
      logger.error('CHAT_INTERFACE', 'Failed to route message to AI service', {
        content: trimmedContent,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  };

  const handleInputCleared = () => {
    logger.debug('CHAT_INTERFACE', 'Input cleared after successful task creation');
    setShouldClearInput(false); // Reset the clear flag after input is cleared
  };

  // Ensure unique messages by ID
  const uniqueMessages = messages.filter((message, index, self) => 
    index === self.findIndex((m) => m.id === message.id)
  );

  // Only disable input when actually sending a message, not during other loading states
  const isSendingMessage = isLoading && messages.some(m => m.status === 'sending');

  return (
    <div className="flex flex-col h-full relative">
      <ScrollArea className="flex-1 p-4 space-y-4 chat-gradient">
        <div className="flex flex-col">
          {uniqueMessages && uniqueMessages.length > 0 ? (
            uniqueMessages.map((message) => (
              <Message key={message.id} message={message} />
            ))
          ) : (
            <div className="text-center text-gray-500 py-8">No messages yet</div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      <div className="p-4 bg-background border-t">
        {suggestions && suggestions.length > 0 && (
          <>
            <Suggestions
              suggestions={suggestions}
              onSelectSuggestion={handleSendMessage}
            />
            <Separator className="my-3" />
          </>
        )}
        <MessageInput
          onSendMessage={handleSendMessage}
          isLoading={isSendingMessage}
          placeholder="Ask me about your tasks or type a new task..."
          shouldClearInput={shouldClearInput}
          onInputCleared={handleInputCleared}
        />
      </div>
      
      {/* Debug Panel */}
      <DebugPanel />
    </div>
  );
};

export default ChatInterface;
