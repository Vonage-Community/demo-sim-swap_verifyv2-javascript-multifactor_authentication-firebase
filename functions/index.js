const functions = require("firebase-functions");
require("dotenv").config();
const axios = require("axios");
const { Auth } = require("@vonage/auth");
const { Vonage } = require("@vonage/server-sdk");
const { Channels } = require("@vonage/verify2");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

const vonage = new Vonage(
  new Auth({
    applicationId: process.env.VONAGE_APPLICATION_ID,
    privateKey: process.env.VONAGE_PRIVATE_KEY,
  })
);

const scope = "dpv:FraudPreventionAndDetection#check-sim-swap";
const authReqUrl = "https://api-eu.vonage.com/oauth2/bc-authorize";
const tokenUrl = "https://api-eu.vonage.com/oauth2/token";
const simSwapApiUrl = "https://api-eu.vonage.com/camara/sim-swap/v040/check";

async function authenticate(phone, scope) {
  try {
    console.log(`Authenticating for phone: ${phone} with scope: ${scope}`);
    const authReqResponse = await axios.post(
      authReqUrl,
      {
        login_hint: phone,
        scope: scope,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.JWT}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    const authReqId = authReqResponse.data.auth_req_id;

    const tokenResponse = await axios.post(
      tokenUrl,
      {
        auth_req_id: authReqId,
        grant_type: "urn:openid:params:grant-type:ciba",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.JWT}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    return tokenResponse.data.access_token;
  } catch (error) {
    console.error(
      "Error during authentication:",
      error.response?.data || error.message
    );
    throw error;
  }
}

async function checkSim(phoneNumberParam) {
  try {
    console.log(`Checking SIM swap for phone number: ${phoneNumberParam}`);
    const accessToken = await authenticate(phoneNumberParam, scope);
    const response = await axios.post(
      simSwapApiUrl,
      {
        phoneNumber: phoneNumberParam,
        maxAge: process.env.MAX_AGE,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.swapped;
  } catch (error) {
    console.error(
      "Error checking SIM swap:",
      error.response?.data || error.message
    );
    throw error;
  }
}

function handleCors(req, res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
}

exports.sendCode = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;
  const phone = process.env.RECIPIENT_NUMBER
    ? process.env.RECIPIENT_NUMBER
    : req.body.phone;
  try {
    const response = await vonage.verify2.newRequest({
      brand: "Vonage Bank",
      workflow: [
        {
          channel: Channels.SMS,
          to: phone,
        },
      ],
    });
    const requestId = response.requestId;
    console.log(`Verification code sent. RequestId: ${requestId}`);

    let snapshot = await db
      .collection("credentials")
      .where("phone_number", "==", phone)
      .limit(1)
      .get();

    let document = snapshot.docs[0];
    db.collection("credentials")
      .doc(document.id)
      .update({
        request_id: requestId,
      })
      .then(() => {})
      .catch((error) => {
        console.error("Error writing document: ", error);
      });

    res.json({
      message: "Verification code sent.",
      verifycode: true,
      request_id: requestId,
    });
  } catch (error) {
    console.error("Error during verification:", error);
    res
      .status(500)
      .json({ message: "Error processing request.", verifycode: false });
  }
});

exports.simSwap = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;
  let phoneNumberParam = req.body.phone;
  console.log(`Received simswap request for phone number: ${phoneNumberParam}`);
  try {
    const simSwapped = await checkSim(phoneNumberParam);
    res.json({ swapped: simSwapped });
  } catch (error) {
    console.error("Error checking SIM swap:", error);
    res.status(500).json({ message: "Error processing request." });
  }
});

exports.verify = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;
  const { pin, newPass } = req.body;
  console.log({ pin, newPass });

  try {
    let snapshot = await db
      .collection("credentials")
      .where("phone_number", "==", process.env.RECIPIENT_NUMBER)
      .limit(1)
      .get();

    let document = snapshot.docs[0];

    const requestId = document.data().request_id;

    const status = await vonage.verify2.checkCode(requestId, pin);
    if (status == "completed") {
      console.log("inside status completed wewewe");
      db.collection("credentials")
        .doc(document.id)
        .update({
          password: newPass,
        })
        .then(() => {
          console.log("New Password successfully written!");
        })
        .catch((error) => {
          console.error("Error writing document: ", error);
        });

      res.json({ message: "Success" });
    } else {
      res.json({ message: "Invalid verification code. Please try again." });
    }
  } catch (err) {
    console.error("Error during PIN verification:", err);
    res.status(500).json({ message: "Error during PIN verification." });
  }
});

exports.login = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;
  const { username, password } = req.body;

  try {
    let snapshot = await db
      .collection("credentials")
      .where("username", "==", username)
      .limit(1)
      .get();
    let document = snapshot.docs[0];
    if (!document.exists) {
      throw new Error("Password not found.");
    }
    const storedPassword = document.data().password;

    if (password === storedPassword) {
      res.json({ message: "Success" });
    } else {
      res.status(401).json({ message: "Invalid user and password" });
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Error during login." });
  }
});
