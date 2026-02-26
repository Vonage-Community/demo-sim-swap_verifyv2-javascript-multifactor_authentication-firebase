const functions = require("firebase-functions/v1");
require("dotenv").config();
const { Auth } = require("@vonage/auth");
const { Vonage } = require("@vonage/server-sdk");
const { Channels } = require("@vonage/verify2");
const { IdentityInsights } = require("@vonage/identity-insights");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

const vonage = new Vonage(
  new Auth({
    applicationId: process.env.VONAGE_APPLICATION_ID,
    privateKey: process.env.VONAGE_PRIVATE_KEY,
  })
);

const identityClient = new IdentityInsights(
  new Auth({
    applicationId: process.env.VONAGE_APPLICATION_ID,
    privateKey: process.env.VONAGE_PRIVATE_KEY,
  })
);

async function checkSim(phoneNumberParam) {
  // Ensure E.164 format
  if (phoneNumberParam && !phoneNumberParam.startsWith("+")) {
    phoneNumberParam = "+" + phoneNumberParam;
  }
  try {
    console.log(`Checking SIM swap for phone number: ${phoneNumberParam}`);
    const resp = await identityClient.getIdentityInsights({
      phoneNumber: phoneNumberParam,
      purpose: "FraudPreventionAndDetection",
      insights: {
        simSwap: {
          period: parseInt(process.env.PERIOD),
        },
      },
    });

    console.log("Identity Insights response:", JSON.stringify(resp, null, 2));

    const simSwap = resp?.insights?.simSwap;
    if (!simSwap) {
      console.warn("No simSwap data in response");
      return false;
    }
    if (simSwap.status && simSwap.status.code !== "OK") {
      console.warn(`SIM swap check status: ${simSwap.status.code} - ${simSwap.status.message}`);
      return false;
    }
    return simSwap.isSwapped === true;
  } catch (error) {
    console.error("Identity Insights SDK call failed:", error?.message, error);
    throw error; // let caller return 500 instead of silently returning undefined
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
    await db
      .collection("credentials")
      .doc(document.id)
      .update({
        request_id: requestId,
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
    if (snapshot.empty) {
      return res.status(401).json({ message: "Invalid user and password" });
    }
    let document = snapshot.docs[0];
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
