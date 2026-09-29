# Monitor de Fontes NFe / NFS-e

Monitora páginas de documentação fiscal (NFe, NFS-e, TaxPlus) e envia notificação no Telegram quando detecta mudança. A leitura das páginas é feita com Puppeteer (headless).

## Requisitos

- Node.js 18+
- Windows, Linux ou macOS (os scripts `.vbs` de agendamento são exclusivos do Windows)

## Instalação

```bash
npm install
```

## Configuração

1. Copie `.env.example` para `.env`:

   ```bash
   copy .env.example .env     # Windows
   cp .env.example .env       # Linux / macOS
   ```

2. Preencha as variáveis:

   ```dotenv
   TELEGRAM_TOKEN=token_do_bot
   TELEGRAM_CHAT_ID=id_do_chat
   ```

   - `TELEGRAM_TOKEN`: obtido no [@BotFather](https://t.me/BotFather).
   - `TELEGRAM_CHAT_ID`: id do chat/grupo que receberá os alertas.

> O `.env` está no `.gitignore` e **nunca** deve ser commitado.

## Execução

| Comando | O que faz |
|---|---|
| `npm start` | Executa o ciclo principal de monitoramento (`src/index.js`). |
| `npm run disponibilidade_nfe` | Verifica a página de disponibilidade do NFe (`src/disponibilidade-nfe.js`). |

Ambos executam um ciclo único e encerram — o agendamento é feito por um agendador externo.

### Agendamento no Windows

Os arquivos `run.vbs` e `runNFe.vbs` executam os ciclos sem abrir janela, para uso no Agendador de Tarefas.

> **Atenção:** os dois arquivos `.vbs` contêm caminhos absolutos fixos (`C:\Projetos\telegram\...`). Ao rodar em outra máquina, ajuste o caminho para onde o projeto foi clonado.

## Fontes monitoradas

As fontes ficam no array `URLS` em `src/monitor.js`. Cada fonte tem um `type` que define como a mudança é detectada:

| `type` | Detecção |
|---|---|
| `inventsoftware` | Lê a data em `.updated-info` e, quando `trackByDate` **não** está definido, rastreia o **índice sequencial** (`lastIndice`) da tabela `#isPasted tr`; com `trackByDate: true`, compara apenas a data. |
| `municipios-nfse` | Lê a data em `.updated-info` e compara a lista de municípios (links via XPath) com `municipios-nfse.json`; notifica cada município novo. |
| `nfe-notas-tecnicas` | Usa **XPath** para localizar o container e, dentro dele, `querySelectorAll('p a span')` para achar a data mais recente. |
| `govbr` | Lê a data em `.documentModified` com regex `dd/mm/aaaa HHhMM`. |
| `prefeitura-sp-manuais` | Lê `.manual-list` (`.manual-title`, `.manual-date`, `a.button-download`) e compara o manual mais recente. |
| `content-hash` | Gera **hash SHA-256** de `document.querySelector('.row').innerText` e compara com o anterior. |

### URLs monitoradas

**Release Notes — Docs. Eletrônicos (Invend Software)**
`https://atendimento.inventsoftware.info/` — `type: inventsoftware`
- `/kb/pt-br/article/570570/...` — Release Candidate: 25.12.30.53022
- `/kb/pt-br/article/581097/...` — Release Candidate: 26.3.27.56711
- `/kb/pt-br/article/586464/...` — Release Candidate: 26.4.30.58013
- `/kb/pt-br/article/589793/...` — Release Candidate: 26.5.29.59240
- `/kb/pt-br/article/594051/...` — Release Candidate: 26.6.30.60399
- `/kb/pt-br/article/547814/...` — Histórico de Releases TaxPlus

Seletores: `document.querySelectorAll('.updated-info')[0].innerText` com regex `(\d{2}/\d{2}/\d{4} \d{2}:\d{2})`; tabela via `document.querySelectorAll('#isPasted tr')` (`td[0]` índice, `td[1]` número, `td[2]` data, `td[3]` descrição).

**Portal de Notícias — Docs. Eletrônicos** (`trackByDate: true`)
- `/kb/pt-br/article/590309` — Junho 2026
- `/kb/pt-br/article/594056/docsnoticiasjulho2026` — Julho 2026

**TaxPlus NFS-e — Municípios em Produção** — `type: municipios-nfse`
- `https://atendimento.inventsoftware.info/kb/pt-br/article/355371/taxplus-nfs-e-municipios-em-producao-webservice`
- Data via `.updated-info`; municípios via XPath `/html/body/div[1]/div/div[5]/article/div/div[4]/ul/li/a` (`document.evaluate`, `ORDERED_NODE_SNAPSHOT_TYPE`).

**NFe — Portal da Fazenda** — `type: nfe-notas-tecnicas`
Base: `https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx`
- `?tipoConteudo=04BIflQt1aY=` — Alteração Nota Técnica NFe
- `?tipoConteudo=hXzemuyNHW4=` — Informes Técnicos NFe
- `?tipoConteudo=/NJarYc9nus=` — Diversos NFe

Seletores: XPath do container `/html/body/div[2]/form/div[4]/div[3]/div[3]/div[2]/div[1]` (`XPathResult.FIRST_ORDERED_NODE_TYPE`); itens via `container.querySelectorAll('p a span')`.

**NFS-e — Portal gov.br** — `type: govbr`
Base: `https://www.gov.br/nfse/pt-br/biblioteca/`
- `documentacao-tecnica/atualizacoes-e-implantacoes`
- `documentacao-tecnica/rtc`
- `documentacao-tecnica/producao-restrita`

Seletor: `document.querySelectorAll('.documentModified')[0].innerText` com regex `(\d{2}/\d{2}/\d{4} \d{2}h\d{2})`.

**Prefeitura de São Paulo — Manuais NFS-e** — `type: prefeitura-sp-manuais`
- `https://notadomilhao.sf.prefeitura.sp.gov.br/manuais/`
- `document.querySelector('.manual-list')`, `.manual-title`, `.manual-date`, `a.button-download`.

**Provedor NotaControl (Goiânia)** — `type: content-hash`
- `https://www.issnetonline.com.br/goiania/online/Login/Login.aspx`
- `document.querySelector('.row').innerText` → SHA-256.

**Disponibilidade do NFe** (fluxo separado, `src/disponibilidade-nfe.js`)
- `https://www.nfe.fazenda.gov.br/portal/disponibilidade.aspx`
- Segunda tabela da página (`document.querySelectorAll('table')[1]`); status lido de `img.src` (padrão `bola_<status>_P`).

## Como funciona o ciclo

1. Um navegador Puppeteer (`headless: 'new'`) é aberto e cada fonte é acessada com `waitUntil: 'networkidle2'` (timeout de 30s).
2. O resultado é comparado com o estado salvo:
   - **SEED** — primeira execução: apenas registra, **não** notifica.
   - **CHANGED** — mudança detectada: envia mensagem no Telegram (MarkdownV2).
   - **SEM MUDANÇA** — nada é enviado.
3. Ao final, o estado é persistido em disco.

## Arquivos de estado (gerados em tempo de execução)

| Arquivo | Conteúdo |
|---|---|
| `state.json` | Última data/índice/hash por URL da fonte principal. |
| `municipios-nfse.json` | Lista de municípios homologados (`indice`, `texto`, `href`). |
| `state-disponibilidade-nfe.json` | Mapa `autorizador → { serviço: status }`. |

> Esses arquivos **não são versionados**: são criados na primeira execução de cada instalação. Se fossem commitados, quem clonasse herdaria o estado de outra máquina e a primeira execução deixaria de ser SEED — ou seja, o projeto não notificaria nada até uma mudança real acontecer.

> Observação: nas fontes `inventsoftware` rastreadas por índice, `lastIndice = 0` indica que a tabela não retornou linhas na última leitura (extração vazia).

## Como adicionar uma fonte

1. Adicione um objeto ao array `URLS` em `src/monitor.js` com `id`, `label`, `url`, `type` e os seletores (`dateRegex`, `xpath` e/ou `selector`).
2. Se for um novo padrão de página, implemente o tratamento do novo `type` em `scrapePage` e o ramo de comparação em `runMonitoringCycle`.

## Limitações

- A extração depende de **seletores CSS, XPath e classes específicas** de cada site; mudanças no HTML podem quebrar a leitura (log `[FAIL]`), mantendo a última data conhecida.
- Falhas de envio ao Telegram (`[TELEGRAM FAIL]`) são isoladas por fonte e não interrompem o ciclo.
- O monitoramento é acionado externamente (Agendador de Tarefas, cron etc.); o processo não fica residente.