// assets/js/modules/admin.js
// Área exclusiva de quem tem um documento em admins/{uid}. Mostra todas as
// empresas de todos os utilizadores (collection-group query) e permite
// "entrar" numa delas para dar suporte, sem nunca precisar das credenciais
// de mais ninguém. Também gere a lixeira de empresas eliminadas.

import {
    isAdmin, listarTodasEmpresasAdmin, entrarNaEmpresa,
    listarLixeiraEmpresas, restaurarEmpresaDaLixeira, eliminarDaLixeiraDefinitivo
} from './tenant.js';

let S = { empresas: [], lixeira: [], abaAtiva: 'empresas' };

// ─── render() ───────────────────────────────────────────────────────────────
export function render() {
    return `
    <div style="min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
        <header style="background:var(--rh-primary);color:var(--rh-bg-card);padding:20px 32px;display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="background:var(--rh-primary-light);padding:8px;border-radius:8px;">🛠️</div>
                <div>
                    <h3 style="margin:0;font-size:16px;">Administração</h3>
                    <small style="color:var(--rh-text-subtle);">Visão global — todos os utilizadores</small>
                </div>
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="window.router.navigate('empresas')"
                    style="background:var(--rh-bg-muted);color:var(--rh-text);border:1px solid rgba(255,255,255,0.3);padding:8px 14px;border-radius:6px;cursor:pointer;font-size:12px;">
                    ← Voltar às Minhas Empresas
                </button>
            </div>
        </header>

        <main style="max-width:1100px;margin:0 auto;padding:32px 24px;">
            <div id="adm-stats" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:26px;"></div>

            <div style="display:flex;gap:8px;margin-bottom:18px;border-bottom:2px solid var(--rh-border);">
                <button id="tab-empresas" onclick="window._adminMudarAba('empresas')"
                    style="background:none;border:none;padding:10px 16px;cursor:pointer;font-size:13px;font-weight:bold;color:var(--rh-primary);border-bottom:2px solid var(--rh-primary);margin-bottom:-2px;">
                    Todas as Empresas
                </button>
                <button id="tab-lixeira" onclick="window._adminMudarAba('lixeira')"
                    style="background:none;border:none;padding:10px 16px;cursor:pointer;font-size:13px;font-weight:bold;color:var(--rh-text-subtle);border-bottom:2px solid transparent;margin-bottom:-2px;">
                    Lixeira (Empresas Eliminadas)
                </button>
            </div>

            <div id="painel-empresas">
                <input type="text" id="adm-filtro" placeholder="🔎 Pesquisar por nome, NIF ou utilizador (uid)…"
                    oninput="window._adminRenderEmpresas()"
                    style="width:100%;padding:10px 14px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;margin-bottom:16px;">
                <div style="background:var(--rh-bg-card);border-radius:10px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.03);">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead>
                            <tr style="background:var(--rh-bg-muted);text-align:left;">
                                <th style="padding:11px 16px;">Empresa</th>
                                <th style="padding:11px 16px;">NIF</th>
                                <th style="padding:11px 16px;">Dono (uid)</th>
                                <th style="padding:11px 16px;">Criada em</th>
                                <th style="padding:11px 16px;"></th>
                            </tr>
                        </thead>
                        <tbody id="tbody-adm-empresas"></tbody>
                    </table>
                    <p id="adm-sem-empresas" style="display:none;text-align:center;color:var(--rh-text-subtle);padding:30px;font-style:italic;">Nenhuma empresa registada.</p>
                </div>
            </div>

            <div id="painel-lixeira" style="display:none;">
                <div style="background:var(--rh-warning-bg);border:1px solid var(--rh-warning);border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--rh-warning-text);">
                    ⚠️ Empresas eliminadas ficam guardadas aqui antes de serem apagadas em definitivo. Pode restaurá-las para o utilizador original, ou eliminá-las de forma permanente.
                </div>
                <div style="background:var(--rh-bg-card);border-radius:10px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.03);">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead>
                            <tr style="background:var(--rh-bg-muted);text-align:left;">
                                <th style="padding:11px 16px;">Empresa</th>
                                <th style="padding:11px 16px;">NIF</th>
                                <th style="padding:11px 16px;">Dono original (uid)</th>
                                <th style="padding:11px 16px;">Eliminada em</th>
                                <th style="padding:11px 16px;"></th>
                            </tr>
                        </thead>
                        <tbody id="tbody-lixeira"></tbody>
                    </table>
                    <p id="adm-sem-lixeira" style="display:none;text-align:center;color:var(--rh-text-subtle);padding:30px;font-style:italic;">Lixeira vazia.</p>
                </div>
            </div>
        </main>
    </div>`;
}

// ─── Carregamento ─────────────────────────────────────────────────────────────
async function carregarStats() {
    const utilizadores = new Set(S.empresas.map(e => e.donoUid)).size;
    document.getElementById('adm-stats').innerHTML = `
        <div style="background:var(--rh-bg-card);padding:18px;border-radius:10px;border-top:4px solid var(--rh-primary);">
            <small style="color:var(--rh-text-muted);text-transform:uppercase;font-size:11px;font-weight:bold;">Total de Empresas</small>
            <h3 style="margin:8px 0 2px;font-size:24px;color:var(--rh-primary);">${S.empresas.length}</h3>
        </div>
        <div style="background:var(--rh-bg-card);padding:18px;border-radius:10px;border-top:4px solid var(--rh-secondary);">
            <small style="color:var(--rh-text-muted);text-transform:uppercase;font-size:11px;font-weight:bold;">Utilizadores com Empresas</small>
            <h3 style="margin:8px 0 2px;font-size:24px;color:var(--rh-primary);">${utilizadores}</h3>
        </div>
        <div style="background:var(--rh-bg-card);padding:18px;border-radius:10px;border-top:4px solid var(--rh-danger);">
            <small style="color:var(--rh-text-muted);text-transform:uppercase;font-size:11px;font-weight:bold;">Na Lixeira</small>
            <h3 style="margin:8px 0 2px;font-size:24px;color:var(--rh-primary);">${S.lixeira.length}</h3>
        </div>`;
}

function formatarData(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('pt-PT'); } catch { return iso; }
}

window._adminRenderEmpresas = function() {
    const filtro = (document.getElementById('adm-filtro')?.value || '').toLowerCase().trim();
    let lista = S.empresas;
    if (filtro) {
        lista = lista.filter(e =>
            (e.nome || '').toLowerCase().includes(filtro) ||
            (e.nif || '').toLowerCase().includes(filtro) ||
            (e.donoUid || '').toLowerCase().includes(filtro)
        );
    }
    const tbody = document.getElementById('tbody-adm-empresas');
    const semEl = document.getElementById('adm-sem-empresas');
    if (!lista.length) { tbody.innerHTML = ''; semEl.style.display = 'block'; return; }
    semEl.style.display = 'none';

    tbody.innerHTML = lista.map(e => `
        <tr style="border-top:1px solid var(--rh-border);">
            <td style="padding:11px 16px;font-weight:500;">${e.nome}</td>
            <td style="padding:11px 16px;font-family:monospace;font-size:12px;color:var(--rh-text-muted);">${e.nif || '—'}</td>
            <td style="padding:11px 16px;font-family:monospace;font-size:11px;color:var(--rh-text-subtle);" title="${e.donoUid}">${e.donoUid.slice(0, 12)}…</td>
            <td style="padding:11px 16px;color:var(--rh-text-muted);">${formatarData(e.criadoEm)}</td>
            <td style="padding:11px 16px;text-align:right;">
                <button onclick="window._adminEntrar('${e.id}','${e.donoUid}')"
                    style="background:var(--rh-accent);color:var(--rh-text);border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">
                    Entrar →
                </button>
            </td>
        </tr>`).join('');
};

function renderLixeira() {
    const tbody = document.getElementById('tbody-lixeira');
    const semEl = document.getElementById('adm-sem-lixeira');
    if (!S.lixeira.length) { tbody.innerHTML = ''; semEl.style.display = 'block'; return; }
    semEl.style.display = 'none';

    tbody.innerHTML = S.lixeira.map(item => `
        <tr style="border-top:1px solid var(--rh-border);">
            <td style="padding:11px 16px;font-weight:500;">${item.empresa?.nome || '—'}</td>
            <td style="padding:11px 16px;font-family:monospace;font-size:12px;color:var(--rh-text-muted);">${item.empresa?.nif || '—'}</td>
            <td style="padding:11px 16px;font-family:monospace;font-size:11px;color:var(--rh-text-subtle);" title="${item.donoUid}">${(item.donoUid || '').slice(0, 12)}…</td>
            <td style="padding:11px 16px;color:var(--rh-text-muted);">${formatarData(item.eliminadaEm)}</td>
            <td style="padding:11px 16px;text-align:right;white-space:nowrap;">
                <button onclick="window._adminRestaurar('${item.id}')"
                    style="background:var(--rh-bg-muted);border:1px solid var(--rh-border);padding:7px 12px;border-radius:6px;cursor:pointer;font-size:12px;margin-right:6px;">
                    ↺ Restaurar
                </button>
                <button onclick="window._adminApagarDefinitivo('${item.id}')"
                    style="background:var(--rh-danger-bg);color:var(--rh-danger-text);border:1px solid var(--rh-danger);padding:7px 12px;border-radius:6px;cursor:pointer;font-size:12px;">
                    ✕ Apagar definitivo
                </button>
            </td>
        </tr>`).join('');
}

// ─── Ações ────────────────────────────────────────────────────────────────────
window._adminMudarAba = function(aba) {
    S.abaAtiva = aba;
    document.getElementById('painel-empresas').style.display = aba === 'empresas' ? 'block' : 'none';
    document.getElementById('painel-lixeira').style.display = aba === 'lixeira' ? 'block' : 'none';

    const setAtivo = (id, ativo) => {
        const el = document.getElementById(id);
        el.style.color = ativo ? 'var(--rh-primary)' : 'var(--rh-text-subtle)';
        el.style.borderBottom = ativo ? '2px solid var(--rh-primary)' : '2px solid transparent';
    };
    setAtivo('tab-empresas', aba === 'empresas');
    setAtivo('tab-lixeira', aba === 'lixeira');
};

window._adminEntrar = async function(empresaId, donoUid) {
    await entrarNaEmpresa(empresaId, donoUid);
    window.router.navigate('dashboard');
};

window._adminRestaurar = async function(empresaId) {
    if (!confirm('Restaurar esta empresa para o utilizador original?')) return;
    try {
        const resultado = await restaurarEmpresaDaLixeira(empresaId);
        if (resultado) {
            alert(`Empresa "${resultado.nome}" restaurada com sucesso.`);
            await carregarTudo();
        } else {
            alert('Não foi possível restaurar — backup não encontrado.');
        }
    } catch (e) {
        alert('Erro ao restaurar: ' + e.message);
    }
};

window._adminApagarDefinitivo = async function(empresaId) {
    if (!confirm('Apagar este backup PERMANENTEMENTE? Esta ação não pode ser revertida.')) return;
    try {
        await eliminarDaLixeiraDefinitivo(empresaId);
        await carregarTudo();
    } catch (e) {
        alert('Erro ao apagar: ' + e.message);
    }
};

async function carregarTudo() {
    [S.empresas, S.lixeira] = await Promise.all([listarTodasEmpresasAdmin(), listarLixeiraEmpresas()]);
    await carregarStats();
    window._adminRenderEmpresas();
    renderLixeira();
}

// ─── init() ───────────────────────────────────────────────────────────────────
export async function init() {
    const admin = await isAdmin();
    if (!admin) {
        document.getElementById('app').innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:var(--rh-bg);font-family:sans-serif;">
                <div style="text-align:center;">
                    <h2 style="color:var(--rh-danger);margin-bottom:10px;">Acesso Restrito</h2>
                    <p style="color:var(--rh-text-muted);margin-bottom:20px;">Esta área é exclusiva a administradores.</p>
                    <button onclick="window.router.navigate('empresas')"
                        style="background:var(--rh-accent);color:var(--rh-text);border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:bold;">
                        ← Voltar
                    </button>
                </div>
            </div>`;
        return;
    }

    S.abaAtiva = 'empresas';
    await carregarTudo();
}
