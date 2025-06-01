import { WebSocketServer } from 'ws'; 



export function startSocketServer() {
const server = http.createServer(app);


const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const wss = new WebSocketServer({ server });


io.on('connection', (socket) => {
  socket.emit('welcome', { message: 'Welcome to the Socket.IO server!' });
  socket.on('disconnect', () => {
    console.log('Socket.IO client disconnected');
  });
});

wss.on('connection', function(ws) {

  ws.send(JSON.stringify({ message: 'Welcome to the WebSocket server!' }));
  
  ws.on('message', function(message) {
    console.log('received: %s', message);
    ws.send(message.toString());
  });
  
  ws.on('close', function() {
    console.log('Raw WebSocket client disconnected');
  });
});
}


