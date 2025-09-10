const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Create a canvas
const size = 64;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

// Draw the logo
ctx.fillStyle = '#2563EB';
ctx.fillRect(0, 0, size, size);

// Draw the play button
ctx.fillStyle = 'white';
const points = [
  [size * 0.3125, size * 0.25],
  [size * 0.6875, size * 0.5],
  [size * 0.3125, size * 0.75],
];
ctx.beginPath();
ctx.moveTo(points[0][0], points[0][1]);
ctx.lineTo(points[1][0], points[1][1]);
ctx.lineTo(points[2][0], points[2][1]);
ctx.closePath();
ctx.fill();

// Save as favicon.ico
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(path.join(__dirname, '../public/favicon.png'), buffer);

// Create a simple ICO file (most browsers will use the PNG anyway)
const icoBuffer = Buffer.concat([
  Buffer.from([0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  buffer
]);
fs.writeFileSync(path.join(__dirname, '../public/favicon.ico'), icoBuffer);

console.log('Favicon files generated successfully!');
