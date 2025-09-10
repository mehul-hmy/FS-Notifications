// // firebase.js
// const admin = require('firebase-admin');
// const serviceAccount = require('./services/serviceAccountKey.json');

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// const db = admin.firestore(); // Firestore DB instance
// module.exports = db;

// firebase.js
const admin = require("firebase-admin");
// const sourceServiceAccount = require("./services/serviceAccountKey.json");
const targetServiceAccount = require("./services/targetServiceAccount.json");

// Initialize source app (default)
const sourceApp = admin.initializeApp(
  {
    credential: admin.credential.cert(targetServiceAccount),
    storageBucket: "fs-prd.appspot.com",
  },
  "sourceApp"
);
const sourceDb = sourceApp.firestore();
const bucket = sourceApp.storage().bucket(); // Use sourceApp
console.log("Source Firestore connection established.");

// // Initialize target app
// const targetApp = admin.initializeApp(
//   {
//     credential: admin.credential.cert(targetServiceAccount),
//   },
//   "targetApp"
// );

// const targetDb = targetApp.firestore();
// console.log("Target Firestore connection established.");

module.exports = { db: sourceDb, bucket };
