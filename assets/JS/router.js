// assets/js/router.js

let _currentModule = null;

export async function navigate(moduleName) {
    const appContainer = document.getElementById('app');
    try {
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

// Volta sempre ao dashboard
export function goBack() {
    navigate('dashboard');
}

window.router = { navigate, goBack };
