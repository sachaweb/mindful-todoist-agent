
import React, { useRef, useEffect } from "react";
import Message from "./Message";
import MessageInput from "./MessageInput";
import Suggestions from "./Suggestions";
import { useTodoistAgent } from "../context/TodoistAgentContext";
import { Separator } from "@/components/ui/separator";

const ChatInterface: React.FC = () => {
  const { messages, isLoading, sendMessage, suggestions } = useTodoistAgent();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-gradient scrollbar-thin">
        <div className="flex flex-col">
          {messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <div className="p-4 bg-background border-t">
        {suggestions.length > 0 && (
          <>
            <Suggestions
              suggestions={suggestions}
              onSelectSuggestion={sendMessage}
            />
            <Separator className="my-3" />
          </>
        )}
        <MessageInput
          onSendMessage={sendMessage}
          isLoading={isLoading}
          placeholder="Ask me about your tasks or type a new task..."
        />
      </div>
    </div>
  );
};

export default ChatInterface;
