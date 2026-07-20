import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const bgDir = './public/assets/backgrounds';
const assetDir = './public/assets';

async function convert() {
  // 1. Convert background images
  if (fs.existsSync(bgDir)) {
    const files = fs.readdirSync(bgDir);
    for (const file of files) {
      if (file.endsWith('.png')) {
        const inputPath = path.join(bgDir, file);
        const outputPath = path.join(bgDir, file.replace('.png', '.webp'));
        console.log(`Converting ${file} to webp...`);
        await sharp(inputPath).webp({ quality: 78 }).toFile(outputPath);
        fs.unlinkSync(inputPath);
        console.log(`Removed original ${file}`);
      }
    }
  }

  // 2. Convert boss images
  const bossFiles = ['boss.png', 'boss2.png'];
  for (const file of bossFiles) {
    const inputPath = path.join(assetDir, file);
    const outputPath = path.join(assetDir, file.replace('.png', '.webp'));
    if (fs.existsSync(inputPath)) {
      console.log(`Converting ${file} to webp...`);
      await sharp(inputPath).webp({ quality: 78 }).toFile(outputPath);
      fs.unlinkSync(inputPath);
      console.log(`Removed original ${file}`);
    }
  }
}

convert().catch(console.error);
