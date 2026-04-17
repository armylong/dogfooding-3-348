import { CARD_TYPES, RANK_VALUES } from './config.js';

export class CardValidator {
    static getType(cards) {
        if (!cards || cards.length === 0) return null;

        const values = cards.map(c => c.value).sort((a, b) => a - b);
        const counts = {};
        for (const v of values) {
            counts[v] = (counts[v] || 0) + 1;
        }

        const countValues = Object.values(counts).sort((a, b) => b - a);
        const uniqueValues = Object.keys(counts).map(Number).sort((a, b) => a - b);

        if (cards.length === 1) {
            return { type: CARD_TYPES.SINGLE, value: values[0] };
        }

        if (cards.length === 2) {
            if (values[0] === values[1]) {
                return { type: CARD_TYPES.PAIR, value: values[0] };
            }
            if (values[0] === 16 && values[1] === 17) {
                return { type: CARD_TYPES.ROCKET, value: 17 };
            }
        }

        if (cards.length === 3 && countValues[0] === 3) {
            return { type: CARD_TYPES.TRIPLE, value: uniqueValues[0] };
        }

        if (cards.length === 4) {
            if (countValues[0] === 4) {
                return { type: CARD_TYPES.BOMB, value: uniqueValues[0] };
            }
            if (countValues[0] === 3 && countValues.length === 2) {
                return { type: CARD_TYPES.TRIPLE_ONE, value: uniqueValues.find(v => counts[v] === 3) };
            }
        }

        if (cards.length === 5 && countValues[0] === 3 && countValues[1] === 2) {
            return { type: CARD_TYPES.TRIPLE_TWO, value: uniqueValues.find(v => counts[v] === 3) };
        }

        if (cards.length >= 5 && countValues.every(c => c === 1)) {
            if (this._isConsecutive(uniqueValues) && uniqueValues[uniqueValues.length - 1] <= 14) {
                return { type: CARD_TYPES.STRAIGHT, value: uniqueValues[uniqueValues.length - 1], length: cards.length };
            }
        }

        if (cards.length >= 6 && cards.length % 2 === 0 && countValues.every(c => c === 2)) {
            if (this._isConsecutive(uniqueValues) && uniqueValues[uniqueValues.length - 1] <= 14) {
                return { type: CARD_TYPES.STRAIGHT_PAIR, value: uniqueValues[uniqueValues.length - 1], length: cards.length / 2 };
            }
        }

        if (cards.length >= 6 && cards.length % 3 === 0) {
            const tripleValues = Object.keys(counts)
                .map(Number)
                .filter(v => counts[v] === 3)
                .sort((a, b) => a - b);
            
            if (tripleValues.length === cards.length / 3 && 
                this._isConsecutive(tripleValues) && 
                tripleValues[tripleValues.length - 1] <= 14) {
                return { type: CARD_TYPES.PLANE, value: tripleValues[tripleValues.length - 1], length: tripleValues.length };
            }
        }

        if (cards.length >= 8 && cards.length % 4 === 0) {
            const tripleValues = Object.keys(counts)
                .map(Number)
                .filter(v => counts[v] === 3)
                .sort((a, b) => a - b);
            
            const planeLength = cards.length / 4;
            if (tripleValues.length === planeLength && 
                this._isConsecutive(tripleValues) && 
                tripleValues[tripleValues.length - 1] <= 14) {
                return { type: CARD_TYPES.PLANE, value: tripleValues[tripleValues.length - 1], length: planeLength, withSingle: true };
            }
        }

        if (cards.length >= 10 && cards.length % 5 === 0) {
            const tripleValues = Object.keys(counts)
                .map(Number)
                .filter(v => counts[v] === 3)
                .sort((a, b) => a - b);
            
            const pairValues = Object.keys(counts)
                .map(Number)
                .filter(v => counts[v] === 2)
                .sort((a, b) => a - b);
            
            const planeLength = cards.length / 5;
            if (tripleValues.length === planeLength && 
                pairValues.length === planeLength &&
                this._isConsecutive(tripleValues) && 
                tripleValues[tripleValues.length - 1] <= 14) {
                return { type: CARD_TYPES.PLANE, value: tripleValues[tripleValues.length - 1], length: planeLength, withPair: true };
            }
        }

        if (cards.length === 6 && countValues[0] === 4) {
            return { type: CARD_TYPES.FOUR_TWO, value: uniqueValues.find(v => counts[v] === 4) };
        }

        if (cards.length === 8 && countValues[0] === 4 && countValues[1] === 2 && countValues[2] === 2) {
            return { type: CARD_TYPES.FOUR_TWO, value: uniqueValues.find(v => counts[v] === 4), withPair: true };
        }

        return null;
    }

    static _isConsecutive(values) {
        for (let i = 1; i < values.length; i++) {
            if (values[i] - values[i - 1] !== 1) {
                return false;
            }
        }
        return true;
    }

    static canBeat(cards, type, lastCards, lastType) {
        if (!lastType) return true;

        if (type.type === CARD_TYPES.ROCKET) return true;
        if (type.type === CARD_TYPES.BOMB && lastType.type !== CARD_TYPES.BOMB && lastType.type !== CARD_TYPES.ROCKET) {
            return true;
        }

        if (type.type !== lastType.type) return false;

        if (type.type === CARD_TYPES.STRAIGHT || type.type === CARD_TYPES.STRAIGHT_PAIR) {
            return type.length === lastType.length && type.value > lastType.value;
        }

        if (type.type === CARD_TYPES.PLANE) {
            return type.length === lastType.length && 
                   type.withSingle === lastType.withSingle && 
                   type.withPair === lastType.withPair && 
                   type.value > lastType.value;
        }

        if (type.type === CARD_TYPES.FOUR_TWO) {
            return type.withPair === lastType.withPair && type.value > lastType.value;
        }

        return type.value > lastType.value;
    }
}
