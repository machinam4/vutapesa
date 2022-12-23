const express = require("express");
require("dotenv").config();
const http = require("http");
const cors = require("cors");
const bodyParser = require("body-parser");
var { graphqlHTTP } = require("express-graphql");
var { buildSchema } = require("graphql");
const mongoose = require("mongoose");
const graphqlSchema = require("./graphql/schema/index");
const graphqlResolver = require("./graphql/resolver/index");
// init system hashing
const { createGame, endGame, addBots } = require("./utils/bustgame");
const isAuth = require("./middleware/is-auth");
const { socketIO, socketCON } = require("./socket/socketio");
const socketAuth = require("./middleware/socketAuth");
const path = require("path");

const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");

// socket files
const { connection } = require("./socket/gameHandler");

const { startGame } = require("./utils/gameplay");
const {
  registerUrl,
  expressSTK,
  confirmation,
  validation,
} = require("./accounts/mpesa_c2b");
const { withdrawConfirm } = require("./accounts/mpesa_b2c");
const Bets = require("./models/Bet");

app.use(isAuth);
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
// app.use(bodyParser.json());

// initialization of graphql
app.use(
  "/vutapesa",
  graphqlHTTP({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
  })
);
app.use(express.static(path.join(__dirname + "/public/build")));
// REST API routes
app.get("/api", (req, res) => {
  // res.send("server up");
});

app.get("/api/v1/callback/registerUrl", (req, res) => {
  registerUrl(req, res);
});
app.post("/api/v1/callback/express", (req, res) => {
  expressSTK(req, res);
});
app.post("/api/v1/callback/confirmation", (req, res) => {
  confirmation(req, res);
});
app.post("/api/v1/callback/validation", (req, res) => {
  validation(req, res);
});
app.post("/api/v1/callback/withdrawConfirm", (req, res) =>
  withdrawConfirm(req, res)
);
// Route.get('social/:provider', 'SocialController.redirect')

// socketio initialization and connection check
const io = socketIO(server);

const onConnection = (socket) => {
  connection(io, socket);
};

io.on("connection", onConnection);
io.use(socketAuth);
// bust game

let intervalId;

let counterValue = 10;
let countInterval = 101;

const StartBust = () => {
  const waitCount = async () => {
    counterValue = 10; //set counter value to 0 before countoing
    intervalId = await setInterval(() => {
      counterValue -= 0.1;
      // console.log(counterValue.toFixed(2));
      io.sockets.emit("game_wait", counterValue.toFixed(2));
      if (counterValue <= 0.2) {
        clearInterval(intervalId);
        // console.log("second left = ", counterValue);
        bustStart();
      }
    }, 100);
  };

  // count bust value
  const bustCount = async (game) => {
    intervalId = await setInterval(() => {
      // incremenet count speed
      if (countInterval >= 10 && counterValue <= 3) {
        countInterval -= 10;
      }
      // end
      counterValue = counterValue + 0.01;
      io.sockets.emit("game_play", counterValue.toFixed(2));
      // console.log("bust rate at= ", counterValue.toFixed(2));
      if (counterValue >= game.bust) {
        clearInterval(intervalId);
        io.sockets.emit("game_end", game.bust);
        // save game status
        endGame(game);
        setTimeout(() => {
          waitCount();
        }, 3000);
      }
    }, countInterval);
  };

  // start burst rate
  const bustStart = async () => {
    const game = await createGame();
    // addBots();
    // console.log(game.bust);
    counterValue = 1; //set counter value to 0 before countoing
    setTimeout(() => {
      bustCount(game);
    }, 3000);
    const bets = await Bets.find({ status: "wait" })
      .sort({ rate: -1 })
      .populate("user");

    io.sockets.emit("game_start", bets);
  };

  waitCount();
};

// express server
server.listen(process.env.APP_PORT, () => {
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
  // startGame(io);
  StartBust();
  console.log(`listening on *:${process.env.APP_PORT}`);
});
