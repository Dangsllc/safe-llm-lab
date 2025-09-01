// Simple debug server to test if Node.js is working
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html>
      <head><title>Debug Server</title></head>
      <body>
        <h1>Node.js is working!</h1>
        <p>Time: ${new Date().toISOString()}</p>
        <p>If you see this, Node.js is functioning properly.</p>
      </body>
    </html>
  `);
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Debug server running at http://localhost:${PORT}`);
});
