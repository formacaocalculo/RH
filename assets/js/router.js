
// assets/js/router.js

export async function navigate(moduleName) {
    const appContainer = document.getElementById('app');
    try {
        const module = await import(`./modules/${moduleName}.js`);
        appContainer.innerHTML = module.render();
        if (typeof module.init === 'function') {
            module.init();
        }
    } catch (error) {
        console.error("Erro ao carregar o módulo:", error);
        appContainer.innerHTML = "<h1>404 - Página não encontrada</h1>";
    }
}

// ADICIONA ISTO: Torna a função global
window.router = { navigate };