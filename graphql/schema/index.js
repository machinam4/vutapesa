var { buildSchema } = require("graphql");

module.exports = buildSchema(`
  type Query {
    getGame: Game!
    games: [Game!]!
    bets: [Bet!]!
    chats: [Chat]

    A_users(phoneNumber: String!): [A_User]
    organization: Organization
    transactions(account: ID!): [Transaction]

    
  }
  type Mutation {
    loginUser(phoneNumber: String!, password: String!): AuthData
    loginAdmin(phoneNumber: String!, password: String!): AuthData
    registerUser(userInput: UserInput): AuthData
    sendMessage(message: String!): Chat
    placeBet(betInput: BetInput): Bet
    getUser(userId: ID!): User!
    
    #auth password reset
    getCode(phoneNumber: String!): Response
    confirmCode(phoneNumber: String!, code: String!): Response
    changePassword(phoneNumber: String!, password: String!): Response


    #smsfunctions
    uploadcontacts(contacts: [[String]]) : Response
    sendbulksms(message: String!, msgCount: Int!) : Response

  }



  type Response {
    code: String
    message: String
  }

  type A_User {
    _id: ID
    phoneNumber: String!
    username: String!
    password: String
    bets: [Bet]
    account: Account
  }
  type Account {
    _id: ID!
    balance: Float!
  }
  type Organization {
    totalFunds: Float
    walletFunds: Float
    totalTax: Float
    houseFunds: Float
    waitingFunds: Float
    withdrawals: Float
    createdAt: Date
  }
  type Transaction {
    winnings: Float
    winAmount: Float
    taxAmount: Float
    amount: Float
    transCode: String
    type: String
    createdAt: Date
  }



  type User {
    _id: ID
    phoneNumber: String!
    username: String!
    password: String
    bets: [Bet]
  }
  
  input UserInput {
    phoneNumber: String!
    username: String!
    password: String!
  }
  type AuthData {
    userId: ID!
    username: String!
    role: String!
    token: String!
    tokenValidity: Int!
  }

  type Bet {
    _id: ID
    amount: Int!
    rate: Float!
    game: Game
    user: User!
    status: String
    createdAt: Date
  }
  input BetInput {
    amount: Int!
    rate: Float!
  }

  type Game {
    _id: ID
    hash: String!
    bust: Float!
  }

  scalar Date
  type Chat {
    _id: ID
    message: String!
    user: User
    createdAt: Date
  }

  #typedefs authReset Password
  type Another {
    _id: ID
    hash: String!
    bust: Float!
  }
`);
