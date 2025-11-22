# Worker Architecture Plan

## Problem
Video processing (FFmpeg, fal.ai API calls) is:
- **CPU/Memory intensive** - Can't run on lightweight serverless
- **Long-running** - Minutes per video, not seconds
- **Resource-heavy** - Needs FFmpeg binaries installed
- **Scalable** - Multiple calls completing simultaneously

## Solution: Separate Worker Service

Keep pg-boss queue system, but run workers in a **separate deployable service**.

## Architecture

```
┌─────────────────────┐
│   Main App Server   │
│  (TanStack Start)   │
│                     │
│  - Web UI           │
│  - API Routes       │
│  - Webhooks         │
│  - Enqueue jobs     │
└──────────┬──────────┘
           │
           │ (pg-boss queue)
           │
           ▼
┌─────────────────────┐
│   PostgreSQL DB     │
│   (pg-boss tables)  │
└──────────┬──────────┘
           │
           │ (poll for jobs)
           │
           ▼
┌─────────────────────┐
│  Worker Service     │
│  (Separate process) │
│                     │
│  - Call Processor   │
│  - Video Generator  │
│  - FFmpeg installed  │
│  - Heavy processing │
└─────────────────────┘
```

## Deployment Options

### Option 1: Same Repo, Separate Entry Point (Recommended)
**Structure:**
```
aicalltv/
├── src/
│   ├── server.ts          # Main app entry
│   ├── worker.ts          # Worker service entry (NEW)
│   └── lib/
│       └── workers/       # Shared worker code
├── scripts/
│   └── start-worker.ts    # Worker startup script
└── Dockerfile.worker       # Worker container (NEW)
```

**Benefits:**
- ✅ Shared codebase
- ✅ Same dependencies
- ✅ Easy local dev
- ✅ Can deploy separately

**Deployment:**
- Main app: Vercel/Netlify/serverless
- Worker: AWS ECS Fargate / EC2 / Lambda Container

### Option 2: Separate Repo
**Structure:**
```
aicalltv/              # Main app
aicalltv-workers/      # Worker service (separate repo)
```

**Benefits:**
- ✅ Complete isolation
- ✅ Independent deployments
- ✅ Different scaling

**Drawbacks:**
- ❌ Code duplication
- ❌ Harder to share types

## Implementation Plan

### Step 1: Create Worker Entry Point
**File:** `src/worker.ts`
```typescript
// Standalone worker service
// Connects to pg-boss, runs workers only
import { setupCallProcessorWorker } from "./lib/workers/call-processor";
import { setupVideoGeneratorWorker } from "./lib/workers/video-generator";

async function startWorker() {
  console.log("[Worker] Starting worker service...");
  
  await setupCallProcessorWorker();
  await setupVideoGeneratorWorker();
  
  console.log("[Worker] Worker service running");
  
  // Keep process alive
  process.on("SIGTERM", () => {
    console.log("[Worker] Shutting down...");
    process.exit(0);
  });
}

startWorker();
```

### Step 2: Add Worker Script
**File:** `package.json`
```json
{
  "scripts": {
    "worker": "bun run src/worker.ts",
    "worker:dev": "bun --watch run src/worker.ts"
  }
}
```

### Step 3: Update Main App
**File:** `src/lib/workers/index.ts`
```typescript
// Only initialize workers if WORKER_MODE env var is not set
// Main app should NOT run workers, just enqueue jobs
export async function initializeWorkers() {
  // Skip if running as worker service
  if (process.env.WORKER_MODE === "true") {
    return;
  }
  
  // For local dev, allow running workers
  if (process.env.NODE_ENV === "development" && process.env.RUN_WORKERS !== "false") {
    // ... existing worker setup
  }
}
```

### Step 4: Dockerfile for Worker
**File:** `Dockerfile.worker`
```dockerfile
FROM oven/bun:latest

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production

COPY . .
RUN bun run build

CMD ["bun", "run", "src/worker.ts"]
```

### Step 5: AWS Deployment Options

#### Option A: ECS Fargate (Recommended)
- Container-based
- Auto-scaling
- Pay per use
- FFmpeg in container

**Setup:**
1. Build Docker image
2. Push to ECR
3. Create ECS task definition
4. Run as service (always running) or task (on-demand)

#### Option B: EC2 Instance
- Full control
- Can install anything
- Fixed cost
- Good for predictable load

#### Option C: AWS Batch
- Job-based (not always running)
- Auto-scales
- Good for sporadic heavy loads

#### Option D: Lambda Container (Advanced)
- Serverless
- 15 min max timeout
- Might be tight for video processing
- Need to check if feasible

## Local Development

**Terminal 1:** Main app
```bash
bun run dev
```

**Terminal 2:** Worker service
```bash
bun run worker:dev
```

**Terminal 3:** WebSocket server
```bash
bun run dev:ws
```

## Environment Variables

**Main App:**
- `RUN_WORKERS=false` - Don't run workers in main app
- All existing env vars

**Worker Service:**
- `WORKER_MODE=true` - Indicates running as worker
- `DATABASE_URL` - For pg-boss
- `AWS_*` - For S3
- `FAL_KEY` - For video generation
- `TWILIO_*` - For downloading recordings

## Benefits

1. **Scalability**: Scale workers independently
2. **Resource Isolation**: Heavy processing doesn't affect main app
3. **Cost**: Only pay for worker compute when processing
4. **Reliability**: Worker failures don't crash main app
5. **Flexibility**: Can use different instance types (CPU-optimized)

## Next Steps

1. ✅ Create `src/worker.ts` entry point
2. ✅ Add worker script to package.json
3. ✅ Update main app to skip workers
4. ✅ Create Dockerfile.worker
5. ✅ Test locally with separate processes
6. ⏭️ Set up AWS ECS deployment
7. ⏭️ Configure auto-scaling

