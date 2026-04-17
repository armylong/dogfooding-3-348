import { Game } from './game.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const game = new Game(canvas);

    canvas.addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();
        // 计算CSS显示尺寸与canvas实际像素尺寸的比例
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        // 将鼠标坐标映射到canvas内部坐标
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
