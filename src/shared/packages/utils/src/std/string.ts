/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/utils/src/std/string.ts
 */

export function generate_random_string<L extends number, CR extends [number, number][]>(
   length: L,
   character_ranges?: CR
): string {
   let result = '';

   const default_ranges: [number, number][] = [[32, 126]];
   const ranges = character_ranges || default_ranges;

   for (let i = 0; i < length; i++) {
      const [min, max] = ranges[Math.floor(Math.random() * ranges.length)] as CR[number];
      const char_code = Math.floor(Math.random() * (max - min + 1)) + min;

      result += String.fromCharCode(char_code);
   }

   return result;
}

export function starts_with(str: string, search: string): boolean {
   if (search.length === 0 || search.length > str.length) {
      return false;
   }

   for (let i = 0; i < search.length; i++) {
      if (str[i] !== search[i]) {
         return false;
      }
   }

   return true;
}

export function ends_with(str: string, search: string): boolean {
   if (search.length === 0 || search.length > str.length) {
      return false;
   }

   for (let i = 0; i < search.length; i++) {
      if (str[str.length - search.length + i] !== search[i]) {
         return false;
      }
   }

   return true;
}

export function capitalize(str: string): string {
   if (str.length === 0) {
      return str;
   }

   return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, length: number, suffix: string = '...'): string {
   if (str.length <= length) {
      return str;
   }

   return str.slice(0, length - suffix.length) + suffix;
}


/** options for replacing a range of lines */
export interface ReplaceLineRangeOptions {
   /** the 1-based starting line number of the inclusive range to replace */
   start_line: number;
   /** the 1-based ending line number of the inclusive range to replace */
   end_line: number;
   /** the new content to insert in place of the specified range */
   new_content?: string;
}

/**
 * replaces an inclusive range of lines within a string content with new content, deletes the range, or dynamically generates replacement content
 *
 * @param content the original string content
 * @param options configuration for the replacement
 * 
 * @returns the modified string content
 * 
 * @throws {Error} if line numbers are invalid or out of bounds for a replacement operation
 */
export function replace_line_range_in_content(
   content: string,
   options: ReplaceLineRangeOptions
): string {
   const { start_line, end_line, new_content } = options;

   let line_ending = '\n';

   if (content.indexOf('\r\n') > -1) {
      line_ending = '\r\n';
   }

   const lines = content.split(/\r?\n/);

   const start_index = start_line - 1;
   const end_index = end_line - 1;

   if (start_line < 1) {
      throw new Error(`start line number ${start_line} must be 1 or greater`);
   }

   if (end_line < start_line - 1) {
      throw new Error(`end line number ${end_line} is invalid. it must be >= start_line (${start_line}), or exactly one less for an insertion`);
   }

   const effective_lines_length = content === '' ? 0 : lines.length;

   if (
      start_index >= effective_lines_length
      && effective_lines_length > 0
   ) {
      throw new Error(`start line number ${start_line} is out of bounds (content has ${effective_lines_length} lines)`);
   }

   if (
      end_index >= effective_lines_length
      && effective_lines_length > 0
   ) {
      throw new Error(`end line number ${end_line} is out of bounds (content has ${effective_lines_length} lines)`);
   }

   if (
      effective_lines_length === 0
      && (
         start_line !== 1
         || end_line !== 1
      )
   ) {
      throw new Error(`cannot specify range other than 1-1 for empty content. got ${start_line}-${end_line}`);
   }

   let new_lines_to_insert: string[];

   if (new_content == null) {
      new_lines_to_insert = [];
   } else {
      new_lines_to_insert = new_content.split(/\r?\n/);
   }

   let lines_to_remove_count: number;
   let actual_start_index = start_index;

   if (effective_lines_length === 0) {
      lines_to_remove_count = lines.length;
      actual_start_index = 0;
   } else {
      lines_to_remove_count = end_index - start_index + 1;
   }

   lines.splice(actual_start_index, lines_to_remove_count, ...new_lines_to_insert);

   if (
      lines.length === 1
      && lines[0] === ''
      && new_lines_to_insert.length === 1
      && new_lines_to_insert[0] === ''
   ) {
      return '';
   }

   return lines.join(line_ending);
}

/** options for deleting a range of lines */
export interface DeleteLineRangeOptions {
   /** the 1-based starting line number of the inclusive range to delete */
   start_line: number;
   /** the 1-based ending line number of the inclusive range to delete */
   end_line: number;
}

/**
 * deletes an inclusive range of lines from a string content
 * 
 * this is a convenience wrapper around `replace_line_range_in_content`
 *
 * @param content the original string content
 * @param options configuration for the deletion
 * 
 * @returns the modified string content
 */
export function delete_line_range(
   content: string,
   options: DeleteLineRangeOptions
): string {
   return replace_line_range_in_content(content, {
      ...options,
      new_content: undefined,
   });
}

/** options for inserting lines */
export interface InsertLinesOptions {
   /** the 1-based line number *before* which the new content should be inserted */
   before_line_number: number;
   /** the new content to insert */
   content_to_insert: string;
}

/**
 * inserts new lines into a string content before a specified line number
 *
 * @param content the original string content
 * @param options configuration for the insertion
 * 
 * @returns the modified string content
 */
export function insert_lines_before(
   content: string,
   options: InsertLinesOptions
): string {
   const { before_line_number, content_to_insert } = options;

   if (content === '' && before_line_number === 1) {
      return content_to_insert;
   }

   let line_ending = '\n';

   if (content.indexOf('\r\n') > -1) {
      line_ending = '\r\n';
   }

   const lines = content.split(/\r?\n/);

   const max_insert_point = (content === '') ? 1 : lines.length + 1;

   if (before_line_number < 1 || before_line_number > max_insert_point) {
      throw new Error(`target line number ${before_line_number} for insertion is out of bounds (1 to ${max_insert_point} for current content)`);
   }

   const new_lines_array = content_to_insert.split(/\r?\n/);
   const insert_at_index = before_line_number - 1;

   if (content === '' && insert_at_index === 0) {
      lines.splice(insert_at_index, 1, ...new_lines_array);
   } else {
      lines.splice(insert_at_index, 0, ...new_lines_array);
   }

   return lines.join(line_ending);
}

/**
 * inserts new lines into a string content after a specified line number
 *
 * @param content the original string content
 * @param options takes `after_line_number` (1-based) and `content_to_insert`
 * 
 * @returns the modified string content
 */
export function insert_lines_after(
   content: string,
   options: { after_line_number: number; content_to_insert: string }
): string {
   const { after_line_number, content_to_insert } = options;

   const lines_array = content.split(/\r?\n/);
   const effective_lines_length = content === '' ? 0 : lines_array.length;

   if (after_line_number < 0 || after_line_number > effective_lines_length) {
      if (after_line_number === 0 && effective_lines_length === 0) {
         return insert_lines_before(content, { before_line_number: 1, content_to_insert });
      } else if (after_line_number === 0 && effective_lines_length > 0) {
         return insert_lines_before(content, { before_line_number: 1, content_to_insert });
      }

      throw new Error(`target line number ${after_line_number} for 'insert after' is out of bounds (0 to ${effective_lines_length})`);
   }

   return insert_lines_before(content, {
      before_line_number: after_line_number + 1,
      content_to_insert,
   });
}