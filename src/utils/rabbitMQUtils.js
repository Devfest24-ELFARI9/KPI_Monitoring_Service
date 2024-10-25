const getConnection = require('./rabbitMQConnection');

const sendMessage = async (queue, message) => {
  const connection = await getConnection();
  const channel = await connection.createChannel();
  await channel.assertQueue(queue, { durable: true });
  channel.sendToQueue(queue, Buffer.from(message)); 
  console.log(`Sent: ${message}`);
};

const consumeMessages = async (queue, callback) => {
  const connection = await getConnection();
  const channel = await connection.createChannel();
  await channel.assertQueue(queue, { durable: true });
  channel.consume(queue, (msg) => {
    if (msg !== null) {
      callback(msg.content.toString());
      channel.ack(msg);
    }
  });
};

module.exports = { sendMessage, consumeMessages };