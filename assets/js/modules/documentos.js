// assets/js/modules/documentos.js
// Gestão de contratos e documentos por colaborador.
// Coleção: documentos/{id} = { funcId, tipo, titulo, numero, dataEmissao,
//   dataValidade, link, notas, criadoEm, criadoPor }

import { getDocs, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { colEmpresa, docEmpresa } from './tenant.js';
import { auth } from '../app.js';
import { renderSidebarHTML, initSidebar } from './sidebar.js';
import { esc, escAttr } from './html-utils.js';

const TIPOS = ['Contrato', 'Aditamento', 'Certificado', 'Identificação', 'Documento médico', 'Outro'];
let S = { funcId: '', funcionarios: [], itens: [], editId: null };

const quem = () => auth.currentUser?.email || auth.currentUser?.uid || '—';
const fmtD = (s) => { if (!s) return '—'; const [a, m, d] = s.split('-'); return `${d}/${m}/${a}`; };
const hojeISO = () => new Date().toISOString().slice(0, 10);

export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        ${renderSidebarHTML('documentos')}
        <main style="flex:1;padding:32px;overflow-x:auto;">
            <div style="margin-bottom:18px;">
                <h2 style="margin:0;font-size:24px;color:var(--rh-primary);">📁 Contratos e Documentos</h2>
                <p style="margin:4px 0 0;color:var(--rh-text-muted);font-size:13px;">Documentos por colaborador, com datas e alertas de validade</p>
            </div>
            <div style="display:flex;gap:10px;align-items:end;margin-bottom:18px;background:var(--rh-bg-card);padding:14px 16px;border-radius:10px;">
                <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);margin-bottom:3px;">Colaborador</label>
                    <select id="doc-func" style="padding:9px;border:1px solid var(--rh-border);border-radius:6px;min-width:220px;font-size:13px;"></select></div>
                <button onclick="window._docCarregar()" style="background:var(--rh-primary);color:#fff;border:none;padding:9px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">Ver</button>
            </div>
            <div id="doc-conteudo"><p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Escolha um colaborador.</p></div>
        </main>
    </div>`;
}

function formHTML(it) {
    const v = (k) => it ? escAttr(it[k] || '') : '';
    return `
    <div style="background:var(--rh-bg-card);border-radius:10px;padding:16px;margin-bottom:16px;">
        <h3 style="margin:0 0 12px;font-size:15px;color:var(--rh-primary);">${it ? 'Editar documento' : 'Adicionar documento'}</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Tipo</label>
                <select id="doc-tipo" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;background:var(--rh-bg-card);">
                    ${TIPOS.map(t => `<option ${it && it.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Título</label><input id="doc-titulo" value="${v('titulo')}" placeholder="ex.: Contrato sem termo" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Nº / Referência</label><input id="doc-numero" value="${v('numero')}" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Data de emissão</label><input type="date" id="doc-emissao" value="${v('dataEmissao')}" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Validade (se aplicável)</label><input type="date" id="doc-validade" value="${v('dataValidade')}" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"></div>
            <div><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Ligação (URL)</label><input id="doc-link" value="${v('link')}" placeholder="https://… (arquivo externo)" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;"></div>
        </div>
        <div style="margin-top:10px;"><label style="display:block;font-size:11px;color:var(--rh-text-muted);">Notas</label>
            <textarea id="doc-notas" rows="2" style="width:100%;padding:8px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;">${it ? esc(it.notas || '') : ''}</textarea></div>
        <div style="margin-top:12px;display:flex;gap:8px;">
            <button onclick="window._docGuardar()" style="background:var(--rh-success);color:#fff;border:none;padding:9px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">${it ? 'Guardar alterações' : '+ Adicionar'}</button>
            ${it ? `<button onclick="window._docCancelar()" style="background:var(--rh-bg-muted);color:var(--rh-text);border:1px solid var(--rh-border);padding:9px 16px;border-radius:6px;cursor:pointer;font-size:13px;">Cancelar</button>` : ''}
        </div>
    </div>`;
}

function badgeValidade(it) {
    if (!it.dataValidade) return '';
    const hoje = hojeISO();
    const d30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    if (it.dataValidade < hoje) return ` <span style="background:var(--rh-danger-bg);color:var(--rh-danger-dark);padding:1px 7px;border-radius:9px;font-size:10px;">expirado</span>`;
    if (it.dataValidade <= d30) return ` <span style="background:var(--rh-warning-bg);color:var(--rh-warning-text);padding:1px 7px;border-radius:9px;font-size:10px;">a expirar</span>`;
    return '';
}

function renderConteudo() {
    const cont = document.getElementById('doc-conteudo');
    if (!S.funcId) { cont.innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Escolha um colaborador e carregue em "Ver".</p>`; return; }
    const editItem = S.editId ? S.itens.find(i => i.id === S.editId) : null;
    const lista = [...S.itens].sort((a, b) => (b.dataEmissao || '').localeCompare(a.dataEmissao || ''));
    cont.innerHTML = formHTML(editItem) + `
        <div style="background:var(--rh-bg-card);border-radius:10px;overflow:hidden;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:var(--rh-bg-muted);color:var(--rh-text-muted);font-size:11px;text-transform:uppercase;">
                    <th style="padding:9px 12px;text-align:left;">Tipo</th><th style="padding:9px 12px;text-align:left;">Título</th><th style="padding:9px 12px;">Emissão</th><th style="padding:9px 12px;">Validade</th><th style="padding:9px 12px;">Ligação</th><th style="padding:9px 12px;text-align:right;">Ações</th>
                </tr></thead>
                <tbody>${lista.length ? lista.map(it => `<tr style="border-top:1px solid var(--rh-border);">
                    <td style="padding:9px 12px;font-weight:500;">${esc(it.tipo)}</td>
                    <td style="padding:9px 12px;">${esc(it.titulo) || '—'}${it.numero ? ` <span style="color:var(--rh-text-subtle);font-size:11px;">(${esc(it.numero)})</span>` : ''}</td>
                    <td style="padding:9px 12px;text-align:center;">${fmtD(it.dataEmissao)}</td>
                    <td style="padding:9px 12px;text-align:center;">${fmtD(it.dataValidade)}${badgeValidade(it)}</td>
                    <td style="padding:9px 12px;text-align:center;">${it.link ? `<a href="${escAttr(it.link)}" target="_blank" rel="noopener" style="color:var(--rh-secondary);">abrir ↗</a>` : '—'}</td>
                    <td style="padding:9px 12px;text-align:right;white-space:nowrap;">
                        <button onclick="window._docEditar('${escAttr(it.id)}')" style="background:none;border:1px solid var(--rh-border);border-radius:5px;padding:4px 8px;cursor:pointer;font-size:11px;">✏️</button>
                        <button onclick="window._docEliminar('${escAttr(it.id)}')" style="background:none;border:1px solid var(--rh-border);border-radius:5px;padding:4px 8px;cursor:pointer;font-size:11px;color:var(--rh-danger);">🗑️</button>
                    </td></tr>`).join('') : `<tr><td colspan="6" style="padding:24px;text-align:center;color:var(--rh-text-subtle);font-style:italic;">Sem documentos para este colaborador.</td></tr>`}</tbody>
            </table>
        </div>`;
}

async function carregar() {
    S.itens = [];
    try {
        const snap = await getDocs(colEmpresa('documentos'));
        snap.forEach(d => { const x = { id: d.id, ...d.data() }; if (x.funcId === S.funcId) S.itens.push(x); });
    } catch (e) { console.warn('[documentos]', e); }
    renderConteudo();
}

function lerForm() {
    return {
        funcId: S.funcId,
        tipo: document.getElementById('doc-tipo').value,
        titulo: document.getElementById('doc-titulo').value.trim(),
        numero: document.getElementById('doc-numero').value.trim(),
        dataEmissao: document.getElementById('doc-emissao').value || null,
        dataValidade: document.getElementById('doc-validade').value || null,
        link: document.getElementById('doc-link').value.trim(),
        notas: document.getElementById('doc-notas').value.trim(),
    };
}

window._docCarregar = function() {
    S.funcId = document.getElementById('doc-func').value; S.editId = null;
    if (!S.funcId) { renderConteudo(); return; }
    carregar();
};
window._docGuardar = async function() {
    if (!S.funcId) return;
    const dados = lerForm();
    if (!dados.titulo) { alert('Indique um título.'); return; }
    try {
        if (S.editId) { await updateDoc(docEmpresa('documentos', S.editId), dados); S.editId = null; }
        else { await addDoc(colEmpresa('documentos'), { ...dados, criadoEm: new Date(), criadoPor: quem() }); }
        await carregar();
    } catch (e) { alert('Erro ao guardar: ' + e.message); }
};
window._docEditar = function(id) { S.editId = id; renderConteudo(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
window._docCancelar = function() { S.editId = null; renderConteudo(); };
window._docEliminar = async function(id) {
    if (!confirm('Eliminar este documento?')) return;
    try { await deleteDoc(docEmpresa('documentos', id)); await carregar(); }
    catch (e) { alert('Erro ao eliminar: ' + e.message); }
};

export async function init() {
    await initSidebar();
    try {
        const snap = await getDocs(colEmpresa('funcionarios'));
        S.funcionarios = []; snap.forEach(d => S.funcionarios.push({ id: d.id, ...d.data() }));
        S.funcionarios.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
        const sel = document.getElementById('doc-func');
        if (sel) sel.innerHTML = `<option value="">— escolher —</option>` + S.funcionarios.map(f => `<option value="${escAttr(f.id)}">${esc(f.nome) || f.id}</option>`).join('');
    } catch (e) {
        document.getElementById('doc-conteudo').innerHTML = `<p style="padding:30px;text-align:center;color:var(--rh-danger);">Erro ao carregar colaboradores: ${esc(e.message)}</p>`;
    }
}
