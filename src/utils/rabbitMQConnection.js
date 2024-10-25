const amqp = require('amqplib');
const config = require('../config/rabbitmq');

let connection = null;

const getConnection = async () => {
  if (!connection) {
    connection = await amqp.connect({
      protocol: 'amqp',
      hostname: config.rabbitmq.host,
      port: config.rabbitmq.port,
      username: config.rabbitmq.username,
      password: config.rabbitmq.password,
    });
  }
  return connection;
};

module.exports = getConnection;