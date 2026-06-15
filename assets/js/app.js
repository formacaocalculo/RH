// assets/js/app.js

// Importamos todas as funções do router.js
import * as router from './router.js';

// Tornamos as funções do router acessíveis globalmente no navegador
// para que o onclick="..." no HTML as consiga encontrar.
window.router = router;

// Aqui podes adicionar lógica de inicialização da app (ex: verificar autenticação)
document.addEventListener('DOMContentLoaded', () => {
    console.log("Portal RH iniciado.");
    // Exemplo: router.navigate('dashboard');
});
