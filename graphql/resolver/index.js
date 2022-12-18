const Game = require("../../models/Game");
const { register, login, Adminlogin } = require("../../utils/userAuth");
const { place } = require("../../utils/bustgame");
const Bets = require("../../models/Bets");
const Chat = require("../../models/Chat");
const User = require("../../models/User");
const Organization = require("../../models/Organization");
const Transaction = require("../../models/Transaction");

module.exports = {
  // game manipulations
  getGame: async () =>
    await Game.findOne().sort({ createdAt: -1 }).populate("bets"),
  games: async () =>
    await Game.find({ status: "ended" }).sort({ createdAt: -1 }).limit(20), //history
  bets: async () =>
    await Bets.find({ status: "play" }).sort({ rate: -1 }).populate("user"),
  chats: async () =>
    await Chat.find().sort({ createdAt: -1 }).limit(30).populate("user"),

  // admin queries
  // find users
  A_users: async ({ phoneNumber }) => {
    if (phoneNumber === "") {
      return User.find({ role: "player" })
        .sort({ createdAt: -1 })
        .limit(30)
        .populate("bets")
        .populate("account", "balance");
    } else {
      return await User.find({
        phoneNumber: { $regex: ".*" + phoneNumber + ".*" },
        role: "player",
      })
        .sort({ createdAt: -1 })
        .limit(30)
        .populate("bets")
        .populate("account");
    }
  },

  organization: async () =>
    await Organization.findOne().sort({ createdAt: -1 }),

  transactions: async ({ account }) => {
    return Transaction.find({ account: account }).sort({ createdAt: -1 });
  },

  // bets manpulations
  placeBet: async (args, req) => {
    if (!req.isAuth) {
      throw new Error("Unauthenticated");
    }
    try {
      const bet = await place(
        args.betInput.amount,
        args.betInput.rate,
        req.user
      );

      return {
        ...bet._doc,
      };
    } catch (err) {
      throw err;
    }
  },

  // user manipulations
  registerUser: async ({ userInput }) => {
    try {
      const user = await register(
        userInput.phoneNumber,
        userInput.username,
        userInput.password
      );
      try {
        const loggedIn = await login(userInput.phoneNumber, userInput.password);
        return loggedIn;
      } catch (err) {
        throw err;
      }
      return {
        ...user._doc,
        password: null,
        _id: user.id,
      };
    } catch (err) {
      throw err;
    }
  },
  loginUser: async ({ phoneNumber, password }) => {
    try {
      const auth = await login(phoneNumber, password);
      return { ...auth };
    } catch (err) {
      throw err;
    }
  },
  loginAdmin: async ({ phoneNumber, password }) => {
    try {
      const auth = await Adminlogin(phoneNumber, password);
      return { ...auth };
    } catch (err) {
      throw err;
    }
  },
  getUser: async (req) => {
    if (!req.isAuth) {
      throw new Error("Unauthenticated");
    }
    return User.findById(req.user).populate("bets");
  },

  sendMessage: async ({ message }, req) => {
    if (!req.isAuth) {
      throw new Error("Unauthenticated");
    }
    try {
      const chatMessage = await new Chat({
        message: message,
        user: req.user,
      }).save();
      const newmessage = await chatMessage.populate("user");
      return newmessage;
    } catch (err) {
      throw err;
    }
  },
};
