// assets/js/modules/declaracoes.js
// Declaração anual de rendimentos por colaborador (para efeitos de IRS).
// Agrega os processamentos confirmados do ano e gera um PDF com os campos
// do anexo A do IRS: 401 (código), entidade pagadora (NIF), 403 (rendimentos
// brutos sujeitos), 404 (retenção na fonte) e 405 (contribuições obrigatórias).

import { getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { colEmpresa, empresaAtiva } from './tenant.js';
import { renderSidebarHTML, initSidebar } from './sidebar.js';
import { esc, escAttr } from './html-utils.js';

let S = { ano: new Date().getFullYear(), empresa: null, processamentos: [], linhas: [] };

const fmt = (v) => (v || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

// jsPDF self-hosted (igual ao recibos.js).
let _jsPdfPromise = null;
function carregarJsPDF() {
    if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (_jsPdfPromise) return _jsPdfPromise;
    _jsPdfPromise = new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = 'assets/vendor/jspdf.umd.min.js';
        sc.onload = () => resolve(window.jspdf.jsPDF);
        sc.onerror = () => reject(new Error('Não foi possível carregar a biblioteca de PDF.'));
        document.head.appendChild(sc);
    });
    return _jsPdfPromise;
}

export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        ${renderSidebarHTML('declaracoes')}
        <main style="flex:1;padding:32px;overflow-x:auto;">
            <div style="margin-bottom:18px;">
                <h2 style="margin:0;font-size:24px;color:var(--rh-primary);">🧾 Declaração Anual de Rendimentos</h2>
                <p style="margin:4px 0 0;color:var(--rh-text-muted);font-size:13px;">Rendimentos e retenções por colaborador (para IRS) · campos 401–405</p>
            </div>
            <div style="display:flex;gap:10px;align-items:end;margin-bottom:18px;background:var(--rh-bg-card);padding:14px 16px;border-radius:10px;">
                <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);margin-bottom:3px;">Ano</label>
                    <input type="number" id="dec-ano" value="${S.ano}" min="2000" max="2100" style="width:100px;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;"></div>
                <button onclick="window._decCarregar()" style="background:var(--rh-primary);color:#fff;border:none;padding:9px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">Ver</button>
            </div>
            <div id="dec-conteudo"><p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Escolha o ano e carregue em "Ver".</p></div>
        </main>
    </div>`;
}

// Agrega os processamentos do ano por colaborador.
function agregar() {
    const doAno = S.processamentos.filter(p => Number(p.ano) === S.ano);
    const porFunc = {};
    doAno.forEach(p => (p.linhas || []).forEach(l => {
        const k = l.funcId || l.nome;
        if (!porFunc[k]) porFunc[k] = { funcId: l.funcId, nome: l.nome || '—', nif: l.nif || '', meses: 0, brutos: 0, irs: 0, ss: 0, subsidio: 0, liquido: 0 };
        const a = porFunc[k];
        a.meses++;
        a.brutos += (l.vencimentoBase || 0) + (l.valorHorasExtra || 0); // rendimentos sujeitos (sem subsídio isento)
        a.irs += l.retencaoIRS || 0;
        a.ss += l.descontoSS || 0;
        a.subsidio += l.subsidioRefeicao || 0;
        a.liquido += l.liquido || 0;
        if (!a.nif && l.nif) a.nif = l.nif;
    }));
    const arr = Object.values(porFunc).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
    arr.forEach(a => { a.brutos = Math.round(a.brutos * 100) / 100; a.irs = Math.round(a.irs * 100) / 100; a.ss = Math.round(a.ss * 100) / 100; a.subsidio = Math.round(a.subsidio * 100) / 100; a.liquido = Math.round(a.liquido * 100) / 100; });
    return arr;
}

function renderConteudo() {
    const cont = document.getElementById('dec-conteudo');
    S.linhas = agregar();
    if (!S.linhas.length) { cont.innerHTML = `<p style="padding:40px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Não há vencimentos processados em ${S.ano}.</p>`; return; }
    cont.innerHTML = `
        <div style="background:var(--rh-bg-card);border-radius:10px;overflow:hidden;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:var(--rh-bg-muted);color:var(--rh-text-muted);font-size:11px;text-transform:uppercase;">
                    <th style="padding:9px 12px;text-align:left;">Colaborador</th><th style="padding:9px 12px;">NIF</th><th style="padding:9px 12px;">Meses</th>
                    <th style="padding:9px 12px;text-align:right;">Brutos (403)</th><th style="padding:9px 12px;text-align:right;">Ret. IRS (404)</th><th style="padding:9px 12px;text-align:right;">SS (405)</th>
                    <th style="padding:9px 12px;text-align:right;">Declaração</th>
                </tr></thead>
                <tbody>${S.linhas.map((a, i) => `<tr style="border-top:1px solid var(--rh-border);background:${i % 2 ? 'var(--rh-bg-muted)' : 'var(--rh-bg-card)'};">
                    <td style="padding:9px 12px;font-weight:500;color:var(--rh-primary-dark);">${esc(a.nome)}</td>
                    <td style="padding:9px 12px;text-align:center;">${esc(a.nif) || '—'}</td>
                    <td style="padding:9px 12px;text-align:center;color:var(--rh-text-muted);">${a.meses}</td>
                    <td style="padding:9px 12px;text-align:right;font-weight:600;">${fmt(a.brutos)}</td>
                    <td style="padding:9px 12px;text-align:right;color:var(--rh-danger);">${fmt(a.irs)}</td>
                    <td style="padding:9px 12px;text-align:right;color:var(--rh-warning-text);">${fmt(a.ss)}</td>
                    <td style="padding:9px 12px;text-align:right;"><button onclick="window._decPDF('${escAttr(a.funcId || a.nome)}')" style="background:var(--rh-primary);color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">⬇ PDF</button></td>
                </tr>`).join('')}</tbody>
            </table>
        </div>
        <p style="margin:12px 2px 0;font-size:11px;color:var(--rh-text-subtle);">
            Campo 403 = rendimentos brutos sujeitos a IRS (vencimento + horas extra). O subsídio de refeição é tratado como não sujeito e não entra no 403. Documento informativo — não substitui a declaração oficial (Modelo 10 / comprovativos da AT).
        </p>`;
}

window._decCarregar = async function() {
    S.ano = parseInt(document.getElementById('dec-ano').value, 10) || S.ano;
    const cont = document.getElementById('dec-conteudo');
    cont.innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">A carregar…</p>`;
    try {
        if (!S.empresa) S.empresa = await empresaAtiva();
        S.processamentos = [];
        const snap = await getDocs(colEmpresa('processamentos'));
        snap.forEach(d => S.processamentos.push({ id: d.id, ...d.data() }));
    } catch (e) {
        cont.innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-danger);">Erro ao carregar: ${esc(e.message)}</p>`;
        return;
    }
    renderConteudo();
};

window._decPDF = async function(chave) {
    const a = S.linhas.find(x => (x.funcId || x.nome) === chave);
    if (!a) return;
    let jsPDF;
    try { jsPDF = await carregarJsPDF(); } catch (e) { alert(e.message); return; }
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const empNome = S.empresa?.nome || 'Entidade Pagadora';
    const empNif = S.empresa?.nif || '—';
    const empMorada = S.empresa?.morada || '';
    let y = 20;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(empNome, 14, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); y += 6;
    doc.text(`NIF: ${empNif}${empMorada ? '   ·   ' + empMorada : ''}`, 14, y); y += 12;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(`Declaração de Rendimentos e Retenções — Ano ${S.ano}`, 14, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('Para efeitos de IRS (rendimentos da categoria A — trabalho dependente)', 14, y); y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold'); doc.text(`Colaborador: ${a.nome}`, 14, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.text(`NIF: ${a.nif || '—'}`, 14, y); y += 4;
    doc.text(`Meses processados no ano: ${a.meses}`, 14, y); y += 8;

    doc.setDrawColor(180); doc.line(14, y, 196, y); y += 8;

    const linha = (label, valor, destaque) => {
        doc.setFont('helvetica', destaque ? 'bold' : 'normal'); doc.setFontSize(destaque ? 11 : 10);
        doc.text(label, 14, y);
        doc.text(valor, 196, y, { align: 'right' });
        y += destaque ? 8 : 7;
    };
    linha('Código do Rendimento (Campo 401)', 'A — Trabalho dependente');
    linha('Entidade Pagadora — NIF', empNif);
    linha('Rendimentos Brutos sujeitos (Campo 403)', fmt(a.brutos), true);
    linha('Retenção na Fonte de IRS (Campo 404)', fmt(a.irs), true);
    linha('Contribuições Obrigatórias / Seg. Social (Campo 405)', fmt(a.ss), true);
    y += 2;
    doc.setDrawColor(210); doc.line(14, y, 196, y); y += 7;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    linha('Subsídio de refeição (não sujeito a IRS)', fmt(a.subsidio));
    linha('Total líquido recebido no ano', fmt(a.liquido));

    y += 10;
    doc.setFontSize(8); doc.setTextColor(110);
    const aviso = doc.splitTextToSize('Documento informativo emitido automaticamente para apoio ao preenchimento da declaração de IRS (Modelo 3, Anexo A). Confirme o código do rendimento (401), o NIF da entidade pagadora e os valores junto da Autoridade Tributária. Não substitui a declaração oficial nem os comprovativos da AT.', 182);
    doc.text(aviso, 14, y); y += aviso.length * 4 + 4;
    doc.text(`Gerado automaticamente em ${new Date().toLocaleDateString('pt-PT')}.`, 14, y);

    doc.save(`Declaracao_Rendimentos_${(a.nome || 'colaborador').replace(/[^a-zA-Z0-9]+/g, '_')}_${S.ano}.pdf`);
};

export async function init() {
    await initSidebar();
}
