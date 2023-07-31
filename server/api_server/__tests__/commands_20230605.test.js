import {describe, expect, test} from '@jest/globals';
const path = require('path')

const commands = require('routes/commands');
const load = commands.__get__('load');
const get = commands.__get__('get');

const mock = require('mock-fs');
const commands_20230605 = require('./commands_20230605.json');

console.log("DEBUG:", path.resolve(__dirname, 'assets/commands_20230605'));

describe('load', () => {
    beforeEach(() => {
        mock({
            'commands': mock.load(path.resolve(__dirname, 'assets/commands_20230605')),
        });
    });
    afterEach(() => {
        mock.restore();
    });

    test('load', () => {
        load();
        const commands_data = commands.__get__('_commands');
        const commands_json = JSON.parse(JSON.stringify(commands_data));
        expect(commands_json).toEqual(commands_20230605);
    });
});
