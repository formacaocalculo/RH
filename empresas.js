// assets/js/modules/empresas.js
// Ponto de entrada multi-empresa: qualquer utilizador autenticado vê aqui a
// lista das SUAS próprias empresas, pode criar novas, e escolhe com qual
// quer trabalhar. Quem for administrador (admins/{uid}) vê adicionalmente
// um botão para a área de Administração (visão global).

import {
    listarEmpresas, criarEmpresa, editarEmpresa, definirEmpresaAtiva, isAdmin, eliminarEmpresa
} from './tenant.js';
import { pedirReautenticacao } from './seguranca-dados.js';

let S = { empresas: [], souAdmin: false, aEditarId: null };

// ─── render() ───────────────────────────────────────────────────────────────
export function render() {
    return `
    <div style="min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        <header style="background:var(--rh-primary);color:var(--rh-bg-card);padding:20px 32px;display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="background:var(--rh-primary-light);padding:8px;border-radius:8px;">🏢</div>
                <div>
                    <h3 style="margin:0;font-size:16px;">Portal RH</h3>
                    <small style="color:var(--rh-text-subtle);">As Minhas Empresas</small>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:14px;">
                <span id="emp-utilizador-label" style="font-size:12px;color:var(--rh-text-subtle);"></span>
                <button id="btn-ir-admin" onclick="window.router.navigate('admin')" hidden
                    style="background:var(--rh-accent);color:var(--rh-text);border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">
                    🛠️ Administração
                </button>
                <a href="#" onclick="window._empresasSair();return false;" style="color:var(--rh-text-subtle);font-size:12px;text-decoration:none;">🚪 Sair</a>
            </div>
        </header>

        <main style="max-width:920px;margin:0 auto;padding:36px 24px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
                <div>
                    <h2 style="margin:0;font-size:21px;color:var(--rh-primary);">Escolha uma empresa</h2>
                    <p style="margin:4px 0 0;font-size:13px;color:var(--rh-text-muted);">Selecione com qual empresa quer trabalhar, ou crie uma nova.</p>
                </div>
                <button onclick="window._empresasMostrarForm()"
                    style="background:var(--rh-accent);color:var(--rh-text);border:none;padding:10px 18px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">
                    + Nova Empresa
                </button>
            </div>

            <div id="form-empresa" style="display:none;background:var(--rh-bg-card);border:1px solid var(--rh-border);border-radius:10px;padding:18px;margin-bottom:20px;">
                <h4 id="form-empresa-titulo" style="margin:0 0 12px;font-size:14px;color:var(--rh-primary);">Nova Empresa</h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:12px;">
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:12px;color:var(--rh-text-muted);">Nome da Empresa *</label>
                        <input type="text" id="emp-nome" placeholder="Ex: Empresa Lda"
                            style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:12px;color:var(--rh-text-muted);">NIF da Empresa</label>
                        <input type="text" id="emp-nif" placeholder="9 dígitos"
                            style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-size:12px;color:var(--rh-text-muted);">Morada</label>
                        <input type="text" id="emp-morada" placeholder="Rua, número, localidade"
                            style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;">
                    </div>
                </div>
                <div style="display:flex;gap:8px;">
                    <button id="btn-guardar-empresa" onclick="window._empresasGuardar()"
                        style="background:var(--rh-secondary);color:#fff;border:none;padding:9px 16px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">
                        💾 Guardar
                    </button>
                    <button onclick="window._empresasMostrarForm(false)"
                        style="background:var(--rh-bg-muted);color:var(--rh-text-muted);border:1px solid var(--rh-border);padding:9px 16px;border-radius:6px;cursor:pointer;font-size:13px;">
                        Cancelar
                    </button>
                </div>
            </div>

            <div id="lista-empresas" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">
                <p style="color:var(--rh-text-subtle);font-style:italic;">A carregar…</p>
            </div>
        </main>
    </div>`;
}

// ─── Carregamento e render da lista ─────────────────────────────────────────
async function carregar() {
    S.empresas = await listarEmpresas();
}

function renderLista() {
    const el = document.getElementById('lista-empresas');
    if (!el) return;
    if (!S.empresas.length) {
        el.innerHTML = `<p style="color:var(--rh-text-subtle);font-style:italic;grid-column:1/-1;">
            Ainda não tem nenhuma empresa. Use "+ Nova Empresa" para começar.
        </p>`;
        return;
    }
    el.innerHTML = S.empresas.map(emp => `
        <div style="background:var(--rh-bg-card);border:1px solid var(--rh-border);border-radius:10px;padding:18px;display:flex;flex-direction:column;gap:10px;">
            <div>
                <div style="font-size:15px;font-weight:bold;color:var(--rh-primary);">🏢 ${emp.nome}</div>
                <div style="font-size:11px;color:var(--rh-text-subtle);margin-top:3px;">
                    NIF: ${emp.nif || '—'}${emp.morada ? ' · ' + emp.morada : ''}
                </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:auto;">
                <button onclick="window._empresasEntrar('${emp.id}')"
                    style="flex:1;background:var(--rh-primary);color:#fff;border:none;padding:8px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">
                    Entrar →
                </button>
                <button onclick="window._empresasEditar('${emp.id}')" title="Editar"
                    style="background:var(--rh-bg-muted);border:1px solid var(--rh-border);padding:8px 10px;border-radius:6px;cursor:pointer;font-size:13px;">✏️</button>
                ${S.souAdmin ? `<button onclick="window._empresasEliminar('${emp.id}')" title="Eliminar (só administradores)"
                    style="background:var(--rh-bg-muted);border:1px solid var(--rh-border);padding:8px 10px;border-radius:6px;cursor:pointer;font-size:13px;color:var(--rh-danger);">🗑️</button>` : ''}
            </div>
        </div>
    `).join('');
}

// ─── Ações ────────────────────────────────────────────────────────────────────
window._empresasMostrarForm = function(mostrar = true) {
    const el = document.getElementById('form-empresa');
    if (el) el.style.display = mostrar ? 'block' : 'none';
    if (mostrar) {
        S.aEditarId = null;
        document.getElementById('form-empresa-titulo').textContent = 'Nova Empresa';
        document.getElementById('btn-guardar-empresa').textContent = '💾 Guardar';
        ['emp-nome', 'emp-nif', 'emp-morada'].forEach(id => { document.getElementById(id).value = ''; });
    }
};

window._empresasEditar = function(empresaId) {
    const emp = S.empresas.find(e => e.id === empresaId);
    if (!emp) return;
    S.aEditarId = empresaId;
    document.getElementById('form-empresa-titulo').textContent = `Editar — ${emp.nome}`;
    document.getElementById('btn-guardar-empresa').textContent = '💾 Guardar Alterações';
    document.getElementById('emp-nome').value = emp.nome || '';
    document.getElementById('emp-nif').value = emp.nif || '';
    document.getElementById('emp-morada').value = emp.morada || '';
    document.getElementById('form-empresa').style.display = 'block';
    document.getElementById('form-empresa').scrollIntoView?.({ behavior: 'smooth', block: 'center' });
};

window._empresasGuardar = async function() {
    const nome = document.getElementById('emp-nome').value.trim();
    const nif = document.getElementById('emp-nif').value.trim();
    const morada = document.getElementById('emp-morada').value.trim();
    if (!nome) { alert('O nome da empresa é obrigatório.'); return; }

    try {
        if (S.aEditarId) {
            await editarEmpresa(S.aEditarId, { nome, nif, morada });
        } else {
            await criarEmpresa({ nome, nif, morada });
        }
        window._empresasMostrarForm(false);
        await carregar();
        renderLista();
    } catch (e) {
        alert('Erro ao guardar empresa: ' + e.message);
    }
};

window._empresasEntrar = function(empresaId) {
    definirEmpresaAtiva(empresaId);
    window.router.navigate('dashboard');
};

window._empresasEliminar = async function(empresaId) {
    if (!S.souAdmin) {
        alert('Apenas administradores podem eliminar empresas.');
        return;
    }
    const emp = S.empresas.find(e => e.id === empresaId);
    if (!emp) return;

    const ok = await pedirReautenticacao(
        `A empresa "${emp.nome}" e TODOS os seus dados (colaboradores, ausências, configurações) serão eliminados. ` +
        `Ficam guardados numa lixeira acessível apenas a administradores, e podem ser restaurados. ` +
        `Introduza a sua password para confirmar.`
    );
    if (!ok) return;

    try {
        await eliminarEmpresa(empresaId);
        await carregar();
        renderLista();
    } catch (e) {
        alert('Erro ao eliminar empresa: ' + e.message);
    }
};

window._empresasSair = async function() {
    if (!confirm('Terminar sessão?')) return;
    const { auth } = await import('../app.js');
    const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    const { limparEmpresaAtiva } = await import('./tenant.js');
    limparEmpresaAtiva();
    await signOut(auth);
};

// ─── init() ───────────────────────────────────────────────────────────────────
export async function init() {
    const { auth } = await import('../app.js');
    const label = document.getElementById('emp-utilizador-label');
    if (label) label.textContent = `Sessão: ${auth.currentUser?.email || ''}`;

    // Determinar se é admin ANTES de desenhar a lista, para que o botão de
    // eliminar (visível só a administradores) apareça logo no primeiro render.
    S.souAdmin = await isAdmin();

    await carregar();
    renderLista();

    const btnAdmin = document.getElementById('btn-ir-admin');
    if (btnAdmin) btnAdmin.hidden = !S.souAdmin;
}
