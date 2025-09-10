const express = require('express');
const app = express();
const cors = require("cors")
const path = require("path")
const functions = require('firebase-functions');
const bodyParser = require('body-parser')
require('dotenv').config()

require('./scheduler/upComingPdf'); // get pdf On Whatsa

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())


// Serve the PDFs publicly
app.use('/pdfs', express.static(path.join(__dirname, 'pdfs')));

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`server listen on ${process.env.PORT}`)
})