const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Account = require("../models/Account");

const generateAccNo = () => {
  // create user account no using id
  // const arrOfDigits = Array.from(String(user.id), Number);
  const rnumber = Date.now() % 9999; //number to generate account
  const arrOfDigits = Array.from(String(rnumber), Number);
  let AccountNo = [];
  let toChars = "";
  arrOfDigits.forEach((n) => {
    toChars = `${n >= 26 ? toChars(Math.floor(n / 26) - 1) : ""}${
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[n % 26]
    }`;
    AccountNo.push(toChars);
  });
  AccountNo = AccountNo.join("");
  return AccountNo;
};

const register = async (phoneNumber, username, password) => {
  const user = await User.findOne({ phoneNumber: phoneNumber });
  if (user) {
    throw new Error("User Already Exists");
  }
  const hashedPassword = await bcrypt.hash(password, 12);
  const newUser = await User.create({
    phoneNumber: phoneNumber,
    username: username,
    password: hashedPassword,
    role: "player",
  });
  const AccountNo = await generateAccNo();
  const account = new Account({
    accountNumber: AccountNo,
    user: newUser,
  });
  await account.save();
  newUser.account = account;
  await newUser.save();
  return user;
};

module.exports = {
  register,
  // : (phoneNumber, username, password) => {
  //   return User.findOne({})
  //     .then((user) => {
  //       if (user) {
  //         throw new Error("Phone Number already exists");
  //       }
  //       return bcrypt.hash(password, 12);
  //     })
  //     .then((hashedPassword) => {
  //       const userModel = new User({
  //         phoneNumber: phoneNumber,
  //         username: username,
  //         password: hashedPassword,
  //       });
  //       return userModel.save().then((user) => {
  //         generateAccNo().then((AccountNo) => {
  //           const account = new Account({
  //             accountNumber: AccountNo,
  //             user: user,
  //           });
  //           return account.save().then((account) => {
  //             user.account = account;
  //             return user;
  //           });
  //           // return user;
  //         });
  //       });
  //     })

  //     .catch((err) => {
  //       throw err;
  //     });
  // },

  login: async (phoneNumber, password) => {
    const user = await User.findOne({ phoneNumber: phoneNumber });
    if (!user) {
      throw new Error("User Not Found");
    }
    const isUser = await bcrypt.compare(password, user.password);
    if (!isUser) {
      throw new Error("Incorrect Password/Phone Number");
    }
    const token = await jwt.sign(
      { userId: user.id, phoneNumber: user.phoneNumber },
      process.env.SECRET_KEY,
      { expiresIn: "7d" }
    );
    return {
      userId: user.id,
      username: user.username,
      token,
      tokenValidity: 24000,
    };
  },

  Adminlogin: async (phoneNumber, password) => {
    const user = await User.findOne({ phoneNumber: phoneNumber });
    if (!user) {
      throw new Error("User Not Found");
    }
    const isUser = await bcrypt.compare(password, user.password);
    if (!isUser) {
      throw new Error("Incorrect Password/Phone Number");
    }
    if (user.role !== "admin") {
      throw new Error("You are not authorized");
    }
    const token = await jwt.sign(
      { userId: user.id, phoneNumber: user.phoneNumber },
      process.env.SECRET_KEY,
      { expiresIn: "7d" }
    );
    return {
      userId: user.id,
      username: user.username,
      token,
      tokenValidity: 24000,
    };
  },
};
