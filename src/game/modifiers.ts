import { MAX_SQUAD } from '../config';

export type Op = '+' | '-' | 'x' | '/';

export interface Modifier {
    op: Op;
    value: number;
}

export function applyModifier(count: number, { op, value }: Modifier): number {
    let next: number;
    switch (op) {
        case '+': next = count + value; break;
        case '-': next = count - value; break;
        case 'x': next = count * value; break;
        case '/': next = Math.floor(count / value); break;
    }
    return Math.max(0, Math.min(MAX_SQUAD, next));
}

export function isGood({ op }: Modifier): boolean {
    return op === '+' || op === 'x';
}

export function modifierLabel({ op, value }: Modifier): string {
    const symbol = { '+': '+', '-': '−', 'x': '×', '/': '÷' }[op];
    return `${symbol}${value}`;
}
