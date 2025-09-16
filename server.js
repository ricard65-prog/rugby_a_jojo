const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.use(session({
    secret: 'monSecretSuperSecurise',
    resave: false,
    saveUninitialized: false
}));

// --------------------- UTILS JSON ---------------------------
function readJSON(filename) {
    return JSON.parse(fs.readFileSync(filename, 'utf-8'));
}
function writeJSON(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

const USERS_FILE = './users.json';
const VIDEOS_FILE = './videos.json';

// ------------------- MIDDLEWARES AUTH -----------------------
function isAuthenticated(req, res, next) {
    if (req.session && req.session.email && req.session.role && req.session.statut === "actif") return next();
    res.redirect('/login');
}

function isAdmin(req, res, next) {
    if (req.session.role === "admin") return next();
    res.status(403).send("Accès interdit");
}

// --------------------- ROUTES -------------------------------

// --- Page d'accueil (redirection) ---
app.get('/', (req, res) => res.redirect('/login'));

// --- Authentification ---
app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.email === email);

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.render('login', { error: 'Email ou mot de passe incorrect.' });
    }
    if (user.statut !== "actif") {
        return res.render('login', { error: "Compte inactif. Contactez l'administrateur." });
    }
    req.session.email = user.email;
    req.session.role = user.role;
    req.session.statut = user.statut;
    return res.redirect('/videos');
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// --- Création de compte ---
app.get('/register', (req, res) => res.render('register', { error: null }));
app.post('/register', (req, res) => {
    const { email, password } = req.body;
    const users = readJSON(USERS_FILE);
    if (users.find(u => u.email === email)) {
        return res.render('register', { error: "Email déjà utilisé." });
    }
    const hashedPwd = bcrypt.hashSync(password, 10);
    users.push({ email, password: hashedPwd, statut: "inactif", role: "joueur" });
    writeJSON(USERS_FILE, users);
    res.redirect('/login');
});

// --- Page de vidéos (joueur + admin) ---
app.get('/videos', isAuthenticated, (req, res) => {
    const videos = readJSON(VIDEOS_FILE);
    // Grouper les vidéos par zone pour l’affichage rugby
    const zones = ["en-but gauche", "22m gauche", "40m gauche", "50m", "40m droit", "22m droit", "en-but droit"];
    const videosByZone = {};
    zones.forEach(zone => {
        videosByZone[zone] = videos.filter(v => v.zone === zone);
    });
    res.render('videos', { videosByZone, isAdmin: req.session.role === "admin", email: req.session.email });
});

// --- Section Admin : gestion des comptes ---
app.get('/admin/users', isAuthenticated, isAdmin, (req, res) => {
    const users = readJSON(USERS_FILE);
    res.render('admin_users', { users });
});
app.post('/admin/user/toggle', isAuthenticated, isAdmin, (req, res) => {
    const { email } = req.body;
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.email === email);
    if (user) user.statut = (user.statut === "actif" ? "inactif" : "actif");
    writeJSON(USERS_FILE, users);
    res.redirect('/admin/users');
});

// --- Section Admin : gestion des vidéos ---
app.get('/admin/videos', isAuthenticated, isAdmin, (req, res) => {
    const videos = readJSON(VIDEOS_FILE);
    res.render('admin_videos', { videos });
});
app.post('/admin/videos/add', isAuthenticated, isAdmin, (req, res) => {
    const { zone, titre, commentaire, url } = req.body;
    const videos = readJSON(VIDEOS_FILE);
    videos.push({ zone, titre, commentaire, url });
    writeJSON(VIDEOS_FILE, videos);
    res.redirect('/admin/videos');
});
app.post('/admin/videos/delete', isAuthenticated, isAdmin, (req, res) => {
    const { url } = req.body;
    let videos = readJSON(VIDEOS_FILE);
    videos = videos.filter(v => v.url !== url);
    writeJSON(VIDEOS_FILE, videos);
    res.redirect('/admin/videos');
});
app.post('/admin/videos/edit', isAuthenticated, isAdmin, (req, res) => {
    const { oldUrl, zone, titre, commentaire, url } = req.body;
    let videos = readJSON(VIDEOS_FILE);
    const idx = videos.findIndex(v => v.url === oldUrl);
    if (idx !== -1) {
        videos[idx] = { zone, titre, commentaire, url };
        writeJSON(VIDEOS_FILE, videos);
    }
    res.redirect('/admin/videos');
});

app.listen(PORT, () => console.log(`Serveur lancé sur http://localhost:${PORT}`));