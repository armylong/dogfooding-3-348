import { COLORS, getCardDimensions } from './config.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    // 获取当前canvas尺寸对应的卡牌尺寸
    _getDimensions() {
        return getCardDimensions(this.canvas.width, this.canvas.height);
    }

    clear() {
        this.ctx.fillStyle = COLORS.BACKGROUND;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawBackground() {
        this.ctx.fillStyle = COLORS.BACKGROUND;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawCard(x, y, card, faceUp = true, selected = false) {
        const dims = this._getDimensions();
        const { CARD_WIDTH, CARD_HEIGHT, scale } = dims;
        const drawY = selected ? y - 20 * scale : y;

        this.ctx.fillStyle = faceUp ? COLORS.CARD : COLORS.CARD_BACK;
        this.ctx.fillRect(x, drawY, CARD_WIDTH, CARD_HEIGHT);

        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, drawY, CARD_WIDTH, CARD_HEIGHT);

        if (faceUp && card) {
            const isRed = card.suit === '♥' || card.suit === '♦' || card.rank === '大王';
            this.ctx.fillStyle = isRed ? COLORS.RED : COLORS.BLACK;
            this.ctx.font = `bold ${16 * scale}px Arial`;
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';

            const displayRank = card.rank === '小王' ? '小' : card.rank === '大王' ? '大' : card.rank;
            this.ctx.fillText(displayRank, x + 5 * scale, drawY + 5 * scale);

            if (card.suit) {
                this.ctx.font = `${20 * scale}px Arial`;
                this.ctx.fillText(card.suit, x + 5 * scale, drawY + 25 * scale);
            }

            if (card.rank === '小王' || card.rank === '大王') {
                this.ctx.font = `bold ${24 * scale}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.fillText(card.rank === '小王' ? '王' : '王', x + CARD_WIDTH / 2, drawY + CARD_HEIGHT / 2);
            }
        }
    }

    drawPlayers(players, currentIndex, landlordIndex) {
        const dims = this._getDimensions();
        const { CARD_HEIGHT, scale } = dims;
        
        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            let x, y, labelY;

            if (i === 0) {
                // 底部玩家（人类玩家）
                x = this.canvas.width / 2;
                y = this.canvas.height - 30 * scale;
                labelY = this.canvas.height - CARD_HEIGHT - 110 * scale;
            } else if (i === 1) {
                // 左侧电脑玩家
                x = 80 * scale;
                y = this.canvas.height / 2;
                labelY = y - CARD_HEIGHT / 2 - 40 * scale;
            } else {
                // 右侧电脑玩家
                x = this.canvas.width - 80 * scale;
                y = this.canvas.height / 2;
                labelY = y - CARD_HEIGHT / 2 - 40 * scale;
            }

            // 绘制玩家名称和身份
            this.ctx.fillStyle = currentIndex === i ? '#f1c40f' : COLORS.TEXT;
            this.ctx.font = `bold ${16 * scale}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(player.name + (player.isLandlord ? ' (地主)' : ''), x, labelY);
            
            // 绘制剩余张数（在牌背上方，避免被遮挡）
            this.ctx.font = `${14 * scale}px Arial`;
            this.ctx.fillText(`剩余: ${player.cards.length}张`, x, labelY + 20 * scale);

            // 绘制电脑玩家的牌背（在人类玩家上方显示）
            if (i !== 0) {
                const cardCount = Math.min(player.cards.length, 10);
                const startX = x - (cardCount * 8 * scale) / 2;
                // 将牌背绘制在标签下方，避免遮挡剩余张数
                const cardY = labelY + 35 * scale;
                for (let j = 0; j < cardCount; j++) {
                    this.drawCard(startX + j * 8 * scale, cardY, null, false);
                }
            }
        }
    }

    drawBottomCards(cards, visible) {
        const dims = this._getDimensions();
        const { scale } = dims;
        const startX = this.canvas.width / 2 - (3 * 30 * scale) / 2;
        for (let i = 0; i < cards.length; i++) {
            this.drawCard(startX + i * 30 * scale, 10 * scale, cards[i], visible);
        }
        this.ctx.fillStyle = COLORS.TEXT;
        this.ctx.font = `${14 * scale}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('底牌', this.canvas.width / 2, 110 * scale);
    }

    drawPlayerCards(cards, startX, y, selectedIndices) {
        const dims = this._getDimensions();
        const { CARD_OVERLAP } = dims;
        for (let i = 0; i < cards.length; i++) {
            const isSelected = selectedIndices.includes(i);
            this.drawCard(startX + i * CARD_OVERLAP, y, cards[i], true, isSelected);
        }
    }

    drawLastPlay(cards, playerIndex) {
        const dims = this._getDimensions();
        const { CARD_WIDTH, CARD_HEIGHT, CARD_OVERLAP, scale } = dims;
        let x, y;
        if (playerIndex === 0) {
            x = this.canvas.width / 2 - (cards.length * CARD_OVERLAP) / 2;
            y = this.canvas.height - CARD_HEIGHT - 180 * scale;
        } else if (playerIndex === 1) {
            x = 150 * scale;
            y = this.canvas.height / 2 - CARD_HEIGHT / 2;
        } else {
            x = this.canvas.width - 150 * scale - cards.length * CARD_OVERLAP;
            y = this.canvas.height / 2 - CARD_HEIGHT / 2;
        }

        for (let i = 0; i < cards.length; i++) {
            this.drawCard(x + i * CARD_OVERLAP, y, cards[i], true);
        }
    }

    drawButton(x, y, width, height, text) {
        const dims = this._getDimensions();
        const { scale } = dims;
        this.ctx.fillStyle = COLORS.BUTTON;
        this.ctx.fillRect(x, y, width, height);
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);

        this.ctx.fillStyle = COLORS.TEXT;
        this.ctx.font = `bold ${16 * scale}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, x + width / 2, y + height / 2);
    }

    drawGameOver(message) {
        const dims = this._getDimensions();
        const { scale } = dims;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = `bold ${48 * scale}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2 - 20 * scale);
    }
}
