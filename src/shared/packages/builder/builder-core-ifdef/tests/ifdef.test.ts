/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-ifdef/tests/ifdef.test.ts
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';

import { REG_EXPS } from '@self/constants';
import { DirectiveError, type PluginLogicSettings, type WarnCallback } from '@self/types';
import { IfdefParser } from '@self/parser';
import { IfdefProcessor } from '@self/processor';
import { IfdefRenderer } from '@self/renderer';
import { format_content_stack } from '@self/formatter';

describe('@eldritch-engine/builder-core-ifdef', () => {
   describe('IfdefParser', () => {
      const parser = new IfdefParser(REG_EXPS.triple);

      it('should parse a simple #if directive into a DirectiveToken', () => {
         const line = '/// #if DEBUG';
         const tokens = [...parser.parse(line)];

         expect(tokens.length).toBe(1);
         expect(tokens[0]).toEqual({
            type: 'directive',
            line_index: 0,
            line_text: line,
            token_str: 'if',
            expression: 'DEBUG',
            column: 0,
            length: 13,
         });
      });

      it('should parse a line without a directive into a ContentToken', () => {
         const line = 'const x = 1;';
         const tokens = [...parser.parse(line)];

         expect(tokens.length).toBe(1);
         expect(tokens[0]).toEqual({
            type: 'content',
            line_index: 0,
            line_text: line,
         });
      });

      it('should correctly handle multi-line input', () => {
         const content = 'line 1\n/// #if true\nline 3';
         const tokens = [...parser.parse(content)];

         expect(tokens.length).toBe(3);
         expect(tokens[0]!.type).toBe('content');
         expect(tokens[1]!.type).toBe('directive');
         expect(tokens[2]!.type).toBe('content');
         expect((tokens[1] as any).expression).toBe('true');
      });
   });

   describe('IfdefProcessor', () => {
      const file_path = '/src/test.ts';
      const warn_fn = mock<WarnCallback>();

      beforeEach(() => {
         warn_fn.mockClear();
      });

      it('should process a simple true conditional and yield KEEP actions for content', () => {
         const settings: PluginLogicSettings = { variables: { DEBUG: true } };
         const parser = new IfdefParser(REG_EXPS.triple);
         const processor = new IfdefProcessor(settings, file_path, warn_fn);
         const tokens = parser.parse('/// #if DEBUG\n  console.log("debug");\n/// #endif');
         const actions = [...processor.process(tokens)];

         expect(actions.length).toBe(3);
         expect(actions[0]!.type).toBe('PRUNE'); // the #if line
         expect(actions[1]!.type).toBe('KEEP');
         expect((actions[1] as any).content).toBe('  console.log("debug");');
         expect(actions[2]!.type).toBe('PRUNE'); // the #endif line
      });

      it('should process a simple false conditional and yield PRUNE actions for content', () => {
         const settings: PluginLogicSettings = { variables: { DEBUG: false } };
         const parser = new IfdefParser(REG_EXPS.triple);
         const processor = new IfdefProcessor(settings, file_path, warn_fn);
         const tokens = parser.parse('/// #if DEBUG\n  console.log("debug");\n/// #endif');
         const actions = [...processor.process(tokens)];

         expect(actions.length).toBe(3);
         expect(actions[0]!.type).toBe('PRUNE');
         expect(actions[1]!.type).toBe('PRUNE');
         expect((actions[1] as any).line_text).toBe('  console.log("debug");');
         expect(actions[2]!.type).toBe('PRUNE');
      });

      it('should handle #define and #undef correctly', () => {
         const settings: PluginLogicSettings = {};
         const parser = new IfdefParser(REG_EXPS.triple);
         const processor = new IfdefProcessor(settings, file_path, warn_fn);
         const tokens = parser.parse('/// #define MY_FLAG\n/// #if MY_FLAG\nContent\n/// #endif\n/// #undef MY_FLAG\n/// #if MY_FLAG\nshould be pruned\n/// #endif');
         const actions = [...processor.process(tokens)];

         expect(actions[2]!.type).toBe('KEEP');
         expect((actions[2] as any).content).toBe('Content');
         expect(actions[6]!.type).toBe('PRUNE');
      });

      it('should handle #define with various value types', () => {
         const settings: PluginLogicSettings = {};
         const parser = new IfdefParser(REG_EXPS.triple);
         const processor = new IfdefProcessor(settings, file_path, warn_fn);
         const tokens = parser.parse('/// #define V_TRUE true\n/// #define V_FALSE false\n/// #define V_NUM 123\n/// #if V_TRUE\nContent A\n/// #endif\n/// #if !V_FALSE\nContent B\n/// #endif\n/// #if V_NUM === 123\nContent C\n/// #endif');
         const actions = [...processor.process(tokens)];

         expect((actions.find(a => a.type === 'KEEP' && a.content === 'Content A'))).toBeDefined();
         expect((actions.find(a => a.type === 'KEEP' && a.content === 'Content B'))).toBeDefined();
         expect((actions.find(a => a.type === 'KEEP' && a.content === 'Content C'))).toBeDefined();
      });

      it('should handle #ifdef and #ifndef', () => {
         const settings: PluginLogicSettings = { variables: { IS_DEFINED: true } };
         const parser = new IfdefParser(REG_EXPS.triple);
         const processor = new IfdefProcessor(settings, file_path, warn_fn);
         const tokens = parser.parse('/// #ifdef IS_DEFINED\nContent A\n/// #endif\n/// #ifndef IS_NOT_DEFINED\nContent B\n/// #endif');
         const actions = [...processor.process(tokens)];

         expect((actions.find(a => a.type === 'KEEP' && a.content === 'Content A'))).toBeDefined();
         expect((actions.find(a => a.type === 'KEEP' && a.content === 'Content B'))).toBeDefined();
      });

      it('should handle #elifdef and #elifndef', () => {
         const settings: PluginLogicSettings = { variables: { B: true } };
         const parser = new IfdefParser(REG_EXPS.triple);
         const processor = new IfdefProcessor(settings, file_path, warn_fn);
         const tokens = parser.parse('/// #ifdef A\nPruned\n/// #elifdef B\nContent B\n/// #elifdef C\nPruned\n/// #endif\n/// #ifdef D\nPruned\n/// #elifndef E\nContent E\n/// #endif');
         const actions = [...processor.process(tokens)];

         expect((actions.find(a => a.type === 'KEEP' && a.content === 'Content B'))).toBeDefined();
         expect((actions.find(a => a.type === 'KEEP' && a.content === 'Content E'))).toBeDefined();
      });

      it('should ignore #pragma directives', () => {
         const settings: PluginLogicSettings = {};
         const parser = new IfdefParser(REG_EXPS.triple);
         const processor = new IfdefProcessor(settings, file_path, warn_fn);
         const tokens = parser.parse('/// #pragma once\nContent');
         const actions = [...processor.process(tokens)];

         expect(actions[0]!.type).toBe('PRUNE'); // the pragma line itself is pruned
         expect(actions[1]!.type).toBe('KEEP');
         expect((actions[1] as any).content).toBe('Content');
      });

      it('should throw DirectiveError for unterminated blocks', () => {
         const settings: PluginLogicSettings = {};
         const parser = new IfdefParser(REG_EXPS.triple);
         const processor = new IfdefProcessor(settings, file_path, warn_fn);
         const tokens = parser.parse('/// #if true');

         const process_action = () => [...processor.process(tokens)];
         expect(process_action).toThrow(new DirectiveError('unterminated #if block that started on line 1'));
      });

      it('should call warn_fn for #warning directive', () => {
         const settings: PluginLogicSettings = {};
         const parser = new IfdefParser(REG_EXPS.triple);
         const processor = new IfdefProcessor(settings, file_path, warn_fn);
         const tokens = parser.parse('/// #warning a test warning');

         [...processor.process(tokens)]; // consume the generator
         expect(warn_fn).toHaveBeenCalledTimes(1);
         expect(warn_fn.mock.calls[0]![0]).toBe('a test warning');
      });

      it('should throw DirectiveError for #error directive', () => {
         const settings: PluginLogicSettings = {};
         const parser = new IfdefParser(REG_EXPS.triple);
         const processor = new IfdefProcessor(settings, file_path, warn_fn);
         const tokens = parser.parse('/// #error a test error');

         const processAction = () => [...processor.process(tokens)];
         expect(processAction).toThrow(new DirectiveError('a test error'));
      });

      describe('expression evaluation', () => {
         const variables = { DEBUG: true, RELEASE: false, VERSION: 3, NAME: 'test' };
         const custom_helpers = { is_foo: (val: string) => val === 'foo' };

         const test_expression = (expression: string, settings: Partial<PluginLogicSettings> = {}) => {
            const final_settings: PluginLogicSettings = { variables, expression_helpers: custom_helpers, ...settings };
            const processor = new IfdefProcessor(final_settings, file_path, warn_fn);

            return processor.eval_expression(expression, 0, variables);
         };

         it('should evaluate built-in defined() helper', () => {
            expect(test_expression("defined('DEBUG')")).toBe(true);
            expect(test_expression("!defined('UNDEFINED_VAR')")).toBe(true);
         });

         it('should evaluate built-in env() helper', () => {
            expect(test_expression("env('VERSION') === 3")).toBe(true);
            expect(test_expression("env('UNDEFINED_VAR', 10) === 10")).toBe(true);
         });

         it('should evaluate magic variables __FILE__ and __LINE__', () => {
            const processor = new IfdefProcessor({ variables }, file_path, warn_fn);
            expect(processor.eval_expression(`__FILE__ === '${file_path}'`, 10, variables)).toBe(true);
            expect(processor.eval_expression('__LINE__ === 11', 10, variables)).toBe(true);
         });

         it('should evaluate with custom helpers', () => {
            expect(test_expression("is_foo('foo')")).toBe(true);
            expect(test_expression("is_foo(NAME)")).toBe(false);
         });

         it('should throw for undefined variables in strict mode', () => {
            expect(() => test_expression('UNDEFINED_VAR', { strict: true })).toThrow(ReferenceError);
         });

         it('should treat undefined variables as falsy in non-strict mode', () => {
            expect(test_expression('UNDEFINED_VAR', { strict: false })).toBe(false);
         });

         it('should throw a syntax error for an invalid expression', () => {
            expect(() => test_expression('DEBUG &&')).toThrow(SyntaxError);
         });
      });
   });

   describe('IfdefRenderer', () => {
      it('should render KEEP actions as content and PRUNE actions as empty lines by default', () => {
         const renderer = new IfdefRenderer({});

         const actions = [
            { type: 'KEEP', content: 'line 1' },
            { type: 'PRUNE', line_text: 'line 2' },
            { type: 'KEEP', content: 'line 3' },
         ];

         const result = renderer.render(actions as any);
         expect(result).toBe('line 1\n\nline 3');
      });

      it('should render PRUNE actions with spaces if fill_with_spaces is true', () => {
         const renderer = new IfdefRenderer({ fill_with_spaces: true });

         const actions = [
            { type: 'PRUNE', line_text: 'line 2' },
         ];

         const result = renderer.render(actions as any);
         expect(result).toBe(' '.repeat('line 2'.length));
      });

      it('should render PRUNE actions as comments if comment_out_lines is true', () => {
         const renderer = new IfdefRenderer({ comment_out_lines: true, comment_prefix: '// ' });

         const actions = [
            { type: 'PRUNE', line_text: 'line 2' },
         ];

         const result = renderer.render(actions as any);
         expect(result).toBe('// line 2');
      });
   });

   describe('format_content_stack (integration)', () => {
      const default_settings: PluginLogicSettings = {
         reg_exp: REG_EXPS.triple,
         variables: {
            DEBUG: true,
            PROD: false,
            LEVEL: 2
         },
      };

      const warn_fn = mock<WarnCallback>();

      beforeEach(() => {
         warn_fn.mockClear();
      });

      it('should keep content if #if condition is true', () => {
         const content = 'line 1\n' + '/// #if' + ' DEBUG\n' + 'line 2\n' + '/// #endif\n' + 'line 3';
         const expected = 'line 1\n\nline 2\n\nline 3';
         const result = format_content_stack(content, 'test.ts', default_settings, warn_fn);

         expect(result).toBe(expected);
      });

      it('should prune content if #if condition is false', () => {
         const content = 'line 1\n' + '/// #if' + ' PROD\n' + 'line 2\n' + '/// #endif\n' + 'line 3';
         const expected = 'line 1\n\n\n\nline 3';
         const result = format_content_stack(content, 'test.ts', default_settings, warn_fn);

         expect(result).toBe(expected);
      });

      it('should handle #else correctly', () => {
         const content_true = 'A\n' + '/// #if' + ' DEBUG\n' + 'B\n' + '/// #else\n' + 'C\n' + '/// #endif\n' + 'D';
         const expected_true = 'A\n\nB\n\n\n\nD';

         expect(format_content_stack(content_true, 'test.ts', default_settings, warn_fn)).toBe(expected_true);

         const content_false = 'A\n' + '/// #if' + ' PROD\n' + 'B\n' + '/// #else\n' + 'C\n' + '/// #endif\n' + 'D';
         const expected_false = 'A\n\n\n\nC\n\nD';

         expect(format_content_stack(content_false, 'test.ts', default_settings, warn_fn)).toBe(expected_false);
      });

      it('should handle #ifdef and #ifndef', () => {
         const content_ifdef = '/// #ifdef' + ' DEBUG\n' + '_DEBUG is defined\n' + '/// #endif';
         expect(format_content_stack(content_ifdef, 'test.ts', default_settings, warn_fn)).toBe('\n_DEBUG is defined\n');

         const content_ifndef = '/// #ifndef' + ' UNDEFINED_VAR\n' + '_UNDEFINED_VAR is not defined\n' + '/// #endif';
         expect(format_content_stack(content_ifndef, 'test.ts', default_settings, warn_fn)).toBe('\n_UNDEFINED_VAR is not defined\n');
      });

      it('should handle nested blocks', () => {
         const content = 'L1\n' + '/// #if' + ' DEBUG\n' + 'L2\n' + '/// #if' + ' LEVEL > 1\n' + 'L3\n' + '/// #endif\n' + 'L4\n' + '/// #endif\n' + 'L5';
         const expected = 'L1\n\nL2\n\nL3\n\nL4\n\nL5';
         expect(format_content_stack(content, 'test.ts', default_settings, warn_fn)).toBe(expected);
      });

      it('should throw DirectiveError for unterminated #if block', () => {
         const content = '/// #if' + ' DEBUG\n' + ' some content';

         expect(() => format_content_stack(content, 'test.ts', default_settings, warn_fn))
            .toThrow(new DirectiveError('unterminated #if block that started on line 1'));
      });

      it('should throw DirectiveError for misplaced #else', () => {
         const content = '/// #else';

         expect(() => format_content_stack(content, 'test.ts', default_settings, warn_fn))
            .toThrow(new DirectiveError('misplaced #else directive'));
      });
   });
});