'use strict';

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATE_FILE = path.join(__dirname, '..', 'state.json');
const MUNICIPIOS_FILE = path.join(__dirname, '..', 'municipios-nfse.json');

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

const URLS = [
  {
    id: '25.12.30.53022',
    label: 'Docs. Eletrônicos | 📌 Release Note – Versão Release Candidate: 25.12.30.53022',
    url: 'https://atendimento.inventsoftware.info/kb/pt-br/article/570570/docs-eletronicos-release-note-versao-release-candidate-251230530',
    type: 'inventsoftware',
    dateRegex: /(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/,
  },
  {
    id: '26.3.27.56711',
    label: 'Docs. Eletrônicos | 📌 Release Note – Versão Release Candidate: 26.3.27.56711',
    url: 'https://atendimento.inventsoftware.info/kb/pt-br/article/581097/docs-eletronicos-release-note-versao-release-candidate-263275671',
    type: 'inventsoftware',
    dateRegex: /(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/,
  },
  {
    id: '26.4.30.58013',
    label: 'Docs. Eletrônicos | 📌 Release Note – Versão Release Candidate: 26.4.30.58013',
    url: 'https://atendimento.inventsoftware.info/kb/pt-br/article/586464/docs-eletronicos-release-note-versao-release-candidate-264305801',
    type: 'inventsoftware',
    dateRegex: /(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/,
  },
  {
    id: '26.5.29.59240',
    label: 'Docs. Eletrônicos | 📌 Release Note – Versão Release Candidate: 26.5.29.59240',
    url: 'https://atendimento.inventsoftware.info/kb/pt-br/article/589793/docs-eletronicos-release-note-versao-release-candidate-2652659',
    type: 'inventsoftware',
    dateRegex: /(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/,
  },
  {
    id: '26.6.30.60399',
    label: 'Docs. Eletrônicos | 📌 Release Note – Versão Release Candidate: 26.6.30.60399',
    url: 'https://atendimento.inventsoftware.info/kb/pt-br/article/594051/docs-eletronicos-release-note-versao-release-candidate-266306039',
    type: 'inventsoftware',
    dateRegex: /(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/,
  },
  {
    id: 'municipios-nfse-producao',
    label: 'TaxPlus NFS-e | Municípios em Produção Webservice',
    url: 'https://atendimento.inventsoftware.info/kb/pt-br/article/355371/taxplus-nfs-e-municipios-em-producao-webservice',
    type: 'municipios-nfse',
    dateRegex: /(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/,
    xpath: '/html/body/div[1]/div/div[5]/article/div/div[4]/ul/li/a',
  },
  {
    id: 'inventsoftware-historico-taxplus',
    label: 'TaxPlus Docs. Eletrônicos - Histórico de Releases',
    url: 'https://atendimento.inventsoftware.info/kb/pt-br/article/547814/docs-eletronicos-historico-de-releases-taxplus',
    type: 'inventsoftware',
    dateRegex: /(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/,
  },
  {
    id: 'nfe-notas-tecnicas',
    label: 'Alteração Nota Técnica NFe',
    url: 'https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY=',
    type: 'nfe-notas-tecnicas',
    xpath: '/html/body/div[2]/form/div[4]/div[3]/div[3]/div[2]/div[1]',
  },
  {
    id: 'nfe-informes-tecnicos',
    label: 'Informes Técnicos NFe',
    url: 'https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=hXzemuyNHW4=',
    type: 'nfe-notas-tecnicas',
    xpath: '/html/body/div[2]/form/div[4]/div[3]/div[3]/div[2]/div[1]',
  },
  {
    id: 'nfe-diversos',
    label: 'Diversos NFe',
    url: 'https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=/NJarYc9nus=',
    type: 'nfe-notas-tecnicas',
    xpath: '/html/body/div[2]/form/div[4]/div[3]/div[3]/div[2]/div[1]',
  },
  {
    id: 'nfse-atualizacoes',
    label: 'NFS-e - Atualizações e Implantações',
    url: 'https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/atualizacoes-e-implantacoes',
    type: 'govbr',
    dateRegex: /(\d{2}\/\d{2}\/\d{4} \d{2}h\d{2})/,
  },
  {
    id: 'nfse-rtc',
    label: 'NFS-e - RTC',
    url: 'https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/rtc',
    type: 'govbr',
    dateRegex: /(\d{2}\/\d{2}\/\d{4} \d{2}h\d{2})/,
  },
  {
    id: 'nfse-producao-restrita',
    label: 'NFS-e - Produção Restrita',
    url: 'https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/producao-restrita',
    type: 'govbr',
    dateRegex: /(\d{2}\/\d{2}\/\d{4} \d{2}h\d{2})/,
  },
  {
    id: 'prefeitura-sp-manuais',
    label: 'Prefeitura SP - Manuais NFS-e',
    url: 'https://notadomilhao.sf.prefeitura.sp.gov.br/manuais/',
    type: 'prefeitura-sp-manuais',
  },
  {
    id: 'Portal de Notícias - Junho 2026',
    label: 'Docs. Eletrônicos | Portal de Notícias - Junho 2026',
    url: 'https://atendimento.inventsoftware.info/kb/pt-br/article/590309',
    type: 'inventsoftware',
    dateRegex: /(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/,
    trackByDate: true,
  },
  {
    id: 'notacontrol-goiania',
    label: 'Alteração Provedor NotaControl',
    url: 'https://www.issnetonline.com.br/goiania/online/Login/Login.aspx',
    type: 'content-hash',
    selector: '.row',
  },
  {
    id: 'Portal de Notícias - Julho 2026',
    label: 'Docs. Eletrônicos | Portal de Notícias - Julho 2026',
    url: 'https://atendimento.inventsoftware.info/kb/pt-br/article/594056/docsnoticiasjulho2026?menuId=56045-147540-594056',
    type: 'inventsoftware',
    dateRegex: /(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/,
    trackByDate: true,
  },
];

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn(`[WARN] state.json ilegível, iniciando zerado: ${err.message}`);
  }
  return {};
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function loadMunicipios() {
  try {
    if (fs.existsSync(MUNICIPIOS_FILE)) {
      return JSON.parse(fs.readFileSync(MUNICIPIOS_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn(`[WARN] municipios-nfse.json ilegível: ${err.message}`);
  }
  return [];
}

function saveMunicipios(list) {
  fs.writeFileSync(MUNICIPIOS_FILE, JSON.stringify(list, null, 2), 'utf8');
}

async function scrapePage(browser, config) {
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7' });

  try {
    await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 30000 });

    if (config.type === 'nfe-notas-tecnicas') {
      const resultado = await page.evaluate((xpath) => {
        const container = document.evaluate(
          xpath, document, null,
          XPathResult.FIRST_ORDERED_NODE_TYPE, null
        ).singleNodeValue;

        if (!container) return null;

        const regex = /\b(\d{2}\/\d{2}\/\d{4})\b/g;
        let dataMaisRecente = null;

        [...container.querySelectorAll('p a span')].forEach(span => {
          const texto = span.innerText;
          const match = texto.match(regex);
          if (!match) return;
          const data = match[0];
          const [dia, mes, ano] = data.split('/').map(Number);
          const ts = new Date(ano, mes - 1, dia).getTime();
          if (!dataMaisRecente || ts > dataMaisRecente.ts) {
            dataMaisRecente = { texto, data, ts };
          }
        });

        if (!dataMaisRecente) return null;
        return { texto: dataMaisRecente.texto, data: dataMaisRecente.data };
      }, config.xpath);

      if (!resultado) {
        throw new Error('XPath não encontrou container ou nenhuma data encontrada');
      }

      return { success: true, date: resultado.data, titulo: resultado.texto };
    }

    if (config.type === 'municipios-nfse') {
      const rawText = await page.evaluate(
        () => (document.querySelectorAll('.updated-info')[0] || {}).innerText || ''
      );
      const match = rawText.match(config.dateRegex);
      if (!match) {
        throw new Error(`Seletor retornou "${rawText}" — regex não encontrou data`);
      }
      const date = match[1];

      const municipios = await page.evaluate((xpath) => {
        const itens = document.evaluate(
          xpath, document, null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
        );
        const resultado = [];
        for (let i = 0; i < itens.snapshotLength; i++) {
          const a = itens.snapshotItem(i);
          resultado.push({ indice: i, texto: a.innerText.trim(), href: a.href });
        }
        return resultado;
      }, config.xpath);

      if (!municipios.length) {
        throw new Error('XPath não retornou municípios');
      }

      return { success: true, date, municipios };
    }

    if (config.type === 'content-hash') {
      const text = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.innerText.trim() : null;
      }, config.selector);

      if (!text) {
        throw new Error(`Seletor "${config.selector}" não encontrou elemento`);
      }

      const hash = crypto.createHash('sha256').update(text).digest('hex');
      return { success: true, contentHash: hash };
    }

    if (config.type === 'prefeitura-sp-manuais') {
      const manualInfo = await page.evaluate(() => {
        const lista = document.querySelector('.manual-list');
        if (!lista) return null;
        const itens = [...lista.children];
        const maisRecente = itens
          .map(item => {
            const dataTexto = item.querySelector('.manual-date')?.innerText?.trim();
            if (!dataTexto) return null;
            const [dia, mes, ano] = dataTexto.split('/');
            return { element: item, data: new Date(`${ano}-${mes}-${dia}`) };
          })
          .filter(Boolean)
          .sort((a, b) => b.data - a.data)[0]
          ?.element;

        if (!maisRecente) return null;

        const descricao = [...maisRecente.querySelectorAll('p')]
          .find(p =>
            !p.classList.contains('manual-date') &&
            !p.classList.contains('manual-description') &&
            p.innerText.trim()
          )?.innerText.trim();

        return {
          titulo: maisRecente.querySelector('.manual-title')?.innerText?.trim(),
          data: maisRecente.querySelector('.manual-date')?.innerText?.trim(),
          descricao,
          downloadUrl: maisRecente.querySelector('a.button-download')?.href,
        };
      });

      if (!manualInfo || !manualInfo.data) {
        throw new Error('Nenhum manual encontrado ou sem data');
      }
      return { success: true, date: manualInfo.data, manualInfo };
    }

    let rawText;
    if (config.type === 'inventsoftware') {
      rawText = await page.evaluate(
        () => (document.querySelectorAll('.updated-info')[0] || {}).innerText || ''
      );
    } else {
      rawText = await page.evaluate(
        () => (document.querySelectorAll('.documentModified')[0] || {}).innerText || ''
      );
    }

    const match = rawText.match(config.dateRegex);
    if (!match) {
      throw new Error(`Seletor retornou "${rawText}" — regex não encontrou data`);
    }
    const date = match[1];

    let tableRows = null;
    if (config.type === 'inventsoftware') {
      tableRows = await page.evaluate(() => {
        const linhas = Array.from(document.querySelectorAll('#isPasted tr'))
          .map(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length < 4) return null;
            const indice = tds[0].textContent.trim();
            const numero = tds[1].textContent.trim();
            const data = tds[2].textContent.trim();
            const descricao = tds[3] ? tds[3].textContent.trim() : '';
            if (!indice || isNaN(parseInt(indice))) return null;
            return { indice: parseInt(indice), numero, data, descricao };
          })
          .filter(Boolean);

        return linhas;
      });
    }

    return { success: true, date, tableRows };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    await page.close();
  }
}

function escapeMarkdown(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function formatMessage(config, oldDate, newDate, tableRows) {
  const timestamp = now();
  const previousLabel = oldDate ? escapeMarkdown(oldDate) : '_N/A (primeira verificação)_';

  let msg = `🔔 *Atualização Detectada\\!*\n\n`;
  msg += `📄 *${escapeMarkdown(config.label)}*\n`;
  msg += `🔗 ${escapeMarkdown(config.url)}\n\n`;
  msg += `📅 *Data anterior:* ${previousLabel}\n`;
  msg += `✅ *Nova data:* ${escapeMarkdown(newDate)}\n`;
  msg += `🕐 *Verificado em:* ${escapeMarkdown(timestamp)}\n`;

  if (tableRows && tableRows.length > 0) {
    const dataLabel = escapeMarkdown(tableRows[0].data);
    msg += `\n📋 *Mudanças mais recentes \\(${dataLabel}\\):*\n\n`;
    for (const row of tableRows) {
      msg += `🔹 *TXPDE\\-${escapeMarkdown(row.numero)}*\n`;
      msg += `${escapeMarkdown(row.descricao)}\n\n`;
    }
  }

  return msg;
}

async function sendTelegramMessage(bot, chatId, text) {
  await bot.sendMessage(chatId, text, { parse_mode: 'MarkdownV2' });
}

function formatNotaTecnicaMessage(config, oldDate, newDate, titulo) {
  const timestamp = now();
  const previousLabel = oldDate ? escapeMarkdown(oldDate) : '_N/A \\(primeira verificação\\)_';
  let msg = `🔔 *${escapeMarkdown(config.label)}\\!*\n\n`;
  msg += `📄 *${escapeMarkdown(titulo)}*\n`;
  msg += `🔗 ${escapeMarkdown(config.url)}\n\n`;
  msg += `📅 *Data anterior:* ${previousLabel}\n`;
  msg += `✅ *Nova data:* ${escapeMarkdown(newDate)}\n`;
  msg += `🕐 *Verificado em:* ${escapeMarkdown(timestamp)}`;
  return msg;
}

function formatMunicipioMessage(municipio) {
  const timestamp = now();
  let msg = `🏙️ *Novo Município Homologado\\!*\n\n`;
  msg += `📍 *${escapeMarkdown(municipio.texto)}*\n`;
  msg += `🔗 [Acessar configuração](${escapeMarkdown(municipio.href)})\n`;
  msg += `🕐 *Verificado em:* ${escapeMarkdown(timestamp)}`;
  return msg;
}

function formatManualMessage(config, anterior, atual) {
  const timestamp = now();
  const anteriorLabel = anterior.titulo
    ? `${escapeMarkdown(anterior.titulo)} \\(${escapeMarkdown(anterior.data)}\\)`
    : '_N/A (primeira verificação)_';

  let msg = `🔔 *Atualização Detectada\\!*\n\n`;
  msg += `📄 *${escapeMarkdown(config.label)}*\n`;
  msg += `🔗 ${escapeMarkdown(config.url)}\n\n`;
  msg += `📌 *Manual anterior:* ${anteriorLabel}\n`;
  msg += `✅ *Novo manual:* ${escapeMarkdown(atual.titulo)} \\(${escapeMarkdown(atual.data)}\\)\n`;
  if (atual.descricao) {
    msg += `📝 ${escapeMarkdown(atual.descricao)}\n`;
  }
  if (atual.downloadUrl) {
    msg += `⬇️ [Download](${escapeMarkdown(atual.downloadUrl)})\n`;
  }
  msg += `🕐 *Verificado em:* ${escapeMarkdown(timestamp)}\n`;
  return msg;
}

async function runMonitoringCycle(bot, chatId) {
  console.log(`[${now()}] Ciclo iniciado`);
  const state = loadState();
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    for (const config of URLS) {
      console.log(`  Verificando: ${config.id}`);
      const result = await scrapePage(browser, config);

      if (!result.success) {
        console.error(`  [FAIL] ${config.id}: ${result.error}`);
        continue;
      }

      if (config.type === 'nfe-notas-tecnicas') {
        const { date: newDate, titulo } = result;
        const oldDate = state[config.url]?.lastDate;

        state[config.url] = { lastDate: newDate, lastChecked: now() };

        if (!oldDate) {
          console.log(`  [SEED] ${config.id}: "${newDate}" — ${titulo}`);
        } else if (newDate !== oldDate) {
          console.log(`  [CHANGED] ${config.id}: "${oldDate}" → "${newDate}"`);
          const message = formatNotaTecnicaMessage(config, oldDate, newDate, titulo);
          try {
            await sendTelegramMessage(bot, chatId, message);
            console.log(`  [NOTIFIED] ${config.id}`);
          } catch (telegramErr) {
            console.error(`  [TELEGRAM FAIL] ${config.id}: ${telegramErr.message}`);
          }
        } else {
          console.log(`  [SEM MUDANÇA] ${config.id}: "${newDate}"`);
        }
        continue;
      }

      if (config.type === 'municipios-nfse') {
        const { date: newDate, municipios } = result;
        const existing = loadMunicipios();
        const existingHrefs = new Set(existing.map(m => m.href));
        const novos = municipios.filter(m => !existingHrefs.has(m.href));

        saveMunicipios(municipios);
        state[config.url] = { lastDate: newDate, lastChecked: now() };

        if (!existing.length) {
          console.log(`  [SEED] ${config.id}: ${municipios.length} municípios registrados`);
        } else if (novos.length > 0) {
          console.log(`  [CHANGED] ${config.id}: ${novos.length} novo(s) município(s)`);
          for (const municipio of novos) {
            const msg = formatMunicipioMessage(municipio);
            try {
              await sendTelegramMessage(bot, chatId, msg);
            } catch (telegramErr) {
              console.error(`  [TELEGRAM FAIL] ${config.id} (${municipio.texto}): ${telegramErr.message}`);
            }
          }
          console.log(`  [NOTIFIED] ${config.id}: ${novos.length} notificação(ões)`);
        } else {
          console.log(`  [SEM MUDANÇA] ${config.id}: ${municipios.length} municípios`);
        }
        continue;
      }

      if (config.type === 'content-hash') {
        const { contentHash } = result;
        const oldHash = state[config.url]?.contentHash;

        state[config.url] = { contentHash, lastChecked: now() };

        if (!oldHash) {
          console.log(`  [SEED] ${config.id}: hash inicial registrado`);
        } else if (contentHash !== oldHash) {
          console.log(`  [CHANGED] ${config.id}: hash alterado`);
          const timestamp = now();
          const msg =
            `🔔 *${escapeMarkdown(config.label)}\\!*\n\n` +
            `🔗 ${escapeMarkdown(config.url)}\n` +
            `🕐 *Verificado em:* ${escapeMarkdown(timestamp)}`;
          try {
            await sendTelegramMessage(bot, chatId, msg);
            console.log(`  [NOTIFIED] ${config.id}`);
          } catch (telegramErr) {
            console.error(`  [TELEGRAM FAIL] ${config.id}: ${telegramErr.message}`);
          }
        } else {
          console.log(`  [SEM MUDANÇA] ${config.id}`);
        }
        continue;
      }

      const { date: newDate, tableRows } = result;

      if (config.type === 'inventsoftware') {
        if (config.trackByDate) {
          const oldDate = state[config.url]?.lastDate;
          state[config.url] = { lastDate: newDate, lastChecked: now() };
          if (!oldDate) {
            console.log(`  [SEED] ${config.id}: "${newDate}"`);
          } else if (newDate !== oldDate) {
            console.log(`  [CHANGED] ${config.id}: "${oldDate}" → "${newDate}"`);
            const message = formatMessage(config, oldDate, newDate, null);
            try {
              await sendTelegramMessage(bot, chatId, message);
              console.log(`  [NOTIFIED] ${config.id}`);
            } catch (telegramErr) {
              console.error(`  [TELEGRAM FAIL] ${config.id}: ${telegramErr.message}`);
            }
          } else {
            console.log(`  [SEM MUDANÇA] ${config.id}: "${newDate}"`);
          }
        } else {
          // Rastreia pelo índice sequencial da tabela, não pela data.
          // Evita duplicatas e itens perdidos quando a página atualiza múltiplas vezes no mesmo dia.
          const lastIndice = state[config.url]?.lastIndice ?? null;
          const oldDate = state[config.url]?.lastDate;
          const allRows = tableRows || [];
          const maxIndice = allRows.length > 0 ? Math.max(...allRows.map(r => r.indice)) : 0;
          // lastIndice === null significa primeira execução (SEED) — não filtra nada
          const newRows = lastIndice !== null ? allRows.filter(r => r.indice > lastIndice) : [];

          state[config.url] = {
            lastDate: newDate,
            lastIndice: maxIndice,
            lastChecked: now(),
          };

          if (lastIndice === null) {
            console.log(`  [SEED] ${config.id}: primeira execução → indice ${maxIndice}`);
          } else if (newRows.length > 0) {
            console.log(`  [CHANGED] ${config.id}: ${newRows.length} novos itens (indice > ${lastIndice})`);
            const message = formatMessage(config, oldDate, newDate, newRows);
            try {
              await sendTelegramMessage(bot, chatId, message);
              console.log(`  [NOTIFIED] ${config.id}`);
            } catch (telegramErr) {
              console.error(`  [TELEGRAM FAIL] ${config.id}: ${telegramErr.message}`);
            }
          } else {
            console.log(`  [SEM MUDANÇA] ${config.id}: indice max ${maxIndice}`);
          }
        }
      } else if (config.type === 'prefeitura-sp-manuais') {
        const { manualInfo } = result;
        const oldData = state[config.url]?.lastData;
        const oldTitulo = state[config.url]?.lastTitulo;

        state[config.url] = {
          lastData: newDate,
          lastTitulo: manualInfo.titulo,
          lastChecked: now(),
        };

        if (!oldData) {
          console.log(`  [SEED] ${config.id}: "${manualInfo.titulo}" (${newDate})`);
        } else if (newDate !== oldData || manualInfo.titulo !== oldTitulo) {
          console.log(`  [CHANGED] ${config.id}: "${oldTitulo}" (${oldData}) → "${manualInfo.titulo}" (${newDate})`);
          const message = formatManualMessage(config, { titulo: oldTitulo, data: oldData }, manualInfo);
          try {
            await sendTelegramMessage(bot, chatId, message);
            console.log(`  [NOTIFIED] ${config.id}`);
          } catch (telegramErr) {
            console.error(`  [TELEGRAM FAIL] ${config.id}: ${telegramErr.message}`);
          }
        } else {
          console.log(`  [SEM MUDANÇA] ${config.id}: "${manualInfo.titulo}" (${newDate})`);
        }
      } else {
        const oldDate = state[config.url]?.lastDate;

        state[config.url] = {
          lastDate: oldDate || newDate,
          lastChecked: now(),
        };

        if (!oldDate) {
          console.log(`  [SEED] ${config.id}: primeira execução → "${newDate}"`);
          state[config.url].lastDate = newDate;
        } else if (newDate !== oldDate) {
          console.log(`  [CHANGED] ${config.id}: "${oldDate}" → "${newDate}"`);
          const message = formatMessage(config, oldDate, newDate, tableRows);
          try {
            await sendTelegramMessage(bot, chatId, message);
            state[config.url].lastDate = newDate;
            console.log(`  [NOTIFIED] ${config.id}`);
          } catch (telegramErr) {
            console.error(`  [TELEGRAM FAIL] ${config.id}: ${telegramErr.message}`);
          }
        } else {
          console.log(`  [SEM MUDANÇA] ${config.id}: "${newDate}"`);
          state[config.url].lastDate = newDate;
        }
      }
    }
  } catch (err) {
    console.error(`[ERRO CICLO] ${err.message}`);
  } finally {
    if (browser) await browser.close();
    saveState(state);
    console.log(`[${now()}] state.json salvo. Ciclo encerrado.`);
  }
}

module.exports = { runMonitoringCycle };
