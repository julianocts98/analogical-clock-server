const { Server } = require("socket.io");

const port = 3000;

const io = new Server({
  cors: {
    origin: true,
  },
});

io.on("connection", (socket) => {
  console.log(
    `User ${socket.id} just connected. Total of ${io.engine.clientsCount} connected users.`
  );
  socket.emit(
    "welcome",
    `Welcome, new user! By this time we have ${io.engine.clientsCount} connected clients.
      Your ID is: ${socket.id}`
  );
});

io.listen(port);
