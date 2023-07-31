import {describe, expect, test} from '@jest/globals';
const edit = require('routes/shell').__get__('edit');

describe('edit', () => {
    test('backspace', () => {
        const receive = edit('dae\bte\b\n');
        expect(receive).toBe('date\n');
    });
    test('erase left', () => {
        const receive = edit('12345\b\u001b[K\b\u001b[K\b\u001b[K\b\u001b[K\b\u001b[Kdate\n');
        expect(receive).toBe('date\n');
    });
    test('delete left', () => {
        const receive = edit('daaate\b\b\b\u001b[1Pte\b\b\b\u001b[1Pte\b\b\n');
        expect(receive).toBe('date\n');
    });
    test('insert space', () => {
        const receive = edit('date\b\b\b\bd\u001b[1@d\b\u001b[1@a\u001b[1@t\u001b[1@e\u001b[K\n');
        expect(receive).toBe('date\n');
    });
    test('bell', () => {
        const receive = edit('\x07\x07da\x07te\x07\x07\n');
        expect(receive).toBe('date\n');
    });
});
