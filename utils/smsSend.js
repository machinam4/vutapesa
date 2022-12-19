const unirest = require("unirest");
MsgSend = async (msg, phone) => {
  await unirest
    .get(
      "https://smsportal.hostpinnacle.co.ke/SMSApi/send?userid=machina&password=56zBWzyb&sendMethod=quick&mobile=" +
        phone +
        "&msg=" +
        msg +
        "&senderid=HPKSMS&msgType=text&duplicatecheck=true&trackLink=true&smartLinkTitle=click here&output=json"
    )
    .then((res) => {
      return "success";
    });
};
module.exports = { MsgSend };
