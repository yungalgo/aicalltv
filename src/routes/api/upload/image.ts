/**
 * Image upload API endpoint
 * Handles user-uploaded images for video generation
 */

import { createFileRoute } from "@tanstack/react-router";
import { uploadToS3 } from "~/lib/storage/s3";
import { auth } from "~/lib/auth/auth";
import { getRequest } from "@tanstack/react-start/server";

export const Route = createFileRoute("/api/upload/image")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // Check authentication
          const session = await auth.api.getSession({
            headers: getRequest().headers,
          });

          if (!session?.user) {
            return new Response(
              JSON.stringify({ error: "Unauthorized" }),
              { status: 401, headers: { "Content-Type": "application/json" } }
            );
          }

          const formData = await request.formData();
          const file = formData.get("file") as File | null;

          if (!file) {
            return new Response(
              JSON.stringify({ error: "No file provided" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          // Validate file type
          if (!file.type.startsWith("image/")) {
            return new Response(
              JSON.stringify({ error: "File must be an image" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          // Validate file size (5MB max)
          if (file.size > 5 * 1024 * 1024) {
            return new Response(
              JSON.stringify({ error: "File must be less than 5MB" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          // Generate unique key in temp prefix (auto-deleted after 1 day via S3 lifecycle)
          const timestamp = Date.now();
          const ext = file.name.split(".").pop() || "jpg";
          const key = `uploads/temp/${session.user.id}/${timestamp}.${ext}`;

          // Convert File to Buffer
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Upload to S3
          const result = await uploadToS3({
            file: buffer,
            key,
            contentType: file.type,
          });

          console.log(`[Upload] Image uploaded: ${result.key}`);

          return new Response(
            JSON.stringify({
              url: result.url,
              key: result.key,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (error) {
          console.error("[Upload] Error:", error);
          return new Response(
            JSON.stringify({ error: "Upload failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});

