const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Conexão com Banco de Dados
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error('Erro ao conectar ao SQLite:', err);
    else {
        console.log('Conectado ao SQLite.');
        criarTabelas();
    }
});

function criarTabelas() {
    // Tabela Usuários
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        data_nascimento TEXT,
        categoria TEXT DEFAULT 'Geral',
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela Posts
    db.run(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        descricao TEXT,
        categoria TEXT,
        imagem_url TEXT,
        autor TEXT,
        curtidas INTEGER DEFAULT 0,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela Comentários (NOVA)
    db.run(`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER,
        texto TEXT NOT NULL,
        autor TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(post_id) REFERENCES posts(id)
    )`);
}

// --- ROTAS USUÁRIO ---
app.post('/register', async (req, res) => {
    const { nome, email, senha, data_nascimento } = req.body;
    try {
        const hashSenha = await bcrypt.hash(senha, 10);
        db.run(`INSERT INTO users (nome, email, senha, data_nascimento) VALUES (?, ?, ?, ?)`, 
            [nome, email, hashSenha, data_nascimento], 
            function(err) {
                if (err) return res.status(400).json({ message: "Erro ao cadastrar." });
                res.status(201).json({ message: "Usuário criado!", id: this.lastID });
            }
        );
    } catch (e) { res.status(500).json({ message: "Erro interno." }); }
});

app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (!user || !(await bcrypt.compare(senha, user.senha))) {
            return res.status(401).json({ message: "Email ou senha inválidos." });
        }
        res.json({ message: "Login OK", user: { id: user.id, nome: user.nome } });
    });
});

// --- ROTAS DE POSTS ---

// 1. Criar Post
app.post('/posts', (req, res) => {
    const { titulo, descricao, categoria, imagem_url, autor } = req.body;
    db.run(`INSERT INTO posts (titulo, descricao, categoria, imagem_url, autor) VALUES (?, ?, ?, ?, ?)`, 
        [titulo, descricao, categoria, imagem_url, autor], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Post criado!", id: this.lastID });
    });
});

// 2. Listar Posts
app.get('/posts', (req, res) => {
    db.all(`SELECT * FROM posts ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// --- NOVAS ROTAS (INTERAÇÃO) ---

// 3. Dar Like
app.post('/posts/:id/like', (req, res) => {
    const id = req.params.id;
    db.run(`UPDATE posts SET curtidas = curtidas + 1 WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        // Retorna o novo número de curtidas
        db.get(`SELECT curtidas FROM posts WHERE id = ?`, [id], (err, row) => {
            res.json({ curtidas: row.curtidas });
        });
    });
});

// 4. Comentar
app.post('/posts/:id/comments', (req, res) => {
    const post_id = req.params.id;
    const { texto, autor } = req.body;
    db.run(`INSERT INTO comments (post_id, texto, autor) VALUES (?, ?, ?)`, [post_id, texto, autor], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Comentário adicionado", id: this.lastID });
    });
});

// 5. Ler Comentários de um Post
app.get('/posts/:id/comments', (req, res) => {
    const post_id = req.params.id;
    db.all(`SELECT * FROM comments WHERE post_id = ? ORDER BY id ASC`, [post_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.get('/users/:id', (req, res) => {
    const id = req.params.id;
    db.get(`SELECT id, nome, email, categoria, criado_em FROM users WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: "Usuário não encontrado" });
        res.json(row);
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});