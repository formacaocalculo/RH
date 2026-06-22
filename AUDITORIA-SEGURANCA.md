# Auditoria de Segurança — Portal RH

*Aplicação SPA (JavaScript ES modules) + Firebase/Firestore, multi-empresa.*
Data da revisão: 22/06/2026 · Âmbito: código estático fornecido em `RH.zip` (não inclui teste dinâmico nem a configuração real da consola Firebase).

---

## Resumo executivo

| # | Severidade | Tema |
|---|-----------|------|
| 1 | 🔴 **CRÍTICA** | XSS armazenado em toda a aplicação → tomada de conta de administrador e acesso a todas as empresas |
| 2 | 🟠 Média | A "reautenticação para eliminar" não é uma fronteira de segurança real |
| 3 | 🟡 Baixa/Info | Registo aberto + config pública: a segurança depende inteiramente das regras Firestore e da configuração Auth |
| 4 | 🟡 Baixa | `onclick` inline com valores interpolados |
| 5 | 🟡 Baixa | jsPDF carregado de CDN sem Subresource Integrity (SRI) |
| 6 | ⚪ Info | Dados pessoais sensíveis (RGPD) espalhados em backups/`.json` |

### Estado das correções (aplicado em 22/06/2026)

| # | Estado | O que foi feito no código |
|---|--------|---------------------------|
| 1 | ✅ **Corrigido** | Novo `assets/js/modules/html-utils.js` com `esc()`/`escAttr()`. Aplicado a **todos** os pontos onde dados do utilizador entram em `innerHTML`: empresas, colaboradores, NIF/NIB, cargos, moradas, **notas de ausências**, descrições da lixeira, mensagens de alerta, nomes na área de Administração e no modal de eliminação. |
| 4 | ✅ Mitigado | Identificadores em `onclick="..."` passam por `escAttr()` (neutraliza aspas/parênteses). Refactor completo para `addEventListener` continua recomendado (ver nota). |
| 5 | ✅ **Corrigido** | jsPDF deixou de ser carregado de CDN sem SRI; agora é alojado localmente em `assets/vendor/jspdf.umd.min.js`. |
| — | ✅ Adicionado | Cabeçalhos de segurança no `vercel.json`: CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `HSTS`, `Permissions-Policy`. |
| 2 | ⚠️ Documentado | Continua a ser salvaguarda de UX (não fronteira de segurança). Sem alteração de código — exigiria validação no servidor (Cloud Functions). |
| 3 | ⚠️ Consola | Confirmar regras publicadas + ativar App Check / verificação de email. Fora do código. |
| 6 | ⚠️ Processo | Definir retenção de backups/lixeira e base legal de acesso de admin. Fora do código. |

**Nota sobre a CSP:** inclui `'unsafe-inline'` para *scripts* e *estilos* porque a app usa muitos `onclick`/estilos inline. Isto limita o valor da CSP contra XSS — mas o XSS já está fechado na origem (#1). Concluir o refactor da #4 (remover handlers inline) permitirá uma CSP estrita sem `'unsafe-inline'`.

---

**O que está bem:** as regras do Firestore estão corretas e fazem o isolamento entre empresas *no servidor* (não apenas na interface); o modelo de admin não permite auto-promoção; a recuperação de password não revela se o email existe; espera-se por `authReady` antes de confiar na sessão. A separação multi-tenant é sólida — o problema crítico não está nas regras, está no cliente.

---

## 1. 🔴 CRÍTICA — XSS armazenado em toda a aplicação

### O problema
Nenhum dado dinâmico é escapado antes de ser injetado via `innerHTML`. Todos os campos de texto livre controlados pelo utilizador são interpolados em bruto em *template strings* de HTML. Confirmei que **não existe nenhuma função de escape** em todo o código (`grep` por `escapeHtml`, `DOMPurify`, `sanitize`, etc. não devolve nada; `textContent` só é usado para strings estáticas internas, nunca para dados do utilizador nas tabelas).

Exemplos (não exaustivo):

- `admin.js:131` — `<td ...>${e.nome}</td>` (nome da empresa, em bruto)
- `funcionarios.js:166` — `${f.nome}`, `${f.nif}`, `${f.cargo}`
- `empresas.js:100` — lista de empresas
- `dashboard.js:~110` — `${alerta.mensagem}` (mensagem de alerta, derivada do nome do colaborador)
- `recibos.js:70`, `lixeira.js:91`, `assiduidade.js:597/667`, `ficha-funcionario.js`, `processamento.js:245`

### Porque é crítico (cadeia de exploração)
1. Qualquer pessoa na Internet pode criar uma conta (registo aberto — ver ponto 3).
2. Essa pessoa cria uma empresa (ou colaborador) cujo **nome** é um *payload*, por exemplo:
   `<img src=x onerror="/* código do atacante */">`
3. O *payload* fica guardado no Firestore (XSS **armazenado**, não refletido).
4. Quando um **administrador** abre a área "🛠️ Administração", `admin.js` renderiza `${e.nome}` de **todas as empresas de todos os utilizadores** em bruto → o *payload* executa **na sessão do admin**.
5. Pelas regras do Firestore, um admin tem leitura/escrita sobre **todos** os dados de **todos** os utilizadores. O código do atacante, a correr no contexto do admin, pode então ler ou destruir a base de dados inteira (salários, NIF, NIB, dados de todos os colaboradores de todas as empresas), criar/apagar registos, etc.

Ou seja: um utilizador anónimo da Internet consegue, na prática, escalar privilégios até ao controlo total, bastando que um admin abra o painel. O mesmo vetor funciona, em menor escala, entre ecrãs do próprio utilizador.

### Correção
Adicionar um utilitário de escape e aplicá-lo a **todos** os valores interpolados em HTML. Sugestão de helper partilhado (ex.: em `colaborador-utils.js` ou num novo `html-utils.js`):

```js
export function esc(v) {
  if (v == null) return '';
  return String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
```

E usar em cada interpolação de dados do utilizador:

```js
// antes
`<td>${f.nome}</td>`
// depois
`<td>${esc(f.nome)}</td>`
```

Notas:
- Aplicar **em todos os módulos**, incluindo `${alerta.mensagem}` no dashboard e as descrições na lixeira/backups.
- Para valores interpolados dentro de **atributos** (ver ponto 4) o escape acima cobre aspas e `<`/`>`; ainda assim, prefira `addEventListener` a `onclick` inline.
- Defesa em profundidade: adicionar uma **Content-Security-Policy** (via `vercel.json` `headers` ou `<meta http-equiv>`) sem `unsafe-inline` quando possível. Atenção: o código atual depende muito de estilos e handlers inline, por isso uma CSP estrita exigirá refactor — vale como objetivo de médio prazo.

---

## 2. 🟠 Média — "Reautenticação para eliminar" não é fronteira de segurança

`seguranca-dados.js` exige reintroduzir a password e guarda um backup antes de eliminar. É uma boa salvaguarda **contra eliminações acidentais**, mas **não é um controlo de segurança**: as regras do Firestore permitem ao dono apagar os seus documentos livremente, sem qualquer reautenticação. Qualquer código com a sessão ativa (incluindo o XSS do ponto 1) pode chamar `deleteDoc(...)` diretamente e ignorar o modal por completo.

Além disso, o mecanismo usa uma *flag* global `window._suprimirRedirecionoAuth` reposta com um `setTimeout(…, 500)` — frágil e dependente de *timing*.

**Recomendação:** manter o modal como proteção de UX, mas não o descrever (no README/notas) como garantia de segurança. Se quiser uma verdadeira confirmação forte para ações destrutivas, ela teria de ser imposta do lado do servidor (ex.: Cloud Functions com verificação de *recent login*), o que está fora do modelo atual só-cliente.

---

## 3. 🟡 Baixa/Info — Superfície pública: registo aberto + config exposta

- A `apiKey` em `firebase-config.js` **não é um segredo** — em apps web Firebase é um identificador público e expô-la é normal. **A segurança depende inteiramente** de (a) as regras de `firestore.rules` estarem efetivamente publicadas e (b) da configuração de Authentication.
- O registo é **aberto** (`createUserWithEmailAndPassword` em `login.js`, confirmado no README): qualquer pessoa que descubra o URL implantado cria uma conta autenticada. Combinado com o ponto 1, isto torna o "atacante" potencial = toda a Internet.

**Recomendações:**
- Confirmar que as regras estão publicadas na consola (o próprio README avisa que, sem isso, qualquer autenticado acede a tudo via API).
- Ativar **Firebase App Check** para limitar abuso da API a partir de clientes não legítimos.
- Considerar **verificação de email** obrigatória e, se o público for fechado, restringir o registo (allowlist de domínios / convite).
- (Positivo) A mensagem genérica na recuperação de password já evita enumeração de emails — manter.

---

## 4. 🟡 Baixa — `onclick` inline com valores interpolados

Padrões como `onclick="window._adminEntrar('${e.id}','${e.donoUid}')"` (admin.js) e equivalentes em `funcionarios.js`, `lixeira.js`, etc. interpolam identificadores dentro de um atributo. Os IDs/UIDs são gerados pelo Firestore (risco baixo hoje), mas o padrão é frágil: qualquer valor que venha a conter uma aspa quebra o atributo e abre injeção.

**Recomendação:** migrar para `addEventListener` com `data-*` (ex.: `data-id`, `data-dono`) e delegação de eventos, eliminando handlers inline. Isto também facilita uma CSP mais restrita (ponto 1).

---

## 5. 🟡 Baixa — jsPDF carregado de CDN sem SRI

`recibos.js:22` carrega `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js` sem atributo `integrity` (SRI) nem `crossorigin`. Se o CDN for comprometido, executa-se JavaScript arbitrário com os privilégios da app — incluindo acesso aos dados de salários/pessoais que estão no ecrã.

**Recomendação:** fixar a versão com hash SRI:

```js
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
script.integrity = 'sha384-…';   // obter o hash oficial da versão 2.5.1
script.crossOrigin = 'anonymous';
```

Em alternativa, **alojar a biblioteca** no próprio projeto (mais robusto e alinhável com uma CSP estrita).

---

## 6. ⚪ Info — Dados pessoais sensíveis (RGPD)

A app trata dados pessoais relevantes ao abrigo do RGPD: salários, NIF, NIB, estado civil, filhos. Pontos a ter em conta (não são bugs de código, mas próprios de uma app de RH em Portugal):

- **Cópias dispersas:** a eliminação gera um `.json` descarregado para o dispositivo e backups no Firestore (`backups`, `lixeiraEmpresas`). Definir política de **retenção** e limpeza dessas cópias.
- **Minimização e acesso:** o acesso de admin a *todos* os dados é amplo; documentar a base legal e, idealmente, registar acessos de suporte ("entrar na empresa de X").
- **Transporte:** servido por Vercel sobre HTTPS — adequado. Acrescentar cabeçalhos de segurança (`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, e a CSP do ponto 1) via `vercel.json`.

---

## Prioridades sugeridas

1. **Imediato:** corrigir o ponto 1 (escape de HTML em todas as interpolações). É a única falha que, por si só, permite comprometer toda a base de dados.
2. **Curto prazo:** SRI/alojamento do jsPDF (5); confirmar regras publicadas + App Check (3).
3. **Médio prazo:** remover handlers `onclick` inline (4) e introduzir CSP; rever política RGPD de backups (6); reposicionar o modal de eliminação como UX, não como segurança (2).

---

*Auditoria baseada apenas no código estático fornecido. Recomenda-se complementar com teste dinâmico na instância implantada e revisão da configuração real da consola Firebase (regras publicadas, definições de Authentication, App Check).*
