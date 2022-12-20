const unirest = require("unirest");
const PaybillB2C = require("../models/PaybillB2C");
const moment = require("moment");
const Payments = require("../models/Payments");
const OperationClass = require("./transactionclass");

const getB2CToken = async () => {
  let accessToken = "";
  const data = process.env.MPESA_B2C_KEY + ":" + process.env.MPESA_B2C_SECRET;
  const tokendata = Buffer.from(data).toString("base64");
  accessToken = await unirest(
    "GET",
    process.env.MPESA_URL + "/oauth/v1/generate?grant_type=client_credentials"
  )
    .headers({
      Authorization: "Basic " + tokendata,
    })
    .send();
  // console.log(accessToken.body.access_token);
  return accessToken.body.access_token;
};

// Handle withdrawals
const Userwithdraw = async (withdrawAmount, user) => {
  try {
    if (withdrawAmount > user.account.balance || withdrawAmount < 50) {
      throw new Error("Invalid withdraw Amount");
    }

    /* Handle Mpesa Withdraw Request */
    const accessToken = await getB2CToken();
    await unirest(
      "POST",
      process.env.MPESA_URL + "/mpesa/b2c/v1/paymentrequest"
    )
      .headers({
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      })
      .send(
        JSON.stringify({
          InitiatorName: process.env.MPESA_INITIATOR_NAME,
          SecurityCredential: process.env.MPESA_B2C_PASSKEY,
          CommandID: "PromotionPayment",
          Amount: withdrawAmount,
          PartyA: process.env.MPESA_B2C_CODE,
          PartyB: user.phoneNumber,
          Remarks:
            "withdrawal from vutapesa account " + user.account.accountNumber,
          QueueTimeOutURL:
            process.env.MPESA_API_URL + "/api/v1/callback/timeout",
          ResultURL:
            process.env.MPESA_API_URL + "/api/v1/callback/withdrawConfirm",
          Occassion: "",
        })
      )
      .end((res) => {
        if (res.error) {
          console.log(res.body);
          return {
            status: "error",
            message: "Request failed, please try again later",
          };
        }
        /* start get body and catch error...add to db */
        console.log(res.body);
        const b2cData = {
          ConversationID: res.body.ConversationID,
          OriginatorConversationID: res.body.OriginatorConversationID,
          ResultCode: res.body.ResponseCode,
          account: user.account,
        };
        try {
          PaybillB2C.create(b2cData);
        } catch (error) {
          console.log(new Error(error));
          return {
            status: "error",
            message: "Request failed, please try again later",
          };
        }

        return {
          status: "success",
          message: "Request Accepted...",
        };
      });
  } catch (error) {
    console.log(new Error(error));
    return {
      status: "error",
      message: "Request failed, please try again later",
    };
  }
};

/* start mpesa callback for stk...add to db */
const withdrawConfirm = async (request, response) => {
  const userResponse = request.body.Result;
  const transaction = await PaybillB2C.findOne({
    ConversationId: userResponse.ConversationID,
  }).populate("account");
  if (userResponse.ResultCode === 2001) {
    transaction.ResultCode = userResponse.ResultCode;
    transaction.TransactionID = userResponse.TransactionID;
    await transaction.save();
    // send sms transaction failed
  } else {
    const transactionItem = userResponse.ResultParameters.ResultParameter;
    transaction.ResultCode = userResponse.ResultCode;
    await transactionItem.forEach((Item) => {
      switch (Item.Key) {
        case "TransactionAmount":
          transaction.Amount = Item.Value;
          break;
        case "TransactionReceipt":
          transaction.TransactionID = Item.Value;
          break;
        case "TransactionCompletedDateTime":
          transaction.TransactionDate = Item.Value;
          break;
        case "ReceiverPartyPublicName":
          transaction.B2CRecipientIsRegisteredCustomer = Item.Value;
          break;
        case "B2CChargesPaidAccountAvailableFunds":
          transaction.B2CChargesPaidAccountAvailableFunds = Item.Value;
          break;
        case "B2CUtilityAccountAvailableFunds":
          transaction.B2CUtilityAccountAvailableFunds = Item.Value;
          break;
        case "B2CWorkingAccountAvailableFunds":
          transaction.B2CWorkingAccountAvailableFunds = Item.Value;
          break;
        default:
          break;
      }
    });
    // console.log(transaction)
    await transaction.save();
    const payments = {
      amount: transaction.Amount,
      transType: "PromotionPayment",
      transCode: transaction.TransactionID,
      timestamp: moment(
        transaction.TransactionDate,
        "DD.MM.YYYY hh:mm:ss"
      ).format("YYYYMMDDhhmmss"),
      payments_id: transaction.id,
      user_id: transaction.user_id,
    };
    await Payments.create(payments);
    const savedPayment = await Payment.findOne({
      transCode: payments.transCode,
    }).populate("account");
    const account = savedPayment.account;
    account.balance -= payments.amount;
    // TO DO: minus the funds to account
    const recordTrans = new OperationClass();
    recordTrans.withdraw(payments);
    await account.save();
    // emit user deposit seccefully
    return response.status(200).send("ok");
  }
};

module.exports = { Userwithdraw, withdrawConfirm };
