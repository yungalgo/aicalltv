"use client";

import React, { forwardRef } from "react";
import { Shader } from "react-shaders";
import { cn } from "~/lib/utils";

export interface WarpedNoiseShadersProps extends React.HTMLAttributes<HTMLDivElement> {
  speed?: number;
  scale?: number;
  warpStrength?: number;
  colorIntensity?: number;
  noiseDetail?: number;
}

// Light mode shader - more saturated pink/magenta gradient (reduced white)
const fragmentShader = `
float colormap_red(float x) {
    if (x < 0.0) {
        return 54.0 / 255.0;
    } else if (x < 20049.0 / 82979.0) {
        return (829.79 * x + 54.51) / 255.0;
    } else {
        return 0.95; // Reduced from 1.0 to keep more color
    }
}

float colormap_green(float x) {
    if (x < 20049.0 / 82979.0) {
        return 0.0;
    } else if (x < 327013.0 / 810990.0) {
        return (8546482679670.0 / 10875673217.0 * x - 2064961390770.0 / 10875673217.0) / 255.0;
    } else if (x <= 1.0) {
        return min((103806720.0 / 483977.0 * x + 19607415.0 / 483977.0) / 255.0, 0.75); // Capped to reduce white
    } else {
        return 0.75; // Reduced from 1.0
    }
}

float colormap_blue(float x) {
    if (x < 0.0) {
        return 54.0 / 255.0;
    } else if (x < 7249.0 / 82979.0) {
        return (829.79 * x + 54.51) / 255.0;
    } else if (x < 20049.0 / 82979.0) {
        return 127.0 / 255.0;
    } else if (x < 327013.0 / 810990.0) {
        return (792.02249341361393720147485376583 * x - 64.364790735602331034989206222672) / 255.0;
    } else {
        return 0.9; // Reduced from 1.0 to keep more magenta
    }
}

vec4 colormap(float x) {
    return vec4(colormap_red(x), colormap_green(x), colormap_blue(x), 1.0);
}

float rand(vec2 n) {
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float noise(vec2 p){
    vec2 ip = floor(p);
    vec2 u = fract(p);
    u = u*u*(3.0-2.0*u);

    float res = mix(
        mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
        mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
    return res*res;
}

float fbm( vec2 p )
{
    const mat2 mtx = mat2( 0.80,  0.60, -0.60,  0.80 );
    float f = 0.0;

    f += 0.500000*noise( p + iTime * u_speed  ); p = mtx*p*2.02;
    f += 0.031250*noise( p ); p = mtx*p*2.01;
    f += 0.250000*noise( p ); p = mtx*p*2.03;
    f += 0.125000*noise( p ); p = mtx*p*2.01;
    f += 0.062500*noise( p ); p = mtx*p*2.04;
    f += 0.015625*noise( p + sin(iTime * u_speed) );

    return f/0.96875;
}

float pattern( in vec2 p )
{
    return fbm( p + fbm( p + fbm( p ) ) * u_warpStrength );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.x * u_scale;
    float shade = pattern(uv * u_noiseDetail);
    vec4 color = colormap(shade);
    color.rgb *= u_colorIntensity;
    fragColor = vec4(color.rgb, shade);
}
`;

export const WarpedNoiseShaders = forwardRef<HTMLDivElement, WarpedNoiseShadersProps>(({
  className,
  speed = 1.0,
  scale = 1.0,
  warpStrength = 1.0,
  colorIntensity = 1.0,
  noiseDetail = 1.0,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn('w-full h-full', className)}
      {...props}
    >
      <Shader
        fs={fragmentShader}
        uniforms={{
          u_speed: { type: '1f', value: speed },
          u_scale: { type: '1f', value: scale },
          u_warpStrength: { type: '1f', value: warpStrength },
          u_colorIntensity: { type: '1f', value: colorIntensity },
          u_noiseDetail: { type: '1f', value: noiseDetail },
        }}
        // @ts-expect-error react-shaders expects CSSStyleDeclaration but accepts object
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
});

WarpedNoiseShaders.displayName = "WarpedNoiseShaders";
