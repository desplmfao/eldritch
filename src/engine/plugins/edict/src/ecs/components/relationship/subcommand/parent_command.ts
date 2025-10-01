/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/plugins/edict/src/ecs/components/relationship/subcommand/parent_command.ts
 */

import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { entity_id_none, type EntityId } from '@eldritch-engine/ecs-core/types/entity';
import { RelationshipBase } from '@eldritch-engine/ecs-core/types/relationship';

@Reflectable()
export class ComponentParentCommand extends RelationshipBase {
   /** the entity id of the parent command node */
   target_entity_id: EntityId = entity_id_none;
}