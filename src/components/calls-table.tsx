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

const callsQueryOptions = () =>
  queryOptions({
    queryKey: ["calls"],
    queryFn: () => (getUserCalls as any)(),
  });

export function CallsTable() {
  const { data: calls } = useSuspenseQuery(callsQueryOptions());

  if (calls.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">No calls yet. Submit your first call request above!</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      call_created: { label: "Created", className: "bg-blue-500/10 text-blue-500" },
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
            <TableHead>Payment</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => (
            <TableRow key={call.id}>
              <TableCell className="font-medium">{call.recipientName}</TableCell>
              <TableCell>{getStatusBadge(call.status)}</TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {call.isFree ? "Free" : call.paymentMethod.replace("_", " ")}
                </span>
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
                  <span className="text-sm text-muted-foreground">
                    {call.status === "call_complete" ? "Processing video..." : "Pending"}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

