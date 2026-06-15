// assets/js/router.js

const sidebar = document.getElementById('sidebar');
const btnClose = document.getElementById('btn-close');
const content = document.getElementById('content');

export const navigate = async (moduleName) => {
    try {
        // 1. Ocultar menu e mostrar botão de voltar
        sidebar.classList.add('hidden'); 
        btnClose.style.display = 'block';

        // 2. Carregar o módulo dinamicamente
        // O caminho pressupõe que estás a usar uma estrutura de servidor local (ex: Live Server)
        const module = await import(`./modules/${moduleName}.js`);

        // 3. Limpar conteúdo atual e injetar o HTML do módulo
        content.innerHTML = ''; // Limpa o container
        if (typeof module.render === 'function') {
            content.innerHTML = module.render(); 
        } else {
            content.innerHTML = `<h1>Erro</h1><p>O módulo ${moduleName} não possui uma função 'render()'.</p>`;
        }
    } catch (error) {
        console.error("Erro ao carregar módulo:", error);
        content.innerHTML = `<h1>Erro</h1><p>Não foi possível carregar o módulo: ${moduleName}</p>`;
    }
};

export const goBack = () => {
    // 1. Reverter visibilidade do menu e botão
    sidebar.classList.remove('hidden');
    btnClose.style.display = 'none';
    
    // 2. Voltar à página inicial (Dashboard)
    content.innerHTML = "<h1>Dashboard</h1><p>Bem-vindo de volta ao sistema.</p>";
};
