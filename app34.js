const express = require("express");
const http = require("http");
const cors = require("cors");
const bodyParser = require("body-parser");
var { graphqlHTTP } = require("express-graphql");
var { buildSchema } = require("graphql");
const mongoose = require("mongoose");
const graphqlSchema = require("./graphql/schema/index");
const graphqlResolver = require("./graphql/resolver/index");
// init system hashing
const { createGame } = require("./utils/bustgame");
const isAuth = require("./middleware/is-auth");

const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const gameSocket = require("./socket/gameSocket");

app.use(isAuth);
app.use(cors());
app.use(bodyParser.json());

// initialization of graphql
app.use(
  "/graphql",
  graphqlHTTP({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
  })
);

// REST API routes
app.get("/", (req, res) => {
  res.send("server up");
  //   res.sendFile(__dirname + "/index.html");
});

// socketio initialization and connection check
const io = new Server(server, {
  transports: ["polling"],
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});
io.on("connection", (socket) => {
  require("./socket/gameSocket")(socket);
});
// express server
server.listen(3001, () => {
  // mongoose connection
  mongoose
    .connect(
      `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PWD}@127.0.0.1:${process.env.MONGO_PORT}/${process.env.MONGO_DB}`
    )
    .then(() => {
      console.log("db connected");
    })
    .catch((err) => console.log(err));
  // end mongoose connection

  // createGame();
  console.log("listening on *:3001");
});

module.exports = io;
