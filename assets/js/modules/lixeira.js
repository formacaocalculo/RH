// assets/js/modules/lixeira.js
import {
    getDocs, setDoc, deleteDoc, updateDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { colEmpresa, docEmpresa } from './tenant.js';
import { renderSidebarHTML, initSidebar } from './sidebar.js';
import { esc, escAttr } from './html-utils.js';

let S = { backups: [] };

// ─── render() ───────────────────────────────────────────────────────────────
export function render() {
    return `
    <div style="display:flex;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        ${renderSidebarHTML('lixeira')}
        <main style="flex:1;padding:28px;overflow-y:auto;">
            <div style="margin-bottom:22px;">
                <h2 style="margin:0;font-size:21px;color:var(--rh-primary);">🗑️ Lixo / Repor Dados</h2>
                <p style="margin:4px 0 0;font-size:13px;color:var(--rh-text-muted);">
                    Registos eliminados em qualquer módulo ficam aqui guardados. Pode restaurá-los ou descarregar novamente o ficheiro .json de backup.
                </p>
            </div>

            <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;align-items:center;">
                <input type="text" id="lix-filtro" placeholder="🔎 Filtrar por tipo ou descrição…"
                    style="flex:1;min-width:220px;padding:9px 12px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;">
                <select id="lix-tipo" style="padding:9px 12px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;background:var(--rh-bg-card);">
                    <option value="">Todos os tipos</option>
                </select>
                <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--rh-text-muted);">
                    <input type="checkbox" id="lix-ocultar-restaurados"> Ocultar já restaurados
                </label>
            </div>

            <div id="lix-lista" style="display:flex;flex-direction:column;gap:10px;">
                <p style="color:var(--rh-text-subtle);font-style:italic;">A carregar…</p>
            </div>
        </main>
    </div>`;
}

// ─── Carregamento ─────────────────────────────────────────────────────────────
async function carregarBackups() {
    S.backups = [];
    try {
        const snap = await getDocs(colEmpresa('backups'));
        snap.forEach(d => S.backups.push({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error('Erro ao carregar backups:', e);
    }
    S.backups.sort((a, b) => (b.eliminadoEm || '').localeCompare(a.eliminadoEm || ''));
}

function popularFiltroTipos() {
    const tipos = [...new Set(S.backups.map(b => b.tipo).filter(Boolean))].sort();
    const sel = document.getElementById('lix-tipo');
    if (!sel) return;
    const atual = sel.value;
    sel.innerHTML = `<option value="">Todos os tipos</option>` +
        tipos.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    sel.value = atual;
}

function formatarData(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('pt-PT'); } catch { return iso; }
}

function renderLista() {
    const el = document.getElementById('lix-lista');
    if (!el) return;

    const filtroTexto = (document.getElementById('lix-filtro')?.value || '').toLowerCase();
    const filtroTipo = document.getElementById('lix-tipo')?.value || '';
    const ocultarRestaurados = document.getElementById('lix-ocultar-restaurados')?.checked;

    let lista = S.backups.filter(b => {
        if (filtroTipo && b.tipo !== filtroTipo) return false;
        if (ocultarRestaurados && b.restaurado) return false;
        if (filtroTexto) {
            const alvo = `${b.tipo || ''} ${b.descricao || ''}`.toLowerCase();
            if (!alvo.includes(filtroTexto)) return false;
        }
        return true;
    });

    if (!lista.length) {
        el.innerHTML = `<p style="color:var(--rh-text-subtle);font-style:italic;">Nenhum registo eliminado encontrado.</p>`;
        return;
    }

    el.innerHTML = lista.map(b => `
        <div style="background:var(--rh-bg-card);border:1px solid var(--rh-border);border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:14px;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
                    <span style="background:var(--rh-bg-muted);color:var(--rh-text-muted);font-size:10px;font-weight:bold;text-transform:uppercase;padding:2px 8px;border-radius:10px;">${esc(b.tipo) || '—'}</span>
                    ${b.restaurado ? `<span style="background:var(--rh-success-bg);color:var(--rh-success-text);font-size:10px;font-weight:bold;padding:2px 8px;border-radius:10px;">✔ Restaurado</span>` : ''}
                </div>
                <div style="font-size:13px;color:var(--rh-text);font-weight:500;">${esc(b.descricao || b.docIdOrigem)}</div>
                <div style="font-size:11px;color:var(--rh-text-subtle);margin-top:2px;">
                    Eliminado em ${formatarData(b.eliminadoEm)} por ${esc(b.eliminadoPor) || '—'}
                </div>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
                <button onclick="window._lixDescarregar('${escAttr(b.id)}')"
                    style="background:var(--rh-bg-muted);color:var(--rh-text-muted);border:1px solid var(--rh-border);padding:8px 12px;border-radius:6px;cursor:pointer;font-size:12px;">
                    ⬇ .json
                </button>
                ${!b.restaurado ? `
                <button onclick="window._lixRestaurar('${escAttr(b.id)}')"
                    style="background:var(--rh-secondary);color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">
                    ♻ Restaurar
                </button>` : ''}
            </div>
        </div>
    `).join('');
}

// ─── Ações ────────────────────────────────────────────────────────────────────
window._lixDescarregar = function(backupId) {
    const b = S.backups.find(x => x.id === backupId);
    if (!b) return;
    const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${b.tipo || 'registo'}_${b.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

window._lixRestaurar = async function(backupId) {
    const b = S.backups.find(x => x.id === backupId);
    if (!b) return;

    const confirmacao = confirm(
        `Restaurar este registo?\n\nTipo: ${b.tipo}\nDescrição: ${b.descricao}\n\n` +
        `Isto vai repor os dados na coleção "${b.colecaoOrigem}".`
    );
    if (!confirmacao) return;

    try {
        if (b.tipo === 'funcionario' && b.dados && b.dados.funcionario) {
            // Caso especial: o backup de funcionário inclui também as ausências associadas.
            await setDoc(docEmpresa(b.colecaoOrigem, b.docIdOrigem), b.dados.funcionario);
            if (b.dados.ausencias) {
                await setDoc(docEmpresa('ausencias', b.docIdOrigem), b.dados.ausencias);
            }
        } else if (b.subcampo) {
            // Restauro de um item dentro de um array de outro documento (ex: um filho)
            const refDoc = docEmpresa(b.colecaoOrigem, b.docIdOrigem);
            const snap = await getDoc(refDoc);
            if (!snap.exists()) {
                alert('O documento de origem já não existe. Não é possível restaurar automaticamente este sub-registo. Use o ficheiro .json para repor manualmente.');
                return;
            }
            const dadosAtuais = snap.data();
            const arr = Array.isArray(dadosAtuais[b.subcampo.campo]) ? dadosAtuais[b.subcampo.campo] : [];
            arr.push(b.dados);
            await updateDoc(refDoc, { [b.subcampo.campo]: arr });
        } else {
            // Restauro de um documento inteiro
            await setDoc(docEmpresa(b.colecaoOrigem, b.docIdOrigem), b.dados);
        }

        await updateDoc(docEmpresa('backups', backupId), { restaurado: true, restauradoEm: new Date().toISOString() });
        b.restaurado = true;
        renderLista();
        alert('Registo restaurado com sucesso.');
    } catch (e) {
        alert('Erro ao restaurar: ' + e.message);
    }
};

// ─── init() ───────────────────────────────────────────────────────────────────
export async function init() {
    await initSidebar();

    await carregarBackups();
    popularFiltroTipos();
    renderLista();

    document.getElementById('lix-filtro').addEventListener('input', renderLista);
    document.getElementById('lix-tipo').addEventListener('change', renderLista);
    document.getElementById('lix-ocultar-restaurados').addEventListener('change', renderLista);
}
