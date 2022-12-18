const getB2CToken = async () => {
  let accessToken = "";
  const data = Env.get("MPESA_B2C_KEY") + ":" + Env.get("MPESA_B2C_SECRET");
  const tokendata = Buffer.from(data).toString("base64");
  accessToken = await unirest(
    "GET",
    Env.get("MPESA_URL") + "/oauth/v1/generate?grant_type=client_credentials"
  )
    .headers({
      Authorization: "Basic " + tokendata,
    })
    .send();
  // console.log(accessToken.body.access_token)
  return accessToken.body.access_token;
};

// Handle withdrawals
const Userwithdraw = async ({ request, auth, response }) => {
  try {
    const rules = {
      amount: "required",
    };
    const validation = await validateAll(request.all(), rules);

    if (validation.fails()) {
      return response.status(400).send(validation.messages());
    }
    const withdrawAmount = request.only(["amount"]);
    const user = await auth.getUser();
    if (withdrawAmount.amount > user.balance || withdrawAmount.amount < 50) {
      return response
        .status(400)
        .send({ status: "error", message: "Invalid withdraw Amount" });
    }
    /* Handle Mpesa Withdraw Request */
    const accessToken = await getB2CToken();
    await unirest("POST", Env.get("MPESA_URL") + "/mpesa/b2c/v1/paymentrequest")
      .headers({
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      })
      .send(
        JSON.stringify({
          InitiatorName: Env.get("MPESA_INITIATOR_NAME"),
          SecurityCredential: Env.get("MPESA_B2C_PASSKEY"),
          CommandID: "PromotionPayment",
          Amount: withdrawAmount.amount,
          PartyA: Env.get("MPESA_B2C_CODE"),
          PartyB: user.phone,
          Remarks: "withdrawal from Patachapaa account " + user.account_no,
          QueueTimeOutURL:
            Env.get("MPESA_API_URL") + "/api/v1/callback/timeout",
          ResultURL:
            Env.get("MPESA_API_URL") + "/api/v1/callback/withdrawConfirm",
          Occassion: "",
        })
      )
      .end((res) => {
        if (res.error) {
          // console.log(new Error(res.error))
          return response.status(400).send({
            status: "error",
            message: "Request failed, please try again later",
          });
        }
        /* start get body and catch error...add to db */
        // console.log(res.body)
        const b2cData = {
          ConversationID: res.body.ConversationID,
          OriginatorConversationID: res.body.OriginatorConversationID,
          ResultCode: res.body.ResponseCode,
          user_id: user.id,
        };
        try {
          PaybillB2C.create(b2cData);
        } catch (error) {
          return response.status(400).send({
            status: "error",
            message: "Request failed, please try again later",
          });
        }

        return response.status(200).send({
          status: "success",
          message: "Request Accepted...",
        });
      });
  } catch (error) {
    // console.log(new Error(error))
    return response
      .status(400)
      .send({ status: "error", message: "Rquest Failed. Try again Later" });
  }
};

/* start mpesa callback for stk...add to db */
const withdrawConfirm = async ({ request, response }) => {
  const userResponse = request.body.Result;
  const transaction = await PaybillB2C.query()
    .where("ConversationId", userResponse.ConversationID)
    .first();
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
    await Payment.create(payments);
    const savedPayment = await Payment.query()
      .where("transCode", payments.transCode)
      .first();
    const user = await savedPayment.user().fetch();
    user.balance -= payments.amount;
    // TO DO: minus the funds to account
    const recordTrans = new Transaction();
    recordTrans.withdraw(payments);
    await user.save();
    // emit user deposit seccefully
    return response.status(200).send("ok");
  }
};

module.exports = { Userwithdraw, withdrawConfirm };
