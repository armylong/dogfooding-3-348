import { Deck } from './deck.js';
import { Player } from './player.js';
import { Renderer } from './renderer.js';
import { CardValidator } from './validator.js';
import { COLORS, GAME_STATES, getCardDimensions, CARD_TYPES } from './config.js';

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
        // 设置canvas为响应式，根据窗口大小调整
        this._resizeCanvas();
        // 监听窗口大小变化事件
        window.addEventListener('resize', () => this._resizeCanvas());
        this._render();
    }

    // 响应式调整canvas大小
    _resizeCanvas() {
        const container = this.canvas.parentElement;
        const maxWidth = window.innerWidth;
        const maxHeight = window.innerHeight;
        
        // 保持16:10的宽高比
        const aspectRatio = 10 / 7;
        let width = maxWidth;
        let height = width / aspectRatio;
        
        if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
        this._render();
    }

    start() {
        this.deck.shuffle();
        
        this.players = [
            new Player(0, '你', false),
            new Player(1, '电脑1', true),
            new Player(2, '电脑2', true)
        ];

        // 每人发17张牌，共51张，剩余3张作为底牌
        for (let i = 0; i < 51; i++) {
            this.players[i % 3].addCard(this.deck.deal());
        }

        // 保留3张底牌
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
        const dims = getCardDimensions(this.canvas.width, this.canvas.height);
        const { CARD_WIDTH, CARD_HEIGHT, CARD_OVERLAP, scale } = dims;

        if (this.state === GAME_STATES.WAITING) {
            if (this._isButtonClicked(x, y, this.canvas.width / 2 - 60 * scale, this.canvas.height / 2 - 20 * scale, 120 * scale, 40 * scale)) {
                this.start();
            }
            return;
        }

        if (this.state === GAME_STATES.BIDDING && !this.players[this.currentIndex].isAI) {
            const buttonY = this.canvas.height / 2 - 20 * scale;
            const buttonWidth = 80 * scale;
            const buttonHeight = 40 * scale;
            const totalWidth = this.highestBid === 0 ? 320 * scale : 240 * scale;
            const startX = this.canvas.width / 2 - totalWidth / 2;
            
            if (this.highestBid < 3) {
                let btnIndex = 0;
                for (let bid = this.highestBid + 1; bid <= 3; bid++) {
                    const btnX = startX + btnIndex * (buttonWidth + 10 * scale);
                    if (this._isButtonClicked(x, y, btnX, buttonY, buttonWidth, buttonHeight)) {
                        this._makeBid(this.currentIndex, bid);
                        return;
                    }
                    btnIndex++;
                }
            }
            
            const passX = startX + (this.highestBid === 0 ? 3 : 2) * (buttonWidth + 10 * scale);
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
                const cardY = this.canvas.height - CARD_HEIGHT - 80 * scale;
                const isSelected = this.selectedCards.includes(i);

                if (x >= cardX && x <= cardX + CARD_WIDTH && y >= cardY - (isSelected ? 20 * scale : 0) && y <= cardY + CARD_HEIGHT) {
                    if (this.selectedCards.includes(i)) {
                        this.selectedCards = this.selectedCards.filter(idx => idx !== i);
                    } else {
                        this.selectedCards.push(i);
                    }
                    this._render();
                    return;
                }
            }

            if (this._isButtonClicked(x, y, this.canvas.width / 2 - 130 * scale, this.canvas.height - 50 * scale, 120 * scale, 40 * scale)) {
                this.playSelected();
            } else if (this._isButtonClicked(x, y, this.canvas.width / 2 + 10 * scale, this.canvas.height - 50 * scale, 120 * scale, 40 * scale)) {
                this.pass();
            }
        }

        if (this.state === GAME_STATES.GAME_OVER) {
            if (this._isButtonClicked(x, y, this.canvas.width / 2 - 60 * scale, this.canvas.height / 2 + 30 * scale, 120 * scale, 40 * scale)) {
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
        
        // 检查是否是队友出的牌，如果是则选择不出（顺牌）
        if (this.lastPlay && this.lastPlayPlayer !== this.currentIndex) {
            if (this._isTeammate(this.currentIndex, this.lastPlayPlayer)) {
                // 队友出的牌，选择顺牌（不出）
                this.passCount++;
                if (this.passCount >= 2) {
                    this.lastPlay = null;
                    this.lastPlayType = null;
                    this.passCount = 0;
                }
                this._nextPlayer();
                return;
            }
        }
        
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

    // 判断两个玩家是否是队友
    _isTeammate(playerIndex1, playerIndex2) {
        // 如果地主还没确定，没有队友关系
        if (this.landlordIndex === -1) return false;
        
        const p1IsLandlord = this.players[playerIndex1].isLandlord;
        const p2IsLandlord = this.players[playerIndex2].isLandlord;
        
        // 都是地主或都是农民则是队友
        return p1IsLandlord === p2IsLandlord;
    }

    _findPlayableCards(player) {
        const cards = player.cards.slice().sort((a, b) => a.value - b.value);
        
        if (!this.lastPlay || this.lastPlayPlayer === this.currentIndex) {
            return this._findSmallestPlay(cards);
        }

        return this._findBeatingPlay(cards, this.lastPlay, this.lastPlayType);
    }

    // AI主动出牌策略：优先出组合牌型，提高出牌效率
    _findSmallestPlay(cards) {
        const counts = this._getCardCounts(cards);
        
        // 1. 优先尝试出顺子（5张及以上连续单牌）
        const straight = this._findSmallestStraight(cards);
        if (straight && straight.length >= 5) {
            return straight;
        }
        
        // 2. 优先尝试出连对（3对及以上连续对子）
        const straightPair = this._findSmallestStraightPair(cards);
        if (straightPair && straightPair.length >= 6) {
            return straightPair;
        }
        
        // 3. 优先尝试出飞机（2个及以上连续三张）
        const plane = this._findSmallestPlane(cards);
        if (plane && plane.length >= 6) {
            return plane;
        }
        
        // 4. 优先出三带二（能带走两张单牌或一个对子）
        for (const card of cards) {
            if (counts[card.value] >= 3) {
                const triple = cards.filter(c => c.value === card.value).slice(0, 3);
                // 尝试找一个对子作为带牌
                for (const pairCard of cards) {
                    if (pairCard.value !== card.value && counts[pairCard.value] >= 2) {
                        const pair = cards.filter(c => c.value === pairCard.value).slice(0, 2);
                        return [...triple, ...pair];
                    }
                }
            }
        }
        
        // 5. 优先出三带一
        for (const card of cards) {
            if (counts[card.value] >= 3) {
                const triple = cards.filter(c => c.value === card.value).slice(0, 3);
                const kicker = cards.find(c => c.value !== card.value);
                if (kicker) {
                    return [...triple, kicker];
                }
            }
        }
        
        // 6. 出三张
        for (const card of cards) {
            if (counts[card.value] >= 3) {
                return cards.filter(c => c.value === card.value).slice(0, 3);
            }
        }
        
        // 7. 出对子
        for (const card of cards) {
            if (counts[card.value] >= 2) {
                return cards.filter(c => c.value === card.value).slice(0, 2);
            }
        }
        
        // 8. 最后出单张
        const singles = cards.filter(c => counts[c.value] === 1);
        if (singles.length > 0) {
            return [singles[0]];
        }
        
        return [cards[0]];
    }

    // 找出最小的顺子
    _findSmallestStraight(cards) {
        const uniqueValues = [...new Set(cards.map(c => c.value))].filter(v => v <= 14).sort((a, b) => a - b);
        
        for (let len = 5; len <= uniqueValues.length; len++) {
            for (let start = 0; start <= uniqueValues.length - len; start++) {
                const straightValues = uniqueValues.slice(start, start + len);
                if (this._isConsecutive(straightValues)) {
                    return straightValues.map(v => cards.find(c => c.value === v));
                }
            }
        }
        return null;
    }

    // 找出最小的连对
    _findSmallestStraightPair(cards) {
        const counts = this._getCardCounts(cards);
        const pairValues = Object.keys(counts)
            .map(Number)
            .filter(v => v <= 14 && counts[v] >= 2)
            .sort((a, b) => a - b);
        
        for (let pairCount = 3; pairCount <= pairValues.length; pairCount++) {
            for (let start = 0; start <= pairValues.length - pairCount; start++) {
                const straightValues = pairValues.slice(start, start + pairCount);
                if (this._isConsecutive(straightValues)) {
                    const result = [];
                    for (const v of straightValues) {
                        result.push(...cards.filter(c => c.value === v).slice(0, 2));
                    }
                    return result;
                }
            }
        }
        return null;
    }

    // 找出最小的飞机（不带牌）
    _findSmallestPlane(cards) {
        const counts = this._getCardCounts(cards);
        const tripleValues = Object.keys(counts)
            .map(Number)
            .filter(v => v <= 14 && counts[v] >= 3)
            .sort((a, b) => a - b);
        
        for (let tripleCount = 2; tripleCount <= tripleValues.length; tripleCount++) {
            for (let start = 0; start <= tripleValues.length - tripleCount; start++) {
                const planeValues = tripleValues.slice(start, start + tripleCount);
                if (this._isConsecutive(planeValues)) {
                    const result = [];
                    for (const v of planeValues) {
                        result.push(...cards.filter(c => c.value === v).slice(0, 3));
                    }
                    return result;
                }
            }
        }
        return null;
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
        
        // 炸弹和王炸只在关键时刻使用
        if (this._shouldUseBomb()) {
            // 尝试出普通炸弹
            for (const card of cards) {
                if (counts[card.value] === 4) {
                    return cards.filter(c => c.value === card.value);
                }
            }
            
            // 尝试出王炸
            const hasSmallJoker = cards.some(c => c.value === 16);
            const hasBigJoker = cards.some(c => c.value === 17);
            if (hasSmallJoker && hasBigJoker) {
                return cards.filter(c => c.value === 16 || c.value === 17);
            }
        }
        
        return null;
    }

    // 判断是否应该在此时使用炸弹
    _shouldUseBomb() {
        // 1. 如果对方出的是炸弹或王炸，必须用炸弹或王炸应对
        if (this.lastPlayType.type === CARD_TYPES.BOMB || this.lastPlayType.type === CARD_TYPES.ROCKET) {
            return true;
        }
        
        // 2. 如果自己牌很少（快赢了），可以使用炸弹
        const myCardCount = this.players[this.currentIndex].cards.length;
        if (myCardCount <= 3) {
            return true;
        }
        
        // 3. 如果队友牌很少且是队友出的牌，不使用炸弹（让队友继续出）
        // 这种情况已经在_isTeammate中处理，不会走到这里
        
        // 4. 如果对手（非队友）牌很少，使用炸弹阻止对方获胜
        for (let i = 0; i < this.players.length; i++) {
            if (i !== this.currentIndex && !this._isTeammate(this.currentIndex, i)) {
                if (this.players[i].cards.length <= 2) {
                    return true;
                }
            }
        }
        
        // 5. 如果自己手牌很好（有多个炸弹），可以使用一个
        const counts = this._getCardCounts(this.players[this.currentIndex].cards);
        let bombCount = 0;
        for (const value in counts) {
            if (counts[value] === 4) {
                bombCount++;
            }
        }
        const hasSmallJoker = this.players[this.currentIndex].cards.some(c => c.value === 16);
        const hasBigJoker = this.players[this.currentIndex].cards.some(c => c.value === 17);
        if (hasSmallJoker && hasBigJoker) {
            bombCount++;
        }
        // 有多个炸弹时可以使用一个
        if (bombCount >= 2) {
            return true;
        }
        
        // 6. 其他情况不使用炸弹，保留实力
        return false;
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
        const dims = getCardDimensions(this.canvas.width, this.canvas.height);
        const { CARD_WIDTH, CARD_HEIGHT, CARD_OVERLAP, scale } = dims;

        this.renderer.clear();
        this.renderer.drawBackground();

        if (this.state === GAME_STATES.WAITING) {
            this.renderer.drawButton(this.canvas.width / 2 - 60 * scale, this.canvas.height / 2 - 20 * scale, 120 * scale, 40 * scale, '开始游戏');
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
                const buttonY = this.canvas.height / 2 - 20 * scale;
                const buttonWidth = 80 * scale;
                const buttonHeight = 40 * scale;
                const totalWidth = this.highestBid === 0 ? 320 * scale : 240 * scale;
                const startX = this.canvas.width / 2 - totalWidth / 2;
                
                if (this.highestBid < 3) {
                    let btnIndex = 0;
                    for (let bid = this.highestBid + 1; bid <= 3; bid++) {
                        const btnX = startX + btnIndex * (buttonWidth + 10 * scale);
                        this.renderer.drawButton(btnX, buttonY, buttonWidth, buttonHeight, `${bid}分`);
                        btnIndex++;
                    }
                }
                
                const passX = startX + (this.highestBid === 0 ? 3 : 2) * (buttonWidth + 10 * scale);
                this.renderer.drawButton(passX, buttonY, buttonWidth, buttonHeight, '不叫');
            }
        }

        if (this.state === GAME_STATES.PLAYING && !this.players[this.currentIndex].isAI) {
            const player = this.players[0];
            const startX = this.canvas.width / 2 - (player.cards.length * CARD_OVERLAP) / 2;
            this.renderer.drawPlayerCards(player.cards, startX, this.canvas.height - CARD_HEIGHT - 80 * scale, this.selectedCards);
            this.renderer.drawButton(this.canvas.width / 2 - 130 * scale, this.canvas.height - 50 * scale, 120 * scale, 40 * scale, '出牌');
            this.renderer.drawButton(this.canvas.width / 2 + 10 * scale, this.canvas.height - 50 * scale, 120 * scale, 40 * scale, '不出');
        }

        if (this.state === GAME_STATES.GAME_OVER) {
            const msg = this.winner.isLandlord ? '地主获胜！' : '农民获胜！';
            this.renderer.drawGameOver(msg);
            this.renderer.drawButton(this.canvas.width / 2 - 60 * scale, this.canvas.height / 2 + 30 * scale, 120 * scale, 40 * scale, '再来一局');
        }
    }
}
