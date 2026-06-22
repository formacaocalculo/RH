// assets/js/modules/tenant.js
// ============================================================
//  Motor de multi-empresa (multi-tenant) do Portal RH.
//
//  Estrutura no Firestore:
//    utilizadores/{uid}/empresas/{empresaId}
//    utilizadores/{uid}/empresas/{empresaId}/funcionarios/{id}
//    utilizadores/{uid}/empresas/{empresaId}/ausencias/{funcId}
//    utilizadores/{uid}/empresas/{empresaId}/backups/{id}
//    utilizadores/{uid}/empresas/{empresaId}/configuracoes/empresa_base
//    utilizadores/{uid}/empresas/{empresaId}/alertas_dashboard/{id}
//
//  admins/{uid}            -> só leitura pelo próprio; escrita sempre bloqueada
//                              via app (atribuído manualmente na consola Firebase)
//  lixeiraEmpresas/{id}    -> backups de empresas inteiras eliminadas; só admins
//
//  Cada utilizador autenticado é "dono" das suas próprias empresas e pode ter
//  várias. Ser administrador é apenas uma característica adicional (flag em
//  admins/{uid}) que dá acesso a uma área de Administração com visão sobre
//  todas as empresas de todos os utilizadores — não é um tipo de conta
//  separado nem altera o que a pessoa vê por defeito ao entrar.
// ============================================================

import { auth, db } from '../app.js';
import {
    doc, getDoc, setDoc, updateDoc, deleteDoc, collection, collectionGroup, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const ACTIVE_KEY   = 'rh_empresa_ativa';        // id da empresa ativa
const ACTIVE_OWNER = 'rh_empresa_ativa_dono';   // uid do dono, quando um admin "entrou" na empresa de outro

// ─── Identidade própria ─────────────────────────────────────────────────────
function uidProprio() {
    const user = auth.currentUser;
    if (!user) throw new Error('Utilizador não autenticado.');
    return user.uid;
}

// uid "dono" dos dados a usar nas leituras/escritas: normalmente o próprio
// utilizador, mas se um admin tiver "entrado" na empresa de outra pessoa
// (ver entrarNaEmpresa), passa a ser o uid dessa pessoa.
function uidUtilizador() {
    const dono = localStorage.getItem(ACTIVE_OWNER);
    return dono || uidProprio();
}

export function donoEmpresaAtiva() {
    return localStorage.getItem(ACTIVE_OWNER) || null; // null = é o próprio utilizador
}

// ─── Administração ──────────────────────────────────────────────────────────
let _isAdminCache = null;
export async function isAdmin() {
    if (_isAdminCache !== null) return _isAdminCache;
    try {
        const uid = uidProprio();
        const snap = await getDoc(doc(db, 'admins', uid));
        _isAdminCache = snap.exists();
    } catch (e) {
        _isAdminCache = false; // se as regras bloquearem, assume que não é admin
    }
    return _isAdminCache;
}

function invalidarCacheAdmin() {
    _isAdminCache = null;
}

// Verifica, SEM usar cache, se o utilizador atualmente autenticado é admin.
// Necessário em fluxos onde acabámos de trocar de sessão (ex.: validar as
// credenciais de um admin antes de criar uma conta nova).
export async function confirmarAdminAtual() {
    const u = auth.currentUser;
    if (!u) return false;
    try {
        const snap = await getDoc(doc(db, 'admins', u.uid));
        return snap.exists();
    } catch (e) {
        return false;
    }
}

// Lista todas as empresas de todos os utilizadores (collection-group query).
// Só deve ser chamada depois de confirmar isAdmin() === true — as regras do
// Firestore bloqueiam de qualquer forma para não-admins.
export async function listarTodasEmpresasAdmin() {
    const snap = await getDocs(collectionGroup(db, 'empresas'));
    const lista = [];
    snap.forEach(d => {
        // path: utilizadores/{uid}/empresas/{empresaId}
        const partes = d.ref.path.split('/');
        const donoUid = partes[1];
        lista.push({ id: d.id, donoUid, ...d.data() });
    });
    return lista;
}

// ─── Caminhos Firestore (relativos ao dono ativo) ──────────────────────────
function empresasCol(uidAlvo) {
    const u = uidAlvo || uidUtilizador();
    return collection(db, 'utilizadores', u, 'empresas');
}
function empresaDoc(empresaId, uidAlvo) {
    const u = uidAlvo || uidUtilizador();
    return doc(db, 'utilizadores', u, 'empresas', empresaId);
}

// Caminho para uma subcoleção dentro da empresa ATIVA (ex.: 'funcionarios').
export function colEmpresa(nomeColecao) {
    const empresaId = empresaAtivaId();
    if (!empresaId) throw new Error('Nenhuma empresa ativa selecionada.');
    return collection(empresaDoc(empresaId), nomeColecao);
}

// Caminho para um documento dentro de uma subcoleção da empresa ATIVA.
export function docEmpresa(nomeColecao, docId) {
    const empresaId = empresaAtivaId();
    if (!empresaId) throw new Error('Nenhuma empresa ativa selecionada.');
    return doc(empresaDoc(empresaId), nomeColecao, docId);
}

// ─── Empresas do utilizador autenticado ─────────────────────────────────────
// Lista sempre as empresas do PRÓPRIO utilizador autenticado (não do "dono ativo").
export async function listarEmpresas() {
    const uidP = uidProprio();
    const snap = await getDocs(empresasCol(uidP));
    const lista = [];
    snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
    lista.sort((a, b) => (a.criadoEm || '').localeCompare(b.criadoEm || ''));
    return lista;
}

export function empresaAtivaId() {
    return localStorage.getItem(ACTIVE_KEY);
}

// donoUid é opcional: só necessário quando um admin está a entrar numa
// empresa que não é sua. Quando omitido, assume-se o próprio utilizador.
export function definirEmpresaAtiva(empresaId, donoUid) {
    localStorage.setItem(ACTIVE_KEY, empresaId);
    if (donoUid) {
        localStorage.setItem(ACTIVE_OWNER, donoUid);
    } else {
        localStorage.removeItem(ACTIVE_OWNER);
    }
}

export function limparEmpresaAtiva() {
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(ACTIVE_OWNER);
}

// Devolve o objeto completo da empresa ativa (id + dados base).
let _empresaAtivaCache = null;
export async function empresaAtiva() {
    const id = empresaAtivaId();
    if (!id) return null;
    if (_empresaAtivaCache && _empresaAtivaCache.id === id) return _empresaAtivaCache;
    const snap = await getDoc(empresaDoc(id));
    if (!snap.exists()) return null;
    _empresaAtivaCache = { id: snap.id, ...snap.data() };
    return _empresaAtivaCache;
}

function invalidarCacheEmpresaAtiva() {
    _empresaAtivaCache = null;
}

export async function criarEmpresa(dados) {
    const uidP = uidProprio();
    const col = empresasCol(uidP);
    const novaRef = doc(col); // gera id
    const nova = {
        nome: dados.nome,
        nif: dados.nif || '',
        morada: dados.morada || '',
        criadoEm: new Date().toISOString(),
        ativa: true,
    };
    await setDoc(novaRef, nova);
    return { id: novaRef.id, ...nova };
}

export async function editarEmpresa(empresaId, dados) {
    const ref = empresaDoc(empresaId);
    await updateDoc(ref, dados);
    const snap = await getDoc(ref);
    invalidarCacheEmpresaAtiva();
    return { id: snap.id, ...snap.data() };
}

// Elimina a empresa, mas só depois de copiar a empresa + todas as suas
// subcoleções para a coleção "lixeiraEmpresas" no topo da base de dados —
// permite restauro posterior pelo admin. uidAlvo permite ao admin eliminar
// empresas de outros utilizadores a partir da área de Administração.
const SUBCOLECOES_EMPRESA = ['funcionarios', 'ausencias', 'backups', 'configuracoes', 'alertas_dashboard'];

export async function eliminarEmpresa(empresaId, uidAlvo) {
    const uidDono = uidAlvo || uidUtilizador();
    const ref = empresaDoc(empresaId, uidDono);
    const snapEmpresa = await getDoc(ref);
    if (!snapEmpresa.exists()) return null;
    const dadosEmpresa = snapEmpresa.data();

    const dump = {};
    for (const nome of SUBCOLECOES_EMPRESA) {
        const subSnap = await getDocs(collection(ref, nome));
        dump[nome] = {};
        subSnap.forEach(d => { dump[nome][d.id] = d.data(); });
    }

    await setDoc(doc(db, 'lixeiraEmpresas', empresaId), {
        empresa: dadosEmpresa,
        donoUid: uidDono,
        dados: dump,
        eliminadaEm: new Date().toISOString(),
        eliminadaPor: auth.currentUser?.email || 'desconhecido',
    });

    // Apagar subcoleções e o documento da empresa
    for (const nome of SUBCOLECOES_EMPRESA) {
        const subSnap = await getDocs(collection(ref, nome));
        for (const d of subSnap.docs) await deleteDoc(d.ref);
    }
    await deleteDoc(ref);

    if (empresaAtivaId() === empresaId) limparEmpresaAtiva();
    return dadosEmpresa;
}

// ─── Mover empresa entre utilizadores (administração) ──────────────────────
// Transfere uma empresa inteira (documento + todas as subcoleções) de um
// utilizador para outro. Útil para o admin reatribuir empresas: das suas
// contas para utilizadores, de utilizadores para si, ou entre quaisquer dois
// utilizadores. As regras do Firestore só permitem isto a admins.
//
// Mantém o mesmo empresaId no destino (os ids do Firestore são únicos, pelo
// que não há colisão prática) para preservar referências e rastreabilidade.
export async function moverEmpresa(empresaId, uidOrigem, uidDestino) {
    if (!uidOrigem || !uidDestino) throw new Error('Utilizador de origem ou destino em falta.');
    if (uidOrigem === uidDestino) throw new Error('A empresa já pertence a esse utilizador.');

    const refOrigem = empresaDoc(empresaId, uidOrigem);
    const snapEmpresa = await getDoc(refOrigem);
    if (!snapEmpresa.exists()) throw new Error('Empresa não encontrada na origem.');
    const dadosEmpresa = snapEmpresa.data();

    // 1. Ler todas as subcoleções da origem
    const dump = {};
    for (const nome of SUBCOLECOES_EMPRESA) {
        const subSnap = await getDocs(collection(refOrigem, nome));
        dump[nome] = [];
        subSnap.forEach(d => dump[nome].push({ id: d.id, data: d.data() }));
    }

    // 2. Escrever no destino (documento da empresa + subcoleções)
    const refDestino = empresaDoc(empresaId, uidDestino);
    await setDoc(refDestino, dadosEmpresa);
    for (const nome of SUBCOLECOES_EMPRESA) {
        for (const item of dump[nome]) {
            await setDoc(doc(refDestino, nome, item.id), item.data);
        }
    }

    // 3. Só depois de o destino estar completo, apagar a origem
    for (const nome of SUBCOLECOES_EMPRESA) {
        const subSnap = await getDocs(collection(refOrigem, nome));
        for (const d of subSnap.docs) await deleteDoc(d.ref);
    }
    await deleteDoc(refOrigem);

    // 4. Se a empresa movida estava ativa neste cliente, limpar o contexto
    if (empresaAtivaId() === empresaId) limparEmpresaAtiva();

    return dadosEmpresa;
}

// ─── Perfis de utilizador (email associado a cada UID) ──────────────────────
// Os emails dos utilizadores vivem no Firebase Auth e não são consultáveis a
// partir do Firestore. Para a área de Administração poder mostrar o email ao
// lado do UID, guardamos um documento de perfil por utilizador em
// utilizadores/{uid} com o email. É escrito no login (ver app.js), pelo que
// utilizadores existentes passam a aparecer assim que voltam a entrar.
export async function guardarPerfilProprio() {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await setDoc(doc(db, 'utilizadores', user.uid), {
            email: user.email || '',
            atualizadoEm: new Date()
        }, { merge: true });
    } catch (e) {
        console.warn('[perfil] não foi possível guardar o perfil do utilizador:', e);
    }
}

// Lê os perfis de um conjunto de UIDs e devolve um objeto { uid: { email } }.
// Tolerante a perfis inexistentes (utilizadores que ainda não voltaram a
// entrar desde a introdução desta funcionalidade) — nesses casos o UID
// simplesmente não aparece no mapa e a interface mostra só o UID.
export async function obterPerfis(uids) {
    const unicos = [...new Set((uids || []).filter(Boolean))];
    const mapa = {};
    await Promise.all(unicos.map(async (uid) => {
        try {
            const snap = await getDoc(doc(db, 'utilizadores', uid));
            if (snap.exists()) mapa[uid] = snap.data();
        } catch (e) {
            /* silencioso: cai para mostrar apenas o UID */
        }
    }));
    return mapa;
}

// ─── Lixeira de empresas (administração) ────────────────────────────────────
export async function listarLixeiraEmpresas() {
    const snap = await getDocs(collection(db, 'lixeiraEmpresas'));
    const lista = [];
    snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
    return lista;
}

export async function restaurarEmpresaDaLixeira(empresaId) {
    const snap = await getDoc(doc(db, 'lixeiraEmpresas', empresaId));
    if (!snap.exists()) return null;
    const item = snap.data();
    const uidDono = item.donoUid;

    const ref = empresaDoc(empresaId, uidDono);
    await setDoc(ref, item.empresa);

    for (const nome of SUBCOLECOES_EMPRESA) {
        const registos = item.dados?.[nome] || {};
        for (const [id, dados] of Object.entries(registos)) {
            await setDoc(doc(ref, nome, id), dados);
        }
    }

    await deleteDoc(doc(db, 'lixeiraEmpresas', empresaId));
    return item.empresa;
}

export async function eliminarDaLixeiraDefinitivo(empresaId) {
    await deleteDoc(doc(db, 'lixeiraEmpresas', empresaId));
}

// ─── "Entrar" na empresa de outro utilizador (suporte administrativo) ─────
// Não requer (nem nunca vê) a password de ninguém: o admin só passa a operar
// com o uid do dono real como contexto de leitura/escrita, sempre dentro do
// que as regras do Firestore permitem a um admin.
export async function entrarNaEmpresa(empresaId, donoUid) {
    definirEmpresaAtiva(empresaId, donoUid);
    invalidarCacheEmpresaAtiva();
}

export function sairDoModoAdmin() {
    const id = empresaAtivaId();
    localStorage.removeItem(ACTIVE_OWNER);
    invalidarCacheEmpresaAtiva();
}

export function reset() {
    invalidarCacheAdmin();
    invalidarCacheEmpresaAtiva();
}
