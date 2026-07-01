// assets/js/modules/formacao.js
// Formação e desenvolvimento por colaborador.
// Coleção: formacoes/{id} = { funcId, titulo, area, entidade, dataInicio,
//   dataFim, horas, estado, certificado, notas, criadoEm, criadoPor }

import { getDocs, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { colEmpresa, docEmpresa } from './tenant.js';
import { auth } from '../app.js';
import { renderSidebarHTML, initSidebar } from './sidebar.js';
import { esc, escAttr } from './html-utils.js';

const ESTADOS = ['Planeada', 'Em curso', 'Concluída'];
let S = { funcId: '', funcionarios: [], itens: [], editId: null };

const quem = () => auth.currentUser?.email || auth.currentUser?.uid || '—';
const fmtD = (s) => { if (!s) return '—'; const [a, m, d] = s.split('-'); return `${d}/${m}/${a}`; };

export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        ${renderSidebarHTML('formacao')}
        <main style="flex:1;padding:32px;overflow-x:auto;">
            <div style="margin-bottom:18px;">
                <h2 style="margin:0;font-size:24px;color:var(--rh-primary);">🎓 Formação e Desenvolvimento</h2>
                <p style="margin:4px 0 0;color:var(--rh-text-muted);font-size:13px;">Ações de formação por colaborador, com horas e estado</p>
            </div>
            <div style="display:flex;gap:10px;align-items:end;margin-bottom:18px;background:var(--rh-bg-card);padding:14px 16px;border-radius:10px;">
                <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);margin-bottom:3px;">Colaborador</label>
                    <select id="fo-func" style="padding:9px;border:1px solid var(--rh-border);border-radius:6px;min-width:220px;font-size:13px;"></select></div>
                <button onclick="window._foCarregar()" style="background:var(--rh-primary);color:#fff;border:none;padding:9px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">Ver</button>
            </div>
            <div id="fo-conteudo"><p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Escolha um colaborador.</p></div>
        </main>
    </div>`;
}

function formHTML(it) {
    const v = (k) => it ? escAttr(it[k] || '') : '';
    return `
    <div style="background:var(--rh-bg-card);border-radius:10px;padding:16px;margin-bottom:16px;">
        <h3 style="margin:0 0 12px;font-size:15px;color:var(--rh-primary);">${it ? 'Editar ação de formação' : 'Nova ação de formação'}</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Designação</label><input id="fo-titulo" value="${v('titulo')}" placeholder="ex.: Excel avançado" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Área</label><input id="fo-area" value="${v('area')}" placeholder="ex.: Informática" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Entidade / Formador</label><input id="fo-entidade" value="${v('entidade')}" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Início</label><input type="date" id="fo-inicio" value="${v('dataInicio')}" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Fim</label><input type="date" id="fo-fim" value="${v('dataFim')}" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Horas</label><input type="number" min="0" step="0.5" id="fo-horas" value="${v('horas')}" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Estado</label>
                <select id="fo-estado" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;background:var(--rh-bg-card);">
                    ${ESTADOS.map(e => `<option ${it && it.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Certificado (URL)</label><input id="fo-cert" value="${v('certificado')}" placeholder="https://…" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"></div>
        </div>
        <div style="margin-top:10px;"><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Notas</label>
            <textarea id="fo-notas" rows="2" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;">${it ? esc(it.notas || '') : ''}</textarea></div>
        <div style="margin-top:12px;display:flex;gap:8px;">
            <button onclick="window._foGuardar()" style="background:var(--rh-success);color:#fff;border:none;padding:9px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">${it ? 'Guardar alterações' : '+ Adicionar'}</button>
            ${it ? `<button onclick="window._foCancelar()" style="background:var(--rh-bg-muted);color:var(--rh-text);border:1px solid var(--rh-border);padding:9px 16px;border-radius:6px;cursor:pointer;font-size:13px;">Cancelar</button>` : ''}
        </div>
    </div>`;
}

function corEstado(e) { return e === 'Concluída' ? 'var(--rh-success)' : e === 'Em curso' ? 'var(--rh-warning)' : 'var(--rh-text-muted)'; }

function renderConteudo() {
    const cont = document.getElementById('fo-conteudo');
    if (!S.funcId) { cont.innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Escolha um colaborador e carregue em "Ver".</p>`; return; }
    const editItem = S.editId ? S.itens.find(i => i.id === S.editId) : null;
    const lista = [...S.itens].sort((a, b) => (b.dataInicio || '').localeCompare(a.dataInicio || ''));
    const horasConcluidas = lista.filter(i => i.estado === 'Concluída').reduce((s, i) => s + (Number(i.horas) || 0), 0);
    cont.innerHTML = formHTML(editItem) + `
        <div style="background:var(--rh-bg-card);border-radius:10px;overflow:hidden;">
            <div style="padding:10px 14px;font-size:12px;color:var(--rh-text-muted);border-bottom:1px solid var(--rh-border);">Horas de formação concluídas: <strong style="color:var(--rh-primary);">${horasConcluidas.toLocaleString('pt-PT')}h</strong> · ${lista.length} ação(ões)</div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:var(--rh-bg-muted);color:var(--rh-text-muted);font-size:11px;text-transform:uppercase;">
                    <th style="padding:9px 12px;text-align:left;">Designação</th><th style="padding:9px 12px;text-align:left;">Área</th><th style="padding:9px 12px;text-align:left;">Entidade</th><th style="padding:9px 12px;">Início</th><th style="padding:9px 12px;">Fim</th><th style="padding:9px 12px;">Horas</th><th style="padding:9px 12px;">Estado</th><th style="padding:9px 12px;text-align:right;">Ações</th>
                </tr></thead>
                <tbody>${lista.length ? lista.map(it => `<tr style="border-top:1px solid var(--rh-border);">
                    <td style="padding:9px 12px;font-weight:500;">${esc(it.titulo) || '—'}${it.certificado ? ` <a href="${escAttr(it.certificado)}" target="_blank" rel="noopener" title="Certificado" style="color:var(--rh-secondary);">📜</a>` : ''}</td>
                    <td style="padding:9px 12px;">${esc(it.area) || '—'}</td>
                    <td style="padding:9px 12px;">${esc(it.entidade) || '—'}</td>
                    <td style="padding:9px 12px;text-align:center;">${fmtD(it.dataInicio)}</td>
                    <td style="padding:9px 12px;text-align:center;">${fmtD(it.dataFim)}</td>
                    <td style="padding:9px 12px;text-align:center;font-weight:600;">${it.horas ? Number(it.horas).toLocaleString('pt-PT') + 'h' : '—'}</td>
                    <td style="padding:9px 12px;text-align:center;"><span style="color:${corEstado(it.estado)};font-weight:600;font-size:12px;">${esc(it.estado || 'Planeada')}</span></td>
                    <td style="padding:9px 12px;text-align:right;white-space:nowrap;">
                        <button onclick="window._foEditar('${escAttr(it.id)}')" style="background:none;border:1px solid var(--rh-border);border-radius:5px;padding:4px 8px;cursor:pointer;font-size:11px;">✏️</button>
                        <button onclick="window._foEliminar('${escAttr(it.id)}')" style="background:none;border:1px solid var(--rh-border);border-radius:5px;padding:4px 8px;cursor:pointer;font-size:11px;color:var(--rh-danger);">🗑️</button>
                    </td></tr>`).join('') : `<tr><td colspan="8" style="padding:24px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Sem ações de formação para este colaborador.</td></tr>`}</tbody>
            </table>
        </div>`;
}

async function carregar() {
    S.itens = [];
    try { const snap = await getDocs(colEmpresa('formacoes')); snap.forEach(d => { const x = { id: d.id, ...d.data() }; if (x.funcId === S.funcId) S.itens.push(x); }); }
    catch (e) { console.warn('[formacao]', e); }
    renderConteudo();
}
function lerForm() {
    return {
        funcId: S.funcId,
        titulo: document.getElementById('fo-titulo').value.trim(),
        area: document.getElementById('fo-area').value.trim(),
        entidade: document.getElementById('fo-entidade').value.trim(),
        dataInicio: document.getElementById('fo-inicio').value || null,
        dataFim: document.getElementById('fo-fim').value || null,
        horas: parseFloat(document.getElementById('fo-horas').value) || 0,
        estado: document.getElementById('fo-estado').value,
        certificado: document.getElementById('fo-cert').value.trim(),
        notas: document.getElementById('fo-notas').value.trim(),
    };
}
window._foCarregar = function() { S.funcId = document.getElementById('fo-func').value; S.editId = null; if (!S.funcId) { renderConteudo(); return; } carregar(); };
window._foGuardar = async function() {
    if (!S.funcId) return;
    const dados = lerForm();
    if (!dados.titulo) { alert('Indique a designação.'); return; }
    try {
        if (S.editId) { await updateDoc(docEmpresa('formacoes', S.editId), dados); S.editId = null; }
        else { await addDoc(colEmpresa('formacoes'), { ...dados, criadoEm: new Date(), criadoPor: quem() }); }
        await carregar();
    } catch (e) { alert('Erro ao guardar: ' + e.message); }
};
window._foEditar = function(id) { S.editId = id; renderConteudo(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
window._foCancelar = function() { S.editId = null; renderConteudo(); };
window._foEliminar = async function(id) {
    if (!confirm('Eliminar esta ação de formação?')) return;
    try { await deleteDoc(docEmpresa('formacoes', id)); await carregar(); } catch (e) { alert('Erro ao eliminar: ' + e.message); }
};

export async function init() {
    await initSidebar();
    try {
        const snap = await getDocs(colEmpresa('funcionarios'));
        S.funcionarios = []; snap.forEach(d => S.funcionarios.push({ id: d.id, ...d.data() }));
        S.funcionarios.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
        const sel = document.getElementById('fo-func');
        if (sel) sel.innerHTML = `<option value="">— escolher —</option>` + S.funcionarios.map(f => `<option value="${escAttr(f.id)}">${esc(f.nome) || f.id}</option>`).join('');
    } catch (e) {
        document.getElementById('fo-conteudo').innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-danger);">Erro ao carregar colaboradores: ${esc(e.message)}</p>`;
    }
}
