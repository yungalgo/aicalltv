# Video Stitching Strategy

## Problem Statement

Current approach:
- ✅ Cost-optimized: Only generate videos for speech segments (no silence)
- ❌ Poor UX: Black frames during silence, jumpy cuts, feels unnatural

## Goals

1. **Cost Optimization**: Only generate video for speech segments
2. **Natural Viewing Experience**: Smooth transitions, no black screens, feels like a real conversation
3. **Clear Speaker Identification**: Easy to tell who's talking

## Proposed Strategy: "Hold Frame + Smart Transitions"

### Core Concept

Instead of black frames during silence, we:
1. **Hold the last frame** of the speaker who just finished talking
2. **Transition smoothly** between speakers
3. **Use split-screen** with visual emphasis on active speaker

### Implementation Details

#### Phase 1: Video Generation (Cost-Optimized)
- Generate videos only for speech segments (current approach)
- Each video segment contains natural avatar movements synchronized with audio

#### Phase 2: Timeline Reconstruction

For each speaker's timeline:

1. **Speech Segments**: Use generated video segments
2. **Post-Speech Hold**: After speech ends, hold the last frame for:
   - Short silence (< 2s): Hold 0.5-1s, then fade to split-screen
   - Medium silence (2-5s): Hold 1-2s, then fade to split-screen
   - Long silence (> 5s): Hold 2s, then fade to black or split-screen
3. **Pre-Speech Transition**: Before speech starts, fade in from split-screen or previous speaker

#### Phase 3: Split-Screen Composition

**Active Speaker Emphasis:**
- Active speaker: 60% width, slightly brighter, subtle border/glow
- Inactive speaker: 40% width, slightly dimmed
- Both visible: 50/50 split

**Transition Types:**
- **Speaker Change**: Crossfade between speakers (0.3-0.5s)
- **Silence Start**: Fade to split-screen (0.3s)
- **Silence End**: Fade from split-screen to active speaker (0.3s)

### Visual Flow Example

```
Time: 0s    5s    10s   15s   20s
      |-----|-----|-----|-----|
Caller: [===]     [===]       [===]
        speak    speak       speak
        hold     hold        hold
        
Callee:     [===]     [===]
            speak    speak
            hold     hold
            
Screen: [C] [C|B] [B] [B|C] [C]
        full split split split full
```

Where:
- `[C]` = Caller full screen (when caller talking)
- `[B]` = Both split screen (during silence)
- `[C|B]` = Transition from caller to split
- `[B|C]` = Transition from split to caller

### FFmpeg Implementation Strategy

1. **Create Timeline Tracks**:
   - For each speaker: `[speech video] + [hold frame] + [speech video] + [hold frame]...`
   - Hold frames created by extracting last frame and extending duration

2. **Create Transition Overlays**:
   - Use FFmpeg filters for crossfades and fades
   - `fade` filter for fade in/out
   - `overlay` filter for split-screen composition

3. **Compose Final Video**:
   - Layer caller and callee tracks
   - Apply scaling based on active speaker
   - Add transitions at segment boundaries

### Cost Analysis

**Current Approach:**
- Generate: Only speech segments ✅
- Stitch: Black frames (free) ✅
- Total: Minimal cost

**Proposed Approach:**
- Generate: Only speech segments ✅ (same)
- Stitch: Hold frames (free, just frame duplication) ✅
- Transitions: FFmpeg filters (free) ✅
- Total: Same cost, better UX

### Alternative: "Single Shot" Approach

If transitions are too complex, simpler approach:

1. Always show 50/50 split screen
2. When speaker talks: Scale their side to 60%, brighten
3. When silent: Scale to 50%, dim slightly
4. Smooth scale transitions (0.3s)

**Pros:**
- Simpler implementation
- Always clear who's talking
- No complex transitions

**Cons:**
- Less dynamic
- Both speakers always visible (might be distracting)

## Recommendation

**Start with "Single Shot" approach** for MVP:
- Easier to implement
- Good UX
- Same cost
- Can enhance later with transitions

**Enhance to "Hold Frame + Transitions"** for v2:
- Better UX
- More polished
- Still cost-optimized

## Implementation Plan

1. ✅ Keep current speech segment detection
2. ✅ Keep current video generation (only speech)
3. 🔄 Update stitching to use hold frames instead of black frames
4. 🔄 Add split-screen composition with active speaker emphasis
5. 🔄 Add smooth transitions between segments

