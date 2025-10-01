/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/components/runtime/command_invocation.ts
 */

import type { arr, bool, f64, str, t } from '@eldritch-engine/type-utils/guerrero/markers';
import { Reflectable, ReflectProperty } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { Component } from '@eldritch-engine/ecs-core/types/component';
import { entity_id_none, type EntityId } from '@eldritch-engine/ecs-core/types/entity';

/** transient component added to a temporary entity to trigger command execution */
@Reflectable()
export class ComponentCommandInvocation extends Component {
   /** the entity that initiated the command */
   sender_entity_id: EntityId = entity_id_none;

   /** the entity id of the compiled command that was executed */
   target_command_entity: EntityId = entity_id_none;

   /** the parsed arguments for the command execution */
   parsed_args!: t<arr<str | f64 | bool>>;
}