const express = require('express');
const bodyParser = require('body-parser');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const { sendMessage } = require('./utils/rabbitMQUtils');
const { execFile } = require('child_process');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

console.log(process.env.INFLUXDB_URL, process.env.INFLUXDB_TOKEN, process.env.INFLUXDB_ORG, process.env.INFLUXDB_BUCKET);

const influxDB = new InfluxDB({ url: process.env.INFLUXDB_URL, token: process.env.INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(process.env.INFLUXDB_ORG);
const writeApi = influxDB.getWriteApi(process.env.INFLUXDB_ORG, process.env.INFLUXDB_BUCKET);
writeApi.useDefaultTags({ host: 'host1' });

const getPreviousDataPoints = async (kpiName, timestamp) => {
  const newTimestamp = new Date(timestamp);
  const formatedTimestamp = newTimestamp.toISOString();
  console.log("formatedTimestamp",formatedTimestamp);
  const query = `
    from(bucket: "${process.env.INFLUXDB_BUCKET}")
      |> range(start: ${"2017-07-31T03:20:00Z"}, stop: ${formatedTimestamp})
      |> filter(fn: (r) => r._measurement == "kpi" and r.kpi_name == "${kpiName}")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 5)
  `;

  try {
    const results = await queryApi.collectRows(query);
    console.log(results);

    const groupedResults = results.reduce((acc, record) => {
      const time = record._time;
      if (!acc[time]) {
        acc[time] = { timestamp: time, kpi_name: kpiName };
      }
      if (record._field === 'kpi_value') {
        acc[time].kpi_value = record._value;
      }
      if (record._field === 'anomaly') {
        acc[time].anomaly = record._value;
      }
      return acc;
    }, {});

    // Convert grouped results to an array
    const responseArray = Object.values(groupedResults).filter(entry => entry.kpi_value !== undefined && entry.anomaly !== undefined);

    return responseArray;
  } catch (error) {
    console.error('Error retrieving data:', error);
    throw new Error('Error retrieving data');
  }
};

const runModel = (script, data) => {
  return new Promise((resolve, reject) => {
    const input = JSON.stringify(data);
    execFile('python3', [script, input], (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        console.log("Model results:",script, JSON.parse(stdout));
        resolve(JSON.parse(stdout));
      }
    });
  });
};

app.get('/data/retrieve', async (req, res) => {
  console.log("rani hhnna")
  const { KPI_Name } = req.query;
  console.log("KPI_NAME",KPI_Name,req.query)

  // Calculate timestamp for 30 days ago
  const date30DaysAgo = new Date();
  date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
  const startTimestamp = date30DaysAgo.toISOString();

  const query = `
    from(bucket: "${process.env.INFLUXDB_BUCKET}")
      |> range(start: ${"2017-07-31T04:44:00Z"})
      |> filter(fn: (r) => r["_measurement"] == "kpi")
      |> filter(fn: (r) => r["kpi_name"] == "${KPI_Name}")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 10)
      |> yield(name: "last")
  `;

  console.log(query);

  try {
    const results = await queryApi.collectRows(query);

    // Convert results into an array of objects for the response
    const responseArray = results.map(record => ({
      kpi_name: KPI_Name,
      kpi_value: record._field === 'kpi_value' ? record._value : null,
      anomaly: record._field === 'anomaly' ? record._value : null,
      timestamp: record._time,
    })).filter(entry => entry.kpi_value !== null || entry.anomaly !== null);

    if (responseArray.length > 0) {
      res.status(200).json(responseArray);
    } else {
      res.status(404).json({ message: "No data found for this KPI." });
    }
  } catch (error) {
    console.error('Error retrieving data:', error);
    res.status(500).send('Error retrieving data');
  }
});

app.post('/data', async (req, res) => {
  const { KPI_Name, KPI_Value, Timestamp } = req.body;

  const prevData=await getPreviousDataPoints(KPI_Name, Timestamp);
  console.log("prevData",prevData);

  // Prepare data for the models
  const ForecastModelData = {
    KPI_Value_1: [KPI_Value],  
    KPI_Value_2: [prevData[0]?.kpi_value || null],  
    KPI_Value_3: [prevData[1]?.kpi_value || null],  
    KPI_Value_4: [prevData[2]?.kpi_value || null],  
    KPI_Value_5: [prevData[3]?.kpi_value || null],  
    Timestamp: [Timestamp]
  };

  const PredictModelData = {
    KPI_Value: [KPI_Value],  
    Lag1: [prevData[0]?.kpi_value || null],  
    Lag2: [prevData[1]?.kpi_value || null],  
    Lag3: [prevData[2]?.kpi_value || null],  
    Lag4: [prevData[3]?.kpi_value || null],  
    Lag5: [prevData[4]?.kpi_value || null],
    Timestamp: [Timestamp]
  };

  try {
    // Run anomaly detection model
    const anomalyResult = await runModel('modelScript/predict.py', PredictModelData);

    // Run forecasting model
    const forecastResult = await runModel('modelScript/forecast.py', ForecastModelData);

    console.log('Data received:', req.body);
    console.log('Anomaly result:', anomalyResult);
    console.log('Forecast result:', forecastResult);

    const point = new Point('kpi')
      .tag('kpi_name', KPI_Name)
      .floatField('kpi_value', KPI_Value)
      .booleanField('anomaly', anomalyResult.anomaly == 1)
      .timestamp(new Date(Timestamp));

    console.log('Writing point to InfluxDB:', point);

    writeApi.writePoint(point);
    await writeApi.flush();

    const message = {
      KPI_Name,
      KPI_Value,
      Timestamp,
      anomaly: anomalyResult == 1,
      forecastedPoint1: forecastResult.forecasted_point1,
      // forecastedPoint2: anomalyResult.forecasted_point2,  // Assuming this is still from the anomaly model
      // trend: anomalyResult.trend,  // Assuming this is still from the anomaly model
    };
    console.log('Sending message to queue:', message);

    await sendMessage('kpi_queue', JSON.stringify(message));
    if(anomalyResult == 0){
      const kpiAlertMessage = {
        KPI_Name,
        KPI_Value,
        Timestamp
      };
      await sendMessage('kpi_alert_queue', JSON.stringify(kpiAlertMessage));
    }

    res.status(200).send('Data processed successfully');
  } catch (error) {
    console.error('Error running model:', error);
    res.status(500).send('Error processing data');
  }
});



const PORT = process.env.PORT || 3010;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});