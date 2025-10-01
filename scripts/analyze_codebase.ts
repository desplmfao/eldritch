/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/scripts/analyze_codebase.ts
 */

import { Glob } from 'bun';

import { promises as fs } from 'node:fs';
import path from 'node:path';

const project_root = process.cwd();
const scan_patterns = ['**/*'];
const exclude_patterns = [
   '**/node_modules/**',
   '**/*dist/**',
   '**/__generated__/**',
   '**/.git/**',
   '**/bun.lockb',
   'docs/**',      // ignore vitepress build output
   'docs-json/**', // ignore typedoc intermediate json
];

const JSDOC_REGEX = /\/\*\*[\s\S]*?\*\//g;
const LICENSE_HEADER_SIGNATURE = '/*!';
const TODO_REGEX = /(\/\/|\/\*)\s*todo/gi;
const FIXME_REGEX = /(\/\/|\/\*)\s*fixme/gi;

interface CategoryMetrics {
   name: string;
   file_count: number;
   line_count: number;
   size_bytes: number;
   todo_count: number;
   files: string[];
}

function categorize_file(file_path: string): string {
   const relative_path = path.relative(project_root, file_path);

   if (
      relative_path.includes(path.join(path.sep, 'tests', path.sep))
      || relative_path.endsWith('.test.ts')
   ) {
      return 'tests';
   }

   if (relative_path.startsWith('src' + path.sep)) {
      return 'source';
   }

   if (
      relative_path.startsWith('docs-site')
      || relative_path.endsWith('.md')
   ) {
      return 'documentation';
   }

   if (relative_path.startsWith('scripts')) {
      return 'scripts';
   }

   if (relative_path.startsWith('examples')) {
      return 'examples';
   }

   if (relative_path.startsWith('assets')) {
      return 'assets';
   }

   if (
      relative_path.startsWith('.github')
      || [
         'package.json',
         'tsconfig.json',
         'bunfig.toml',
         '.gitignore',
         '.gitattributes',
         '.env.example',
         'LICENSE',
         'typedoc.base.json',
         'pnpm-workspace.yaml',
      ].includes(path.basename(relative_path))
   ) {
      return 'configuration';
   }

   return 'other';
}

function process_file_content(
   content: string
): {
   cleaned_code: string;
   jsdoc_line_count: number;
   todo_count: number;
   fixme_count: number;
} {
   let jsdoc_line_count = 0;

   const jsdoc_matches = content.match(JSDOC_REGEX);

   if (jsdoc_matches) {
      for (const match of jsdoc_matches) {
         jsdoc_line_count += (match.match(/\r?\n/g) || []).length + 1;
      }
   }

   const todo_matches = content.match(TODO_REGEX);
   const fixme_matches = content.match(FIXME_REGEX);
   const todo_count = todo_matches ? todo_matches.length : 0;
   const fixme_count = fixme_matches ? fixme_matches.length : 0;

   let cleaned_code = content.replace(JSDOC_REGEX, '');

   if (cleaned_code.trimStart().startsWith(LICENSE_HEADER_SIGNATURE)) {
      const end_of_header_index = cleaned_code.indexOf('*/');

      if (end_of_header_index !== -1) {
         cleaned_code = cleaned_code.slice(end_of_header_index + 2);
      }
   }

   return {
      cleaned_code,
      jsdoc_line_count,
      todo_count,
      fixme_count,
   };
}

function format_size(bytes: number): string {
   if (bytes === 0) {
      return '0 B';
   }

   const k = 1024;
   const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
   const i = Math.floor(Math.log(bytes) / Math.log(k));

   return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function analyze_codebase() {
   const glob = new Glob(scan_patterns.join(' '));
   const exclude_globs = exclude_patterns.map(p => new Glob(p));

   const all_files = await Array.fromAsync(
      glob.scan({
         cwd: project_root,
         absolute: true,
         followSymlinks: false,
      })
   );

   const files_to_process = all_files.filter(
      (file_path) => {
         return !exclude_globs.some((exclude_glob) => exclude_glob.match(file_path));
      }
   );

   const metrics: Map<string, CategoryMetrics> = new Map();

   const get_or_create_category = (name: string): CategoryMetrics => {
      if (!metrics.has(name)) {
         metrics.set(name, {
            name,
            file_count: 0,
            line_count: 0,
            size_bytes: 0,
            todo_count: 0,
            files: [],
         });
      }

      return metrics.get(name)!;
   };

   for (const file_path of files_to_process) {
      const category_name = categorize_file(file_path);
      const category = get_or_create_category(category_name);

      category.file_count++;
      category.files.push(path.relative(project_root, file_path));

      try {
         const stats = await fs.stat(file_path);
         category.size_bytes += stats.size;

         const content = await fs.readFile(file_path, 'utf-8');
         const { cleaned_code, jsdoc_line_count, todo_count, fixme_count } = process_file_content(content);

         if (jsdoc_line_count > 0) {
            const doc_category = get_or_create_category('documentation');

            doc_category.line_count += jsdoc_line_count;
         }

         category.todo_count += todo_count;

         const code_lines = cleaned_code.split(/\r?\n/).length;

         category.line_count += code_lines;
      } catch (e) {
         // ignore binary files or read errors
      }
   }

   const sorted_metrics = [...metrics.values()].sort((a, b) => b.line_count - a.line_count);
   const total_files = sorted_metrics.reduce((sum, m) => sum + m.file_count, 0);
   const total_lines = sorted_metrics.reduce((sum, m) => sum + m.line_count, 0);
   const total_size = sorted_metrics.reduce((sum, m) => sum + m.size_bytes, 0);
   const total_todos = sorted_metrics.reduce((sum, m) => sum + m.todo_count, 0);

   const table_data = sorted_metrics.map(m => ({
      category: m.name,
      files: m.file_count.toLocaleString(),
      lines: m.line_count.toLocaleString(),
      size: format_size(m.size_bytes),
      todos: m.todo_count.toLocaleString(),
      percentage: ((m.line_count / total_lines) * 100).toFixed(2) + '%',
   }));

   const widths = {
      category: Math.max('category'.length, ...table_data.map(d => d.category.length)),
      files: Math.max('files'.length, ...table_data.map(d => d.files.length)),
      lines: Math.max('lines'.length, ...table_data.map(d => d.lines.length)),
      size: Math.max('size'.length, ...table_data.map(d => d.size.length)),
      todos: Math.max('todos'.length, ...table_data.map(d => d.todos.length)),
      percentage: 'percentage'.length,
   };

   const header =
      ` ${'category'.padEnd(widths.category)} | ` +
      `${'files'.padStart(widths.files)} | ` +
      `${'lines'.padStart(widths.lines)} | ` +
      `${'size'.padStart(widths.size)} | ` +
      `${'todos'.padStart(widths.todos)} | ` +
      `${'percentage'.padStart(widths.percentage)} `;

   const separator =
      '-'.repeat(widths.category + 2) + '+' +
      '-'.repeat(widths.files + 2) + '+' +
      '-'.repeat(widths.lines + 2) + '+' +
      '-'.repeat(widths.size + 2) + '+' +
      '-'.repeat(widths.todos + 2) + '+' +
      '-'.repeat(widths.percentage + 2);

   console.info(`\nproject root: ${project_root}`);
   console.info(`total files: ${total_files.toLocaleString()}, total lines: ${total_lines.toLocaleString()}, total size: ${format_size(total_size)}, total todos: ${total_todos}\n`);
   console.info(header);
   console.info(separator);

   for (const row of table_data) {
      const line =
         ` ${row.category.padEnd(widths.category)} | ` +
         `${row.files.padStart(widths.files)} | ` +
         `${row.lines.padStart(widths.lines)} | ` +
         `${row.size.padStart(widths.size)} | ` +
         `${row.todos.padStart(widths.todos)} | ` +
         `${row.percentage.padStart(widths.percentage)} `;

      console.info(line);
   }

   const source_lines = metrics.get('source')?.line_count ?? 0;
   const test_lines = metrics.get('tests')?.line_count ?? 0;

   if (source_lines > 0) {
      const ratio = test_lines / source_lines;

      console.info(`\ntest to source code line ratio: ${ratio.toFixed(2)} : 1`);
   }
}

await analyze_codebase();