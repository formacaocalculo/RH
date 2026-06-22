// assets/js/router.js

let _currentModule = null;

// Módulos que não dependem de sessão (login) ou de uma empresa ativa
// selecionada (empresas, admin). Todos os outros são "operacionais": só
// fazem sentido depois de saber a que empresa os dados pertencem.
const MODULOS_PUBLICOS = new Set(['login']);
const MODULOS_SEM_EMPRESA = new Set(['login', 'empresas', 'admin']);

export async function navigate(moduleName) {
    const appContainer = document.getElementById('app');
    try {
        if (!MODULOS_PUBLICOS.has(moduleName)) {
            const { auth, authReady } = await import('./app.js');
            await authReady;
            if (!auth.currentUser) {
                if (moduleName !== 'login') { await navigate('login'); return; }
            } else if (!MODULOS_SEM_EMPRESA.has(moduleName)) {
                const tenant = await import('./modules/tenant.js');
                if (!tenant.empresaAtivaId()) {
                    await navigate('empresas');
                    return;
                }
            }
        }

        const module = await import(`./modules/${moduleName}.js`);
        _currentModule = moduleName;
        appContainer.innerHTML = module.render();
        if (typeof module.init === 'function') {
            await module.init();
        }
    } catch (error) {
        console.error("Erro ao carregar o módulo:", error);
        appContainer.innerHTML = `<div style="padding:40px;font-family:sans-serif;color:#ef4444;">
            <h2>Página não encontrada</h2>
            <button onclick="window.router.navigate('dashboard')" style="margin-top:16px;padding:10px 20px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer;">
                ← Voltar ao Dashboard
            </button>
        </div>`;
    }
}

// Chamado a partir de app.js sempre que o estado de autenticação confirma um
// utilizador válido (login feito ou sessão restaurada). Decide entre ir para
// a escolha de empresa ou diretamente para o dashboard, sem duplicar esta
// lógica também dentro de cada módulo.
export async function navigateAposLogin() {
    const tenant = await import('./modules/tenant.js');

    let empresas = [];
    try {
        empresas = await tenant.listarEmpresas();
    } catch (e) {
        console.warn('[router] não foi possível listar empresas:', e);
    }

    // Se a empresa "ativa" guardada já não pertence a este utilizador (ex.:
    // sobra de uma sessão anterior ou de outra conta no mesmo browser), limpa-a
    // para não entrar numa empresa errada.
    const ativaId = tenant.empresaAtivaId();
    const ativaValida = !!ativaId && empresas.some(e => e.id === ativaId);
    if (ativaId && !ativaValida) tenant.limparEmpresaAtiva();

    if (ativaValida) {
        // Recarregar a página mantém o utilizador na empresa onde estava.
        await navigate('dashboard');
    } else if (empresas.length === 1) {
        // Uma única empresa: entra logo, sem obrigar a escolher.
        tenant.definirEmpresaAtiva(empresas[0].id);
        await navigate('dashboard');
    } else {
        // Nenhuma (para criar a primeira) OU várias (para escolher qual usar):
        // mostra sempre a lista "As Minhas Empresas".
        await navigate('empresas');
    }
}

// Volta sempre ao dashboard
export function goBack() {
    navigate('dashboard');
}

window.router = { navigate, goBack, navigateAposLogin };
