import { cn } from "~/lib/utils";

interface IPhoneFrameProps {
  children?: React.ReactNode;
  className?: string;
  videoSrc?: string;
  width?: number;
  height?: number;
}

export function IPhoneFrame({ children, className, videoSrc, width, height }: IPhoneFrameProps) {
  // iPhone 15 Pro aspect ratio: width/height = 9/19.5
  const aspectRatio = 9 / 19.5;
  
  // Calculate dimensions - if height is provided, calculate width from it
  // If width is provided, use it directly
  // Otherwise default to 240px width
  let frameWidth: number;
  let frameHeight: number;
  
  if (height) {
    frameHeight = height;
    frameWidth = height * aspectRatio;
  } else {
    frameWidth = width || 240;
    frameHeight = frameWidth / aspectRatio;
  }
  
  return (
    <div 
      className={cn(
        "relative",
        className
      )}
    >
      {/* Shadow layer for skeuomorphic depth */}
      <div 
        className="absolute inset-0 rounded-[2rem] blur-2xl opacity-50"
        style={{ 
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 70%, transparent 100%)',
          transform: 'translateY(12px) scale(0.92)',
        }}
      />
      
      {/* iPhone Frame - sleek bezel design */}
      <div 
        className="relative bg-[#1A1A1A]"
        style={{ 
          width: `${frameWidth}px`,
          height: `${frameHeight}px`,
          borderRadius: `${frameWidth * 0.12}px`,
          padding: `${frameWidth * 0.03}px`,
        }}
      >
        {/* Screen Area with inner radius */}
        <div 
          className="relative w-full h-full bg-black overflow-hidden"
          style={{ 
            borderRadius: `${frameWidth * 0.1}px`,
          }}
        >
          {/* Dynamic Island */}
          <div 
            className="absolute top-2 left-1/2 -translate-x-1/2 bg-black z-20"
            style={{ 
              width: `${frameWidth * 0.35}px`,
              height: `${frameWidth * 0.09}px`,
              borderRadius: `${frameWidth * 0.045}px`,
            }}
          />
          
          {/* Video/Content */}
          {videoSrc ? (
            <video
              src={videoSrc}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            children || (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-900 to-black">
                <p className="text-white/20 text-xs">video preview</p>
              </div>
            )
          )}
          
          {/* Home Indicator */}
          <div 
            className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/40 z-20"
            style={{ 
              width: `${frameWidth * 0.35}px`,
              height: `${frameWidth * 0.02}px`,
              borderRadius: `${frameWidth * 0.01}px`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
