# Video Generation Pipeline Plan

## Overview
Generate split-screen video from dual-channel Twilio recording:
- **Left channel** = Caller (AI voice)
- **Right channel** = Callee (human)

**Deployment:** Railway (2 vCPU, 2GB RAM recommended)
**Storage:** AWS S3 (all files)
**Processing:** FFmpeg + fal.ai API

## Complete Flow

```
1. Twilio Recording Webhook → Enqueue job
   ↓
2. Download Recording from Twilio (MP3/WAV stereo)
   ↓
3. Upload to S3 → recordings/{callId}.mp3
   ↓
4. Download from S3 to temp file (Railway /tmp)
   ↓
5. Split Audio (FFmpeg)
   ├─ Left channel → /tmp/{callId}-caller.mp3
   └─ Right channel → /tmp/{callId}-callee.mp3
   ↓
6. Upload split audio to S3
   ├─ audio/{callId}-caller.mp3
   └─ audio/{callId}-callee.mp3
   ↓
7. Generate Videos (fal.ai - parallel)
   ├─ caller-audio.mp3 → fal.ai → caller-video.mp4
   └─ callee-audio.mp3 → fal.ai → callee-video.mp4
   ↓
8. Download videos from fal.ai to /tmp
   ├─ /tmp/{callId}-caller-video.mp4
   └─ /tmp/{callId}-callee-video.mp4
   ↓
9. Stitch Videos (FFmpeg)
   → /tmp/{callId}-final.mp4
   ↓
10. Upload Final Video to S3
    → videos/{callId}.mp4
    ↓
11. Clean up temp files
    ↓
12. Update DB with video URL
```

## Implementation Steps

### Step 1: Download & Store Recording
**File:** `src/lib/twilio/recording.ts`

```typescript
export async function downloadTwilioRecording(
  recordingUrl: string,
  callId: string
): Promise<Buffer> {
  // Download from Twilio with auth
  // Retry logic with exponential backoff
  // Return Buffer
}

export async function storeRecordingInS3(
  recordingBuffer: Buffer,
  callId: string
): Promise<string> {
  // Upload to S3: recordings/{callId}.mp3
  // Return S3 URL
}
```

**Implementation details:**
- Use Twilio Account SID + Auth Token for auth
- Retry up to 3 times with exponential backoff
- Stream download to avoid memory issues
- Upload directly to S3 (don't store in Railway)

### Step 2: Split Stereo Audio
**File:** `src/lib/audio/split-channels.ts`

```typescript
export interface SplitAudioResult {
  callerAudioPath: string; // /tmp/{callId}-caller.mp3
  calleeAudioPath: string; // /tmp/{callId}-callee.mp3
  callerS3Url: string;
  calleeS3Url: string;
}

export async function splitStereoAudio(
  inputPath: string,
  callId: string
): Promise<SplitAudioResult> {
  // Use fluent-ffmpeg to extract channels
  // Save to /tmp (Railway temp directory)
  // Upload both to S3
  // Return paths and URLs
}
```

**FFmpeg implementation:**
```typescript
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';
import path from 'path';
import os from 'os';

const tmpDir = os.tmpdir();

// Extract left channel (caller)
await new Promise((resolve, reject) => {
  ffmpeg(inputPath)
    .audioFilters('pan=mono|c0=FL')
    .output(path.join(tmpDir, `${callId}-caller.mp3`))
    .on('end', resolve)
    .on('error', reject)
    .run();
});

// Extract right channel (callee)
await new Promise((resolve, reject) => {
  ffmpeg(inputPath)
    .audioFilters('pan=mono|c0=FR')
    .output(path.join(tmpDir, `${callId}-callee.mp3`))
    .on('end', resolve)
    .on('error', reject)
    .run();
});
```

**Railway considerations:**
- Use `/tmp` directory (cleared on restart)
- Clean up temp files after upload to S3
- Monitor disk space (Railway has limits)

### Step 3: Generate Videos with fal.ai
**File:** `src/lib/video/fal-generator.ts`

```typescript
export interface FalVideoResult {
  videoUrl: string;
  jobId: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

export async function generateVideoFromAudio(
  audioUrl: string, // S3 URL
  callId: string,
  character: 'caller' | 'callee'
): Promise<FalVideoResult> {
  // 1. Submit job to fal.ai with audio URL
  // 2. Poll for completion (every 5-10 seconds)
  // 3. Return video URL when complete
  // 4. Handle errors and retries
}

export async function generateVideosParallel(
  callerAudioUrl: string,
  calleeAudioUrl: string,
  callId: string
): Promise<{
  callerVideo: FalVideoResult;
  calleeVideo: FalVideoResult;
}> {
  // Generate both videos in parallel using Promise.all
}
```

**fal.ai API integration:**
- Model: Research which fal.ai model supports audio-to-video
- Input: S3 URL (public or signed URL)
- Polling: Check status every 5-10 seconds
- Timeout: Max 10 minutes per video
- Retry: Up to 2 retries on failure

**Cost optimization:**
- Generate videos in parallel (saves time)
- Use signed S3 URLs (no need to make public)
- Cache fal.ai responses if possible

### Step 4: Download Videos from fal.ai
**File:** `src/lib/video/fal-generator.ts` (add download function)

```typescript
export async function downloadFalVideo(
  videoUrl: string,
  callId: string,
  character: 'caller' | 'callee'
): Promise<string> {
  // Download video from fal.ai URL
  // Save to /tmp/{callId}-{character}-video.mp4
  // Return local file path
}
```

### Step 5: Stitch Videos (Split-Screen)
**File:** `src/lib/video/stitcher.ts`

```typescript
export interface StitchOptions {
  callerVideoPath: string;
  calleeVideoPath: string;
  outputPath: string;
  width?: number; // Default: 640
  height?: number; // Default: 480
}

export async function stitchVideosSideBySide(
  options: StitchOptions
): Promise<string> {
  // Use FFmpeg to create side-by-side video
  // Scale both videos to same size
  // Stack horizontally
  // Return output path
}
```

**FFmpeg command (via fluent-ffmpeg):**
```typescript
await new Promise((resolve, reject) => {
  ffmpeg()
    .input(callerVideoPath)
    .input(calleeVideoPath)
    .complexFilter([
      '[0:v]scale=640:480[left]',
      '[1:v]scale=640:480[right]',
      '[left][right]hstack=inputs=2[v]'
    ])
    .outputOptions([
      '-map [v]',
      '-c:v libx264',
      '-preset medium',
      '-crf 23',
      '-pix_fmt yuv420p' // Ensure compatibility
    ])
    .output(outputPath)
    .on('end', resolve)
    .on('error', reject)
    .on('progress', (progress) => {
      console.log(`[Stitch] Progress: ${progress.percent}%`);
    })
    .run();
});
```

**Railway considerations:**
- Use `medium` preset (balance between speed/quality)
- Monitor CPU usage during stitching
- Clean up input videos after stitching

### Step 6: Upload Final Video to S3
**File:** `src/lib/storage/s3.ts` (already exists, needs implementation)

```typescript
export async function uploadVideoToS3(
  videoPath: string, // Local file path
  callId: string
): Promise<string> {
  // Read file from disk
  // Upload to S3: videos/{callId}.mp4
  // Return S3 URL
}
```

### Step 7: Clean Up Temp Files
**File:** `src/lib/utils/temp-cleanup.ts`

```typescript
export async function cleanupTempFiles(
  callId: string,
  files: string[]
): Promise<void> {
  // Delete all temp files for this call
  // Handle errors gracefully (log but don't fail)
}
```

### Step 8: Update Video Generator Worker
**File:** `src/lib/workers/video-generator.ts`

**Complete orchestration:**
```typescript
async function processVideoGeneration(callId: string, recordingUrl: string) {
  const tempFiles: string[] = [];
  
  try {
    // 1. Download recording
    const recordingBuffer = await downloadTwilioRecording(recordingUrl, callId);
    const recordingS3Url = await storeRecordingInS3(recordingBuffer, callId);
    
    // 2. Download to temp
    const tempRecordingPath = await downloadFromS3(recordingS3Url, callId);
    tempFiles.push(tempRecordingPath);
    
    // 3. Split audio
    const splitResult = await splitStereoAudio(tempRecordingPath, callId);
    tempFiles.push(splitResult.callerAudioPath, splitResult.calleeAudioPath);
    
    // 4. Generate videos (parallel)
    const [callerVideo, calleeVideo] = await Promise.all([
      generateVideoFromAudio(splitResult.callerS3Url, callId, 'caller'),
      generateVideoFromAudio(splitResult.calleeS3Url, callId, 'callee')
    ]);
    
    // 5. Download videos
    const callerVideoPath = await downloadFalVideo(callerVideo.videoUrl, callId, 'caller');
    const calleeVideoPath = await downloadFalVideo(calleeVideo.videoUrl, callId, 'callee');
    tempFiles.push(callerVideoPath, calleeVideoPath);
    
    // 6. Stitch videos
    const finalVideoPath = path.join(os.tmpdir(), `${callId}-final.mp4`);
    await stitchVideosSideBySide({
      callerVideoPath,
      calleeVideoPath,
      outputPath: finalVideoPath
    });
    tempFiles.push(finalVideoPath);
    
    // 7. Upload final video
    const finalVideoUrl = await uploadVideoToS3(finalVideoPath, callId);
    
    // 8. Update DB
    await db.update(calls).set({
      videoUrl: finalVideoUrl,
      videoStatus: 'completed',
      updatedAt: new Date()
    }).where(eq(calls.id, callId));
    
  } catch (error) {
    // Update DB with error
    await db.update(calls).set({
      videoStatus: 'failed',
      videoErrorMessage: error.message,
      updatedAt: new Date()
    }).where(eq(calls.id, callId));
    throw error;
  } finally {
    // 9. Clean up temp files
    await cleanupTempFiles(callId, tempFiles);
  }
}
```

**Progress tracking:**
- Update DB at each major step
- Log progress for monitoring
- Handle partial failures gracefully

## Dependencies Needed

```json
{
  "fluent-ffmpeg": "^2.1.2",
  "@aws-sdk/client-s3": "^3.700.0",
  "@aws-sdk/s3-request-presigner": "^3.700.0"
}
```

**Note:** FFmpeg will be installed in Dockerfile, not via npm

## File Structure

```
src/lib/
├── twilio/
│   └── recording.ts          # Download from Twilio
├── audio/
│   └── split-channels.ts     # Split stereo audio
├── video/
│   ├── generator.ts          # fal.ai integration (existing)
│   ├── fal-generator.ts      # fal.ai API client
│   └── stitcher.ts           # FFmpeg video stitching
├── storage/
│   └── s3.ts                 # S3 upload/download (needs implementation)
└── utils/
    └── temp-cleanup.ts       # Clean up temp files
```

## Railway-Specific Considerations

### Resource Management
- **Temp files:** Use `/tmp` directory (cleared on restart)
- **Memory:** Stream large files, don't load entirely into memory
- **CPU:** Use `medium` preset for FFmpeg (balance speed/quality)
- **Disk:** Clean up temp files immediately after use

### Cost Optimization
- **S3 storage:** Store all files in S3, not Railway volumes
- **Parallel processing:** Generate videos simultaneously
- **Early cleanup:** Delete temp files as soon as uploaded
- **Monitoring:** Track processing time and resource usage

### Error Handling
- **Retry logic:** 3 retries with exponential backoff
- **Partial failures:** Keep individual videos if stitching fails
- **Timeout handling:** Set max timeouts for each step
- **Cleanup on error:** Always clean up temp files in finally block

## Database Updates

**Already have (in `calls` table):**
- `recordingUrl` - Twilio recording URL
- `recordingSid` - Twilio recording SID
- `videoUrl` - Final S3 video URL
- `videoStatus` - pending/generating/completed/failed
- `falJobId` - fal.ai job ID (single job ID, or comma-separated?)

**Consider adding (optional, for debugging):**
- `callerVideoUrl` - Intermediate caller video S3 URL
- `calleeVideoUrl` - Intermediate callee video S3 URL
- `videoProcessingStartedAt` - Timestamp when processing started
- `videoProcessingCompletedAt` - Timestamp when processing completed
- `videoProcessingDuration` - Duration in seconds

**Migration (if needed):**
```sql
ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_video_url TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS callee_video_url TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS video_processing_started_at TIMESTAMP;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS video_processing_completed_at TIMESTAMP;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS video_processing_duration INTEGER;
```

## Error Handling & Retry Logic

### Download from Twilio
- **Retries:** 3 attempts
- **Backoff:** Exponential (1s, 2s, 4s)
- **On failure:** Mark as failed, log error

### Split Audio
- **Retries:** 2 attempts
- **On failure:** Mark as failed, log FFmpeg error
- **Validation:** Check input file exists and is valid audio

### fal.ai Video Generation
- **Retries:** 2 attempts per video
- **Timeout:** 10 minutes per video
- **On failure:** Retry individual video, don't fail entire job
- **Partial success:** If one video fails, still stitch the other

### Video Stitching
- **Retries:** 1 attempt (usually works or doesn't)
- **On failure:** Keep individual videos, mark as partial
- **Fallback:** Return individual videos if stitching fails

### S3 Upload
- **Retries:** 3 attempts
- **Backoff:** Exponential
- **On failure:** Retry entire step

### Temp File Cleanup
- **Always run:** In finally block
- **On failure:** Log but don't throw (non-critical)
- **Monitoring:** Track disk usage

## Performance Considerations

### Parallel Processing
- ✅ Generate caller + callee videos simultaneously (saves ~2-5 minutes)
- ✅ Download videos from fal.ai in parallel
- ⚠️ Don't parallelize FFmpeg operations (CPU intensive)

### Memory Management
- ✅ Stream large files (don't load entire file into memory)
- ✅ Process files in chunks when possible
- ✅ Monitor memory usage during processing

### Disk Management
- ✅ Use `/tmp` directory (Railway temp storage)
- ✅ Clean up files immediately after use
- ✅ Monitor disk space usage
- ⚠️ Railway has disk limits (check current limits)

### CPU Optimization
- ✅ Use FFmpeg `medium` preset (balance speed/quality)
- ✅ Process videos sequentially (FFmpeg is CPU-intensive)
- ✅ Monitor CPU usage during stitching

### Network Optimization
- ✅ Use S3 signed URLs (no need to make public)
- ✅ Upload directly to S3 (don't store in Railway)
- ✅ Download only when needed

## Monitoring & Logging

### Key Metrics to Track
- Processing time per step
- Memory usage during processing
- CPU usage during FFmpeg operations
- Disk space usage
- S3 upload/download speeds
- fal.ai API response times
- Error rates per step

### Logging Strategy
```typescript
console.log(`[Video Generator] Step 1/8: Downloading recording...`);
console.log(`[Video Generator] Step 2/8: Splitting audio...`);
console.log(`[Video Generator] Step 3/8: Generating videos (parallel)...`);
// etc.
```

## Testing Strategy

### 1. Unit Tests
- Test each function independently
- Mock external dependencies (Twilio, S3, fal.ai)
- Test error handling and retries

### 2. Integration Tests
- Test full pipeline with sample audio
- Use test S3 bucket
- Mock fal.ai responses

### 3. Manual Testing
- Use sample file: `REa1d72f20a5a0fcef68b6e3478c1244b3.mp3`
- Test with real Twilio recording
- Verify split channels are correct
- Check video quality and sync

### 4. Load Testing
- Process multiple videos simultaneously
- Monitor resource usage
- Test error scenarios

## Implementation Order

1. **Phase 1: Foundation**
   - Implement S3 upload/download
   - Implement Twilio recording download
   - Set up error handling utilities

2. **Phase 2: Audio Processing**
   - Implement audio splitting with FFmpeg
   - Test with sample file
   - Verify channel separation

3. **Phase 3: Video Generation**
   - Research fal.ai API
   - Implement fal.ai integration
   - Test video generation

4. **Phase 4: Video Stitching**
   - Implement FFmpeg stitching
   - Test with sample videos
   - Verify output quality

5. **Phase 5: Integration**
   - Wire everything together in worker
   - Add progress tracking
   - Add comprehensive error handling

6. **Phase 6: Optimization**
   - Optimize resource usage
   - Add monitoring
   - Performance tuning

## Railway Deployment Checklist

- [ ] Dockerfile includes FFmpeg installation
- [ ] Environment variables configured
- [ ] S3 bucket and credentials set up
- [ ] fal.ai API key configured
- [ ] Resource limits set (2 vCPU, 2GB RAM)
- [ ] Monitoring/logging configured
- [ ] Error alerts set up
- [ ] Temp file cleanup verified
- [ ] S3 storage verified (not Railway volumes)

