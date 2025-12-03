import { useSuspenseQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { queryOptions } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { getUserCalls } from "~/lib/calls/queries";

// Type for call data returned from getUserCalls
interface CallData {
  id: string;
  userId: string;
  status: string;
  recipientName: string;
  targetGender: string;
  targetGenderCustom: string | null;
  targetAgeRange: string | null;
  targetPhysicalDescription: string | null;
  interestingPiece: string | null;
  videoStyle: string | null;
  openaiPrompt: string | null;
  imagePrompt: string | null;
  script: string | null;
  attempts: number;
  maxAttempts: number;
  firstAttemptAt: Date | null;
  lastAttemptAt: Date | null;
  daysSinceFirstAttempt: number | null;
  nextRetryAt: Date | null;
  isFree: boolean;
  paymentMethod: string;
  paymentTxHash: string | null;
  paymentAmount: string | null;
  encryptedHandle: string | null;
  callSid: string | null;
  recordingUrl: string | null;
  recordingSid: string | null;
  duration: number | null;
  videoUrl: string | null;
  videoS3Key: string | null;
  videoStatus: string | null;
  wavespeedJobId: string | null;
  videoErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const callsQueryOptions = () =>
  queryOptions({
    queryKey: ["calls"],
    queryFn: () => getUserCalls() as Promise<CallData[]>,
  });

export function CallsTable() {
  const { data: calls } = useSuspenseQuery(callsQueryOptions());

  if (calls.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">No calls yet. Buy your first AI call above!</p>
      </div>
    );
  }

  const getStatusBadge = (status: string, videoStatus?: string | null) => {
    // Show video status if available
    if (videoStatus === "completed") {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-500/10 text-green-500">
          Video Ready
        </span>
      );
    }
    if (videoStatus === "generating") {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-yellow-500/10 text-yellow-500">
          Generating Video
        </span>
      );
    }
    if (videoStatus === "failed") {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-500/10 text-red-500">
          Video Failed
        </span>
      );
    }

    // Call status
    const statusConfig = {
      call_created: { label: "Created", className: "bg-blue-500/10 text-blue-500" },
      prompt_ready: { label: "Ready", className: "bg-green-500/10 text-green-500" },
      call_attempted: { label: "In Progress", className: "bg-yellow-500/10 text-yellow-500" },
      call_complete: { label: "Complete", className: "bg-green-500/10 text-green-500" },
      call_failed: { label: "Failed", className: "bg-red-500/10 text-red-500" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.call_created;

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Recipient</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Video</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => (
            <TableRow key={call.id}>
              <TableCell className="font-medium">{call.recipientName}</TableCell>
              <TableCell>{getStatusBadge(call.status, call.videoStatus)}</TableCell>
              <TableCell>
                {call.videoUrl ? (
                  <a 
                    href={call.videoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View Video
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {call.videoStatus === "generating" ? "Generating..." : 
                     call.videoStatus === "failed" ? "Failed" :
                     call.status === "call_complete" ? "Pending" : "Not started"}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(call.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                {call.videoUrl ? (
                  <Button size="sm" variant="outline" asChild>
                    <a href={call.videoUrl} download target="_blank" rel="noopener noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </a>
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

