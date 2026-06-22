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
const SUBCOLECOES_EMPRESA = ['funcionarios', 'ausencias', 'backups', 'configuracoes', 'alertas_dashboard', 'processamentos'];

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

// ─── Registo de utilizadores (para a área de Administração) ──────────────────
// Mantém um documento utilizadores/{uid} com o email, para o admin poder
// listar e identificar utilizadores por email (e não só pelo uid). É
// preenchido automaticamente em cada login (ver app.js). Utilizadores
// antigos só aparecem depois de voltarem a entrar uma vez.
export async function registarUtilizador(uid, email) {
    try {
        await setDoc(doc(db, 'utilizadores', uid), {
            email: email || '',
            ultimoLogin: new Date().toISOString(),
        }, { merge: true });
    } catch (e) {
        // Não crítico: se falhar, o admin vê o uid em vez do email.
        console.warn('Não foi possível registar o utilizador:', e);
    }
}

export async function listarUtilizadores() {
    const snap = await getDocs(collection(db, 'utilizadores'));
    const lista = [];
    snap.forEach(d => lista.push({ uid: d.id, ...d.data() }));
    return lista;
}

// ─── Transferir uma empresa de um utilizador para outro (admin) ──────────────
// O Firestore não tem "mover": copia-se a empresa + subcoleções para o novo
// dono e só depois se apaga o original. Só funciona para administradores
// (as regras do Firestore bloqueiam para os restantes).
export async function transferirEmpresa(empresaId, uidOrigem, uidDestino) {
    if (!uidDestino) throw new Error('Utilizador de destino não indicado.');
    if (uidOrigem === uidDestino) throw new Error('A empresa já pertence a esse utilizador.');

    const refOrigem = doc(db, 'utilizadores', uidOrigem, 'empresas', empresaId);
    const snap = await getDoc(refOrigem);
    if (!snap.exists()) throw new Error('Empresa não encontrada.');
    const dadosEmpresa = snap.data();

    const refDestino = doc(db, 'utilizadores', uidDestino, 'empresas', empresaId);

    // 1. Copiar o documento da empresa.
    await setDoc(refDestino, dadosEmpresa);

    // 2. Copiar todas as subcoleções.
    for (const nome of SUBCOLECOES_EMPRESA) {
        const subSnap = await getDocs(collection(refOrigem, nome));
        for (const d of subSnap.docs) {
            await setDoc(doc(refDestino, nome, d.id), d.data());
        }
    }

    // 3. Apagar o original (subcoleções + documento).
    for (const nome of SUBCOLECOES_EMPRESA) {
        const subSnap = await getDocs(collection(refOrigem, nome));
        for (const d of subSnap.docs) await deleteDoc(d.ref);
    }
    await deleteDoc(refOrigem);

    // Se o admin tinha esta empresa ativa, limpar a seleção.
    if (empresaAtivaId() === empresaId) limparEmpresaAtiva();

    return dadosEmpresa;
}

// ─── Eliminar um utilizador (admin) ──────────────────────────────────────────
// Apaga TODOS os dados do utilizador (todas as empresas e respetivas
// subcoleções) e o seu documento de registo. NÃO apaga a conta de
// Authentication (login) — isso exige o Admin SDK no servidor. Devolve o
// número de empresas removidas.
export async function eliminarUtilizador(uid) {
    const empresasSnap = await getDocs(collection(db, 'utilizadores', uid, 'empresas'));
    let nEmpresas = 0;
    for (const empDoc of empresasSnap.docs) {
        const ref = empDoc.ref;
        for (const nome of SUBCOLECOES_EMPRESA) {
            const subSnap = await getDocs(collection(ref, nome));
            for (const d of subSnap.docs) await deleteDoc(d.ref);
        }
        await deleteDoc(ref);
        nEmpresas++;
    }
    // Documento de registo do utilizador (pode não existir).
    try { await deleteDoc(doc(db, 'utilizadores', uid)); } catch (e) { /* ignorar */ }
    return nEmpresas;
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
