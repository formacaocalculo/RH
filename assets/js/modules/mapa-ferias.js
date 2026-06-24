// assets/js/modules/mapa-ferias.js
// Relatório: mapa de férias de todos os colaboradores da empresa ativa.
// Mostra, por colaborador, os dias de férias marcados distribuídos por mês,
// e o direito / marcados / disponíveis para o ano escolhido.

import { getDocs, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { colEmpresa, docEmpresa } from './tenant.js';
import { renderSidebarHTML, initSidebar } from './sidebar.js';
import { calcularDireitoFerias } from './ferias-utils.js';
import { esc } from './html-utils.js';

const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
let S = { ano: new Date().getFullYear(), limite: 22 };

export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        ${renderSidebarHTML('mapa-ferias')}
        <main style="flex:1;padding:32px;overflow-x:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
                <div>
                    <h2 style="margin:0;font-size:24px;color:var(--rh-primary);">🏖️ Mapa de Férias</h2>
                    <p style="margin:4px 0 0;color:var(--rh-text-muted);font-size:13px;">Todos os colaboradores · dias de férias por mês</p>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <label style="font-size:13px;color:var(--rh-text-muted);">Ano</label>
                    <input type="number" id="mf-ano" min="2000" max="2100" value="${S.ano}"
                        style="width:90px;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;">
                    <button onclick="window._mfRecarregar()"
                        style="background:var(--rh-primary);color:#fff;border:none;padding:9px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">Atualizar</button>
                    <button onclick="window.print()"
                        style="background:var(--rh-bg-muted);color:var(--rh-text);border:1px solid var(--rh-border);padding:9px 14px;border-radius:6px;cursor:pointer;font-size:13px;">🖨️ Imprimir</button>
                </div>
            </div>
            <div id="mf-conteudo" style="background:var(--rh-bg-card);border-radius:10px;overflow-x:auto;">
                <p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">A carregar…</p>
            </div>
        </main>
    </div>`;
}

async function carregar() {
    const cont = document.getElementById('mf-conteudo');
    cont.innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">A carregar…</p>`;

    let funcionarios = [];
    try {
        const snap = await getDocs(colEmpresa('funcionarios'));
        snap.forEach(d => funcionarios.push({ id: d.id, ...d.data() }));
    } catch (e) {
        cont.innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-danger);">Erro ao carregar colaboradores: ${esc(e.message)}</p>`;
        return;
    }

    try {
        const cfg = await getDoc(docEmpresa('configuracoes', 'empresa_base'));
        if (cfg.exists() && cfg.data().limiteDiasFerias) S.limite = cfg.data().limiteDiasFerias;
    } catch (e) { /* usa o limite por omissão */ }

    if (!funcionarios.length) {
        cont.innerHTML = `<p style="padding:40px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Esta empresa ainda não tem colaboradores.</p>`;
        return;
    }

    funcionarios.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
    const anoStr = String(S.ano);

    const linhas = funcionarios.map(f => {
        const direito = calcularDireitoFerias(f.admissao, S.ano, S.limite);
        const diasAno = (f.diasFerias || []).filter(d => d.startsWith(anoStr));
        const porMes = new Array(12).fill(0);
        diasAno.forEach(d => {
            const m = parseInt(d.slice(5, 7), 10) - 1;
            if (m >= 0 && m < 12) porMes[m]++;
        });
        const marcados = diasAno.length;
        const disponiveis = Math.max(direito - marcados, 0);
        return { f, porMes, direito, marcados, disponiveis };
    });

    const totalMes = new Array(12).fill(0);
    linhas.forEach(l => l.porMes.forEach((v, i) => totalMes[i] += v));

    const th = (txt, extra = '') => `<th style="padding:10px 8px;font-size:11px;color:var(--rh-text-muted);text-transform:uppercase;${extra}">${txt}</th>`;
    const celMes = (v) => v > 0
        ? `<td style="padding:9px 6px;text-align:center;background:var(--rh-success-bg);color:var(--rh-success-text);font-weight:600;">${v}</td>`
        : `<td style="padding:9px 6px;text-align:center;color:var(--rh-border);">·</td>`;

    cont.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:920px;">
            <thead>
                <tr style="background:var(--rh-bg-muted);border-bottom:2px solid var(--rh-border);">
                    ${th('Colaborador', 'text-align:left;padding-left:16px;')}
                    ${MESES_CURTO.map(m => th(m, 'text-align:center;')).join('')}
                    ${th('Direito', 'text-align:center;')}
                    ${th('Marcados', 'text-align:center;')}
                    ${th('Disponíveis', 'text-align:center;')}
                </tr>
            </thead>
            <tbody>
                ${linhas.map((l, i) => `
                    <tr style="border-bottom:1px solid var(--rh-border);background:${i % 2 ? 'var(--rh-bg-muted)' : 'var(--rh-bg-card)'};">
                        <td style="padding:10px 16px;font-weight:500;color:var(--rh-primary-dark);white-space:nowrap;">${esc(l.f.nome) || '—'}</td>
                        ${l.porMes.map(celMes).join('')}
                        <td style="padding:9px 6px;text-align:center;color:var(--rh-text-muted);">${l.direito}</td>
                        <td style="padding:9px 6px;text-align:center;font-weight:600;">${l.marcados}</td>
                        <td style="padding:9px 6px;text-align:center;">
                            <span style="background:${l.disponiveis > 0 ? 'var(--rh-success-bg)' : 'var(--rh-danger-bg)'};color:${l.disponiveis > 0 ? 'var(--rh-success)' : 'var(--rh-danger-dark)'};padding:2px 9px;border-radius:10px;font-weight:600;">${l.disponiveis}</span>
                        </td>
                    </tr>`).join('')}
            </tbody>
            <tfoot>
                <tr style="border-top:2px solid var(--rh-border);background:var(--rh-bg-muted);font-weight:bold;">
                    <td style="padding:10px 16px;">Total (${linhas.length})</td>
                    ${totalMes.map(v => `<td style="padding:9px 6px;text-align:center;color:var(--rh-primary);">${v || '·'}</td>`).join('')}
                    <td colspan="3" style="padding:9px 6px;text-align:center;color:var(--rh-text-muted);">${linhas.reduce((s, l) => s + l.marcados, 0)} dias marcados no total</td>
                </tr>
            </tfoot>
        </table>`;
}

window._mfRecarregar = function() {
    const v = parseInt(document.getElementById('mf-ano').value, 10);
    if (v) S.ano = v;
    carregar();
};

export async function init() {
    await initSidebar();
    await carregar();
}
