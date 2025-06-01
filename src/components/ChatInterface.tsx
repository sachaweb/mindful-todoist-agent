
import React, { useRef, useEffect } from "react";
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

  const handleSendMessage = (content: string) => {
    logger.info('CHAT_INTERFACE', 'User sending message', { content });
    sendMessage(content);
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
        />
      </div>
      
      {/* Debug Panel */}
      <DebugPanel />
    </div>
  );
};

export default ChatInterface;
