import { JSDOM, VirtualConsole } from "jsdom";
import fs from "fs";

const html = fs.readFileSync(process.argv[2], "utf8")
  .replace(/<script src="https:\/\/www\.gstatic\.com[^"]*"><\/script>/g, "");

const vc = new VirtualConsole();
const erros = [];
const ignorar = /scrollTo|scrollIntoView|Not implemented: HTMLCanvas|navigation/i;
vc.on("jsdomError", e => { const m = e.stack || e.message; if (!ignorar.test(m)) erros.push(m); });

const docFake = { get: () => Promise.resolve({ exists: false }), set: () => Promise.resolve() };

const dom = new JSDOM(html, {
  runScripts: "dangerously", pretendToBeVisual: true,
  url: "https://destravalinguas.web.app/", virtualConsole: vc,
  // as simulacoes precisam existir ANTES do script rodar
  beforeParse(w) {
    w.scrollTo = () => {};
    w.firebase = {
      initializeApp: () => {},
      auth: () => ({
        onAuthStateChanged: cb => setTimeout(() => cb({ uid: "u1", email: "teste@x.com" }), 0),
        signOut: () => {},
      }),
      firestore: () => ({ collection: () => ({ doc: () => docFake }) }),
    };
    w.speechSynthesis = { getVoices: () => [], cancel(){}, speak(){}, addEventListener(){} };
    w.SpeechSynthesisUtterance = function(){};
    w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ chave: true }) });
    w.Element.prototype.scrollIntoView = () => {};
  },
});
const w = dom.window;

await new Promise(r => setTimeout(r, 1200));
const d = w.document;

// escolhe o idioma, como o usuario faria
const cartoes = d.querySelectorAll(".cartao");
console.log("  cartoes de idioma ...", cartoes.length);
if (cartoes.length) { cartoes[0].dispatchEvent(new w.MouseEvent("click", {bubbles:true})); }
await new Promise(r => setTimeout(r, 900));
const conta = sel => d.querySelectorAll(sel).length;
console.log("  #view ...............", d.getElementById("view").children.length, "elementos");
console.log("  abas na navegacao ...", conta("#nav button"));
console.log("  Larissa no palco ....", conta(".palco .bn-olho") + conta(".palco .bn-fio"), "pecas animadas");
console.log("  licoes na trilha ....", conta(".les"));
console.log(erros.length ? "\nERROS:\n" + erros.slice(0, 2).join("\n---\n") : "\n  nenhum erro");
