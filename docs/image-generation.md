# Image Generation Architecture

## Overview

We need to generate custom images for the WavespeedAI multi-person video generation. Instead of using a static default image, we'll dynamically generate images using Nanonets Banana Pro that show two people in a split-screen phone call format.

## Architecture

### File Structure

```
src/lib/image/
  ├── banana-generator.ts      # Nanonets Banana Pro API integration
  ├── prompt-builder.ts         # Build prompts for image generation
  └── index.ts                  # Main export
```

### Flow

1. **Image Generation Request**
   - When video generation starts, check if we need a custom image
   - Build a prompt describing the split-screen phone call scenario
   - Call Nanonets Banana Pro to generate the image
   - Upload generated image to S3
   - Return S3 URL for use in WavespeedAI

2. **Integration with Video Generation**
   - Replace default image URL with generated image URL
   - Pass to `generateMultiPersonVideo()` function

## Image Prompt Design

### Concept
The image should look like a **split-screen phone call** - two people talking on a video call, vertically split down the middle, like a TV show format.

### Prompt Structure

```
"A split-screen phone call scene, vertically divided down the middle. 
Left side: [caller description] sitting in [caller setting], looking at camera. 
Right side: [callee description] sitting in [callee setting], looking at camera. 
Both people appear to be on a video call, with phone/computer screens visible. 
Modern, professional, well-lit. Split-screen format with vertical divider in center."
```

### Prompt Variations

**Basic Template:**
```
"Split-screen video call scene, vertical division. Left: person on phone call, 
professional setting. Right: person on phone call, professional setting. 
Both looking at camera. Modern, clean, well-lit."
```

**With Context (if available):**
```
"Split-screen video call scene, vertical division. Left: [caller name/description] 
on video call, [setting description]. Right: [callee name/description] on video call, 
[setting description]. Both looking at camera. Modern, professional, well-lit."
```

### Key Elements

1. **Split-screen format** - Vertical division down the middle
2. **Two people** - One on left, one on right
3. **Video call context** - Phones/computers visible, video call UI elements
4. **Professional appearance** - Clean, modern, well-lit
5. **Camera-facing** - Both people looking at camera (for talking avatar generation)

## Implementation Details

### 1. Nanonets Banana Pro Integration

**File:** `src/lib/image/banana-generator.ts`

```typescript
export interface BananaImageOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;  // Default: 512
  height?: number; // Default: 512
  seed?: number;
}

export interface BananaImageResult {
  imageUrl: string; // S3 URL of generated image
  jobId: string;
}

/**
 * Generate image using Nanonets Banana Pro
 */
export async function generateImageWithBanana(
  options: BananaImageOptions
): Promise<BananaImageResult> {
  // 1. Call Nanonets Banana Pro API
  // 2. Poll for completion
  // 3. Download generated image
  // 4. Upload to S3
  // 5. Return S3 URL
}
```

### 2. Prompt Builder

**File:** `src/lib/image/prompt-builder.ts`

```typescript
export interface CallContext {
  callerName?: string;
  calleeName?: string;
  callerContext?: string; // From call record
  calleeContext?: string; // From call record
}

/**
 * Build prompt for split-screen phone call image
 */
export function buildSplitScreenCallPrompt(
  context?: CallContext
): string {
  const basePrompt = 
    "Split-screen video call scene, vertical division down the middle. " +
    "Left side: person on video call, professional setting, looking at camera. " +
    "Right side: person on video call, professional setting, looking at camera. " +
    "Both people appear to be on a video call with phone/computer screens visible. " +
    "Modern, professional, well-lit. Split-screen format with vertical divider in center.";
  
  // Add context if available
  if (context?.callerName || context?.callerContext) {
    // Enhance left side description
  }
  
  if (context?.calleeName || context?.calleeContext) {
    // Enhance right side description
  }
  
  return basePrompt;
}
```

### 3. Integration Point

**File:** `src/lib/workers/video-generator.ts`

```typescript
// Before generating video:
const imageUrl = await generateCallImage(callId, {
  callerName: call.recipientName, // Or from user profile
  calleeContext: call.recipientContext,
});

// Then pass to video generation:
const videoResult = await generateMultiPersonVideo(
  callerS3Url,
  calleeS3Url,
  callId,
  imageUrl, // Use generated image instead of default
  audioDuration,
);
```

## API Details

### Nanonets Banana Pro

**Endpoint:** `https://api.banana.dev/v1/...` (check actual endpoint)

**Request:**
```json
{
  "prompt": "Split-screen video call scene...",
  "negative_prompt": "blurry, low quality, distorted",
  "width": 512,
  "height": 512,
  "seed": -1
}
```

**Response:**
```json
{
  "jobId": "...",
  "status": "pending"
}
```

**Polling:**
- Poll `/predictions/{jobId}/result` every 1-2 seconds
- When `status === "completed"`, download image from `outputs[0]`

## Caching Strategy

### Option 1: Per-Call Image
- Generate new image for each call
- Store in S3: `images/{callId}.jpg`
- Pros: Unique per call
- Cons: More API calls, slower

### Option 2: Reusable Template Images
- Generate a few template images
- Reuse across calls
- Store in S3: `images/templates/split-screen-{variant}.jpg`
- Pros: Faster, cheaper
- Cons: Less personalized

### Option 3: Hybrid
- Generate image with call context hash
- Cache by context hash
- Reuse if same context
- Store in S3: `images/cache/{contextHash}.jpg`

**Recommended:** Start with Option 1 (per-call), optimize to Option 3 later.

## Error Handling

1. **Banana API fails** → Fall back to default image
2. **Image generation timeout** → Fall back to default image
3. **S3 upload fails** → Retry with exponential backoff
4. **Invalid image format** → Validate before uploading

## Cost Considerations

- Nanonets Banana Pro pricing per image generation
- S3 storage costs for images
- Consider caching to reduce API calls

## Future Enhancements

1. **User-uploaded images** - Allow users to upload custom split-screen images
2. **Style variations** - Different visual styles (professional, casual, etc.)
3. **Dynamic backgrounds** - Based on call context
4. **Avatar customization** - Match user profile pictures if available

## Implementation Steps

1. ✅ Create `src/lib/image/` folder structure
2. ✅ Implement `banana-generator.ts` with API integration
3. ✅ Implement `prompt-builder.ts` with prompt logic
4. ✅ Integrate into video generator worker
5. ✅ Add error handling and fallback to default image
6. ✅ Test end-to-end flow
7. ✅ Add caching if needed

## Environment Variables

```bash
BANANA_API_KEY=...          # Nanonets Banana Pro API key
BANANA_MODEL_ID=...         # Model ID for image generation
```

## Example Usage

```typescript
import { generateCallImage } from "~/lib/image";

// In video generator:
const imageUrl = await generateCallImage(callId, {
  callerName: "John",
  calleeName: "Jane",
  callerContext: "Tech support call",
});

// Use in video generation
await generateMultiPersonVideo(
  callerAudioUrl,
  calleeAudioUrl,
  callId,
  imageUrl,
  audioDuration,
);
```

