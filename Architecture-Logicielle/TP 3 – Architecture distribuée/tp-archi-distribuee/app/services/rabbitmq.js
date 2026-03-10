// app/services/rabbitmq.js
const amqp = require('amqplib');

let channel;
const QUEUE = 'commandes';

async function connectRabbitMQ() {
  const conn = await amqp.connect('amqp://admin:admin@rabbitmq');
  channel = await conn.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });
  console.log('✅ RabbitMQ connecté');
}

function publierCommande(commande) {
  const msg = JSON.stringify(commande);
  channel.sendToQueue(QUEUE, Buffer.from(msg), { persistent: true });
  console.log('📤 Message publié dans RabbitMQ');
}

module.exports = { connectRabbitMQ, publierCommande };