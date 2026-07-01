// assets/js/modules/contratos-terminar.js
// Relatório de contratos a terminar: lista os colaboradores ativos com contrato
// a termo (com data de fim prevista), ordenados pela data de fim, com a
// antecedência escolhida (30/60/90 dias ou todos) e alertas de expirados.

import { getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { colEmpresa } from './tenant.js';
import { renderSidebarHTML, initSidebar } from './sidebar.js';
import { esc } from './html-utils.js';

let S = { dias: 60, funcionarios: [] };

const fmtD = (s) => { if (!s) return '—'; const [a, m, d] = s.split('-'); return `${d}/${m}/${a}`; };
const diasEntre = (isoFim) => Math.round((new Date(isoFim + 'T00:00:00') - new Date(new Date().toDateString())) / 864e5);

export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        ${renderSidebarHTML('contratos-terminar')}
        <main style="flex:1;padding:32px;overflow-x:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;flex-wrap:wrap;gap:12px;">
                <div>
                    <h2 style="margin:0;font-size:24px;color:var(--rh-primary);">📑 Contratos a Terminar</h2>
                    <p style="margin:4px 0 0;color:var(--rh-text-muted);font-size:13px;">Contratos a termo com fim previsto, por antecedência</p>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <label style="font-size:13px;color:var(--rh-text-muted);">Antecedência</label>
                    <select id="ct-dias" onchange="window._ctMudar(this.value)" style="padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;background:var(--rh-bg-card);">
                        <option value="30">Próximos 30 dias</option>
                        <option value="60" selected>Próximos 60 dias</option>
                        <option value="90">Próximos 90 dias</option>
                        <option value="9999">Todos</option>
                    </select>
                    <button onclick="window.print()" style="background:var(--rh-bg-muted);color:var(--rh-text);border:1px solid var(--rh-border);padding:9px 14px;border-radius:6px;cursor:pointer;font-size:13px;">🖨️ Imprimir</button>
                </div>
            </div>
            <div id="ct-conteudo"><p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">A carregar…</p></div>
        </main>
    </div>`;
}

function situacao(dias) {
    if (dias < 0) return { txt: `Expirado há ${Math.abs(dias)}d`, bg: 'var(--rh-danger-bg)', cor: 'var(--rh-danger-dark)' };
    if (dias === 0) return { txt: 'Termina hoje', bg: 'var(--rh-danger-bg)', cor: 'var(--rh-danger-dark)' };
    if (dias <= 30) return { txt: `Termina em ${dias}d`, bg: 'var(--rh-danger-bg)', cor: 'var(--rh-danger-dark)' };
    if (dias <= 60) return { txt: `Termina em ${dias}d`, bg: 'var(--rh-warning-bg)', cor: 'var(--rh-warning-text)' };
    return { txt: `Termina em ${dias}d`, bg: 'var(--rh-success-bg)', cor: 'var(--rh-success)' };
}

function renderConteudo() {
    const cont = document.getElementById('ct-conteudo');
    const candidatos = S.funcionarios
        .filter(f => f.ativo !== false && !f.dataCessacao && f.dataFimContrato)
        .map(f => ({ f, dias: diasEntre(f.dataFimContrato) }))
        .filter(x => x.dias <= S.dias)               // dentro da antecedência (expirados incluídos)
        .sort((a, b) => a.dias - b.dias);

    if (!candidatos.length) {
        cont.innerHTML = `<div style="background:var(--rh-bg-card);border-radius:10px;padding:40px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Não há contratos a termo a terminar ${S.dias >= 9999 ? '' : `nos próximos ${S.dias} dias`}.</div>`;
        return;
    }
    const expirados = candidatos.filter(x => x.dias < 0).length;
    cont.innerHTML = `
        ${expirados ? `<div style="background:var(--rh-danger-bg);border:1px solid var(--rh-danger);border-radius:8px;padding:10px 16px;margin-bottom:14px;color:var(--rh-danger-dark);font-size:13px;">⚠️ ${expirados} contrato(s) já terminado(s) sem cessação registada — convém renovar, converter ou registar a cessação.</div>` : ''}
        <div style="background:var(--rh-bg-card);border-radius:10px;overflow:hidden;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:var(--rh-bg-muted);color:var(--rh-text-muted);font-size:11px;text-transform:uppercase;">
                    <th style="padding:10px 14px;text-align:left;">Colaborador</th><th style="padding:10px 14px;text-align:left;">Tipo de Contrato</th><th style="padding:10px 14px;">Admissão</th><th style="padding:10px 14px;">Fim do Contrato</th><th style="padding:10px 14px;">Situação</th>
                </tr></thead>
                <tbody>${candidatos.map((x, i) => { const s = situacao(x.dias); return `<tr style="border-top:1px solid var(--rh-border);background:${i % 2 ? 'var(--rh-bg-muted)' : 'var(--rh-bg-card)'};">
                    <td style="padding:10px 14px;font-weight:500;color:var(--rh-primary-dark);">${esc(x.f.nome) || '—'}</td>
                    <td style="padding:10px 14px;">${esc(x.f.tipoContrato || '—')}</td>
                    <td style="padding:10px 14px;text-align:center;color:var(--rh-text-muted);">${fmtD(x.f.admissao)}</td>
                    <td style="padding:10px 14px;text-align:center;font-weight:600;">${fmtD(x.f.dataFimContrato)}</td>
                    <td style="padding:10px 14px;text-align:center;"><span style="background:${s.bg};color:${s.cor};padding:3px 10px;border-radius:10px;font-size:12px;font-weight:600;">${s.txt}</span></td>
                </tr>`; }).join('')}</tbody>
            </table>
        </div>
        <p style="margin:12px 2px 0;font-size:11px;color:var(--rh-text-subtle);">Mostra colaboradores ativos com contrato a termo e data de fim prevista. Não inclui contratos sem termo nem colaboradores já cessados.</p>`;
}

window._ctMudar = function(v) { S.dias = parseInt(v, 10) || 60; renderConteudo(); };

export async function init() {
    await initSidebar();
    const cont = document.getElementById('ct-conteudo');
    try {
        const snap = await getDocs(colEmpresa('funcionarios'));
        S.funcionarios = []; snap.forEach(d => S.funcionarios.push({ id: d.id, ...d.data() }));
        S.funcionarios.sort((a, b) => (a.dataFimContrato || '').localeCompare(b.dataFimContrato || ''));
        renderConteudo();
    } catch (e) {
        cont.innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-danger);">Erro ao carregar colaboradores: ${esc(e.message)}</p>`;
    }
}
