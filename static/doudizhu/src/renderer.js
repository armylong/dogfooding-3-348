import { COLORS, CARD_WIDTH, CARD_HEIGHT, CARD_OVERLAP } from './config.js';

const BASE_WIDTH = 1000;
const BASE_HEIGHT = 700;

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
    }

    setScale(scale) {
        this.scale = scale;
        this.offsetX = (this.canvas.width - BASE_WIDTH * scale) / 2;
        this.offsetY = (this.canvas.height - BASE_HEIGHT * scale) / 2;
    }

    _x(value) {
        return this.offsetX + value * this.scale;
    }

    _y(value) {
        return this.offsetY + value * this.scale;
    }

    _w(value) {
        return value * this.scale;
    }

    _h(value) {
        return value * this.scale;
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
        const drawY = selected ? y - 20 : y;
        const cardW = CARD_WIDTH;
        const cardH = CARD_HEIGHT;

        this.ctx.fillStyle = faceUp ? COLORS.CARD : COLORS.CARD_BACK;
        this.ctx.fillRect(this._x(x), this._y(drawY), this._w(cardW), this._h(cardH));

        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(this._x(x), this._y(drawY), this._w(cardW), this._h(cardH));

        if (faceUp && card) {
            const isRed = card.suit === '♥' || card.suit === '♦' || card.rank === '大王';
            this.ctx.fillStyle = isRed ? COLORS.RED : COLORS.BLACK;
            this.ctx.font = `bold ${this._h(16)}px Arial`;
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';

            const displayRank = card.rank === '小王' ? '小' : card.rank === '大王' ? '大' : card.rank;
            this.ctx.fillText(displayRank, this._x(x + 5), this._y(drawY + 5));

            if (card.suit) {
                this.ctx.font = `${this._h(20)}px Arial`;
                this.ctx.fillText(card.suit, this._x(x + 5), this._y(drawY + 25));
            }

            if (card.rank === '小王' || card.rank === '大王') {
                this.ctx.font = `bold ${this._h(24)}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.fillText(card.rank === '小王' ? '王' : '王', this._x(x + cardW / 2), this._y(drawY + cardH / 2));
            }
        }
    }

    drawPlayers(players, currentIndex, landlordIndex) {
        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            let x, y, labelY;

            if (i === 0) {
                x = BASE_WIDTH / 2;
                y = BASE_HEIGHT - 30;
                labelY = BASE_HEIGHT - CARD_HEIGHT - 110;
            } else if (i === 1) {
                x = 80;
                y = BASE_HEIGHT / 2;
                labelY = y - CARD_HEIGHT / 2 - 50;
            } else {
                x = BASE_WIDTH - 80;
                y = BASE_HEIGHT / 2;
                labelY = y - CARD_HEIGHT / 2 - 50;
            }

            this.ctx.fillStyle = currentIndex === i ? '#f1c40f' : COLORS.TEXT;
            this.ctx.font = `bold ${this._h(16)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(player.name + (player.isLandlord ? ' (地主)' : ''), this._x(x), this._y(labelY));
            this.ctx.font = `${this._h(14)}px Arial`;
            this.ctx.fillText(`剩余: ${player.cards.length}张`, this._x(x), this._y(labelY + 20));

            if (i !== 0) {
                const cardCount = Math.min(player.cards.length, 10);
                const startX = x - (cardCount * 8) / 2;
                for (let j = 0; j < cardCount; j++) {
                    this.drawCard(startX + j * 8, y - CARD_HEIGHT / 2, null, false);
                }
            }
        }
    }

    drawBottomCards(cards, visible) {
        const startX = BASE_WIDTH / 2 - (3 * 30) / 2;
        for (let i = 0; i < cards.length; i++) {
            this.drawCard(startX + i * 30, 10, cards[i], visible);
        }
        this.ctx.fillStyle = COLORS.TEXT;
        this.ctx.font = `${this._h(14)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('底牌', this._x(BASE_WIDTH / 2), this._y(110));
    }

    drawPlayerCards(cards, startX, y, selectedIndices) {
        for (let i = 0; i < cards.length; i++) {
            const isSelected = selectedIndices.includes(i);
            this.drawCard(startX + i * CARD_OVERLAP, y, cards[i], true, isSelected);
        }
    }

    drawLastPlay(cards, playerIndex) {
        let x, y;
        if (playerIndex === 0) {
            x = BASE_WIDTH / 2 - (cards.length * CARD_OVERLAP) / 2;
            y = BASE_HEIGHT - CARD_HEIGHT - 180;
        } else if (playerIndex === 1) {
            x = 150;
            y = BASE_HEIGHT / 2 - CARD_HEIGHT / 2;
        } else {
            x = BASE_WIDTH - 150 - cards.length * CARD_OVERLAP;
            y = BASE_HEIGHT / 2 - CARD_HEIGHT / 2;
        }

        for (let i = 0; i < cards.length; i++) {
            this.drawCard(x + i * CARD_OVERLAP, y, cards[i], true);
        }
    }

    drawButton(x, y, width, height, text) {
        this.ctx.fillStyle = COLORS.BUTTON;
        this.ctx.fillRect(this._x(x), this._y(y), this._w(width), this._h(height));
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this._x(x), this._y(y), this._w(width), this._h(height));

        this.ctx.fillStyle = COLORS.TEXT;
        this.ctx.font = `bold ${this._h(16)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, this._x(x + width / 2), this._y(y + height / 2));
    }

    drawGameOver(message) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = `bold ${this._h(48)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(message, this._x(BASE_WIDTH / 2), this._y(BASE_HEIGHT / 2 - 20));
    }
}
