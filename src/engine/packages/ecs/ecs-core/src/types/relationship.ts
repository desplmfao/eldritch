/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/types/relationship.ts
 */

import type { sparseset, t } from '@eldritch-engine/type-utils/guerrero/markers';

import { Component } from '@self/types/component';
import type { EntityId } from '@self/types/entity';

// TODO: make this usable for guerrero
/** metadata stored for each registered relationship type. */
export interface RelationshipMetadata {
   /** the constructor function of the corresponding RelationshipTarget component */
   target_type: string;
   /** the constructor function of the Relationship component itself */
   relationship_type: string;
   /** if true, deleting the target entity will recursively delete source entities */
   linked_spawn: boolean;
}

/** base class for components representing the source of a relationship */
export abstract class RelationshipBase extends Component {
   /** the entity id this relationship points to */
   abstract target_entity_id: EntityId;
}

/** base class for components representing the target of a relationship */
export abstract class RelationshipTargetBase extends Component {
   /** list of entity ids that have a relationship pointing to this entity */
   abstract source_entities: t<sparseset>;
}
