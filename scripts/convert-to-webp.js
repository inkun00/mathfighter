import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const bgDir = './public/assets/backgrounds';

async function convert() {
  if (!fs.existsSync(bgDir)) {
    console.error(`Directory does not exist: ${bgDir}`);
    return;
  }
  const files = fs.readdirSync(bgDir);
  for (const file of files) {
    if (file.endsWith('.png')) {
      const inputPath = path.join(bgDir, file);
      const outputPath = path.join(bgDir, file.replace('.png', '.webp'));
      
      console.log(`Converting ${file} to webp...`);
      await sharp(inputPath)
        .webp({ quality: 78 })
        .toFile(outputPath);
        
      console.log(`Successfully created ${path.basename(outputPath)}`);
      
      // Remove original PNG to save size
      fs.unlinkSync(inputPath);
      console.log(`Removed original ${file}`);
    }
  }
}

convert().catch(console.error);
