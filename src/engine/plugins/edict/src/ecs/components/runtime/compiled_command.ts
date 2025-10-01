/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/components/runtime/compiled_command.ts
 */

import type { i64, str, t } from '@eldritch-engine/type-utils/guerrero/markers';
import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { Component } from '@eldritch-engine/ecs-core/types/component';

import type { CommandNodeType } from '@self/ecs/components/command_node';

/** runtime component added by SystemCompileCommands, holding optimized data for parsing */
@Reflectable()
export class ComponentCompiledCommand extends Component {
   /** full command path from root */
   full_path!: t<str[]>;

   /** the node type for each corresponding segment in the full_path */
   path_node_types!: t<CommandNodeType[]>;

   /** a hash of the full command path for lookups */
   full_path_hash: t<i64> = -1n;

   /** ordered list of argument parser type names */
   argument_parser_names!: t<str[]>;

   /** list of all permission component names found on this path */
   permission_tag_names!: t<str[]>;
}