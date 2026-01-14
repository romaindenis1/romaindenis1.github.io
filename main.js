const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
var flagtext = document.getElementById("flagtext");
var timertext = document.getElementById("timertext");

let gridSize = 15;  // Default Medium
let cellSize = canvas.width / gridSize;
let grid = [];
let mineAmount = 40; // Default for medium
let flaggedCount = 0; // Track flagged cells
let revealedCount = 0; // Track revealed cells for win condition

let firstClick = true;
let firstClickPosition = null;
const flagImage = new Image();
flagImage.src = "./Images/flag.png";

const mineImage = new Image();
mineImage.src = "./Images/mine.png";


let gameOver = false;
let gameWon = false;
let animations = []; // Store active animations: { row, col, startTime, duration, type: 'reveal'|'press' }

let timerInterval;
let startTime;

// Initialize the game loop
function gameLoop() {
    updateAnimations();
    drawGrid();
    requestAnimationFrame(gameLoop);
}

// Update animation states
function updateAnimations() {
    const now = Date.now();
    animations = animations.filter(anim => {
        const elapsed = now - anim.startTime;
        return elapsed < anim.duration;
    });
}

// Makes grid
function initializeGrid() {
    grid = [];
    for (let row = 0; row < gridSize; row++) {
        grid[row] = [];
        for (let col = 0; col < gridSize; col++) {
            grid[row][col] = {
                value: 0,
                revealed: false,
                flagged: false,
                scale: 1 // For animation
            };
        }
    }

    placeMines();
    calculateTiles();
}

// Draw the grid
function drawGrid() {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Style
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;

    // Draw the grid lines
    for (let i = 0; i <= gridSize; i++) {
        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, canvas.height);
        ctx.stroke();

        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvas.width, i * cellSize);
        ctx.stroke();
    }

    // Render the grid cells
    grid.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            let x = colIndex * cellSize;
            let y = rowIndex * cellSize;

            // Handle Animation Scale
            let scale = 1;
            const anim = animations.find(a => a.row === rowIndex && a.col === colIndex);
            if (anim) {
                const now = Date.now();
                const progress = (now - anim.startTime) / anim.duration;
                // Simple "press" curve: down then up
                if (progress < 0.5) {
                    scale = 1 - (progress * 0.2); // Go down to 0.9
                } else {
                    scale = 0.9 + ((progress - 0.5) * 0.2); // Go back to 1
                }
            }

            // Save context for scaling
            ctx.save();
            // Translate to center of cell
            ctx.translate(x + cellSize / 2, y + cellSize / 2);
            ctx.scale(scale, scale);
            // Translate back to top-left of cell (relative to the translated origin, it is -cellSize/2)
            const drawX = -cellSize / 2;
            const drawY = -cellSize / 2;

            // Styles for revealed cells
            if (cell.revealed) {
                if (cell.value === 9) {
                    ctx.fillStyle = 'red';  // Mine 
                }
                else if ((rowIndex + colIndex) % 2 === 0) {
                    ctx.fillStyle = '#C3B59F';
                } else {
                    ctx.fillStyle = '#A57F60';
                }

            } else {
                // Alternate colors for unrevealed cells
                if ((rowIndex + colIndex) % 2 === 0) {
                    ctx.fillStyle = '#2f2f2f';  // One color for unrevealed cells
                } else {
                    ctx.fillStyle = '#3a3a3a';  // Another color for unrevealed cells
                }
            }

            ctx.fillRect(drawX, drawY, cellSize, cellSize);

            // Center numbers for revealed cells
            if (cell.revealed && cell.value !== 0) {
                if (cell.value === 9) {
                    ctx.drawImage(mineImage, drawX + cellSize * 0.1, drawY + cellSize * 0.1, cellSize * 0.8, cellSize * 0.8);
                } else {
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 16px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(cell.value, 0, 0); // At center (0,0) because of translate
                }
            }

            // Draw flag
            if (cell.flagged) {
                ctx.drawImage(flagImage, drawX + cellSize / 4, drawY + cellSize / 4, cellSize / 2, cellSize / 2);

                if (gameOver && cell.value !== 9) {
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(drawX + cellSize * 0.2, drawY + cellSize * 0.2);
                    ctx.lineTo(drawX + cellSize * 0.8, drawY + cellSize * 0.8);
                    ctx.moveTo(drawX + cellSize * 0.8, drawY + cellSize * 0.2);
                    ctx.lineTo(drawX + cellSize * 0.2, drawY + cellSize * 0.8);
                    ctx.stroke();
                }
            }

            // Restore context
            ctx.restore();
        });
    });

    // Game Over Overlay
    if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);

        ctx.font = '24px Arial';
        ctx.fillText('Press R to Restart', canvas.width / 2, canvas.height / 2 + 50);
    }

    // Win Overlay
    if (gameWon) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#4CAF50'; // Greenish
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('YOU WIN!', canvas.width / 2, canvas.height / 2);

        ctx.font = '24px Arial';
        ctx.fillText('Press R to Restart', canvas.width / 2, canvas.height / 2 + 50);
    }

    // Update the flag count display
    flagtext.innerHTML = `${mineAmount - flaggedCount}`;
}

// Timer Functions
function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    timertext.innerHTML = elapsed;
}

function stopTimer() {
    clearInterval(timerInterval);
}

function resetTimer() {
    stopTimer();
    timertext.innerHTML = "0";
}

// Difficulty handler
document.getElementById('difficulty').addEventListener('change', (event) => {
    flagtext.innerHTML = '';
    let flagwords;
    switch (event.target.value) {
        case 'easy':
            gridSize = 10;
            mineAmount = 10;
            flagwords = document.createTextNode("10");
            break;
        case 'medium':
            gridSize = 15;
            mineAmount = 40;
            flagwords = document.createTextNode("40");
            break;
        case 'hard':
            gridSize = 20;
            mineAmount = 95;
            flagwords = document.createTextNode("99");
            break;
        case 'insane':
            gridSize = 30;
            mineAmount = 150;
            flagwords = document.createTextNode("150");
            break;
    }

    flagtext.appendChild(flagwords);
    cellSize = canvas.width / gridSize;

    initializeGame();
});

// Random mines
function placeMines() {
    const rows = grid.length;
    const cols = grid[0].length;
    let placedMines = 0;

    while (placedMines < mineAmount) {
        let row = Math.floor(Math.random() * rows);
        let col = Math.floor(Math.random() * cols);

        // So mines aren't placed on firstclick or around
        if (grid[row][col].value === 0 && !isFirstClickArea(row, col)) {
            grid[row][col].value = 9;
            placedMines++;
        }
    }
}

// Check if the position is in the first click area
function isFirstClickArea(row, col) {
    if (!firstClickPosition) return false;

    const [firstRow, firstCol] = firstClickPosition;
    return (
        Math.abs(firstRow - row) <= 1 &&
        Math.abs(firstCol - col) <= 1
    );
}

// Calculate numbered cells
function calculateTiles() {
    const rows = grid.length;
    const cols = grid[0].length;

    grid.forEach((row, rIdx) => {
        row.forEach((cell, cIdx) => {
            // Skip mines
            if (cell.value === 9) return;

            let mineCount = 0;

            // Check neighbor cells for mines
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    const newRow = rIdx + i;
                    const newCol = cIdx + j;

                    if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
                        if (grid[newRow][newCol].value === 9) {
                            mineCount++;
                        }
                    }
                }
            }

            // Update
            grid[rIdx][cIdx].value = mineCount;
        });
    });
}

// Reveal cell function
function revealCell(row, col) {
    if (gameOver || gameWon || grid[row][col].flagged) return; // Cannot reveal if game over, won, or flagged

    // Add "press" animation
    animations.push({
        row: row,
        col: col,
        startTime: Date.now(),
        duration: 150 // 150ms press
    });


    if (grid[row][col].revealed) return;

    grid[row][col].revealed = true;

    if (grid[row][col].value === 9) {
        // Mine hit!
        triggerGameOver();
        return;
    }

    // Safe cell revealed
    revealedCount++;
    checkWin();

    if (grid[row][col].value === 0) {
        // Reveal neighboring cells if empty (no number or mine)
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const newRow = row + i;
                const newCol = col + j;
                if (newRow >= 0 && newRow < gridSize && newCol >= 0 && newCol < gridSize) {
                    if (!grid[newRow][newCol].revealed) {
                        revealCell(newRow, newCol);
                    }
                }
            }
        }
    }
}

function checkWin() {
    const totalCells = gridSize * gridSize;
    const totalSafeCells = totalCells - mineAmount;

    if (revealedCount === totalSafeCells) {
        gameWon = true;
        stopTimer();
        // Identify any unflagged mines and flag them (visual polish)
        grid.forEach(row => {
            row.forEach(cell => {
                if (cell.value === 9 && !cell.flagged) {
                    cell.flagged = true;
                }
            });
        });
        flaggedCount = mineAmount; // Set flag count to max
    }
}

function triggerGameOver() {
    gameOver = true;
    stopTimer();
    // Reveal all mines
    grid.forEach(row => {
        row.forEach(cell => {
            if (cell.value === 9) {
                cell.revealed = true;
            }
        });
    });
}

// Setup
function initializeGame() {
    firstClick = true;
    firstClickPosition = null;
    flaggedCount = 0; // Reset the flag count
    revealedCount = 0;
    gameOver = false;
    gameWon = false;
    animations = [];
    resetTimer(); // Reset timer on new game
    initializeGrid();
}

initializeGame();
gameLoop(); // Start the loop

// Event listener for left click (reveal cells)
canvas.addEventListener('click', (event) => {
    if (gameOver || gameWon) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const row = Math.floor(y / cellSize);
    const col = Math.floor(x / cellSize);

    // Check if firstclick
    if (firstClick) {
        firstClickPosition = [row, col];
        firstClick = false;
        startTimer(); // Start timer on first click
        initializeGrid();   // Remake final grid
    }

    revealCell(row, col);
});

// Event listener for right click (flag/unflag cells)
canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault(); // Prevent right-click menu from appearing

    if (gameOver || gameWon) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const row = Math.floor(y / cellSize);
    const col = Math.floor(x / cellSize);

    const cell = grid[row][col];

    // Toggle the flagged state of the cell
    if (!cell.revealed) {
        if (cell.flagged) {
            cell.flagged = false;
            flaggedCount--;
        } else {
            cell.flagged = true;
            flaggedCount++;
        }
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'r' || event.key === 'R') {
        initializeGame();
    }
});