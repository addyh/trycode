import socket from 'socket.io';
import http from './http';
import config from '../config';
import CodeClass from '../classes/CodeClass';

const Code = new CodeClass();
const io = socket.listen(http.app.server);

io.on('connection', (socket) => {

  // Editor

  // The code was changed
  socket.on('server:editor:change', (data) => {
    // Tell everyone
    socket.broadcast.emit('client:editor:change', data);
  });

  // The syntax was changed
  socket.on('server:editor:mode',(data) => {
    // Tell everyone
    socket.broadcast.emit('client:editor:mode', data);
    // Update syntax in database
    Code.setMode(data.cid, data.mode);
  });

  // Cursor
  socket.on('server:editor:cursor',(data) => {
    // Tell everyone
    socket.broadcast.emit('client:editor:cursor', data);
  });

  socket.on('server:editor:viewer',(data) => {
    Code.viewer(data.type, data.cid, data.status);
  });

  socket.on('disconnect',() => {
  });

});

console.log('Sockets are running');
