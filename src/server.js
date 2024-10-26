const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const { sendMessage } = require('./utils/rabbitMQUtils');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

console.log(process.env.INFLUXDB_URL, process.env.INFLUXDB_TOKEN, process.env.INFLUXDB_ORG, process.env.INFLUXDB_BUCKET);

const influxDB = new InfluxDB({ url: process.env.INFLUXDB_URL, token: process.env.INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(process.env.INFLUXDB_ORG);
const writeApi = influxDB.getWriteApi(process.env.INFLUXDB_ORG, process.env.INFLUXDB_BUCKET);
writeApi.useDefaultTags({ host: 'host1' });

const mockModel = (data) => {
  const anomaly = Math.random() < 0.1; // 10% chance of anomaly
  const forecastedPoint1 = data.KPI_Value + Math.random() * 10;
  const forecastedPoint2 = data.KPI_Value + Math.random() * 10;
  const trend = forecastedPoint2 > forecastedPoint1 ? 'up' : 'down';
  return { anomaly, forecastedPoint1, trend };
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
  const modelResult = mockModel({ KPI_Name, KPI_Value, Timestamp });
  console.log('Data received:', req.body);
  console.log('Model result:', modelResult);

  const point = new Point('kpi')
    .tag('kpi_name', KPI_Name)
    .floatField('kpi_value', KPI_Value)
    .booleanField('anomaly', modelResult.anomaly)
    .timestamp(new Date(Timestamp));

  console.log('Writing point to InfluxDB:', point);

  writeApi.writePoint(point);
  await writeApi.flush();

  const message = {
    KPI_Name,
    KPI_Value,
    Timestamp,
    anomaly: modelResult.anomaly,
    forecastedPoint1: modelResult.forecastedPoint1,
    trend: modelResult.trend,
  };
  console.log('Sending message to queue:', message);

  await sendMessage('kpi_queue', JSON.stringify(message));

  if(modelResult.anomaly){
    const kpiAlertMessage={
      KPI_Name,
      KPI_Value,
      Timestamp
    };
    console.log("sending a kpi alert message");
    await sendMessage('kpi_alert_queue', JSON.stringify(kpiAlertMessage));
  }

  res.status(200).send('Data processed successfully');
});

const PORT = process.env.PORT || 3010;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
