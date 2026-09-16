/* Teste de integração: percorre o app como uma pessoa percorreria.
 *
 * Carrega a página num DOM de verdade, simula o Firebase, a voz e o Worker,
 * e então clica: escolhe idioma, abre lição, responde exercício, passa por
 * todas as abas. Cada passo vira uma linha de OK ou FALHA.
 *
 *   npm install jsdom
 *   node teste/completo.mjs public/index.html
 */
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "fs";

const ARQ = process.argv[2] || "public/index.html";
const html = fs.readFileSync(ARQ, "utf8")
  .replace(/<script src="https:\/\/www\.gstatic\.com[^"]*"><\/script>/g, "");

const erros = [];
const ignorar = /scrollTo|scrollIntoView|Not implemented|AudioContext|indexedDB/i;
const vc = new VirtualConsole();
vc.on("jsdomError", e => { const m = e.stack || e.message; if (!ignorar.test(m)) erros.push(m); });

/* ---------------------------------------------------------------- respostas falsas */

const AULA = {
  resumo: "Você vai saber pronunciar a terminação -ING sem inventar vogal.",
  pontos: [{ titulo: "O som final", texto: "É um som nasal só, sem o 'gue' que o português acrescenta." }],
  exemplos: [{ en: "I am working.", pt: "Estou trabalhando.", fig: "ai em uârking" }],
  atencao: "Brasileiro tende a dizer 'workingue'.",
  exercicios: [
    { tipo: "escolha", pergunta: "Como se pronuncia working?", opcoes: ["uârkin", "uârkingue", "uârking"], resposta: 0, porque: "O G final não vira sílaba." },
    { tipo: "escolha", pergunta: "E running?", opcoes: ["raningue", "ranin", "ranig"], resposta: 1, porque: "Mesma regra." },
    { tipo: "traduzir", pergunta: "Eu estou estudando.", resposta: "I am studying.", porque: "Presente contínuo." },
    { tipo: "escolha", pergunta: "O -ING é sempre nasal?", opcoes: ["sim", "não", "às vezes"], resposta: 0, porque: "Sim." },
    { tipo: "escolha", pergunta: "Qual está certo?", opcoes: ["goingue", "going", "goin"], resposta: 1, porque: "Escrita normal." },
  ],
};

const respostaJson = dados => ({
  ok: true, status: 200,
  json: async () => dados,
  text: async () => JSON.stringify(dados),
  blob: async () => ({ size: 9999, type: "audio/mpeg" }),
  headers: { get: () => "application/json" },
  body: null,
});

function fetchFalso(url) {
  const u = String(url);
  if (u.includes("/api/status")) return respostaJson({ chave: true, admin: true, azure: true });
  if (u.includes("/api/vozes")) return respostaJson([
    { nome: "pt-BR-ThalitaMultilingualNeural", rotulo: "Thalita multilíngue", locale: "pt-BR", feminina: true, multilingue: true },
    { nome: "pt-BR-FranciscaNeural", rotulo: "Francisca", locale: "pt-BR", feminina: true, multilingue: false },
  ]);
  if (u.includes("/api/alunos")) return respostaJson({ alunos: [
    { uid: "u1", email: "aluno@teste.com", criadoEm: Date.now(), ultimoAcesso: Date.now(), admin: false },
  ]});
  if (u.includes("/api/voz") || u.includes("/api/ouvir")) return respostaJson({ texto: "hello", idioma: "en-US" });
  if (u.includes("/api/gemini/")) return respostaJson({
    candidates: [{ content: { parts: [{ text: JSON.stringify(AULA) }] } }],
  });
  if (u.includes("identitytoolkit")) return respostaJson({ error: { message: "INVALID_LOGIN_CREDENTIALS" } });
  return respostaJson({});
}

/* ---------------------------------------------------------------- monta o DOM */

const docFake = { get: async () => ({ exists: false }), set: async () => {} };
const dom = new JSDOM(html, {
  runScripts: "dangerously", pretendToBeVisual: true,
  url: "https://destravalinguas.web.app/", virtualConsole: vc,
  beforeParse(w) {
    w.scrollTo = () => {};
    w.Element.prototype.scrollIntoView = () => {};
    w.fetch = u => Promise.resolve(fetchFalso(u));
    w.firebase = {
      initializeApp: () => {},
      auth: () => ({
        onAuthStateChanged: cb => setTimeout(() => cb({ uid: "admin1", email: "admin@destrava.app" }), 0),
        signOut: () => {},
        currentUser: { getIdToken: async () => "tok" },
      }),
      firestore: () => ({ collection: () => ({ doc: () => docFake }) }),
    };
    w.speechSynthesis = { getVoices: () => [], cancel(){}, speak(){}, addEventListener(){}, speaking: false };
    w.SpeechSynthesisUtterance = function(){};
    w.MediaRecorder = undefined;
    w.Audio = function(){ return { play: async () => {}, pause(){}, paused: true, ended: true }; };
    w.URL.createObjectURL = () => "blob:falso";
    w.URL.revokeObjectURL = () => {};
  },
});
const w = dom.window, d = w.document;

/* ---------------------------------------------------------------- utilidades */

const espera = ms => new Promise(r => setTimeout(r, ms));
const $$ = sel => [...d.querySelectorAll(sel)];
const clicar = el => el?.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
const texto = () => d.getElementById("view")?.textContent || "";

let ok = 0, falhou = 0;
function checa(nome, condicao, detalhe) {
  if (condicao) { ok++; console.log("  ✓ " + nome); }
  else { falhou++; console.log("  ✗ " + nome + (detalhe ? "  → " + detalhe : "")); }
}

/* ---------------------------------------------------------------- o percurso */

console.log("\nEntrada");
await espera(900);
checa("pede para escolher o idioma", $$(".cartao").length === 2, `achei ${$$(".cartao").length} cartões`);
checa("mostra os dois idiomas", /Inglês/.test(texto()) && /Italiano/.test(texto()));

console.log("\nTrilha");
clicar($$(".cartao")[0]);
await espera(700);
checa("monta as 42 lições", $$(".les").length === 42, `achei ${$$(".les").length}`);
checa("Larissa aparece com as peças animadas", $$(".bn-olho").length === 2 && $$(".bn-fio").length === 2);
checa("dá um recado de boas-vindas", /Larissa/.test(texto()));
checa("nav tem a aba de administrador", $$("#nav button").length === 5, `${$$("#nav button").length} abas`);

console.log("\nLição");
clicar($$(".les")[0]);
await espera(900);
checa("carrega a explicação", /terminação -ING/.test(texto()));
checa("mostra o exemplo com pronúncia figurada", /uârking/.test(texto()));
checa("monta os 5 exercícios", $$(".ex, .opt").length > 0 && /Exercício 1 de 5/.test(texto()));

const opcoes = $$(".opt");
checa("primeira pergunta tem alternativas", opcoes.length >= 3, `${opcoes.length} opções`);
clicar(opcoes[0]);
await espera(300);
checa("marca a resposta certa", $$(".opt.right").length >= 1);
checa("explica por que", /não vira sílaba/i.test(texto()));

// termina a lição: as escolhas que faltam e a tradução
for (const b of $$(".opt")) if (!b.disabled) { clicar(b); await espera(120); }
const campoTrad = [...$$("input.inp")].find(x => /^ex\d+$/.test(x.id));
if (campoTrad) {
  campoTrad.value = "I am studying.";
  clicar([...d.querySelectorAll("button")].find(x => x.textContent.trim() === "Responder"));
  await espera(300);
}
checa("fecha a lição com a nota", /Lição concluída/.test(texto()), texto().slice(-120));
checa("oferece a próxima lição", /Próxima lição/.test(texto()));

console.log("\nAbas");
const abas = $$("#nav button");
clicar(abas[1]); await espera(500);
checa("Falar abre com Conversa e Pronúncia", /Conversa/.test(texto()) && /Pronúncia/.test(texto()));
checa("Larissa está no palco da conversa", $$(".palco .bn-olho").length === 2);

clicar(abas[2]); await espera(500);
checa("Progresso mostra os perfis", /Seus perfis/.test(texto()));
checa("Progresso conta as lições", /de 42 lições/.test(texto()));

clicar(abas[3]); await espera(700);
checa("Alunos lista quem tem acesso", /aluno@teste\.com/.test(texto()));
checa("Alunos tem o formulário de criar", !!d.getElementById("novo-email"));

clicar(abas[4]); await espera(700);
checa("Ajustes mostra as vozes da conta", /Thalita/.test(texto()));
checa("Ajustes esconde a chave quando está no servidor", !/Chave da API/.test(texto()));

console.log("\nVolta para a trilha");
clicar(abas[0]); await espera(600);
checa("a lição feita ficou marcada", $$(".les.done").length >= 1, `${$$(".les.done").length} concluídas`);

console.log("\nErros de execução");
checa("nenhum erro no console", erros.length === 0, erros[0]?.slice(0, 160));

console.log(`\n${ok} passaram, ${falhou} falharam\n`);
process.exit(falhou ? 1 : 0);
