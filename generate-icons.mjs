import sharp from 'sharp';
import fs from 'fs';
import pngToIco from 'png-to-ico';

async function generate() {
  const svgBuffer = fs.readFileSync('./public/logo.svg');
  
  // Create 16x16
  await sharp(svgBuffer)
    .resize(16, 16)
    .png()
    .toFile('./public/favicon-16x16.png');
    
  // Create 32x32
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile('./public/favicon-32x32.png');
    
  // Create apple-touch-icon (180x180)
  // adding a dark background since Apple touch icons shouldn't have transparency
  await sharp(svgBuffer)
    .resize(180, 180)
    .flatten({ background: '#020412' })
    .png()
    .toFile('./public/apple-touch-icon.png');
    
  // Create favicon.ico
  const icoBuffer = await pngToIco('./public/favicon-32x32.png');
  fs.writeFileSync('./public/favicon.ico', icoBuffer);
  
  console.log('Icons generated successfully.');
}

generate().catch(console.error);
