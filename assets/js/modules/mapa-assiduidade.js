// assets/js/modules/mapa-assiduidade.js
// Relatório: mapa de assiduidade de todos os colaboradores da empresa ativa.
// Mostra, por colaborador, os dias de ausência distribuídos por mês (tipos
// medidos em dias), o total do ano, quantos contam como falta, e as horas
// avulsas (ausências medidas em horas) para o ano escolhido.

import { getDocs, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { colEmpresa, docEmpresa } from './tenant.js';
import { renderSidebarHTML, initSidebar } from './sidebar.js';
import { TIPOS_LABEL, contarUnidades, usaHora, contaComoFaltaAss } from './assiduidade.js';
import { esc } from './html-utils.js';

const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
let S = { ano: new Date().getFullYear() };

export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        ${renderSidebarHTML('mapa-assiduidade')}
        <main style="flex:1;padding:32px;overflow-x:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
                <div>
                    <h2 style="margin:0;font-size:24px;color:var(--rh-primary);">📅 Mapa de Assiduidade</h2>
                    <p style="margin:4px 0 0;color:var(--rh-text-muted);font-size:13px;">Todos os colaboradores · dias de ausência por mês</p>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <label style="font-size:13px;color:var(--rh-text-muted);">Ano</label>
                    <input type="number" id="ma-ano" min="2000" max="2100" value="${S.ano}"
                        style="width:90px;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;">
                    <button onclick="window._maRecarregar()"
                        style="background:var(--rh-primary);color:#fff;border:none;padding:9px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">Atualizar</button>
                    <button onclick="window.print()"
                        style="background:var(--rh-bg-muted);color:var(--rh-text);border:1px solid var(--rh-border);padding:9px 14px;border-radius:6px;cursor:pointer;font-size:13px;">🖨️ Imprimir</button>
                </div>
            </div>
            <div id="ma-conteudo" style="background:var(--rh-bg-card);border-radius:10px;overflow-x:auto;">
                <p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">A carregar…</p>
            </div>
        </main>
    </div>`;
}

// Distribui os dias de uma ausência (tipo medido em dias) pelos meses do ano S.ano.
function distribuirDias(a, porMes, contaFaltaAcc) {
    const ini = new Date(a.dataInicio + 'T00:00:00');
    const fim = new Date(a.dataFim + 'T00:00:00');
    const conta = contaComoFaltaAss(a.tipo);
    for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() !== S.ano) continue;
        porMes[d.getMonth()]++;
        if (conta) contaFaltaAcc.n++;
    }
}

async function carregar() {
    const cont = document.getElementById('ma-conteudo');
    cont.innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">A carregar…</p>`;

    let funcionarios = [];
    try {
        const snap = await getDocs(colEmpresa('funcionarios'));
        snap.forEach(d => funcionarios.push({ id: d.id, ...d.data() }));
    } catch (e) {
        cont.innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-danger);">Erro ao carregar colaboradores: ${esc(e.message)}</p>`;
        return;
    }
    if (!funcionarios.length) {
        cont.innerHTML = `<p style="padding:40px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Esta empresa ainda não tem colaboradores.</p>`;
        return;
    }
    funcionarios.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));

    const anoStr = String(S.ano);
    const linhas = [];
    for (const f of funcionarios) {
        let ausencias = [];
        try {
            const as = await getDoc(docEmpresa('ausencias', f.id));
            if (as.exists()) ausencias = as.data().ausencias || [];
        } catch (e) { /* sem ausências para este colaborador */ }

        const porMes = new Array(12).fill(0);
        const contaFaltaAcc = { n: 0 };
        let horas = 0;
        ausencias.forEach(a => {
            if (usaHora(a.tipo)) {
                if ((a.dataInicio || '').startsWith(anoStr)) horas += contarUnidades(a, 'hora');
            } else if (a.dataInicio && a.dataFim) {
                distribuirDias(a, porMes, contaFaltaAcc);
            }
        });
        const total = porMes.reduce((s, v) => s + v, 0);
        linhas.push({ f, porMes, total, faltas: contaFaltaAcc.n, horas });
    }

    const totalMes = new Array(12).fill(0);
    linhas.forEach(l => l.porMes.forEach((v, i) => totalMes[i] += v));

    const th = (txt, extra = '') => `<th style="padding:10px 8px;font-size:11px;color:var(--rh-text-muted);text-transform:uppercase;${extra}">${txt}</th>`;
    const celMes = (v) => v > 0
        ? `<td style="padding:9px 6px;text-align:center;background:var(--rh-warning-bg);color:var(--rh-warning-text);font-weight:600;">${v}</td>`
        : `<td style="padding:9px 6px;text-align:center;color:var(--rh-border);">·</td>`;

    cont.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:1000px;">
            <thead>
                <tr style="background:var(--rh-bg-muted);border-bottom:2px solid var(--rh-border);">
                    ${th('Colaborador', 'text-align:left;padding-left:16px;')}
                    ${MESES_CURTO.map(m => th(m, 'text-align:center;')).join('')}
                    ${th('Total dias', 'text-align:center;')}
                    ${th('Contam falta', 'text-align:center;')}
                    ${th('Horas avulsas', 'text-align:center;')}
                </tr>
            </thead>
            <tbody>
                ${linhas.map((l, i) => `
                    <tr style="border-bottom:1px solid var(--rh-border);background:${i % 2 ? 'var(--rh-bg-muted)' : 'var(--rh-bg-card)'};">
                        <td style="padding:10px 16px;font-weight:500;color:var(--rh-primary-dark);white-space:nowrap;">${esc(l.f.nome) || '—'}</td>
                        ${l.porMes.map(celMes).join('')}
                        <td style="padding:9px 6px;text-align:center;font-weight:600;">${l.total || '·'}</td>
                        <td style="padding:9px 6px;text-align:center;">${l.faltas > 0 ? `<span style="background:var(--rh-danger-bg);color:var(--rh-danger-text);padding:2px 9px;border-radius:10px;font-weight:600;">${l.faltas}</span>` : '<span style="color:var(--rh-border);">·</span>'}</td>
                        <td style="padding:9px 6px;text-align:center;color:var(--rh-text-muted);">${l.horas > 0 ? l.horas.toLocaleString('pt-PT') + 'h' : '·'}</td>
                    </tr>`).join('')}
            </tbody>
            <tfoot>
                <tr style="border-top:2px solid var(--rh-border);background:var(--rh-bg-muted);font-weight:bold;">
                    <td style="padding:10px 16px;">Total (${linhas.length})</td>
                    ${totalMes.map(v => `<td style="padding:9px 6px;text-align:center;color:var(--rh-primary);">${v || '·'}</td>`).join('')}
                    <td style="padding:9px 6px;text-align:center;color:var(--rh-primary);">${linhas.reduce((s, l) => s + l.total, 0) || '·'}</td>
                    <td style="padding:9px 6px;text-align:center;color:var(--rh-danger-dark);">${linhas.reduce((s, l) => s + l.faltas, 0) || '·'}</td>
                    <td style="padding:9px 6px;text-align:center;color:var(--rh-text-muted);">${(() => { const h = linhas.reduce((s, l) => s + l.horas, 0); return h > 0 ? h.toLocaleString('pt-PT') + 'h' : '·'; })()}</td>
                </tr>
            </tfoot>
        </table>
        <p style="padding:12px 16px;margin:0;font-size:11px;color:var(--rh-text-subtle);">
            "Contam falta" = dias de ausência que descontam no vencimento/assiduidade. "Horas avulsas" = ausências registadas em horas (faltas parciais).
        </p>`;
}

window._maRecarregar = function() {
    const v = parseInt(document.getElementById('ma-ano').value, 10);
    if (v) S.ano = v;
    carregar();
};

export async function init() {
    await initSidebar();
    await carregar();
}
