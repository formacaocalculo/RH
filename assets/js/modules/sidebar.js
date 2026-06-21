// assets/js/modules/sidebar.js
// Sidebar dinâmica partilhada por todos os módulos operacionais do Portal RH.
// Substitui a sidebar fixa que cada módulo desenhava no seu próprio HTML —
// agora o HTML da sidebar tem sempre a mesma marcação (renderSidebarHTML),
// e initSidebar() depois de injetada no DOM o preenche com o nome da
// empresa ativa e o eventual aviso de "modo admin".

import { empresaAtiva, donoEmpresaAtiva, isAdmin } from './tenant.js';

const NAV_ITEMS = [
    { rota: 'dashboard',         icone: '📊', label: 'Dashboard',          secao: 'Principal' },
    { rota: 'funcionarios',      icone: '👥', label: 'Colaboradores',      secao: 'Gestão' },
    { rota: 'criar-funcionario', icone: '➕', label: 'Novo Funcionário',   secao: 'Gestão' },
    { rota: 'assiduidade',       icone: '📅', label: 'Assiduidade',        secao: 'Gestão' },
    { rota: 'processamento',     icone: '💶', label: 'Processamento',      secao: 'Gestão' },
    { rota: 'recibos',           icone: '📄', label: 'Recibos',            secao: 'Gestão' },
    { rota: 'parametrizacao',    icone: '⚙️', label: 'Parametrização',     secao: 'Configurações' },
    { rota: 'lixeira',           icone: '🗑️', label: 'Lixo / Repor Dados', secao: 'Configurações' },
];

// Devolve o esqueleto HTML da sidebar (sem dados ainda) — usado pelos
// módulos dentro do seu render(). Os dados (empresa, admin) são preenchidos
// depois de injetado no DOM, por initSidebar(), porque dependem de uma
// leitura assíncrona ao Firestore/localStorage.
export function renderSidebarHTML(rotaAtiva) {
    const secoes = [...new Set(NAV_ITEMS.map(i => i.secao))];
    const nav = secoes.map(secao => `
        <p style="color:var(--rh-text-muted);font-size:11px;text-transform:uppercase;font-weight:bold;margin:16px 0 8px;">${secao}</p>
        ${NAV_ITEMS.filter(i => i.secao === secao).map(i => `
            <button onclick="window.router.navigate('${i.rota}')"
                style="display:block;width:100%;text-align:left;
                       background:${i.rota === rotaAtiva ? 'var(--rh-primary-light)' : 'none'};
                       color:${i.rota === rotaAtiva ? 'var(--rh-bg-card)' : 'var(--rh-text-subtle)'};
                       padding:10px;border:none;cursor:pointer;font-size:14px;
                       border-radius:6px;margin-bottom:2px;
                       font-weight:${i.rota === rotaAtiva ? 'bold' : 'normal'};">
                ${i.icone} ${i.label}
            </button>`).join('')}
    `).join('');

    return `
    <aside style="width:260px;background:var(--rh-primary);color:var(--rh-bg-card);padding:20px;flex-shrink:0;display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;margin-bottom:18px;">
            <div style="background:var(--rh-primary-light);padding:8px;border-radius:8px;margin-right:10px;">🏢</div>
            <div><h3 style="margin:0;font-size:16px;">Portal RH</h3><small style="color:var(--rh-text-subtle);">Gestão de Vencimentos</small></div>
        </div>

        <div id="sidebar-aviso-admin" style="display:none;margin-bottom:14px;padding:8px 10px;background:rgba(255,255,255,0.1);border:1px solid var(--rh-accent);border-radius:6px;font-size:11px;color:var(--rh-accent);text-align:center;">
            ⚠ Modo Admin — a ver empresa de outro utilizador
        </div>

        <nav style="flex:1;">${nav}</nav>

        <div style="border-top:1px solid rgba(255,255,255,0.12);padding-top:12px;margin-top:12px;">
            <div id="sidebar-empresa-nome" style="color:rgba(255,255,255,0.55);font-size:11px;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
            <div style="display:flex;gap:8px;font-size:11px;">
                <a href="#" onclick="window.router.navigate('empresas');return false;" style="color:var(--rh-accent);text-decoration:none;">🔁 trocar empresa</a>
                <span style="color:rgba(255,255,255,0.3);">·</span>
                <a href="#" onclick="window._sidebarSair();return false;" style="color:rgba(255,255,255,0.55);text-decoration:none;">🚪 sair</a>
            </div>
        </div>
    </aside>`;
}

// Preenche os dados dinâmicos da sidebar já presente no DOM (nome da
// empresa, aviso de modo admin). Deve ser chamado dentro do init() de cada
// módulo operacional, depois de appContainer.innerHTML já conter a sidebar.
export async function initSidebar() {
    try {
        const [emp, admin] = await Promise.all([empresaAtiva(), isAdmin()]);
        const nomeEl = document.getElementById('sidebar-empresa-nome');
        if (nomeEl) nomeEl.textContent = emp ? emp.nome : '—';

        const avisoEl = document.getElementById('sidebar-aviso-admin');
        if (avisoEl) avisoEl.style.display = donoEmpresaAtiva() ? 'block' : 'none';

        // Atalho para a área de administração, visível só a quem é admin.
        if (admin) {
            const nav = document.querySelector('aside nav');
            if (nav && !document.getElementById('sidebar-link-admin')) {
                const btn = document.createElement('button');
                btn.id = 'sidebar-link-admin';
                btn.onclick = () => window.router.navigate('admin');
                btn.style.cssText = 'display:block;width:100%;text-align:left;background:none;color:var(--rh-accent);padding:10px;border:none;cursor:pointer;font-size:14px;border-radius:6px;margin-top:6px;font-weight:bold;';
                btn.textContent = '🛠️ Administração';
                nav.appendChild(btn);
            }
        }
    } catch (e) {
        console.warn('Erro ao preencher sidebar:', e);
    }
}

window._sidebarSair = async function() {
    if (!confirm('Terminar sessão?')) return;
    const { auth } = await import('../app.js');
    const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    const { limparEmpresaAtiva } = await import('./tenant.js');
    limparEmpresaAtiva();
    await signOut(auth);
};
