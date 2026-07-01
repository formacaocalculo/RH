// assets/js/modules/avaliacoes.js
// Avaliações de desempenho por colaborador.
// Coleção: avaliacoes/{id} = { funcId, periodo, data, avaliador, classificacao,
//   objetivos, pontosFortes, pontosMelhorar, comentarios, estado, criadoEm, criadoPor }

import { getDocs, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { colEmpresa, docEmpresa } from './tenant.js';
import { auth } from '../app.js';
import { renderSidebarHTML, initSidebar } from './sidebar.js';
import { esc, escAttr } from './html-utils.js';

const NIVEIS = { 1: 'Insuficiente', 2: 'A melhorar', 3: 'Satisfaz', 4: 'Bom', 5: 'Excelente' };
let S = { funcId: '', funcionarios: [], itens: [], editId: null };

const quem = () => auth.currentUser?.email || auth.currentUser?.uid || '—';
const fmtD = (s) => { if (!s) return '—'; const [a, m, d] = s.split('-'); return `${d}/${m}/${a}`; };
const estrelas = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        ${renderSidebarHTML('avaliacoes')}
        <main style="flex:1;padding:32px;overflow-x:auto;">
            <div style="margin-bottom:18px;">
                <h2 style="margin:0;font-size:24px;color:var(--rh-primary);">⭐ Avaliações de Desempenho</h2>
                <p style="margin:4px 0 0;color:var(--rh-text-muted);font-size:13px;">Ciclos de avaliação por colaborador</p>
            </div>
            <div style="display:flex;gap:10px;align-items:end;margin-bottom:18px;background:var(--rh-bg-card);padding:14px 16px;border-radius:10px;">
                <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);margin-bottom:3px;">Colaborador</label>
                    <select id="av-func" style="padding:9px;border:1px solid var(--rh-border);border-radius:6px;min-width:220px;font-size:13px;"></select></div>
                <button onclick="window._avCarregar()" style="background:var(--rh-primary);color:#fff;border:none;padding:9px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">Ver</button>
            </div>
            <div id="av-conteudo"><p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Escolha um colaborador.</p></div>
        </main>
    </div>`;
}

function formHTML(it) {
    const v = (k) => it ? escAttr(it[k] || '') : '';
    const txt = (k) => it ? esc(it[k] || '') : '';
    return `
    <div style="background:var(--rh-bg-card);border-radius:10px;padding:16px;margin-bottom:16px;">
        <h3 style="margin:0 0 12px;font-size:15px;color:var(--rh-primary);">${it ? 'Editar avaliação' : 'Nova avaliação'}</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Período</label><input id="av-periodo" value="${v('periodo')}" placeholder="ex.: 2026 ou 2026 - 1º semestre" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Data</label><input type="date" id="av-data" value="${v('data')}" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Avaliador</label><input id="av-avaliador" value="${v('avaliador')}" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Classificação</label>
                <select id="av-class" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;background:var(--rh-bg-card);">
                    ${[5, 4, 3, 2, 1].map(n => `<option value="${n}" ${it && Number(it.classificacao) === n ? 'selected' : ''}>${n} — ${NIVEIS[n]}</option>`).join('')}</select></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Estado</label>
                <select id="av-estado" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;background:var(--rh-bg-card);">
                    <option ${it && it.estado === 'Rascunho' ? 'selected' : ''}>Rascunho</option>
                    <option ${it && it.estado === 'Concluída' ? 'selected' : ''}>Concluída</option></select></div>
        </div>
        <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Objetivos</label><textarea id="av-objetivos" rows="3" placeholder="Um por linha…" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;">${txt('objetivos')}</textarea></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Pontos fortes</label><textarea id="av-fortes" rows="3" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;">${txt('pontosFortes')}</textarea></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Pontos a melhorar</label><textarea id="av-melhorar" rows="3" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;">${txt('pontosMelhorar')}</textarea></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Comentários</label><textarea id="av-comentarios" rows="3" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;">${txt('comentarios')}</textarea></div>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
            <button onclick="window._avGuardar()" style="background:var(--rh-success);color:#fff;border:none;padding:9px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">${it ? 'Guardar alterações' : '+ Criar avaliação'}</button>
            ${it ? `<button onclick="window._avCancelar()" style="background:var(--rh-bg-muted);color:var(--rh-text);border:1px solid var(--rh-border);padding:9px 16px;border-radius:6px;cursor:pointer;font-size:13px;">Cancelar</button>` : ''}
        </div>
    </div>`;
}

function renderConteudo() {
    const cont = document.getElementById('av-conteudo');
    if (!S.funcId) { cont.innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Escolha um colaborador e carregue em "Ver".</p>`; return; }
    const editItem = S.editId ? S.itens.find(i => i.id === S.editId) : null;
    const lista = [...S.itens].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const media = lista.length ? (lista.reduce((s, i) => s + (Number(i.classificacao) || 0), 0) / lista.length).toFixed(1) : '—';
    cont.innerHTML = formHTML(editItem) + `
        <div style="background:var(--rh-bg-card);border-radius:10px;overflow:hidden;">
            <div style="padding:10px 14px;font-size:12px;color:var(--rh-text-muted);border-bottom:1px solid var(--rh-border);">Classificação média: <strong style="color:var(--rh-primary);">${media}</strong> · ${lista.length} avaliação(ões)</div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:var(--rh-bg-muted);color:var(--rh-text-muted);font-size:11px;text-transform:uppercase;">
                    <th style="padding:9px 12px;text-align:left;">Período</th><th style="padding:9px 12px;">Data</th><th style="padding:9px 12px;text-align:left;">Avaliador</th><th style="padding:9px 12px;">Classificação</th><th style="padding:9px 12px;">Estado</th><th style="padding:9px 12px;text-align:right;">Ações</th>
                </tr></thead>
                <tbody>${lista.length ? lista.map(it => `<tr style="border-top:1px solid var(--rh-border);">
                    <td style="padding:9px 12px;font-weight:500;">${esc(it.periodo) || '—'}</td>
                    <td style="padding:9px 12px;text-align:center;">${fmtD(it.data)}</td>
                    <td style="padding:9px 12px;">${esc(it.avaliador) || '—'}</td>
                    <td style="padding:9px 12px;text-align:center;"><span title="${NIVEIS[it.classificacao] || ''}" style="color:var(--rh-warning);">${estrelas(Number(it.classificacao) || 0)}</span></td>
                    <td style="padding:9px 12px;text-align:center;"><span style="background:${it.estado === 'Concluída' ? 'var(--rh-success-bg)' : 'var(--rh-bg-muted)'};color:${it.estado === 'Concluída' ? 'var(--rh-success)' : 'var(--rh-text-muted)'};padding:2px 8px;border-radius:9px;font-size:11px;">${esc(it.estado || 'Rascunho')}</span></td>
                    <td style="padding:9px 12px;text-align:right;white-space:nowrap;">
                        <button onclick="window._avEditar('${escAttr(it.id)}')" style="background:none;border:1px solid var(--rh-border);border-radius:5px;padding:4px 8px;cursor:pointer;font-size:11px;">✏️</button>
                        <button onclick="window._avEliminar('${escAttr(it.id)}')" style="background:none;border:1px solid var(--rh-border);border-radius:5px;padding:4px 8px;cursor:pointer;font-size:11px;color:var(--rh-danger);">🗑️</button>
                    </td></tr>`).join('') : `<tr><td colspan="6" style="padding:24px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Sem avaliações para este colaborador.</td></tr>`}</tbody>
            </table>
        </div>`;
}

async function carregar() {
    S.itens = [];
    try { const snap = await getDocs(colEmpresa('avaliacoes')); snap.forEach(d => { const x = { id: d.id, ...d.data() }; if (x.funcId === S.funcId) S.itens.push(x); }); }
    catch (e) { console.warn('[avaliacoes]', e); }
    renderConteudo();
}
function lerForm() {
    return {
        funcId: S.funcId,
        periodo: document.getElementById('av-periodo').value.trim(),
        data: document.getElementById('av-data').value || null,
        avaliador: document.getElementById('av-avaliador').value.trim(),
        classificacao: Number(document.getElementById('av-class').value),
        estado: document.getElementById('av-estado').value,
        objetivos: document.getElementById('av-objetivos').value.trim(),
        pontosFortes: document.getElementById('av-fortes').value.trim(),
        pontosMelhorar: document.getElementById('av-melhorar').value.trim(),
        comentarios: document.getElementById('av-comentarios').value.trim(),
    };
}
window._avCarregar = function() { S.funcId = document.getElementById('av-func').value; S.editId = null; if (!S.funcId) { renderConteudo(); return; } carregar(); };
window._avGuardar = async function() {
    if (!S.funcId) return;
    const dados = lerForm();
    if (!dados.periodo) { alert('Indique o período.'); return; }
    try {
        if (S.editId) { await updateDoc(docEmpresa('avaliacoes', S.editId), dados); S.editId = null; }
        else { await addDoc(colEmpresa('avaliacoes'), { ...dados, criadoEm: new Date(), criadoPor: quem() }); }
        await carregar();
    } catch (e) { alert('Erro ao guardar: ' + e.message); }
};
window._avEditar = function(id) { S.editId = id; renderConteudo(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
window._avCancelar = function() { S.editId = null; renderConteudo(); };
window._avEliminar = async function(id) {
    if (!confirm('Eliminar esta avaliação?')) return;
    try { await deleteDoc(docEmpresa('avaliacoes', id)); await carregar(); } catch (e) { alert('Erro ao eliminar: ' + e.message); }
};

export async function init() {
    await initSidebar();
    try {
        const snap = await getDocs(colEmpresa('funcionarios'));
        S.funcionarios = []; snap.forEach(d => S.funcionarios.push({ id: d.id, ...d.data() }));
        S.funcionarios.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
        const sel = document.getElementById('av-func');
        if (sel) sel.innerHTML = `<option value="">— escolher —</option>` + S.funcionarios.map(f => `<option value="${escAttr(f.id)}">${esc(f.nome) || f.id}</option>`).join('');
    } catch (e) {
        document.getElementById('av-conteudo').innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-danger);">Erro ao carregar colaboradores: ${esc(e.message)}</p>`;
    }
}
