
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface ClaudeApiKeyFormProps {
  onSubmit: (apiKey: string) => void;
  isLoading: boolean;
}

const ClaudeApiKeyForm: React.FC<ClaudeApiKeyFormProps> = ({ onSubmit, isLoading }) => {
  const [apiKey, setApiKey] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      onSubmit(apiKey);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Claude API Key</CardTitle>
        <CardDescription>
          Please enter your Anthropic Claude API key to enable AI assistance.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Enter your Claude API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="text-xs text-gray-500">
              <p>To get your API key:</p>
              <ol className="list-decimal list-inside mt-1 space-y-1">
                <li>Go to <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Anthropic Console</a></li>
                <li>Navigate to "API Keys"</li>
                <li>Create a new API key</li>
              </ol>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={!apiKey.trim() || isLoading}
          >
            {isLoading ? "Setting up..." : "Set API Key"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default ClaudeApiKeyForm;
