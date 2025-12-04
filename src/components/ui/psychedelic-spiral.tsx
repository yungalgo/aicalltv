"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

interface PsychedelicSpiralProps {
  spinRotation?: number;
  spinSpeed?: number;
  offset?: [number, number];
  color1?: string;
  color2?: string;
  color3?: string;
  contrast?: number;
  lighting?: number;
  spinAmount?: number;
  pixelFilter?: number;
  spinEase?: number;
  isRotate?: boolean;
  mouseInteraction?: boolean;
  className?: string;
  [key: string]: unknown;
}

export function PsychedelicSpiral({
  spinRotation = -2.0,
  spinSpeed = 7.0,
  offset = [0.0, 0.0],
  color1 = "#03301D", // Primary dark green
  color2 = "#86EE02", // Bright green accent
  color3 = "#541388", // Purple secondary
  contrast = 3.5,
  lighting = 0.4,
  spinAmount = 0.25,
  pixelFilter = 745.0,
  spinEase = 1.0,
  isRotate = false,
  mouseInteraction = true,
  className,
  ...props
}: PsychedelicSpiralProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [webglSupported, setWebglSupported] = useState(true);

  // Convert hex to RGB
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
          parseInt(result[1], 16) / 255,
          parseInt(result[2], 16) / 255,
          parseInt(result[3], 16) / 255,
        ]
      : [0, 0, 0];
  };

  const [r1, g1, b1] = hexToRgb(color1);
  const [r2, g2, b2] = hexToRgb(color2);
  const [r3, g3, b3] = hexToRgb(color3);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) {
      console.warn("WebGL not supported");
      setWebglSupported(false);
      return;
    }

    setWebglSupported(true);

    // Vertex shader source
    const vertexShaderSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Fragment shader source
    const fragmentShaderSource = `
      precision mediump float;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      uniform float u_spinRotation;
      uniform float u_spinSpeed;
      uniform vec2 u_offset;
      uniform vec3 u_color1;
      uniform vec3 u_color2;
      uniform vec3 u_color3;
      uniform float u_contrast;
      uniform float u_lighting;
      uniform float u_spinAmount;
      uniform float u_pixelFilter;
      uniform float u_spinEase;
      uniform bool u_isRotate;

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        uv += u_offset;
        
        vec2 mouse = (u_mouse - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        if (u_mouse.x > 0.0 && u_mouse.y > 0.0) {
          uv += (mouse - uv) * 0.1;
        }
        
        float angle = atan(uv.y, uv.x);
        float radius = length(uv);
        
        float time = u_isRotate ? u_time * u_spinSpeed : 0.0;
        float spiral = sin(angle * u_spinEase + radius * u_pixelFilter * u_spinAmount + time * u_spinRotation);
        
        float pattern = spiral * u_contrast + u_lighting;
        pattern = clamp(pattern, 0.0, 1.0);
        
        vec3 color = mix(u_color1, mix(u_color2, u_color3, pattern * 0.5), pattern);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Compile shader
    const compileShader = (source: string, type: number): WebGLShader | null => {
      const shader = gl.createShader(type as GLenum);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) {
      setWebglSupported(false);
      return;
    }

    // Create program
    const program = gl.createProgram();
    if (!program) {
      setWebglSupported(false);
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      setWebglSupported(false);
      return;
    }

    gl.useProgram(program);

    // Set up geometry
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const mouseLocation = gl.getUniformLocation(program, "u_mouse");
    const spinRotationLocation = gl.getUniformLocation(program, "u_spinRotation");
    const spinSpeedLocation = gl.getUniformLocation(program, "u_spinSpeed");
    const offsetLocation = gl.getUniformLocation(program, "u_offset");
    const color1Location = gl.getUniformLocation(program, "u_color1");
    const color2Location = gl.getUniformLocation(program, "u_color2");
    const color3Location = gl.getUniformLocation(program, "u_color3");
    const contrastLocation = gl.getUniformLocation(program, "u_contrast");
    const lightingLocation = gl.getUniformLocation(program, "u_lighting");
    const spinAmountLocation = gl.getUniformLocation(program, "u_spinAmount");
    const pixelFilterLocation = gl.getUniformLocation(program, "u_pixelFilter");
    const spinEaseLocation = gl.getUniformLocation(program, "u_spinEase");
    const isRotateLocation = gl.getUniformLocation(program, "u_isRotate");

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      timeRef.current += 0.016; // ~60fps

      gl.uniform1f(timeLocation, timeRef.current);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform2f(mouseLocation, mouseRef.current.x, mouseRef.current.y);
      gl.uniform1f(spinRotationLocation, spinRotation);
      gl.uniform1f(spinSpeedLocation, spinSpeed);
      gl.uniform2f(offsetLocation, offset[0], offset[1]);
      gl.uniform3f(color1Location, r1, g1, b1);
      gl.uniform3f(color2Location, r2, g2, b2);
      gl.uniform3f(color3Location, r3, g3, b3);
      gl.uniform1f(contrastLocation, contrast);
      gl.uniform1f(lightingLocation, lighting);
      gl.uniform1f(spinAmountLocation, spinAmount);
      gl.uniform1f(pixelFilterLocation, pixelFilter);
      gl.uniform1f(spinEaseLocation, spinEase);
      gl.uniform1i(isRotateLocation, isRotate ? 1 : 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseInteraction) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    if (mouseInteraction) {
      canvas.addEventListener("mousemove", handleMouseMove);
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (mouseInteraction) {
        canvas.removeEventListener("mousemove", handleMouseMove);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [
    spinRotation,
    spinSpeed,
    offset,
    r1,
    g1,
    b1,
    r2,
    g2,
    b2,
    r3,
    g3,
    b3,
    contrast,
    lighting,
    spinAmount,
    pixelFilter,
    spinEase,
    isRotate,
    mouseInteraction,
  ]);

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)} {...props}>
      {webglSupported ? (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ display: "block" }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#03301D] via-[#86EE02] to-[#541388] opacity-50" />
      )}
    </div>
  );
}

