import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'socket.io';

const clients = new Set();

export function initSockets(server, pool) {

  const io = new Server(server, {
    cors: {
      origin: '*',
    },
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });


  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    console.log('Raw WebSocket client connected');
    clients.add(ws);

    ws.on('close', () => {
      console.log('Raw WebSocket client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      clients.delete(ws);
    });
  });

  export function sendNotification(username, message) {
    const payload = JSON.stringify({ type: 'notification', username, message });
    console.log('Sending to clients:', payload);

    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
        console.log('Sent to client');
      } else {
        console.log('Skipped client: not open');
      }
    });
  }

  return { io, wss, sendNotification };
}
