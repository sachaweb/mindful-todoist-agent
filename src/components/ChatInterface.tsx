
import React, { useRef, useEffect } from "react";
import Message from "./Message";
import MessageInput from "./MessageInput";
import Suggestions from "./Suggestions";
import { useTodoistAgent } from "../context/TodoistAgentContext";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

const ChatInterface: React.FC = () => {
  const { messages, isLoading, sendMessage, suggestions } = useTodoistAgent();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Log messages for debugging
  useEffect(() => {
    console.log("Current messages in ChatInterface:", messages);
  }, [messages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = (content: string) => {
    console.log("ChatInterface - handleSendMessage called with:", content);
    sendMessage(content);
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4 space-y-4 chat-gradient">
        <div className="flex flex-col">
          {messages && messages.length > 0 ? (
            messages.map((message) => (
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
          isLoading={isLoading}
          placeholder="Ask me about your tasks or type a new task..."
        />
      </div>
    </div>
  );
};

export default ChatInterface;
