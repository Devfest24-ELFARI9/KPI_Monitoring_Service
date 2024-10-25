const axios = require('axios');

// Set query parameters
const KPI_NAME = "Stamping_Press_Efficiency";
const START_TIME = "2017-07-31T00:00:00Z";
const STOP_TIME = "2017-07-31T23:59:59Z";
const URL = `http://localhost:3010/data/retrieve`;

// Function to retrieve data
const retrieveData = async () => {
  try {
    const response = await axios.get(URL, {
      params: {
        KPI_Name: KPI_NAME,
        start: START_TIME,
        stop: STOP_TIME
      }
    });
    console.log("Response Data:", response.data);
  } catch (error) {
    console.error("Error retrieving data:", error.message);
  }
};

// Execute the function
retrieveData();
