/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/type-utils/src/logger/index.ts
 */

import type { ObjK } from '@self/index';

/**
 * defines a custom color. can be one of:
 * - a number (ansi 8-bit color code).
 * - a tuple `[open, close]` (ansi escape codes).
 * - a string:
 *   - `'#RRGGBB'` or `'#RGB'` (hex).
 *   - `'rgb(r,g,b)'` (rgb function).
 *   - `'r,g,b'` (rgb plain).
 *   - an alias to another color name.
 *   - you can append `:8` or `:24` to rgb/plain strings to specify color bits (e.g., `'255,165,0:8'`), defaulting to 24-bit.
 */
export type ColorEntry = number | [number, number] | string;

/** a record of custom color entries */
export type ColorList = Record<string, ColorEntry>;

export type Ansi = `\u001B[${number}m`;

export type AnsiGroup = {
   open: Ansi;
   close: Ansi;
};

/** a union of all standard ansi style names available by default in the logger */
export type AnsiColorStyleName =
   | 'r'
   | 'ul'
   | 'ol'
   | 'st'
   //
   | 'reset'
   | 'bold'
   | 'dim'
   | 'italic'
   | 'underline'
   | 'slow_blink'
   | 'fast_blink'
   | 'inverse'
   | 'hidden'
   | 'strikethrough'
   | 'framed'
   | 'encircle'
   | 'overline'
   //
   | 'black'
   | 'red'
   | 'green'
   | 'yellow'
   | 'blue'
   | 'magenta'
   | 'cyan'
   | 'white'
   //
   | 'black_bright'
   | 'red_bright'
   | 'green_bright'
   | 'yellow_bright'
   | 'blue_bright'
   | 'magenta_bright'
   | 'cyan_bright'
   | 'white_bright'
   //
   | 'bg_black'
   | 'bg_red'
   | 'bg_green'
   | 'bg_yellow'
   | 'bg_blue'
   | 'bg_magenta'
   | 'bg_cyan'
   | 'bg_white'
   //
   | 'bg_black_bright'
   | 'bg_red_bright'
   | 'bg_green_bright'
   | 'bg_yellow_bright'
   | 'bg_blue_bright'
   | 'bg_magenta_bright'
   | 'bg_cyan_bright'
   | 'bg_white_bright';


export interface StyleInfo {
   key: string;
   style: AnsiGroup;
}

/** the different types of log methods available */
export type LogType =
   | 'trace'
   | 'debug'
   | 'critical'
   | 'error'
   | 'assert'
   | 'warn'
   | 'info'
   | 'success'
   | 'profile';

/**
 * the valid namespaces for the logger to use on the `console` object
 */
export type ValidLogsConsoleNamespace = 'debug' | 'info' | 'warn' | 'error';

/**
 * options for configuring a single log call's behavior and appearance
 *
 * @template T_COLOR_LIST - a type representing a record of custom color entries
 */
export interface LogOptions<T_COLOR_LIST extends Record<ObjK, ColorEntry>> {
   log_method?: LogType;
   console_log_force?: ValidLogsConsoleNamespace;
   prefix_colors_append?: Map<string, AnsiColorStyleName | keyof T_COLOR_LIST | [number, number]>;
   use_prefix?: boolean;
   have_time?: boolean;
   namespace?: string;
}

/** the data payload passed from the logger to each transport */
export interface LogPayload<T_COLOR_LIST extends Record<ObjK, ColorEntry> = Record<ObjK, ColorEntry>> {
   raw_messages: unknown[];
   options: LogOptions<T_COLOR_LIST>;
   formatted_messages: any[];
   profile_data?: {
      label: string;
      type: 'begin' | 'end';
      duration_ms?: number;
   };
}

/** the interface that all log transports must implement */
export interface ILogTransport {
   handle<T_COLOR_LIST extends Record<ObjK, ColorEntry>>(payload: LogPayload<T_COLOR_LIST>): void;
}

/** options for configuring a logger instance */
export interface LoggerOptions {
   /** 1=trace, 2=debug, 3=info/success, 4=warn, 5=error/critical/assert */
   log_level: 1 | 2 | 3 | 4 | 5;

   /** a record of custom color definitions */
   list?: ColorList;

   /**
    * specifies which namespaces are initially enabled
    * 
    * omit to enable all namespaces by default
    * 
    * pass `[]` to disable all namespaces
    * 
    * pass an array of strings `['renderer', 'physics']` to enable only specific namespaces
    * 
    * @default everything
    */
   enabled_namespaces?: string[];

   /**
    * controls whether ansi color codes are used in the output
    *
    * - `true`: always enable ansi colors
    * - `false`: always disable ansi colors
    * - `'auto'`: (default) enable colors, but disable them in environments with poor support (like firefox)
    */
   force_ansi?: boolean | 'auto';

   /**
    * an array of log transports to use for output
    *
    * if not provided, defaults to a single `ConsoleTransport`
    */
   transports?: ILogTransport[];

   /** if true, the logger will patch the global `console` object to route its calls through the logger's transports */
   intercept_console?: boolean;
}

/** the interface for a namespaced logger instance */
export interface NamespacedLogger {
   trace(...messages: unknown[]): void;
   debug(...messages: unknown[]): void;
   info(...messages: unknown[]): void;
   success(...messages: unknown[]): void;
   warn(...messages: unknown[]): void;
   error(...messages: unknown[]): void;
   critical(...messages: unknown[]): void;
   assert(condition: boolean, ...messages: unknown[]): void;

   profile_begin(label: string): void;
   profile_end(label: string): void;
}