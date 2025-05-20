
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface ApiKeyFormProps {
  onSubmit: (apiKey: string) => Promise<boolean>;
  isLoading: boolean;
}

const ApiKeyForm: React.FC<ApiKeyFormProps> = ({ onSubmit, isLoading }) => {
  const [apiKey, setApiKey] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      await onSubmit(apiKey);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Todoist API Key</CardTitle>
        <CardDescription>
          Please enter your Todoist API key to connect with your account.
          You can find your API token in Todoist settings under Integrations.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Enter your Todoist API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="text-xs text-gray-500">
              <p>
                To get your API key:
              </p>
              <ol className="list-decimal list-inside mt-1 space-y-1">
                <li>Go to <a href="https://todoist.com/app/settings/integrations" target="_blank" rel="noreferrer" className="text-todoist-red hover:underline">Todoist Settings &gt; Integrations</a></li>
                <li>Scroll down to "Developer"</li>
                <li>Copy your API token</li>
              </ol>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            type="submit" 
            className="w-full bg-todoist-red hover:bg-todoist-red/90" 
            disabled={!apiKey.trim() || isLoading}
          >
            {isLoading ? "Connecting..." : "Connect to Todoist"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default ApiKeyForm;
