/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/ecs/components/grouping/member_of.ts
 */

import { Reflectable } from '@eldritch-engine/guerrero-core/reflect/decorators';

import { RelationshipBase } from '@self/types/relationship';
import { entity_id_none, type EntityId } from '@self/types/entity';

@Reflectable()
export class ComponentMemberOf extends RelationshipBase {
   /** the entity id of the logical group this entity is a member of */
   target_entity_id: EntityId = entity_id_none;
}