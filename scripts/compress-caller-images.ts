/**
 * Compress and resize caller images for web viewing
 * 
 * Run: bun scripts/compress-caller-images.ts
 */

import { readdir, readFile, writeFile, stat } from "fs/promises";
import { join, resolve } from "path";
import sharp from "sharp";

const CALLERS_DIR = resolve(process.cwd(), "callers");
const MAX_SIZE = 800; // Max width/height for web (800px is good for headshots)
const QUALITY = 85; // WebP quality (0-100)

async function compressImage(filePath: string): Promise<{ originalSize: number; newSize: number; saved: number }> {
  const originalBuffer = await readFile(filePath);
  const originalSize = originalBuffer.length;
  
  // Get image metadata
  const metadata = await sharp(originalBuffer).metadata();
  const currentWidth = metadata.width || 0;
  const currentHeight = metadata.height || 0;
  
  // Resize if needed (maintain aspect ratio, max dimension)
  let sharpInstance = sharp(originalBuffer);
  
  if (currentWidth > MAX_SIZE || currentHeight > MAX_SIZE) {
    sharpInstance = sharpInstance.resize(MAX_SIZE, MAX_SIZE, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  
  // Convert to WebP for better compression
  const compressedBuffer = await sharpInstance
    .webp({ quality: QUALITY })
    .toBuffer();
  
  const newSize = compressedBuffer.length;
  
  // Write compressed file (replace original)
  await writeFile(filePath.replace(".png", ".webp"), compressedBuffer);
  
  // Also create optimized PNG version (for compatibility)
  const optimizedPngBuffer = await sharpInstance
    .png({ 
      quality: 90,
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toBuffer();
  
  // Backup original and save optimized PNG
  const backupPath = filePath.replace(".png", ".png.backup");
  await writeFile(backupPath, originalBuffer);
  await writeFile(filePath, optimizedPngBuffer);
  
  const saved = originalSize - Math.min(newSize, optimizedPngBuffer.length);
  
  return {
    originalSize,
    newSize: Math.min(newSize, optimizedPngBuffer.length),
    saved,
  };
}

async function main() {
  console.log("=".repeat(70));
  console.log("🗜️  Compressing caller images for web...");
  console.log(`📁 Directory: ${CALLERS_DIR}`);
  console.log(`📏 Max size: ${MAX_SIZE}x${MAX_SIZE}px`);
  console.log(`🎨 Format: WebP (${QUALITY}% quality) + Optimized PNG`);
  console.log("=".repeat(70));
  console.log("");

  try {
    const files = await readdir(CALLERS_DIR);
    const pngFiles = files.filter((f) => f.toLowerCase().endsWith(".png") && !f.includes(".backup"));
    
    console.log(`Found ${pngFiles.length} PNG files to compress\n`);
    
    let totalOriginalSize = 0;
    let totalNewSize = 0;
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < pngFiles.length; i++) {
      const file = pngFiles[i];
      const filePath = join(CALLERS_DIR, file);
      
      try {
        const fileStat = await stat(filePath);
        const fileSizeMB = (fileStat.size / 1024 / 1024).toFixed(1);
        
        console.log(`[${i + 1}/${pngFiles.length}] Processing: ${file} (${fileSizeMB} MB)`);
        
        const result = await compressImage(filePath);
        
        const originalMB = (result.originalSize / 1024 / 1024).toFixed(1);
        const newMB = (result.newSize / 1024 / 1024).toFixed(1);
        const savedMB = (result.saved / 1024 / 1024).toFixed(1);
        const savedPercent = ((result.saved / result.originalSize) * 100).toFixed(1);
        
        console.log(`   ✅ Compressed: ${originalMB} MB → ${newMB} MB (saved ${savedMB} MB, ${savedPercent}%)`);
        console.log(`   📦 Created: ${file.replace(".png", ".webp")} (WebP version)\n`);
        
        totalOriginalSize += result.originalSize;
        totalNewSize += result.newSize;
        successCount++;
      } catch (error) {
        console.error(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}\n`);
        failCount++;
      }
    }
    
    const totalOriginalMB = (totalOriginalSize / 1024 / 1024).toFixed(1);
    const totalNewMB = (totalNewSize / 1024 / 1024).toFixed(1);
    const totalSavedMB = ((totalOriginalSize - totalNewSize) / 1024 / 1024).toFixed(1);
    const totalSavedPercent = (((totalOriginalSize - totalNewSize) / totalOriginalSize) * 100).toFixed(1);
    
    console.log("=".repeat(70));
    console.log("📊 COMPRESSION COMPLETE");
    console.log("=".repeat(70));
    console.log(`✅ Successfully compressed: ${successCount}/${pngFiles.length}`);
    if (failCount > 0) {
      console.log(`❌ Failed: ${failCount}/${pngFiles.length}`);
    }
    console.log(`📦 Total size: ${totalOriginalMB} MB → ${totalNewMB} MB`);
    console.log(`💾 Total saved: ${totalSavedMB} MB (${totalSavedPercent}%)`);
    console.log(`📁 Original files backed up with .backup extension`);
    console.log(`🌐 WebP versions created for modern browsers`);
    console.log("=".repeat(70));
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

