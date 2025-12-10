const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Caminho para o seu arquivo .db (o real banco SQLite)
const DB_FILE = path.join(__dirname, "database.db");

// Se não existir, cria o banco e popula com seu script SQL
if (!fs.existsSync(DB_FILE)) {
    console.log("Criando banco a partir do script enviado...");

    const scriptSQL = `
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    data_cadastro TEXT DEFAULT (datetime('now'))
    data_nascimento TEXT
);

CREATE TABLE IF NOT EXISTS ideias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    imagem TEXT,
    etapas TEXT,
    custo_estimado REAL,
    divulgacao TEXT,
    tags TEXT,
    categoria TEXT
);

CREATE TABLE IF NOT EXISTS ideias_salvas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL,
    id_ideia INTEGER NOT NULL,
    data_salva TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id),
    FOREIGN KEY (id_ideia) REFERENCES ideias(id)
);

CREATE TABLE IF NOT EXISTS planos_semanais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    progresso INTEGER DEFAULT 0,
    data_inicio TEXT DEFAULT (datetime('now')),
    data_fim TEXT,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS conteudos_aprendizado (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    texto TEXT NOT NULL,
    imagem TEXT,
    categoria TEXT
);

CREATE TABLE IF NOT EXISTS conquistas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    icone TEXT
);

CREATE TABLE IF NOT EXISTS conquistas_usuario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL,
    id_conquista INTEGER NOT NULL,
    data_conquista TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id),
    FOREIGN KEY (id_conquista) REFERENCES conquistas(id)
);

CREATE TABLE IF NOT EXISTS mentor_ia_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL,
    entrada_usuario TEXT NOT NULL,
    resposta_ia TEXT,
    data_interacao TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS compartilhamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    texto TEXT NOT NULL,
    autor TEXT,
    data_criacao TEXT DEFAULT (datetime('now'))
);
`;

    const memdb = new sqlite3.Database(DB_FILE);
    memdb.exec(scriptSQL, (err) => {
        if (err) console.error("Erro ao inicializar DB:", err.message);
        memdb.close();
    });
}

// abre DB
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        console.error("Erro ao abrir DB:", err.message);
        process.exit(1);
    }
    console.log("DB aberto em", DB_FILE);
});

// ======================================
// SALVAR IDEIA SIMPLES (PEDIDO DO FRONT)
// ======================================
app.post("/ideias", (req, res) => {
    const { texto, titulo, imagem = null, etapas = null, custo_estimado = null, divulgacao = null, tags = null, categoria = null } = req.body;
    const toInsert = texto || titulo;
    if (!toInsert || !toInsert.trim()) return res.json({ success: false, error: "Texto/título vazio." });

    const sql = `
        INSERT INTO ideias (titulo, imagem, etapas, custo_estimado, divulgacao, tags, categoria)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(sql, [toInsert.trim(), imagem, etapas, custo_estimado, divulgacao, tags, categoria || null], function (err) {
        if (err) return res.json({ success: false, error: err.message });
        return res.json({ success: true, id: this.lastID, titulo: toInsert.trim() });
    });
});

// ==========================
// LISTAR TODAS AS IDEIAS
// ==========================
app.get("/ideias", (req, res) => {
    db.all("SELECT * FROM ideias ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.json({ success: false, error: err.message });
        res.json(rows);
    });
});

// aliases com /api para compatibilidade com front-end que usa /api/ideias
app.post("/api/ideias", (req, res) => app._router.handle(req, res, () => {}, "POST", "/ideias"));
app.get("/api/ideias", (req, res) => app._router.handle(req, res, () => {}, "GET", "/ideias"));

// ---------------------------------
// NOVOS ENDPOINTS COMPARTILHAMENTOS
// ---------------------------------
app.post("/compartilhamentos", (req, res) => {
    const { texto, autor = null } = req.body;
    if (!texto || !texto.trim()) return res.json({ success: false, error: "Texto vazio." });

    const sql = `
        INSERT INTO compartilhamentos (texto, autor)
        VALUES (?, ?)
    `;
    db.run(sql, [texto.trim(), autor], function (err) {
        if (err) return res.json({ success: false, error: err.message });
        return res.json({ success: true, id: this.lastID, texto: texto.trim() });
    });
});

app.get("/compartilhamentos", (req, res) => {
    db.all("SELECT * FROM compartilhamentos ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.json({ success: false, error: err.message });
        res.json(rows);
    });
});

// aliases /api/compartilhamentos
app.post("/api/compartilhamentos", (req, res) => app._router.handle(req, res, () => {}, "POST", "/compartilhamentos"));
app.get("/api/compartilhamentos", (req, res) => app._router.handle(req, res, () => {}, "GET", "/compartilhamentos"));

// ==========================
// START SERVER
// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API funcional rodando em http://localhost:${PORT}`);
});
