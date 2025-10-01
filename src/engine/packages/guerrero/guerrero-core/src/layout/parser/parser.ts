/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/guerrero/guerrero-core/src/layout/parser/parser.ts
 */

import { FIXED_PRIMITIVE_TYPES } from '@self/layout/constants';

import type {
   TypeNode,
   UnionTypeNode,
   FixedArrayTypeNode,
   MapTypeNode,
   SetTypeNode,
   TupleTypeNode,
   DynamicArrayTypeNode
} from '@eldritch-engine/type-utils/guerrero/parser';

//
//

export class TypeParser {
   input: string;
   pos: number = 0;

   constructor(input: string) {
      this.input = input;
   }

   #format_error_message(
      message: string,
      position: number = this.pos
   ): string {
      const snippet_radius = 20;
      const start = Math.max(0, position - snippet_radius);
      const end = Math.min(this.input.length, position + snippet_radius);

      const snippet = this.input.substring(start, end);
      const pointer_pos = position - start;

      const pointer_line = ' '.repeat(pointer_pos) + '^';
      const formatted_snippet = `> ${snippet.replace(/\n/g, '\n> ')}`;
      const formatted_pointer = `  ${pointer_line}`;

      return `${message} at position ${position}\n${formatted_snippet}\n${formatted_pointer}\n`;
   }

   parse(): TypeNode {
      const type = this.parse_union();

      this.consume_whitespace();

      if (this.pos < this.input.length) {
         throw new Error(this.#format_error_message(`unexpected character '${this.input[this.pos]}'`));
      }

      return type;
   }

   parse_union(): TypeNode {
      let left = this.parse_type_with_suffix();
      this.consume_whitespace();

      if (this.peek() === '|') {
         const variants: TypeNode[] = [left];

         while (this.peek() === '|') {
            this.consume_char('|');
            variants.push(this.parse_type_with_suffix());
            this.consume_whitespace();
         }

         return {
            kind: 'union',
            variants
         } satisfies UnionTypeNode;
      }

      return left;
   }

   parse_type_with_suffix(): TypeNode {
      let base_type = this.parse_primary_type();

      while (this.peek() === '[') {
         this.consume_char('[');
         this.consume_whitespace();

         if (this.peek() === ']') {
            this.consume_char(']');

            base_type = {
               kind: 'dynamic_array',
               element_type: base_type
            } satisfies DynamicArrayTypeNode;
         } else {
            throw new Error(this.#format_error_message(`unexpected token. expected ']' for dynamic array`));
         }
      }

      return base_type;
   }

   parse_primary_type(): TypeNode {
      this.consume_whitespace();

      if (this.peek() === '(') {
         this.consume_char('(');
         const type = this.parse_union();
         this.consume_char(')');

         return type;
      }

      if (this.peek() === '[') {
         return this.parse_bracket_array_type();
      }

      const identifier = this.parse_identifier();

      if (identifier === '') {
         throw new Error(this.#format_error_message(`expected a type identifier`));
      }

      if (this.peek() === '<') {
         return this.parse_generic_type(identifier);
      }

      if (FIXED_PRIMITIVE_TYPES.has(identifier)) {
         return {
            kind: 'primitive',
            name: identifier
         };
      }

      if (identifier === 'str') {
         return {
            kind: 'primitive',
            name: 'str'
         };
      }

      if (identifier === 'sparseset') {
         return {
            kind: 'sparseset'
         };
      }

      if (
         identifier === 'null'
         || identifier === 'undefined'
      ) {
         return {
            kind: 'null'
         };
      }

      return {
         kind: 'identifier',
         name: identifier
      };
   }

   parse_generic_type(
      generic_base: string
   ): TypeNode {
      this.consume_char('<');

      switch (generic_base) {
         case 'fixed_arr': {
            const element_type = this.parse_union();
            this.consume_char(',');
            const count = this.parse_number();
            this.consume_char('>');

            return {
               kind: 'fixed_array',
               element_type,
               count
            } satisfies FixedArrayTypeNode;
         }

         case 'arr': {
            const element_type = this.parse_union();
            this.consume_char('>');

            return {
               kind: 'dynamic_array',
               element_type
            } satisfies DynamicArrayTypeNode;
         }

         case 'map': {
            const key_type = this.parse_union();
            this.consume_char(',');
            const value_type = this.parse_union();
            this.consume_char('>');

            return {
               kind: 'map',
               key_type,
               value_type
            } satisfies MapTypeNode;
         }

         case 'set': {
            const element_type = this.parse_union();
            this.consume_char('>');

            return {
               kind: 'set',
               element_type
            } satisfies SetTypeNode;
         }

         default: {
            throw new Error(this.#format_error_message(`unknown generic type '${generic_base}'`));
         }
      }
   }

   parse_bracket_array_type(): TypeNode {
      this.consume_char('[');

      const elements: TypeNode[] = [];
      elements.push(this.parse_union());

      if (this.peek() === ']') {
         this.consume_char(']');

         throw new Error(this.#format_error_message('single-element bracketed array `[T]` is not a valid type, just use `T` if you want a single element lol', this.pos - 1));
      }

      this.consume_char(',');

      if (this.peek() === ']') {
         throw new Error(this.#format_error_message('trailing comma is not allowed in array or tuple definitions'));
      }

      if (/[0-9]/.test(this.peek()!)) {
         const count = this.parse_number();
         this.consume_char(']');

         return {
            kind: 'fixed_array',
            element_type: elements[0]!,
            count,
         };
      }

      elements.push(this.parse_union());

      while (this.peek() === ',') {
         this.consume_char(',');

         if (this.peek() === ']') {
            throw new Error(this.#format_error_message('trailing comma is not allowed in array or tuple definitions'));
         }

         elements.push(this.parse_union());
      }

      this.consume_char(']');

      return {
         kind: 'tuple',
         element_types: elements
      } satisfies TupleTypeNode;
   }

   parse_identifier(): string {
      this.consume_whitespace();
      let start = this.pos;

      while (
         this.pos < this.input.length
         && /[a-zA-Z0-9_]/.test(this.input[this.pos]!)
      ) {
         this.pos++;
      }

      return this.input.slice(start, this.pos);
   }

   parse_number(): number {
      this.consume_whitespace();
      let start = this.pos;

      while (
         this.pos < this.input.length
         && /[0-9]/.test(this.input[this.pos]!)
      ) {
         this.pos++;
      }

      const num_str = this.input.slice(start, this.pos);

      if (num_str.length === 0) {
         throw new Error(this.#format_error_message('expected a number'));
      }

      return Number.parseInt(num_str, 10);
   }

   peek(): string | undefined {
      return this.pos < this.input.length ? this.input[this.pos]! : undefined;
   }

   consume_char(char: string): void {
      this.consume_whitespace();

      if (this.input[this.pos] === char) {
         this.pos++;
      } else {
         throw new Error(this.#format_error_message(`expected '${char}' but found '${this.input[this.pos] ?? 'end of string'}'`));
      }

      this.consume_whitespace();
   }

   consume_whitespace(): void {
      while (
         this.pos < this.input.length
         && /\s/.test(this.input[this.pos]!)
      ) {
         this.pos++;
      }
   }
}

export function stringify_type_node(
   node: TypeNode
): string {
   switch (node.kind) {
      case 'primitive':
      case 'identifier': {
         return node.name;
      }

      case 'null': {
         return 'null';
      }

      case 'sparseset': {
         return 'sparseset';
      }

      case 'dynamic_array': {
         const element_string = stringify_type_node(node.element_type);

         if (element_string.includes(' ') || element_string.includes('|')) {
            return `(${element_string})[]`;
         }

         return `${element_string}[]`;
      }

      case 'fixed_array': {
         return `fixed_arr<${stringify_type_node(node.element_type)}, ${node.count}>`;
      }

      case 'tuple': {
         return `[${node.element_types.map(stringify_type_node).join(', ')}]`;
      }

      case 'map': {
         return `map<${stringify_type_node(node.key_type)}, ${stringify_type_node(node.value_type)}>`;
      }

      case 'set': {
         return `set<${stringify_type_node(node.element_type)}>`;
      }

      case 'union': {
         return node.variants.map(v => stringify_type_node(v)).join(' | ');
      }

      default: {
         return '';
      }
   }
}