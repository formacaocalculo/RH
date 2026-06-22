// assets/js/modules/html-utils.js
// ============================================================
//  Utilitários de segurança para construção de HTML.
//
//  TODO o dado que tenha origem no utilizador (nomes de empresas e
//  colaboradores, NIF, NIB, cargos, moradas, descrições, mensagens de
//  alerta, etc.) DEVE passar por esc() antes de ser interpolado numa
//  template string que vá para innerHTML. Sem isto, um valor como
//      <img src=x onerror="...">
//  guardado no Firestore executa código no browser de quem o visualiza
//  (XSS armazenado) — ver Auditoria de Segurança, ponto 1.
//
//  Regra prática:
//    - Conteúdo de texto:  `<td>${esc(f.nome)}</td>`
//    - Dentro de atributo: `<div title="${esc(valor)}">`  (esc também
//      escapa aspas, por isso é seguro em atributos com aspas duplas)
//    - Em onclick="...('${...}')": usar escAttr() para também neutralizar
//      apóstrofos/parênteses que possam quebrar o JS inline.
// ============================================================

// Escapa os caracteres com significado em HTML. Aceita qualquer tipo;
// null/undefined tornam-se string vazia.
export function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Versão para valores colocados dentro de JavaScript inline em atributos
// onclick="fn('VALOR')". Para além do escape HTML, remove aspas, barras
// invertidas e parênteses que poderiam quebrar a chamada. Usar apenas
// para identificadores; o ideal continua a ser migrar para addEventListener.
export function escAttr(v) {
    return esc(v).replace(/[\\'"()]/g, '');
}
