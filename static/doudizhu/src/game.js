import { Deck } from './deck.js';
import { Player } from './player.js';
import { Renderer } from './renderer.js';
import { CardValidator } from './validator.js';
import { COLORS, GAME_STATES, CARD_WIDTH, CARD_HEIGHT, CARD_OVERLAP, CARD_TYPES } from './config.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);
        this.deck = new Deck();
        this.players = [];
        this.landlordIndex = -1;
        this.currentIndex = 0;
        this.state = GAME_STATES.WAITING;
        this.lastPlay = null;
        this.lastPlayPlayer = -1;
        this.passCount = 0;
        this.bottomCards = [];
        this.selectedCards = [];
        this.bidHistory = [];
        this.highestBid = 0;
        this.highestBidder = -1;
        this.bidRound = 0;
        this.startBidder = 0;

        this._init();
    }

    _init() {
        this.canvas.width = 1000;
        this.canvas.height = 700;
        this._render();
    }

    start() {
        this.deck.shuffle();
        
        this.players = [
            new Player(0, '你', false),
            new Player(1, '电脑1', true),
            new Player(2, '电脑2', true)
        ];

        for (let i = 0; i < 51; i++) {
            this.players[i % 3].addCard(this.deck.deal());
        }

        this.bottomCards = [this.deck.deal(), this.deck.deal(), this.deck.deal()];

        for (const player of this.players) {
            player.sortCards();
        }

        this.state = GAME_STATES.BIDDING;
        this.currentIndex = Math.floor(Math.random() * 3);
        this.startBidder = this.currentIndex;
        this.landlordIndex = -1;
        this.lastPlay = null;
        this.lastPlayPlayer = -1;
        this.passCount = 0;
        this.selectedCards = [];
        this.bidHistory = [];
        this.highestBid = 0;
        this.highestBidder = -1;
        this.bidRound = 0;

        this._render();

        if (this.players[this.currentIndex].isAI) {
            setTimeout(() => this._aiBid(), 500);
        }
    }

    _evaluateHand(cards) {
        let score = 0;
        const counts = {};
        
        for (const card of cards) {
            counts[card.value] = (counts[card.value] || 0) + 1;
            if (card.value >= 15) {
                score += 3;
            } else if (card.value >= 13) {
                score += 1;
            }
        }
        
        for (const value in counts) {
            if (counts[value] === 4) {
                score += 8;
            } else if (counts[value] === 3) {
                score += 3;
            }
        }
        
        const hasSmallJoker = cards.some(c => c.value === 16);
        const hasBigJoker = cards.some(c => c.value === 17);
        if (hasSmallJoker && hasBigJoker) {
            score += 10;
        } else if (hasSmallJoker || hasBigJoker) {
            score += 4;
        }
        
        return score;
    }

    _aiBid() {
        if (this.state !== GAME_STATES.BIDDING) return;

        const player = this.players[this.currentIndex];
        const handScore = this._evaluateHand(player.cards);
        
        let shouldBid = false;
        let bidValue = 0;
        
        if (this.highestBid === 0) {
            if (handScore >= 12) {
                bidValue = 3;
                shouldBid = true;
            } else if (handScore >= 8) {
                bidValue = 2;
                shouldBid = true;
            } else if (handScore >= 5) {
                bidValue = 1;
                shouldBid = true;
            }
        } else {
            const threshold = this.highestBid === 1 ? 10 : (this.highestBid === 2 ? 15 : 20);
            if (handScore >= threshold && this.highestBid < 3) {
                bidValue = this.highestBid + 1;
                shouldBid = true;
            }
        }
        
        if (shouldBid && bidValue > this.highestBid) {
            this._makeBid(this.currentIndex, bidValue);
        } else {
            this._passBid(this.currentIndex);
        }
    }

    _makeBid(playerIndex, bidValue) {
        this.bidHistory.push({ playerIndex, bidValue });
        this.highestBid = bidValue;
        this.highestBidder = playerIndex;
        this._render();
        
        if (bidValue === 3) {
            this._becomeLandlord(playerIndex);
            return;
        }
        
        this._nextBidder();
    }

    _passBid(playerIndex) {
        this.bidHistory.push({ playerIndex, bidValue: 0 });
        this._render();
        this._nextBidder();
    }

    _nextBidder() {
        this.bidRound++;
        
        if (this.bidRound >= 3) {
            if (this.highestBidder >= 0) {
                this._becomeLandlord(this.highestBidder);
            } else {
                this.restart();
                setTimeout(() => this.start(), 500);
            }
            return;
        }
        
        this.currentIndex = (this.currentIndex + 1) % 3;
        this._render();

        if (this.players[this.currentIndex].isAI) {
            setTimeout(() => this._aiBid(), 500);
        }
    }

    _becomeLandlord(index) {
        this.landlordIndex = index;
        this.players[index].isLandlord = true;

        for (const card of this.bottomCards) {
            this.players[index].addCard(card);
        }
        this.players[index].sortCards();

        this.state = GAME_STATES.PLAYING;
        this.currentIndex = index;
        this._render();

        if (this.players[this.currentIndex].isAI) {
            setTimeout(() => this._aiPlay(), 1000);
        }
    }

    handleClick(x, y) {
        if (this.state === GAME_STATES.WAITING) {
            if (this._isButtonClicked(x, y, this.canvas.width / 2 - 60, this.canvas.height / 2 - 20, 120, 40)) {
                this.start();
            }
            return;
        }

        if (this.state === GAME_STATES.BIDDING && !this.players[this.currentIndex].isAI) {
            const buttonY = this.canvas.height / 2 - 20;
            const buttonWidth = 80;
            const buttonHeight = 40;
            const totalWidth = this.highestBid === 0 ? 320 : 240;
            const startX = this.canvas.width / 2 - totalWidth / 2;
            
            if (this.highestBid < 3) {
                let btnIndex = 0;
                for (let bid = this.highestBid + 1; bid <= 3; bid++) {
                    const btnX = startX + btnIndex * (buttonWidth + 10);
                    if (this._isButtonClicked(x, y, btnX, buttonY, buttonWidth, buttonHeight)) {
                        this._makeBid(this.currentIndex, bid);
                        return;
                    }
                    btnIndex++;
                }
            }
            
            const passX = startX + (this.highestBid === 0 ? 3 : 2) * (buttonWidth + 10);
            if (this._isButtonClicked(x, y, passX, buttonY, buttonWidth, buttonHeight)) {
                this._passBid(this.currentIndex);
            }
            return;
        }

        if (this.state === GAME_STATES.PLAYING && !this.players[this.currentIndex].isAI) {
            const player = this.players[0];
            const startX = this.canvas.width / 2 - (player.cards.length * CARD_OVERLAP) / 2;

            for (let i = player.cards.length - 1; i >= 0; i--) {
                const cardX = startX + i * CARD_OVERLAP;
                const cardY = this.canvas.height - CARD_HEIGHT - 80;
                const isSelected = this.selectedCards.includes(i);

                if (x >= cardX && x <= cardX + CARD_WIDTH && y >= cardY - (isSelected ? 20 : 0) && y <= cardY + CARD_HEIGHT) {
                    if (this.selectedCards.includes(i)) {
                        this.selectedCards = this.selectedCards.filter(idx => idx !== i);
                    } else {
                        this.selectedCards.push(i);
                    }
                    this._render();
                    return;
                }
            }

            if (this._isButtonClicked(x, y, this.canvas.width / 2 - 130, this.canvas.height - 50, 120, 40)) {
                this.playSelected();
            } else if (this._isButtonClicked(x, y, this.canvas.width / 2 + 10, this.canvas.height - 50, 120, 40)) {
                this.pass();
            }
        }

        if (this.state === GAME_STATES.GAME_OVER) {
            if (this._isButtonClicked(x, y, this.canvas.width / 2 - 60, this.canvas.height / 2 + 30, 120, 40)) {
                this.restart();
            }
        }
    }

    _isButtonClicked(x, y, bx, by, bw, bh) {
        return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
    }

    playSelected() {
        if (this.state !== GAME_STATES.PLAYING || this.players[this.currentIndex].isAI) return;
        if (this.selectedCards.length === 0) return;

        const player = this.players[0];
        const cards = this.selectedCards.map(i => player.cards[i]).sort((a, b) => a.value - b.value);
        
        const type = CardValidator.getType(cards);
        if (!type) {
            return;
        }

        if (this.lastPlay && this.lastPlayPlayer !== this.currentIndex) {
            if (!CardValidator.canBeat(cards, type, this.lastPlay, this.lastPlayType)) {
                return;
            }
        }

        this._playCards(this.currentIndex, cards, type);
    }

    _playCards(playerIndex, cards, type) {
        const player = this.players[playerIndex];
        
        player.cards = player.cards.filter((_, i) => !this.selectedCards.includes(i) || playerIndex !== 0);
        if (playerIndex === 0) {
            this.selectedCards = [];
        } else {
            player.cards = player.cards.filter(c => !cards.includes(c));
        }

        this.lastPlay = cards;
        this.lastPlayType = type;
        this.lastPlayPlayer = playerIndex;
        this.passCount = 0;

        if (player.cards.length === 0) {
            this._gameOver(playerIndex);
            return;
        }

        this._nextPlayer();
    }

    pass() {
        if (this.state !== GAME_STATES.PLAYING || this.players[this.currentIndex].isAI) return;
        if (!this.lastPlay || this.lastPlayPlayer === this.currentIndex) return;

        this.passCount++;
        if (this.passCount >= 2) {
            this.lastPlay = null;
            this.lastPlayType = null;
            this.passCount = 0;
        }

        this._nextPlayer();
    }

    _nextPlayer() {
        this.currentIndex = (this.currentIndex + 1) % 3;
        this._render();

        if (this.players[this.currentIndex].isAI) {
            setTimeout(() => this._aiPlay(), 800);
        }
    }

    _aiPlay() {
        if (this.state !== GAME_STATES.PLAYING) return;

        const player = this.players[this.currentIndex];
        const cards = this._findPlayableCards(player);

        if (cards && cards.length > 0) {
            const type = CardValidator.getType(cards);
            this._playCards(this.currentIndex, cards, type);
        } else {
            this.passCount++;
            if (this.passCount >= 2) {
                this.lastPlay = null;
                this.lastPlayType = null;
                this.passCount = 0;
            }
            this._nextPlayer();
        }
    }

    _findPlayableCards(player) {
        const cards = player.cards.slice().sort((a, b) => a.value - b.value);
        
        if (!this.lastPlay || this.lastPlayPlayer === this.currentIndex) {
            return this._findSmallestPlay(cards);
        }

        return this._findBeatingPlay(cards, this.lastPlay, this.lastPlayType);
    }

    _findSmallestPlay(cards) {
        const counts = this._getCardCounts(cards);
        
        const singles = cards.filter(c => counts[c.value] === 1);
        if (singles.length > 0) {
            return [singles[0]];
        }
        
        for (const card of cards) {
            if (counts[card.value] >= 2) {
                const pair = cards.filter(c => c.value === card.value).slice(0, 2);
                return pair;
            }
        }
        
        for (const card of cards) {
            if (counts[card.value] >= 3) {
                const triple = cards.filter(c => c.value === card.value).slice(0, 3);
                return triple;
            }
        }
        
        return [cards[0]];
    }

    _findBeatingPlay(cards, lastPlay, lastType) {
        const counts = this._getCardCounts(cards);
        const lastValue = lastType.value;
        
        if (lastType.type === CARD_TYPES.SINGLE) {
            for (const card of cards) {
                if (card.value > lastValue) {
                    return [card];
                }
            }
        }
        
        if (lastType.type === CARD_TYPES.PAIR) {
            for (const card of cards) {
                if (card.value > lastValue && counts[card.value] >= 2) {
                    return cards.filter(c => c.value === card.value).slice(0, 2);
                }
            }
        }
        
        if (lastType.type === CARD_TYPES.TRIPLE) {
            for (const card of cards) {
                if (card.value > lastValue && counts[card.value] >= 3) {
                    return cards.filter(c => c.value === card.value).slice(0, 3);
                }
            }
        }
        
        if (lastType.type === CARD_TYPES.TRIPLE_ONE) {
            for (const card of cards) {
                if (card.value > lastValue && counts[card.value] >= 3) {
                    const triple = cards.filter(c => c.value === card.value).slice(0, 3);
                    const kicker = cards.find(c => c.value !== card.value);
                    if (kicker) {
                        return [...triple, kicker];
                    }
                }
            }
        }
        
        if (lastType.type === CARD_TYPES.TRIPLE_TWO) {
            for (const card of cards) {
                if (card.value > lastValue && counts[card.value] >= 3) {
                    const triple = cards.filter(c => c.value === card.value).slice(0, 3);
                    for (const pairCard of cards) {
                        if (pairCard.value !== card.value && counts[pairCard.value] >= 2) {
                            const pair = cards.filter(c => c.value === pairCard.value).slice(0, 2);
                            return [...triple, ...pair];
                        }
                    }
                }
            }
        }
        
        if (lastType.type === CARD_TYPES.STRAIGHT) {
            const straight = this._findStraight(cards, lastType.length, lastValue);
            if (straight) return straight;
        }
        
        if (lastType.type === CARD_TYPES.STRAIGHT_PAIR) {
            const straightPair = this._findStraightPair(cards, lastType.length, lastValue);
            if (straightPair) return straightPair;
        }
        
        for (const card of cards) {
            if (counts[card.value] === 4) {
                return cards.filter(c => c.value === card.value);
            }
        }
        
        const hasSmallJoker = cards.some(c => c.value === 16);
        const hasBigJoker = cards.some(c => c.value === 17);
        if (hasSmallJoker && hasBigJoker) {
            return cards.filter(c => c.value === 16 || c.value === 17);
        }
        
        return null;
    }

    _getCardCounts(cards) {
        const counts = {};
        for (const card of cards) {
            counts[card.value] = (counts[card.value] || 0) + 1;
        }
        return counts;
    }

    _findStraight(cards, length, minValue) {
        const uniqueValues = [...new Set(cards.map(c => c.value))].filter(v => v <= 14).sort((a, b) => a - b);
        
        for (let start = 0; start <= uniqueValues.length - length; start++) {
            const straightValues = uniqueValues.slice(start, start + length);
            if (straightValues[straightValues.length - 1] > minValue && 
                this._isConsecutive(straightValues)) {
                const result = [];
                for (const v of straightValues) {
                    result.push(cards.find(c => c.value === v));
                }
                return result;
            }
        }
        return null;
    }

    _findStraightPair(cards, pairCount, minValue) {
        const counts = this._getCardCounts(cards);
        const pairValues = Object.keys(counts)
            .map(Number)
            .filter(v => v <= 14 && counts[v] >= 2)
            .sort((a, b) => a - b);
        
        for (let start = 0; start <= pairValues.length - pairCount; start++) {
            const straightValues = pairValues.slice(start, start + pairCount);
            if (straightValues[straightValues.length - 1] > minValue && 
                this._isConsecutive(straightValues)) {
                const result = [];
                for (const v of straightValues) {
                    const pair = cards.filter(c => c.value === v).slice(0, 2);
                    result.push(...pair);
                }
                return result;
            }
        }
        return null;
    }

    _isConsecutive(values) {
        for (let i = 1; i < values.length; i++) {
            if (values[i] - values[i - 1] !== 1) {
                return false;
            }
        }
        return true;
    }

    _gameOver(winnerIndex) {
        this.state = GAME_STATES.GAME_OVER;
        this.winner = this.players[winnerIndex];
        this._render();
    }

    restart() {
        this.state = GAME_STATES.WAITING;
        this.deck = new Deck();
        this.players = [];
        this.landlordIndex = -1;
        this.currentIndex = 0;
        this.lastPlay = null;
        this.lastPlayPlayer = -1;
        this.passCount = 0;
        this.bottomCards = [];
        this.selectedCards = [];
        this.bidHistory = [];
        this.highestBid = 0;
        this.highestBidder = -1;
        this.bidRound = 0;
        this.startBidder = 0;
        this._render();
    }

    _render() {
        this.renderer.clear();
        this.renderer.drawBackground();

        if (this.state === GAME_STATES.WAITING) {
            this.renderer.drawButton(this.canvas.width / 2 - 60, this.canvas.height / 2 - 20, 120, 40, '开始游戏');
            return;
        }

        this.renderer.drawPlayers(this.players, this.currentIndex, this.landlordIndex);

        if (this.bottomCards.length > 0) {
            this.renderer.drawBottomCards(this.bottomCards, this.state === GAME_STATES.PLAYING);
        }

        if (this.lastPlay) {
            this.renderer.drawLastPlay(this.lastPlay, this.lastPlayPlayer);
        }

        if (this.state === GAME_STATES.BIDDING) {
            if (!this.players[this.currentIndex].isAI) {
                const buttonY = this.canvas.height / 2 - 20;
                const buttonWidth = 80;
                const buttonHeight = 40;
                const totalWidth = this.highestBid === 0 ? 320 : 240;
                const startX = this.canvas.width / 2 - totalWidth / 2;
                
                if (this.highestBid < 3) {
                    let btnIndex = 0;
                    for (let bid = this.highestBid + 1; bid <= 3; bid++) {
                        const btnX = startX + btnIndex * (buttonWidth + 10);
                        this.renderer.drawButton(btnX, buttonY, buttonWidth, buttonHeight, `${bid}分`);
                        btnIndex++;
                    }
                }
                
                const passX = startX + (this.highestBid === 0 ? 3 : 2) * (buttonWidth + 10);
                this.renderer.drawButton(passX, buttonY, buttonWidth, buttonHeight, '不叫');
            }
        }

        if (this.state === GAME_STATES.PLAYING && !this.players[this.currentIndex].isAI) {
            const player = this.players[0];
            const startX = this.canvas.width / 2 - (player.cards.length * CARD_OVERLAP) / 2;
            this.renderer.drawPlayerCards(player.cards, startX, this.canvas.height - CARD_HEIGHT - 80, this.selectedCards);
            this.renderer.drawButton(this.canvas.width / 2 - 130, this.canvas.height - 50, 120, 40, '出牌');
            this.renderer.drawButton(this.canvas.width / 2 + 10, this.canvas.height - 50, 120, 40, '不出');
        }

        if (this.state === GAME_STATES.GAME_OVER) {
            const msg = this.winner.isLandlord ? '地主获胜！' : '农民获胜！';
            this.renderer.drawGameOver(msg);
            this.renderer.drawButton(this.canvas.width / 2 - 60, this.canvas.height / 2 + 30, 120, 40, '再来一局');
        }
    }
}
