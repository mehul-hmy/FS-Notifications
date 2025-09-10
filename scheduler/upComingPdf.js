// const db = require("../firebase");
const cron = require("node-cron");
const { db, bucket } = require("../firebase");
const { Timestamp } = require("firebase-admin/firestore");
const { log } = require("firebase-functions/logger");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const { exit } = require("process");

const MSG91_API_KEY = "417710Am1SthGXxp65f990aeP1";
const SMS_SENDER_ID = "HMYDFS";
const INTEGRATED_WHATSAPP_NUMBER = "919082858532";
let moduleListColumn = {
  name: "Upcoming Document Expiry",
  collectionName: "documentSchedule",
  selectedColumns: ["Vehicle", "Make", "Title", "Expiry Date"],

  allColumns: [
    {
      columnDef: "Vehicle",
      header: "Vehicle",
      cell: (element) => {
        const matchingVehicle = allVehicles.find(
          (x) => x.id === element.vehicleId
        );
        return matchingVehicle ? matchingVehicle.numberPlate : "";
      },
      sortable: true,
      filterable: true,
      width: "100px",
    },
    {
      columnDef: "Title",
      header: "Title",
      cell: (element) => {
        const matchingDocumentTitle = documentMaster.find(
          (x) => x.id === element.docMasterId
        );
        return matchingDocumentTitle ? matchingDocumentTitle.title : "";
      },
      sortable: true,
      filterable: true,
      width: "100px",
    },

    {
      columnDef: "Make",
      header: "Make",
      cell: (element) => {
        const vehicleMakeListId =
          allVehicles?.find((x) => x.id === element.vehicleId)?.makeListId ??
          "";
        const matchingMake = vehicleMake?.find(
          (make) => make.id === vehicleMakeListId
        );
        return matchingMake ? matchingMake.value : "";
      },
      sortable: true,
      filterable: true,
      width: "100px",
    },
    {
      columnDef: "Expiry Date",
      header: "Expiry Date",
      cell: (element) =>
        element.nextRenewal != undefined || null
          ? `${formatDate(element.nextRenewal.toDate())}`
          : "",
      sortable: true,
      filterable: true,
      width: "100px",
    },
  ],
};

let documentMaster = [];
let allVehicles = [];
let vehicleMake = [];
let allColumnData = ["Vehicle", "Make", "Title", "Expiry Date"];
let startDate;
let endDate;
const sampleMode = process.env.sampleMode.split(',').map(item => item.trim());

// exports.documentRenewalCheck = functions.pubsub
//   .schedule('0 0 * * *') // Runs at midnight
//   .timeZone('Asia/Kolkata')
//   .onRun(async context => {

//   const db = admin.firestore();

const upComingPdf = async () => {
  try {
    const accountsSnapshot = await db.collection("accounts").get();
    const notificationsnapshot = await db
      .collection("notificationMaster")
      .get();
    const notificationMaster = notificationsnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    const matchedDoc = notificationMaster.find(
      (doc) => doc?.["notificationName"] === "Document Renewal Alert"
    );
    const notificationId = matchedDoc?.["id"] || null;
    for (const accountDoc of accountsSnapshot.docs) {
      const accountId = accountDoc.id;
      // await documentRenewalForPdf(accountId, notificationId);
      await documentRenewalForPdf(
        "mhKAQq5wcuYVIadq0bTE",
        "AyghB5Uqe3UoRZ0DMElw"
      );
      // console.log("port",typeof sampleMode,sampleMode);
      // console.log("documentRenewalForPdf", accountId, notificationId);
    }
    return null;
  } catch (error) {
    console.error("❌ Error in dailyRenewalCheck:", error);
    return null;
  }
};

async function documentRenewalForPdf(accountId, notificationId) {
  const today = new Date();

  const todayMid = new Date();
  todayMid.setHours(0, 0, 0, 0);

  const next30Days = new Date(todayMid);
  next30Days.setDate(todayMid.getDate() + 30);

  const next30DaysMid = new Date(next30Days);
  next30DaysMid.setHours(0, 0, 0, 0);

  const upcoming30Days = [];

  const docMasterSnap = await db
    .collection(`accounts/${accountId}/documentMaster`)
    .where("isSampleMode", "in", sampleMode)
    .get();
  documentMaster = docMasterSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const vehicleSnap = await db
    .collection(`accounts/${accountId}/vehicleMaster`)
    .where("isSampleMode", "in", sampleMode)
    .get();
  allVehicles = vehicleSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const vehicleMakeSnap = await db.collection(`accounts/${accountId}/vehicleMake`).get();
  // .where("isSampleMode", "in", sampleMode)
  vehicleMake = vehicleMakeSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // This Part Send Notification By Role
  // 1) documentSchedule
  const scheduleSnapshot = await db
    .collection(`accounts/${accountId}/documentSchedule`)
    .where("isSampleMode", "in", sampleMode)
    .get();

  const scheduleData = scheduleSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  scheduleData.forEach((doc) => {
    const raw = doc.nextRenewal;
    const renewalDate = raw?.toDate ? raw.toDate() : new Date(raw);
    // console.log("renewalDate",renewalDate);

    if (renewalDate > todayMid && renewalDate <= next30DaysMid) {
      upcoming30Days.push(doc);
    }
  });

  let sortedAscData = upcoming30Days?.sort(
    (a, b) => a?.nextRenewal - b?.nextRenewal
  );


  const reportData = await preloadCellValues(sortedAscData);
  console.log("reportData", reportData);
  startDate = formatDate(todayMid);
  endDate = formatDate(next30DaysMid);
  // console.log("startDate ", startDate);
  // console.log("endDate ", endDate);

  // console.log("upcoming30Days reportData ", reportData);
  // console.log('notificationRecipient ', notificationRecipient);

  // 2) notificationRecipient
  const notificationRecipientSnapshot = await db
    .collection(`accounts/${accountId}/notificationRecipient`).where("isSampleMode", "in", sampleMode)
    .get();

  const notificationRecipient = notificationRecipientSnapshot.docs.map(
    (doc) => ({
      id: doc.id,
      ...doc.data(),
    })
  );

  // const notificationRecipientUsers =
  //   notificationRecipient?.[0]?.["notificationRecipientUsers"] || [];
  // const notificationRecipientRoles =
  //   notificationRecipient?.[0]?.["notificationRecipientRoles"] || [];

  // Collect all users and roles across all notificationRecipient docs
  const notificationRecipientUsers = notificationRecipient.flatMap(
    (doc) => doc.notificationRecipientUsers || []
  );

  const notificationRecipientRoles = notificationRecipient.flatMap(
    (doc) => doc.notificationRecipientRoles || []
  );

  // first for the notificationRecipientRoles
  const roleList = notificationRecipientRoles.filter(
    (x) => x.notificationId == notificationId
  );

  // 1) Fetch the entire roleUserAssociation sub‑collection
  const roleUserAssocSnapshot = await db
    .collection(`accounts/${accountId}/roleUserAssociation`).where("isSampleMode", "in", sampleMode)
    .get();

  // 2) Map each document into { id, …data }
  const roleUserAssociation = roleUserAssocSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const roleUserList = Array.from(
    new Map(
      roleUserAssociation
        .filter((x) =>
          roleList.map((y) => y.userIdOrRoleId)?.includes(x?.["RoleID"])
        )
        .map((x) => [x?.["UserID"], x])
    ).values()
  );

  // This Part Send Notification By User
  const userList = Array.from(
    new Map(
      notificationRecipientUsers
        .filter((x) => x.notificationId === notificationId)
        .map((x) => [x.userIdOrRoleId, x]) // Map by userIdOrRoleId
    ).values()
  );

  const existingUserIds = new Set(roleUserList.map((x) => x?.["UserID"]));
  const filteredUserList = userList.filter(
    (x) => !existingUserIds.has(x.userIdOrRoleId)
  );

  // role wise Send Notification
  if (roleList && roleUserList) {
    for (const x of roleUserList) {
      const roleId = x?.["RoleID"];
      const userId = x?.["UserID"];
      for (const y of roleList) {
        if (y.userIdOrRoleId === roleId) {
          const data = {
            notificationId: y.notificationId,
            userIdOrRoleId: userId,
            allowDashboard: y.allowDashboard,
            allowSMS: y.allowSMS,
            allowEmail: y.allowEmail,
            allowWhatsApp: y.allowWhatsApp,
            userOrRole: y.userOrRole,
          };
          if (reportData.length > 0) {
            await printPdf(data, accountId, reportData);
          }
        }
      }
    }
  }

  // user wise Send Notification but not exist the user in role
  if (filteredUserList.length > 0) {
    for (const y of filteredUserList) {
      if (reportData.length > 0) {
        await printPdf(y, accountId, reportData);
      }
    }
  }
}

function preloadCellValues(data) {
  return data.map((item) => {
    const vehicle = allVehicles?.find((v) => v.id === item.vehicleId);
    const makeId = vehicle?.makeListId ?? "";
    const make = vehicleMake?.find((m) => m.id === makeId);
    const doc = documentMaster?.find((d) => d.id === item.docMasterId);

    return {
      Vehicle: vehicle?.numberPlate || "",
      Make: make?.value || "",
      Title: doc?.title || "",
      "Expiry Date":
        item.nextRenewal?.toDate?.() instanceof Date
          ? formatDate(item.nextRenewal.toDate())
          : "",
    };
  });
}

async function printPdf(data, accountId, upcoming30Data) {
  try {
    const company = await getCompanyData(accountId);
    // console.log("this.companyDetails", company); //4486
    const pdfData = {
      // data: filteredData,
      columns: moduleListColumn.allColumns,
      name: "",
      // description: reportDes,
      // moduleListColumn.name
      header: " ",
      footer: "",
      layout: "landscape",
      data: upcoming30Data ?? "",
      companyName: company?.companyName ?? "",
      companyLogo: company?.companyLogo ?? "",
      tempalate: "",
      duration: {
        startDate: startDate,
        endDate: endDate,
      },
      filterString: "Monthly Upcoming Document Expiry",
      showTotal: false,
      preparedBy: "Automated",
      Timeframe: getFinancialYear(),
    };
    // console.log("pdfData", pdfData);
    await exportAsPDF(data, pdfData, accountId);
  } catch (error) {
    console.error("PDF generation error:", error);
    // res.status(500).send("Failed to generate PDF");
  }
}

// problem :  if you are working on node dont use Firebase Web SDK (@angular/fire) The Firebase Web SDK expects a browser environment.
// solution : In Node.js, you should use the Firebase Admin SDK or Firebase Node SDK.
// For Node
// const bucket = admin.storage().bucket();

async function exportAsPDF(data, payload, accountId) {
  try {
    // Calculate expiry date (current date + 30 days)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    const date = new Date();
    const timestamp = Date.now();
    const formattedDate = date
      .toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
      .replace(/ /g, " "); // optional: ensures spacing

    const fileName = `_${formattedDate}_${timestamp}.pdf`;
    console.log(fileName); // _8 Aug 2025.pdf

    // const fileName = `_${Date.now()}.pdf`; // Include extension
    const destination = `upComingRenewalPdf/${accountId}/${fileName}`;

    const response = await axios.put(
      "https://fs-reportservice.hmydynamics.com/apis/export",
      // "http://localhost:5000/apis/export", // in local of api have some changes need to deployed
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer", // if you want to save PDF buffer
      }
    );
    // Optionally save to file
    const filePath = path.join(__dirname, "..", "pdfs", fileName);

    // Save PDF
    fs.writeFileSync(filePath, Buffer.from(response.data));
    console.log("PDF saved at:", filePath);

    //  file is actually saved as a JSON now convert into the real PDF.
    // 1. Parse the JSON file
    // 2. Convert it to a buffer

    // Step 1: Read file contents
    const fileContent = fs.readFileSync(filePath, "utf8");

    // Step 2: Parse JSON and get `data` object
    const json = JSON.parse(fileContent);
    const byteData = Object.values(json.data); // Array of bytes

    // Step 3: Convert to buffer
    const pdfBuffer = Buffer.from(byteData);

    // Step 4: Upload buffer to Firebase
    const file = bucket.file(destination);

    await file.save(pdfBuffer, {
      metadata: {
        contentType: "application/pdf",
        // cacheControl: "no-cache",
      },
      public: true,
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
    console.log("File uploaded to Firebasen :", publicUrl);

    // Clean up local file
    fs.unlinkSync(filePath);
    
    await sendNotification(data, accountId, publicUrl, fileName);
  } catch (error) {
    console.error("❌ Upload failed:", error);
  }
}

async function getCompanyData(accountId) {
  const snapshot = await db
    .collection(`accounts/${accountId}/companyMaster`)
    .where("isSampleMode", "in", sampleMode)
    .get();

  const companies = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return companies?.[0] ?? {};
}

function getFinancialYear() {
  let currentDate = new Date();
  const year = currentDate.getFullYear();
  const startYear = currentDate.getMonth() < 3 ? year - 1 : year; // Starts from April
  const endYear = startYear + 1;
  return `${startYear}-${endYear}`;
}

//it a useful funciton
async function sendNotification(data, accountId, publicUrl, fileName) {
  // console.log("data", data);
  console.log("data.userIdOrRoleId", data.userIdOrRoleId);
  if (data.allowWhatsApp) {
    // 1) Query for documents where uid matches
    const employeeSnapshot = await db
      .collection(`accounts/${accountId}/employeeMaster`)
      .where("uid", "==", data.userIdOrRoleId).where("isSampleMode", "in", sampleMode)
      .get();
    // 2) Map into plain objects with their IDs
    const employeeDetail = employeeSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    let contactNumber =
      employeeDetail[0]?.["contactNumber1"] ??
      employeeDetail[0]?.["contactNumber2"] ??
      null;
    console.log("employeeDetail contactNumber", contactNumber, employeeDetail[0]?.["emailId"]);
    if (contactNumber) {
      await sendWhatsAppNotificationPdf(contactNumber, publicUrl, fileName);
    }
  }
  // if (data.allowSMS) {
  //   await sendSMSNotification(data, publicUrl);
  // }
  // if (data.allowEmail) {
  //   await sendEmailNotification(data, publicUrl);
  // }
  // if (data.allowDashboard) {
  //   await sendDashboardNotification(data, publicUrl);
  // }
}

// Function to send WhatsApp notification with PDF
async function sendWhatsAppNotificationPdf(phoneNumber, publicUrl, fileName) {
  try {
    // phoneNumber = "919833240212";
    // phoneNumber = "917400249777";
    //'919833240212'//
    const options = {
      method: "POST",
      url: "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      headers: {
        authkey: MSG91_API_KEY,
        "content-type": "application/json",
      },
      data: {
        integrated_number: INTEGRATED_WHATSAPP_NUMBER,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: "upcomingrenewpdf",
            language: {
              code: "en_US",
              policy: "deterministic",
            },
            namespace: "8f6a7bf8_c6ac_485e_a010_fbfe474172ba",
            to_and_components: [
              {
                to: [phoneNumber],
                components: {
                  header_1: {
                    filename: fileName,
                    type: "document",
                    value: publicUrl,
                  },
                },
              },
            ],
          },
        },
      },
    };

    try {
      const { data } = await axios.request(options);
      console.log(`WhatsApp sent to ${phoneNumber}`, data);
      return data;
    } catch (error) {
      console.error(`WhatsApp failed for ${phoneNumber}`, error);
      throw error;
    }
  } catch (error) {
    console.error(
      "Error sending WhatsApp message:",
      error.response ? error.response.data : error.message
    );
  }
}

function formatDate(date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1
  ).padStart(2, "0")}/${date.getFullYear()}`;
}

//*/5 * * * *
// Schedule to run every 1 minute  (* * * * *)

cron.schedule("* * * * *", upComingPdf);

module.exports = upComingPdf;
