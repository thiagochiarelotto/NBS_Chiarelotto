'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const STATE_FILE = path.join(__dirname, '..', 'state-disponibilidade-nfe.json');
const URL_DISPONIBILIDADE = 'https://www.nfe.fazenda.gov.br/portal/disponibilidade.aspx';

const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token || !chatId || chatId === 'SEU_CHAT_ID_AQUI') {
  console.error('[ERRO] TELEGRAM_TOKEN ou TELEGRAM_CHAT_ID não configurado no .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: false });

function now() {
  return new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(',', ' |');
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn(`[WARN] state-disponibilidade-nfe.json ilegível: ${err.message}`);
  }
  return {};
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function escapeMarkdown(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function servicoNome(coluna) {
  return coluna.replace(/\d+$/, '').trim();
}

function statusInfo(status) {
  switch (status) {
    case 'vermelho':
    case 'vermelha': return { emoji: '🔴', texto: 'indisponível' };
    case 'amarelo':
    case 'amarela':  return { emoji: '🟡', texto: 'com instabilidade' };
    case 'verde':    return { emoji: '🟢', texto: 'normalizado' };
    default:         return { emoji: '⚪', texto: status };
  }
}

function buildBatchMessage(changes) {
  const timestamp = now();

  // Agrupa por autorizador
  const porAutorizador = {};
  for (const c of changes) {
    if (!porAutorizador[c.autorizador]) porAutorizador[c.autorizador] = [];
    porAutorizador[c.autorizador].push(c);
  }

  let msg = `⚠️ *Alteração Disponibilidade NFe*\n\n`;

  for (const [autorizador, itens] of Object.entries(porAutorizador)) {
    msg += `*${escapeMarkdown(autorizador)}:*\n`;
    for (const { servico, novoStatus, antigoStatus } of itens) {
      const { emoji: emojiNovo, texto } = statusInfo(novoStatus);
      const nome = servicoNome(servico);
      msg += `${emojiNovo} ${escapeMarkdown(nome)} — ${escapeMarkdown(texto)}\n`;
    }
    msg += '\n';
  }

  msg += `🔗 ${escapeMarkdown(URL_DISPONIBILIDADE)}\n`;
  msg += `🕐 *Verificado em:* ${escapeMarkdown(timestamp)}`;
  return msg;
}

async function scrapeDisponibilidade(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7' });

  try {
    await page.goto(URL_DISPONIBILIDADE, { waitUntil: 'networkidle2', timeout: 30000 });

    const dados = await page.evaluate(() => {
      const tabela = document.querySelectorAll('table')[1];
      if (!tabela) return null;

      const cabecalhos = [...tabela.rows[0].cells].map(c => c.innerText.trim());

      return [...tabela.rows].slice(1).map(linha => {
        const obj = {};
        [...linha.cells].forEach((celula, i) => {
          const img = celula.querySelector('img');
          obj[cabecalhos[i]] = img
            ? img.src.match(/bola_(.*?)_P/)?.[1] || img.src
            : celula.innerText.trim();
        });
        return obj;
      });
    });

    if (!dados || !dados.length) {
      throw new Error('Tabela não encontrada ou vazia');
    }

    return { success: true, dados };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    await page.close();
  }
}

async function run() {
  console.log(`[${now()}] Verificando disponibilidade NFe...`);
  const state = loadState();
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const result = await scrapeDisponibilidade(browser);

    if (!result.success) {
      console.error(`[FAIL] ${result.error}`);
      return;
    }

    const { dados } = result;
    const isFirstRun = Object.keys(state).length === 0;
    const newState = {};
    const changes = [];

    for (const linha of dados) {
      const colunas = Object.keys(linha);
      const autorizador = linha[colunas[0]];
      if (!autorizador) continue;

      newState[autorizador] = {};

      for (const servico of colunas.slice(1)) {
        const novoStatus = linha[servico];
        if (!novoStatus) continue;

        newState[autorizador][servico] = novoStatus;

        if (isFirstRun) continue;

        const antigoStatus = state[autorizador]?.[servico];
        if (!antigoStatus || antigoStatus === novoStatus) continue;

        console.log(`  [CHANGED] ${autorizador} / ${servico}: ${antigoStatus} → ${novoStatus}`);
        changes.push({ autorizador, servico, novoStatus, antigoStatus });
      }
    }

    if (isFirstRun) {
      console.log(`[SEED] ${dados.length} autorizadores registrados`);
    } else if (changes.length > 0) {
      const msg = buildBatchMessage(changes);
      try {
        await bot.sendMessage(chatId, msg, { parse_mode: 'MarkdownV2' });
        console.log(`  [NOTIFIED] ${changes.length} alteração(ões)`);
      } catch (telegramErr) {
        console.error(`  [TELEGRAM FAIL] ${telegramErr.message}`);
      }
    }

    saveState(newState);
    console.log(`[${now()}] Concluído. State salvo.`);
  } catch (err) {
    console.error(`[ERRO FATAL] ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
}

run().then(() => process.exit(0)).catch(err => {
  console.error('[ERRO]', err.message);
  process.exit(1);
});
