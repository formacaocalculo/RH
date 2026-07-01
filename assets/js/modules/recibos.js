// assets/js/modules/recibos.js
// Lista os processamentos de vencimento já confirmados (ver processamento.js)
// e permite gerar/descarregar o recibo de vencimento individual de cada
// colaborador em PDF, usando jsPDF carregado via CDN (sem build tools,
// consistente com o resto do projeto).

import { getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { colEmpresa, empresaAtiva } from './tenant.js';
import { renderSidebarHTML, initSidebar } from './sidebar.js';
import { esc, escAttr } from './html-utils.js';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

let S = { processamentos: [], empresa: null };

// ─── Carregamento dinâmico do jsPDF (só quando é mesmo preciso gerar um PDF) ─
let _jsPdfPromise = null;
function carregarJsPDF() {
    if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (_jsPdfPromise) return _jsPdfPromise;
    _jsPdfPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'assets/vendor/jspdf.umd.min.js'; // self-hosted (ver Auditoria #5 — evita dependência de CDN sem SRI)
        script.onload = () => resolve(window.jspdf.jsPDF);
        script.onerror = () => reject(new Error('Não foi possível carregar a biblioteca de geração de PDF.'));
        document.head.appendChild(script);
    });
    return _jsPdfPromise;
}

// ─── render() ───────────────────────────────────────────────────────────────
export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        ${renderSidebarHTML('recibos')}
        <main style="flex:1;padding:30px;overflow-y:auto;">
            <header style="margin-bottom:22px;">
                <h2 style="margin:0;font-size:24px;color:var(--rh-primary);">📄 Recibos de Vencimento</h2>
                <p style="margin:4px 0 0;font-size:13px;color:var(--rh-text-muted);">Consulte os processamentos confirmados e descarregue o recibo individual de cada colaborador.</p>
            </header>

            <div id="rec-lista" style="display:flex;flex-direction:column;gap:14px;">
                <p style="color:var(--rh-text-subtle);font-style:italic;">A carregar…</p>
            </div>
        </main>
    </div>`;
}

// ─── Carregamento e listagem ───────────────────────────────────────────────
async function carregarProcessamentos() {
    S.processamentos = [];
    try {
        const snap = await getDocs(colEmpresa('processamentos'));
        snap.forEach(d => S.processamentos.push({ id: d.id, ...d.data() }));
        S.processamentos.sort((a, b) => (b.ano - a.ano) || (b.mes - a.mes));
    } catch (e) {
        console.error('Erro ao carregar processamentos:', e);
    }
}

function renderLista() {
    const el = document.getElementById('rec-lista');
    if (!el) return;
    if (!S.processamentos.length) {
        el.innerHTML = `<p style="color:var(--rh-text-subtle);font-style:italic;">
            Ainda não há nenhum processamento confirmado. Vá a "Processamento" para calcular e confirmar o primeiro.
        </p>`;
        return;
    }

    el.innerHTML = S.processamentos.map(p => {
        const totalLiquido = (p.linhas || []).reduce((s, l) => s + l.liquido, 0);
        const fmt = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
        return `
        <div style="background:var(--rh-bg-card);border:1px solid var(--rh-border);border-radius:10px;overflow:hidden;">
            <div style="padding:16px 18px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;"
                 onclick="window._recibosToggle('${escAttr(p.id)}')">
                <div>
                    <div style="font-size:14px;font-weight:bold;color:var(--rh-primary);">📅 ${MESES[p.mes]} de ${p.ano}</div>
                    <div style="font-size:11px;color:var(--rh-text-subtle);margin-top:2px;">
                        ${(p.linhas || []).length} colaborador(es) · Total líquido: ${fmt(totalLiquido)}
                    </div>
                </div>
                <span style="color:var(--rh-text-subtle);font-size:13px;">▾ ver recibos</span>
            </div>
            <div id="rec-detalhe-${escAttr(p.id)}" style="display:none;border-top:1px solid var(--rh-border);">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                        <tr style="background:var(--rh-bg-muted);color:var(--rh-text-subtle);text-transform:uppercase;font-size:11px;">
                            <th style="padding:10px 16px;text-align:left;">Colaborador</th>
                            <th style="padding:10px 16px;text-align:right;">Líquido</th>
                            <th style="padding:10px 16px;text-align:center;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(p.linhas || []).map(l => `
                            <tr style="border-top:1px solid var(--rh-border);">
                                <td style="padding:10px 16px;">${esc(l.nome)}</td>
                                <td style="padding:10px 16px;text-align:right;font-weight:500;">${fmt(l.liquido)}</td>
                                <td style="padding:10px 16px;text-align:center;">
                                    <button onclick="window._recibosGerarPDF('${escAttr(p.id)}','${escAttr(l.funcId)}')"
                                        style="background:var(--rh-secondary);color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">
                                        ⬇ Recibo PDF
                                    </button>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    }).join('');
}

window._recibosToggle = function(procId) {
    const el = document.getElementById(`rec-detalhe-${procId}`);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

// ─── Geração do PDF do recibo individual ───────────────────────────────────
window._recibosGerarPDF = async function(procId, funcId) {
    const proc = S.processamentos.find(p => p.id === procId);
    const linha = proc?.linhas?.find(l => l.funcId === funcId);
    if (!proc || !linha) { alert('Recibo não encontrado.'); return; }

    let jsPDF;
    try {
        jsPDF = await carregarJsPDF();
    } catch (e) {
        alert(e.message);
        return;
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const fmt = (v) => (v || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
    const empresaNome = S.empresa?.nome || 'Empresa';
    const empresaNif = S.empresa?.nif || '—';
    const empresaMorada = S.empresa?.morada || '';

    let y = 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(empresaNome, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 6;
    doc.text(`NIF: ${empresaNif}${empresaMorada ? '   ·   ' + empresaMorada : ''}`, 14, y);

    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`Recibo de Vencimento — ${MESES[proc.mes]} de ${proc.ano}`, 14, y);

    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Colaborador: ${linha.nome}`, 14, y); y += 5;
    doc.text(`NIF: ${linha.nif || '—'}`, 14, y); y += 5;
    if (linha.cargo) { doc.text(`Cargo: ${linha.cargo}`, 14, y); y += 5; }

    y += 6;
    doc.setLineWidth(0.3);
    doc.line(14, y, 196, y);
    y += 8;

    const linhaTabela = (label, valor, destaque = false) => {
        doc.setFont('helvetica', destaque ? 'bold' : 'normal');
        doc.text(label, 14, y);
        doc.text(valor, 196, y, { align: 'right' });
        y += 7;
    };

    doc.setFont('helvetica', 'bold');
    doc.text('Descrição', 14, y);
    doc.text('Valor', 196, y, { align: 'right' });
    y += 4;
    doc.setLineWidth(0.1);
    doc.line(14, y, 196, y);
    y += 6;

    linhaTabela(`Vencimento Base (${(linha.diasUteisAtivos ?? linha.diasUteisMes) - linha.diasDesconto}/${linha.diasUteisMes} dias úteis)`, fmt(linha.vencimentoBase));
    if (linha.valorHorasExtra > 0) linhaTabela(`Horas Suplementares (${linha.horasExtra}h)`, fmt(linha.valorHorasExtra));
    if (!linha.subsidioEmCartao) linhaTabela(`Subsídio de Refeição${linha.diasComSubsidio !== undefined ? ` (${linha.diasComSubsidio} dias)` : ''}`, fmt(linha.subsidioRefeicao));
    y += 2;
    doc.line(14, y, 196, y);
    y += 7;
    linhaTabela(`Desconto Segurança Social (${linha.taxaSSTrabalhador}%)`, '-' + fmt(linha.descontoSS));
    linhaTabela(`Retenção IRS (${linha.taxaIRS}%)`, '-' + fmt(linha.retencaoIRS));
    y += 2;
    doc.line(14, y, 196, y);
    y += 9;
    linhaTabela('VENCIMENTO LÍQUIDO', fmt(linha.liquido), true);

    if (linha.subsidioEmCartao && linha.subsidioRefeicao > 0) {
        y += 8;
        linhaTabela(`Subsídio de Refeição (pago em cartão, à parte)${linha.diasComSubsidio !== undefined ? ` — ${linha.diasComSubsidio} dias` : ''}`, fmt(linha.subsidioRefeicao));
    }

    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Documento gerado automaticamente em ${new Date().toLocaleDateString('pt-PT')}. Não substitui declaração oficial para efeitos fiscais.`, 14, y);

    const nomeFicheiro = `recibo_${linha.nome.replace(/\s+/g, '_')}_${MESES[proc.mes]}_${proc.ano}.pdf`;
    doc.save(nomeFicheiro);
};

// ─── init() ───────────────────────────────────────────────────────────────────
export async function init() {
    await initSidebar();
    S.empresa = await empresaAtiva();
    await carregarProcessamentos();
    renderLista();
}
