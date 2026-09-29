'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const TelegramBot = require('node-telegram-bot-api');
const { runMonitoringCycle } = require('./monitor');

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token || !chatId || chatId === 'SEU_CHAT_ID_AQUI') {
  console.error('[ERRO] TELEGRAM_TOKEN ou TELEGRAM_CHAT_ID não configurado no .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: false });

runMonitoringCycle(bot, chatId)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[ERRO FATAL]', err.message);
    process.exit(1);
  });
