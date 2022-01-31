const { Server } = require("socket.io");
const axios = require("axios");

const port = 3000;

const WORLD_TIME_API_URL = "https://worldtimeapi.org/api/timezone";

let roomOwner = {};

function timezoneRoomExists(roomName) {
  return roomName in roomOwner;
}

function timezoneRoomOwnerId(roomName) {
  return roomOwner[roomName];
}

function setTimezoneRoomOwnerId(roomName, roomOwnerId) {
  roomOwner[roomName] = roomOwnerId;
}

function createTimezoneRoom(roomName, userSocket) {
  function emitTimezoneRoomCreateResult(message, statusResponse, roomName) {
    userSocket.emit(
      "timezoneRoom:create:result",
      message,
      statusResponse,
      roomName,
      roomName !== undefined ? timezoneRoomOwnerId(roomName) : undefined
    );
  }

  if (isSocketInATimezoneRoom(userSocket)) {
    const currentRoomName = getTimezoneRoomBySocket(userSocket);
    if (roomName === currentRoomName) {
      emitTimezoneRoomCreateResult(`You are already in this room!`, false);
      return false;
    }
    userSocket.leave(currentRoomName);
  }

  if (!isValidRoomName(roomName)) {
    emitTimezoneRoomCreateResult(
      "Invalid room name!\n Length must be higher than just one character.\n\" '  ` and whitespaces are not allowed either!",
      false
    );
    return false;
  }

  if (timezoneRoomExists(roomName)) {
    emitTimezoneRoomCreateResult(`Room name already taken! Try another`, false);
    return false;
  }

  roomOwner[roomName] = userSocket.id;
  userSocket.join(roomName);
  emitTimezoneRoomCreateResult(`Room ${roomName} created`, true, roomName);

  return true;
}

function getTimezoneRoomBySocket(socket) {
  return Array.from(socket.rooms)[1];
}

function isSocketInATimezoneRoom(socket) {
  return socket.rooms.size > 1;
}

function isSocketOwnerOfTimezoneRoom(socket) {
  const room = getTimezoneRoomBySocket(socket);
  return roomOwner[room] === socket.id;
}

function checkIfTimezoneRoomExists(timezoneRoomName) {
  return timezoneRoomName in roomOwner;
}

async function fetchTimezones() {
  try {
    const response = await axios(WORLD_TIME_API_URL);
    return await response.data;
  } catch (error) {
    console.log(error);
    return error;
  }
}

async function getDatetimeByTimezone(timezone) {
  try {
    const response = await axios(`${WORLD_TIME_API_URL}/${timezone}`);
    return await response.data.datetime;
  } catch (error) {
    console.log(error);
    return error;
  }
}

function isValidRoomName(roomName) {
  const re = /^[^-\s][\w\s-]+$/g;
  return re.test(roomName);
}

function formatDatetime(datetime) {
  return datetime.substring(0, 26);
}

function onTimezoneChanged(socket) {
  socket.on("timezoneChanged", async (selectedTimezone) => {
    if (isSocketInTimezoneRoom(socket) && isSocketOwnerOfTimezoneRoom(socket)) {
      if (selectedTimezone != "local") {
        const room = getTimezoneRoomBySocket(socket);
        const datetimeOfTimezone = formatDatetime(
          await getDatetimeByTimezone(selectedTimezone)
        );
        io.to(room).emit("datetimeOfTimezone", datetimeOfTimezone);
      }
    } else {
      if (selectedTimezone !== "local") {
        const datetimeOfTimezone = formatDatetime(
          await getDatetimeByTimezone(selectedTimezone)
        );
        socket.emit("datetimeOfTimezone", datetimeOfTimezone);
      }
    }
  });
}

async function onConnection(socket) {
  console.log(
    `> User ${socket.id} just connected. Total of ${io.engine.clientsCount} connected users.`
  );
  socket.emit(
    "welcome",
    `Welcome, new user! By this time we have ${io.engine.clientsCount} connected clients.
          Your ID is: ${socket.id}`
  );
  const timezonesAvailable = await fetchTimezones();
  socket.emit(
    "fetchTimezones",
    "Available timezones sent!",
    timezonesAvailable
  );
}

function onTimezoneRoomCreate(socket) {
  socket.on("timezoneRoom:create", (timezoneRoomName) => {
    socket.on("disconnect", () => {
      console.log(`> User ${socket.id} disconnected!`);
    });

    if (socket.rooms.size > 1) {
      const previousRoom = Array.from(socket.rooms)[1];
      socket.leave(previousRoom);
    }

    if (isValidRoomName(timezoneRoomName)) {
      if (!checkIfTimezoneRoomExists(timezoneRoomName)) {
        roomOwner[timezoneRoomName] = socket.id;
        socket.join(timezoneRoomName);
        socket.emit(
          "timezoneRoom:create:result",
          `Room created`,
          true,
          timezoneRoomName,
          roomOwner[timezoneRoomName]
        );
      } else {
        socket.emit(
          "timezoneRoom:create:result",
          `Room name already taken! Try another`,
          false
        );
      }
    } else {
      socket.emit(
        "timezoneRoom:create:result",
        "Invalid room name!\n Length must be higher than just one character.\n\" '  ` and whitespaces are not allowed either!",
        false
      );
    }
  });
}

//needs to send owner timezone when entering
function onTimezoneRoomJoin(socket) {
  socket.on("timezoneRoom:join", async (timezoneRoomName) => {
    if (checkIfTimezoneRoomExists(timezoneRoomName)) {
      const previousRoom = Array.from(socket.rooms)[1];
      socket.leave(previousRoom);
      socket.join(timezoneRoomName);
      const socketsIds = Array.from(await io.in(timezoneRoomName).allSockets());
      socket.emit(
        "timezoneRoom:join:result",
        "Joined successfully!",
        true,
        timezoneRoomName,
        socketsIds,
        roomOwner[timezoneRoomName]
      );
    } else {
      socket.emit("timezoneRoom:join:result", "Room not found!", false);
    }
  });
}

const io = new Server({
  cors: {
    origin: true,
  },
});

io.on("connection", (socket) => {
  onConnection(socket);
  onTimezoneChanged(socket);
  onTimezoneRoomCreate(socket);
  onTimezoneRoomJoin(socket);
});

io.of("/").adapter.on("delete-room", (room) => {
  if (room in roomOwner) {
    delete roomOwner[room];
    console.log(`Room ${room} deleted!`);
  }
});

io.of("/").adapter.on("leave-room", async (room, id) => {
  if (room in roomOwner) {
    const allSockets = await io.in(room).allSockets();
    const socketsIds = Array.from(allSockets);
    if (socketsIds.length > 0) {
      const newOwner = socketsIds[0];
      setTimezoneRoomOwnerId(room, newOwner);
      console.log(`> User ${id} left room ${room}`);
      console.log(`> Changed owner of ${room} from ${id} to ${newOwner}`);
      io.to(room).emit("timezoneRoom:userLeft", room, socketsIds, newOwner);
    }
  }
});

io.of("/").adapter.on("join-room", async (room, id) => {
  if (room != id) {
    const socketsIds = Array.from(await io.in(room).allSockets());
    io.to(room).emit("timezoneRoom:newUserJoined", room, socketsIds);
    console.log(`> User ${id} joined ${room}`);
  }
});

io.listen(port);
