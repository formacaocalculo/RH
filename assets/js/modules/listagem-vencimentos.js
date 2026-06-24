// assets/js/modules/listagem-vencimentos.js
// Relatório: listagem de todos os vencimentos processados, por colaborador,
// na empresa ativa. Agrupa por colaborador, com uma linha por mês processado
// (base, subsídio, SS, IRS, líquido), subtotal por colaborador e total geral.

import { getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { colEmpresa } from './tenant.js';
import { renderSidebarHTML, initSidebar } from './sidebar.js';
import { esc } from './html-utils.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmt = (v) => (v || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
let S = { ano: new Date().getFullYear() };

export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        ${renderSidebarHTML('listagem-vencimentos')}
        <main style="flex:1;padding:32px;overflow-x:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
                <div>
                    <h2 style="margin:0;font-size:24px;color:var(--rh-primary);">💶 Listagem de Vencimentos</h2>
                    <p style="margin:4px 0 0;color:var(--rh-text-muted);font-size:13px;">Todos os vencimentos processados, por colaborador</p>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <label style="font-size:13px;color:var(--rh-text-muted);">Ano</label>
                    <input type="number" id="lv-ano" min="2000" max="2100" value="${S.ano}"
                        style="width:90px;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;">
                    <button onclick="window._lvRecarregar()"
                        style="background:var(--rh-primary);color:#fff;border:none;padding:9px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">Atualizar</button>
                    <button onclick="window.print()"
                        style="background:var(--rh-bg-muted);color:var(--rh-text);border:1px solid var(--rh-border);padding:9px 14px;border-radius:6px;cursor:pointer;font-size:13px;">🖨️ Imprimir</button>
                </div>
            </div>
            <div id="lv-conteudo">
                <p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">A carregar…</p>
            </div>
        </main>
    </div>`;
}

async function carregar() {
    const cont = document.getElementById('lv-conteudo');
    cont.innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">A carregar…</p>`;

    let docs = [];
    try {
        const snap = await getDocs(colEmpresa('processamentos'));
        snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
    } catch (e) {
        cont.innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-danger);">Erro ao carregar processamentos: ${esc(e.message)}</p>`;
        return;
    }

    // Filtra o ano e agrupa por colaborador.
    const doAno = docs.filter(d => Number(d.ano) === S.ano);
    if (!doAno.length) {
        cont.innerHTML = `<p style="padding:40px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Não há vencimentos processados em ${S.ano}.</p>`;
        return;
    }

    const porColab = {};   // funcId -> { nome, linhas:[{mes, base, subsidio, ss, irs, liquido}] }
    doAno.forEach(p => {
        (p.linhas || []).forEach(l => {
            const k = l.funcId || l.nome;
            if (!porColab[k]) porColab[k] = { nome: l.nome || '—', linhas: [] };
            porColab[k].linhas.push({
                mes: p.mes,
                base: l.vencimentoBase || 0,
                subsidio: l.subsidioRefeicao || 0,
                ss: l.descontoSS || 0,
                irs: l.retencaoIRS || 0,
                liquido: l.liquido || 0,
            });
        });
    });

    const colabs = Object.values(porColab).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
    colabs.forEach(c => c.linhas.sort((a, b) => a.mes - b.mes));

    const tot = { base: 0, subsidio: 0, ss: 0, irs: 0, liquido: 0 };

    const blocos = colabs.map(c => {
        const sub = { base: 0, subsidio: 0, ss: 0, irs: 0, liquido: 0 };
        c.linhas.forEach(l => {
            sub.base += l.base; sub.subsidio += l.subsidio; sub.ss += l.ss; sub.irs += l.irs; sub.liquido += l.liquido;
        });
        tot.base += sub.base; tot.subsidio += sub.subsidio; tot.ss += sub.ss; tot.irs += sub.irs; tot.liquido += sub.liquido;

        return `
        <div style="background:var(--rh-bg-card);border-radius:10px;margin-bottom:16px;overflow:hidden;">
            <div style="padding:12px 16px;background:var(--rh-primary-soft);font-weight:bold;color:var(--rh-primary);">${esc(c.nome)}</div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:680px;">
                <thead>
                    <tr style="background:var(--rh-bg-muted);border-bottom:1px solid var(--rh-border);color:var(--rh-text-muted);font-size:11px;text-transform:uppercase;">
                        <th style="padding:8px 16px;text-align:left;">Mês</th>
                        <th style="padding:8px 12px;text-align:right;">Venc. base</th>
                        <th style="padding:8px 12px;text-align:right;">Subsídio</th>
                        <th style="padding:8px 12px;text-align:right;">SS</th>
                        <th style="padding:8px 12px;text-align:right;">IRS</th>
                        <th style="padding:8px 16px;text-align:right;">Líquido</th>
                    </tr>
                </thead>
                <tbody>
                    ${c.linhas.map(l => `
                        <tr style="border-bottom:1px solid var(--rh-border);">
                            <td style="padding:9px 16px;">${MESES[l.mes] || l.mes}</td>
                            <td style="padding:9px 12px;text-align:right;">${fmt(l.base)}</td>
                            <td style="padding:9px 12px;text-align:right;color:var(--rh-secondary);">${fmt(l.subsidio)}</td>
                            <td style="padding:9px 12px;text-align:right;color:var(--rh-warning);">−${fmt(l.ss)}</td>
                            <td style="padding:9px 12px;text-align:right;color:var(--rh-danger);">−${fmt(l.irs)}</td>
                            <td style="padding:9px 16px;text-align:right;font-weight:bold;color:var(--rh-primary);">${fmt(l.liquido)}</td>
                        </tr>`).join('')}
                </tbody>
                <tfoot>
                    <tr style="background:var(--rh-bg-muted);font-weight:bold;border-top:1px solid var(--rh-border);">
                        <td style="padding:9px 16px;">Subtotal (${c.linhas.length} mês/meses)</td>
                        <td style="padding:9px 12px;text-align:right;">${fmt(sub.base)}</td>
                        <td style="padding:9px 12px;text-align:right;color:var(--rh-secondary);">${fmt(sub.subsidio)}</td>
                        <td style="padding:9px 12px;text-align:right;color:var(--rh-warning);">−${fmt(sub.ss)}</td>
                        <td style="padding:9px 12px;text-align:right;color:var(--rh-danger);">−${fmt(sub.irs)}</td>
                        <td style="padding:9px 16px;text-align:right;color:var(--rh-primary);">${fmt(sub.liquido)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>`;
    }).join('');

    cont.innerHTML = `
        ${blocos}
        <div style="background:var(--rh-primary);color:#fff;border-radius:10px;padding:16px 18px;display:flex;flex-wrap:wrap;gap:18px;justify-content:flex-end;align-items:center;font-size:14px;">
            <span style="margin-right:auto;font-weight:bold;">Total geral da empresa · ${S.ano} (${colabs.length} colaborador/es)</span>
            <span>Base: <strong>${fmt(tot.base)}</strong></span>
            <span>Subsídios: <strong>${fmt(tot.subsidio)}</strong></span>
            <span>SS: <strong>−${fmt(tot.ss)}</strong></span>
            <span>IRS: <strong>−${fmt(tot.irs)}</strong></span>
            <span style="font-size:16px;">Líquido: <strong>${fmt(tot.liquido)}</strong></span>
        </div>`;
}

window._lvRecarregar = function() {
    const v = parseInt(document.getElementById('lv-ano').value, 10);
    if (v) S.ano = v;
    carregar();
};

export async function init() {
    await initSidebar();
    await carregar();
}
