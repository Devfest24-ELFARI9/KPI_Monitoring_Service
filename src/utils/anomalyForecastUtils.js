const { runModel } = require('../utils/runModel');

const forecastAndCheckAnomalies = async (data, n_steps = 10) => {
  try {
    const forecastData = { ...data, n_steps };
    const forecastResult = await runModel('modelScript/forecast.py', forecastData);

    const estimatedAnomalies = [];
    const previousValues = [
      data.KPI_Value[0],
      data.KPI_Value_1[0],
      data.KPI_Value_2[0],
      data.KPI_Value_3[0],
      data.KPI_Value_4[0],
      data.KPI_Value_5[0]
    ];

    // Step 2: Loop through forecasted values and check for anomalies
    for (let i = 0; i < n_steps; i++) {
      const forecastedValue = forecastResult[`forecasted_point${i + 1}`];

      // Prepare data for anomaly detection
      const anomalyCheckData = {
        KPI_Value: [forecastedValue],
        KPI_Value_1: [previousValues[0]],  
        KPI_Value_2: [previousValues[1]],  
        KPI_Value_3: [previousValues[2]],  
        KPI_Value_4: [previousValues[3]],  
        KPI_Value_5: [previousValues[4]],  
        Timestamp: [new Date().toISOString()] 
      };

      const anomalyResult = await runModel('modelScript/predict.py', anomalyCheckData);

      if (anomalyResult.anomaly) {
        estimatedAnomalies.push({
          KPI_Name: data.KPI_Name,
          KPI_Value: forecastedValue,
          Timestamp: new Date().toISOString()
        });
      }

      // Update previous values for the next iteration
      previousValues.shift();
      previousValues.push(forecastedValue);
    }

    return estimatedAnomalies;
  } catch (error) {
    console.error('Error in forecasting and checking anomalies:', error);
    throw error;
  }
};

module.exports = { forecastAndCheckAnomalies };