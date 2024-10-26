const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');

const csvFilePath = './dataset/test_set_rec.csv';
const postUrl = 'http://localhost:3010/data';
const interval = 10000; 
const maxRows = 100; // Maximum number of rows to read

let dataPoints = [];
let currentIndex = 5;

fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (row) => {
        if (dataPoints.length < maxRows) {
            if (row.KPI_Name) {
                row.KPI_Name = row.KPI_Name.replace(/\s+/g, '_');
            }
            dataPoints.push(row);
        }
    })
    .on('end', () => {
        console.log('CSV file successfully processed');
        startSendingData();
    });

function sendData(data) {
    console.log(data);
    axios.post(postUrl, data)
      .then(response => {
        console.log(`Data sent successfully: ${JSON.stringify(data)}`);
      })
      .catch(error => {
        console.error(`Error sending data: ${error}`);
      });
}

function startSendingData() {
    setInterval(() => {
        if (currentIndex < dataPoints.length) {
            sendData(dataPoints[currentIndex]);
            currentIndex++;
        } else {
            console.log('All data points have been sent');
        }
    }, interval);
}