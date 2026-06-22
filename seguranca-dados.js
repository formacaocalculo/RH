// assets/js/modules/seguranca-dados.js
// Módulo transversal usado por todos os outros módulos para:
//   1. Reautenticar o utilizador (email + password) antes de qualquer eliminação.
//   2. Gravar uma cópia do registo eliminado em Firestore (coleção "backups"),
//      para permitir reposição posterior a partir do ecrã "Lixo / Repor Dados".
//   3. Oferecer download imediato do registo eliminado como ficheiro .json.
//
// Uso típico noutro módulo:
//   import { eliminarComBackup } from './seguranca-dados.js';
//   await eliminarComBackup({
//       colecao: 'funcionarios',
//       docId: id,
//       dados: funcionarioCompleto,
//       tipo: 'funcionario',
//       descricao: `Funcionário: ${funcionarioCompleto.nome}`,
//       aoConcluir: () => { ...atualizar UI... }
//   });

import { auth } from '../app.js';
import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { colEmpresa, docEmpresa } from './tenant.js';

// ─── Modal de reautenticação ───────────────────────────────────────────────
// Devolve uma Promise<boolean>: true se a password foi confirmada com sucesso.
// Exportada para ser reutilizada por outros fluxos sensíveis fora deste
// módulo (ex.: eliminação de uma empresa inteira em empresas.js), que não
// seguem o padrão "registo dentro de uma empresa + backup automático".
export function pedirReautenticacao(mensagem) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.id = 'seg-overlay';
        overlay.style.cssText = `
            position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:9999;
            display:flex;align-items:center;justify-content:center;font-family:sans-serif;`;
        overlay.innerHTML = `
            <div style="background:var(--rh-bg-card);border-radius:12px;padding:28px;width:100%;max-width:380px;box-shadow:0 12px 32px rgba(0,0,0,0.25);">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                    <div style="width:38px;height:38px;border-radius:9px;background:var(--rh-danger-bg);display:flex;align-items:center;justify-content:center;font-size:18px;">🔒</div>
                    <h3 style="margin:0;font-size:16px;color:var(--rh-text);">Confirmar Identidade</h3>
                </div>
                <p style="margin:0 0 16px;font-size:13px;color:var(--rh-text-muted);">${mensagem || 'Esta ação elimina dados permanentemente. Introduza a sua password para confirmar.'}</p>
                <div style="margin-bottom:10px;">
                    <label style="display:block;margin-bottom:4px;font-size:12px;color:var(--rh-text-muted);">Email</label>
                    <input type="email" id="seg-email" value="${auth.currentUser?.email || ''}" readonly
                        style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;background:var(--rh-bg-muted);color:var(--rh-text-muted);">
                </div>
                <div style="margin-bottom:8px;">
                    <label style="display:block;margin-bottom:4px;font-size:12px;color:var(--rh-text-muted);">Password</label>
                    <input type="password" id="seg-password"
                        style="width:100%;padding:9px;border:1px solid var(--rh-border);border-radius:6px;font-size:13px;box-sizing:border-box;">
                </div>
                <p id="seg-erro" style="display:none;color:var(--rh-danger);font-size:12px;margin:4px 0 12px;"></p>
                <div style="display:flex;gap:8px;margin-top:16px;">
                    <button id="seg-cancelar" style="flex:1;background:var(--rh-bg-muted);color:var(--rh-text-muted);border:1px solid var(--rh-border);padding:10px;border-radius:6px;cursor:pointer;font-size:13px;">Cancelar</button>
                    <button id="seg-confirmar" style="flex:1;background:var(--rh-danger);color:#fff;border:none;padding:10px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;">Confirmar e Eliminar</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const inputPwd = overlay.querySelector('#seg-password');
        const erroEl = overlay.querySelector('#seg-erro');
        const btnConfirmar = overlay.querySelector('#seg-confirmar');
        const btnCancelar = overlay.querySelector('#seg-cancelar');

        inputPwd.focus();

        function fechar(resultado) {
            overlay.remove();
            resolve(resultado);
        }

        btnCancelar.addEventListener('click', () => fechar(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(false); });

        async function tentarConfirmar() {
            const password = inputPwd.value;
            if (!password) {
                erroEl.textContent = 'Introduza a sua password.';
                erroEl.style.display = 'block';
                return;
            }
            const email = auth.currentUser?.email;
            if (!email) {
                erroEl.textContent = 'Sessão inválida. Inicie sessão novamente.';
                erroEl.style.display = 'block';
                return;
            }
            btnConfirmar.disabled = true;
            btnConfirmar.textContent = 'A verificar…';
            window._suprimirRedirecionoAuth = true;
            try {
                // Reautentica: se a password estiver errada, isto rejeita.
                await signInWithEmailAndPassword(auth, email, password);
                fechar(true);
            } catch (e) {
                erroEl.textContent = 'Password incorreta. Tente novamente.';
                erroEl.style.display = 'block';
                btnConfirmar.disabled = false;
                btnConfirmar.textContent = 'Confirmar e Eliminar';
            } finally {
                // Pequeno atraso antes de voltar a permitir redirecionamentos automáticos,
                // para garantir que o evento onAuthStateChanged já foi processado.
                setTimeout(() => { window._suprimirRedirecionoAuth = false; }, 500);
            }
        }

        btnConfirmar.addEventListener('click', tentarConfirmar);
        inputPwd.addEventListener('keydown', (e) => { if (e.key === 'Enter') tentarConfirmar(); });
    });
}

// ─── Download do registo eliminado como .json ──────────────────────────────
function descarregarJson(filename, dataObj) {
    const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function slugify(txt) {
    return (txt || 'registo')
        .toString()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .toLowerCase()
        .slice(0, 40);
}

// ─── Função principal: eliminar com backup ─────────────────────────────────
// opcoes = {
//   colecao: string         (coleção Firestore de onde o doc será apagado)
//   docId: string            (id do documento a apagar)
//   dados: object            (snapshot completo dos dados a preservar no backup)
//   tipo: string              (rótulo do tipo de registo: 'funcionario', 'ausencia', 'filho', ...)
//   descricao: string         (texto legível para identificar o registo na lixeira)
//   subcampo: { campo, valor } (opcional: quando se apaga um item dentro de um array,
//                                em vez de apagar o doc todo — ex: um filho dentro de funcionarios.filhos)
//   mensagemConfirmacao: string (opcional, texto do modal)
//   aoConcluir: function       (callback chamado após sucesso)
// }
export async function eliminarComBackup(opcoes) {
    const {
        colecao, docId, dados, tipo, descricao, subcampo,
        mensagemConfirmacao, aoConcluir, onUpdateDoc,
    } = opcoes;

    const ok = await pedirReautenticacao(mensagemConfirmacao);
    if (!ok) return false;

    const backupId = `${colecao}_${docId}_${Date.now()}`;
    const backupRecord = {
        id: backupId,
        colecaoOrigem: colecao,
        docIdOrigem: docId,
        tipo: tipo || colecao,
        descricao: descricao || docId,
        dados,
        subcampo: subcampo || null,
        eliminadoEm: new Date().toISOString(),
        eliminadoPor: auth.currentUser?.email || 'desconhecido',
        restaurado: false,
    };

    try {
        // 1. Gravar backup no Firestore (coleção "backups", dentro da empresa ativa)
        await setDoc(docEmpresa('backups', backupId), backupRecord);

        // 2. Aplicar a eliminação real:
        //    - se for um subcampo (ex: um filho dentro do array de um funcionário), o módulo
        //      chamador faz a atualização via onUpdateDoc (updateDoc com o array já filtrado).
        //    - caso contrário, apaga o documento Firestore inteiro (dentro da empresa ativa).
        if (typeof onUpdateDoc === 'function') {
            await onUpdateDoc();
        } else {
            await deleteDoc(docEmpresa(colecao, docId));
        }

        // 3. Oferecer download imediato do .json
        descarregarJson(`backup_${slugify(tipo)}_${slugify(descricao)}_${Date.now()}.json`, backupRecord);

        if (typeof aoConcluir === 'function') await aoConcluir();
        return true;
    } catch (e) {
        alert('Erro ao eliminar: ' + e.message);
        return false;
    }
}

// Exposto globalmente para ser chamado diretamente de onclick="" inline no HTML dos módulos
window._segEliminarComBackup = eliminarComBackup;
