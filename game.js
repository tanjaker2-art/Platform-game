const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let frame = 0;
let score = 0;
let gameSpeed = 5;
let isGameOver = false;
let isPlaying = false;
let obstacles = [];
let bonuses = []; // New: Bonuses array

// Input Handling
const keys = {};

window.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (!isPlaying && !isGameOver) {
        // Start game
        if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code) || true) {
            isPlaying = true;
            document.getElementById('start-screen').classList.remove('active');
            gameLoop();
        }
    } else if (isGameOver) {
        if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Enter'].includes(e.code)) {
            resetGame();
        }
    }
});

window.addEventListener('keyup', function (e) {
    keys[e.code] = false;
});

// Player Class
class Player {
    constructor() {
        this.width = 40;
        this.height = 40;
        this.x = 100;
        this.y = 200;
        this.dy = 0;
        this.jumpForce = 13;
        this.originalHeight = 40;
        this.grounded = false;
        this.color = '#4CAF50';
        this.speed = 5;
    }

    update() {
        // Jump
        if ((keys['Space'] || keys['KeyW']) && this.grounded) {
            this.dy = -this.jumpForce;
            this.grounded = false;
        }

        // Duck
        if (keys['KeyS'] || keys['ArrowDown']) {
            this.height = this.originalHeight / 2;
        } else {
            this.height = this.originalHeight;
        }

        // Horizontal Movement (WASD)
        if (keys['KeyA'] || keys['ArrowLeft']) {
            this.x -= this.speed;
        }
        if (keys['KeyD'] || keys['ArrowRight']) {
            this.x += this.speed;
        }

        // Boundaries
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;

        // Gravity
        this.y += this.dy;
        if (this.y + this.height < canvas.height - 50) {
            this.dy += 0.6; // Gravity
            this.grounded = false;
        } else {
            this.dy = 0;
            this.grounded = true;
            this.y = canvas.height - 50 - this.height;
        }

        this.draw();
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.fillStyle = 'white';
        let eyeY = this.y + 5;
        if (this.height < this.originalHeight) eyeY = this.y + 2;
        ctx.fillRect(this.x + 25, eyeY, 10, 10);
        ctx.fillStyle = 'black';
        ctx.fillRect(this.x + 30, eyeY + 2, 5, 5);
    }
}

class Obstacle {
    constructor() {
        this.x = canvas.width + Math.random() * 200;
        this.width = 30 + Math.random() * 30;
        this.height = 30 + Math.random() * 40;

        // 30% chance to spawn floating obstacle (force duck)
        // Floating obstacles are always positioned to require ducking (approx head height)
        this.isFloating = Math.random() < 0.3;

        if (this.isFloating) {
            this.y = canvas.height - 50 - 35 - this.height; // Lowered to force duck (was 45)
            this.color = '#E91E63'; // Pink/Red for floating
        } else {
            this.y = canvas.height - 50 - this.height; // On ground
            this.color = '#FF5722'; // Orange for ground
        }

        this.markedForDeletion = false;
    }

    update() {
        this.x -= gameSpeed;
        if (this.x + this.width < 0) {
            this.markedForDeletion = true;
        }
        this.draw();
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        // Visual indicator for floating (maybe wires or just floating)
        if (this.isFloating) {
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(this.x, this.y + this.height, this.width, canvas.height - 50 - (this.y + this.height));
        }
    }
}

class Bonus {
    constructor() {
        this.x = canvas.width + Math.random() * 200;
        this.size = 20;
        // Random height: Low, Mid, High
        let spawnHeight = Math.random();
        if (spawnHeight < 0.33) this.y = canvas.height - 50 - this.size; // Ground
        else if (spawnHeight < 0.66) this.y = canvas.height - 150; // Mid
        else this.y = canvas.height - 250; // High

        // Type: 0 = Score (Gold), 1 = Speed+ (Red), 2 = Slow- (Cyan)
        let typeRand = Math.random();
        if (typeRand < 0.6) {
            this.type = 0; // Gold
            this.color = '#FFD700';
        } else if (typeRand < 0.8) {
            this.type = 1; // Speed Up
            this.color = '#FF0000';
        } else {
            this.type = 2; // Slow Down
            this.color = '#00FFFF';
        }

        this.markedForDeletion = false;
    }

    update() {
        this.x -= gameSpeed;
        if (this.x + this.size < 0) {
            this.markedForDeletion = true;
        }
        this.draw();
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();
    }
}

const player = new Player();

function handleObstacles() {
    if (frame % 100 === 0) {
        obstacles.push(new Obstacle());
        if (gameSpeed < 15) gameSpeed += 0.05;
    }

    for (let i = 0; i < obstacles.length; i++) {
        obstacles[i].update();
    }

    obstacles = obstacles.filter(obstacle => !obstacle.markedForDeletion);
}

function handleBonuses() {
    // Spawn bonuses independently, less frequent than obstacles
    if (frame % 350 === 0) {
        bonuses.push(new Bonus());
    }

    for (let i = 0; i < bonuses.length; i++) {
        bonuses[i].update();
    }
    bonuses = bonuses.filter(b => !b.markedForDeletion);
}

function checkCollisions() {
    // Obstacles
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        if (
            player.x < obs.x + obs.width &&
            player.x + player.width > obs.x &&
            player.y < obs.y + obs.height &&
            player.y + player.height > obs.y
        ) {
            gameOver();
        }
    }

    // Bonuses
    for (let i = 0; i < bonuses.length; i++) {
        let b = bonuses[i];
        if (
            player.x < b.x + b.size &&
            player.x + player.width > b.x &&
            player.y < b.y + b.size &&
            player.y + player.height > b.y
        ) {
            // Collected
            b.markedForDeletion = true;
            applyBonus(b.type);
        }
    }
}

function applyBonus(type) {
    if (type === 0) {
        score += 500; // Bonus Score
        document.getElementById('score').innerText = 'Score: ' + Math.floor(score / 10); // Update immediately
        showFloatingText("+50", "#FFD700");
    } else if (type === 1) {
        gameSpeed += 2; // Speed Up
        showFloatingText("SPEED UP!", "#FF0000");
    } else if (type === 2) {
        gameSpeed = Math.max(3, gameSpeed - 2); // Slow Down
        showFloatingText("SLOW DOWN", "#00FFFF");
    }
}

// Simple floating text effect (could be a class, but keeping it simple/hacky for now)
let floatingTexts = [];
function showFloatingText(text, color) {
    floatingTexts.push({ text: text, color: color, x: player.x, y: player.y, life: 30 });
}
function handleFloatingTexts() {
    for (let i = 0; i < floatingTexts.length; i++) {
        let ft = floatingTexts[i];
        ctx.fillStyle = ft.color;
        ctx.font = "bold 20px Arial";
        ctx.fillText(ft.text, ft.x, ft.y);
        ft.y -= 2;
        ft.life--;
    }
    floatingTexts = floatingTexts.filter(ft => ft.life > 0);
}


function gameOver() {
    isGameOver = true;
    isPlaying = false;
    document.getElementById('final-score').innerText = Math.floor(score / 10);
    document.getElementById('game-over-screen').classList.add('active');
}

function resetGame() {
    isGameOver = false;
    isPlaying = true;
    score = 0;
    frame = 0;
    gameSpeed = 5;
    player.x = 100;
    player.y = 200;
    player.dy = 0;
    obstacles = [];
    bonuses = [];
    floatingTexts = [];
    document.getElementById('game-over-screen').classList.remove('active');
    document.getElementById('score').innerText = 'Score: 0';
    gameLoop();
}

function gameLoop() {
    if (!isPlaying || isGameOver) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Ground
    ctx.fillStyle = '#555';
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);

    // Draw Ground Movement Effect
    ctx.fillStyle = '#666';
    let groundOffset = (frame * gameSpeed) % 50;
    for (let i = 0; i < canvas.width + 50; i += 50) {
        ctx.fillRect(i - groundOffset, canvas.height - 50, 25, 50);
    }

    player.update();
    handleObstacles();
    handleBonuses();
    handleFloatingTexts();
    checkCollisions();

    // Score
    score++;
    if (score % 10 === 0) {
        document.getElementById('score').innerText = 'Score: ' + Math.floor(score / 10);
    }

    frame++;
    requestAnimationFrame(gameLoop);
}

// Initial draw
ctx.fillStyle = '#555';
ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
player.draw();
