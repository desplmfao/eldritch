/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/resources/argument_parser_registry.ts
 */

// THIS DOESNT PASS INTO GUERRERO.

import type { MaybePromise } from '@eldritch-engine/type-utils';

import type { IWorld } from '@eldritch-engine/ecs-core/types/world';
import { Resource } from '@eldritch-engine/ecs-core/types/resource';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';

import type { CommandSuggestion } from '@self/types/command_suggestion';

/** */
export type ParseResult = { success: true; value: unknown; consumed_words: number } | { success: false; error: string };

/** a function that parses raw string words into a typed value */
export type ArgumentParserFunction = (world: IWorld, input_words: string[], argument_entity_id?: EntityId) => ParseResult;

/** an optional function that provides context-aware suggestions for an argument type */
export type SuggestionProviderFunction = (world: IWorld, partial_input: string) => MaybePromise<CommandSuggestion[]>;

/** defines the parsing and suggestion logic for a single argument type */
export interface ArgumentParser {
   /** the function that parses raw string words into a typed value */
   parse: ArgumentParserFunction;
   /** an optional function that provides context-aware suggestions for this argument type */
   get_suggestions?: SuggestionProviderFunction;
}

/** a resource that holds a map of argument type names to their parsing and suggestion logic */
export class ResourceArgumentParserRegistry extends Resource {
   parsers: Map<string, ArgumentParser> = new Map();
}