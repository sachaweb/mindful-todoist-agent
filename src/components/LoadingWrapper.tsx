
import React from 'react';

interface LoadingWrapperProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingMessage?: string;
}

const LoadingWrapper: React.FC<LoadingWrapperProps> = ({ 
  isLoading, 
  children, 
  loadingMessage = "Loading..." 
}) => {
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-todoist-red mx-auto mb-4"></div>
          <p className="text-gray-600">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default LoadingWrapper;
