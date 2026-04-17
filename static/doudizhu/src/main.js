import { Game } from './game.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const game = new Game(canvas);

    canvas.addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;
        game.handleClick(x, y);
    });

    document.addEventListener('keydown', (event) => {
        if (event.code === 'Space') {
            game.playSelected();
        }
        if (event.code === 'KeyP') {
            game.pass();
        }
        if (event.code === 'KeyR') {
            game.restart();
        }
    });
});
