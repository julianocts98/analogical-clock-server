# Analogical Watch Server

This is the backend server for the [Analogical Clock](https://github.com/julianocts98/analogical-clock) project, check it out to understand better the usage of this server.

This is also a study project to learn about socket communication through the **Socket.IO** package.

Its purpose is to fetch and serve the time data from the timezones that the clients can request, as well to be able to manage users by letting them interact with each other through "Timezone rooms" where the owner can set a specific timezone and all the clients connected to the room will share the same time.

The data from the timezones will be fetched through the [WorldTimeAPI](http://worldtimeapi.org/).

## TODO

- [ ] Fetch specific time from timezones through the API.
- [ ] Manage communication from clients and the server using **Socket.IO**.
- [ ] Enable users to create **Timezone rooms** where the owner can select and share the a timezone in realtime with the room.
