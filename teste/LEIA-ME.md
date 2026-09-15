# Teste de fumaça

Carrega `public/index.html` num DOM de verdade (jsdom), com Firebase e voz
simulados, escolhe um idioma e confere se a trilha montou.

```
npm install jsdom
node teste/fumaca.mjs public/index.html
```

Existe porque `node --check` valida sintaxe, não execução. Uma vez uma
variável `let` declarada depois de já ser usada derrubou o script inteiro
no arranque: a sintaxe estava correta, a página abria em branco, e só a
barra de cima aparecia — porque o texto dela está no HTML.
