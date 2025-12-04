import { NearAiChat } from "~/components/near-ai-chat";
import nearLogoUrl from "~/assets/logos/near-logo.svg";

interface NearAiAssistantProps {
  onFormFill: (data: any) => void;
  onComplete: (data: any) => void;
}

export function NearAiAssistant({ onFormFill, onComplete }: NearAiAssistantProps) {
  return (
    <div className="relative mb-8">
      {/* Content */}
      <div className="relative rounded-xl bg-card p-6 border">
        {/* Header Banner */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white">
              <img src={nearLogoUrl} alt="NEAR" className="h-full w-full rounded-full object-contain p-0.5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <span>NEAR AI Assistant</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Private inference powered by Trusted Execution Environment
              </p>
            </div>
          </div>
          
          {/* TEE Verified Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
            <span className="text-green-600 dark:text-green-400 text-xs">🔐</span>
            <span className="text-green-600 dark:text-green-400 text-xs font-medium">TEE Verified</span>
          </div>
        </div>
        
        {/* Chat Component */}
        <NearAiChat
          onFormFill={onFormFill}
          onComplete={onComplete}
        />
        
        {/* Footer Info */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span>🔒</span> End-to-end private
            </span>
            <span className="flex items-center gap-1">
              <span>⚡</span> DeepSeek V3.1
            </span>
            <span className="flex items-center gap-1">
              <span>✓</span> Verifiable inference
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

