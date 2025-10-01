/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-storage-backend-archetype/src/ecs/resources/archetype.ts
 */

import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';
import type { Component } from '@eldritch-engine/ecs-core/types/component';
import { Resource } from '@eldritch-engine/ecs-core/types/resource';

//
//

/** a unique identifier for an archetype */
export type ArchetypeId = string;

/** represents a collection of entities that share the exact same set of components */
export class Archetype {
   /** the unique identifier for this archetype */
   id: ArchetypeId = 'empty';

   /** an ordered list of EntityIds within this archetype. the order matches the indices in the component arrays */
   entities: EntityId[] = [];

   /** maps an EntityId to its specific index within the component arrays for this archetype */
   entity_to_index: Map<EntityId, number> = new Map();

   /** the set of component names defining this archetype */
   component_names: Set<string> = new Set();

   /** stores arrays of components, keyed by the component name. each array holds instances of ONE component type for ALL entities in this archetype, ordered according to the `entities` array */
   component_arrays: Map<string, Component[]> = new Map();
}

/** resource responsible for managing Archetypes within the World. tracks archetypes by their id and maps entities to their current archetype. */
export class ResourceArchetypeMap extends Resource {
   /** maps ArchetypeId to the Archetype data structure */
   archetypes_by_id: Map<ArchetypeId, Archetype> = new Map();

   /** maps the component name to the set of ArchetypeIds that contain this component */
   archetypes_by_component_name: Map<string, Set<ArchetypeId>> = new Map();

   /** maps EntityId to its current ArchetypeId */
   entity_to_archetype_id: Map<EntityId, ArchetypeId> = new Map();

   /** caches transitions for adding a single component (source archetype -> map -> component name -> target archetype) */
   add_transitions: Map<ArchetypeId, Map<string, ArchetypeId>> = new Map();

   /** caches transitions for removing a single component (source archetype -> map -> component name -> target archetype) */
   remove_transitions: Map<ArchetypeId, Map<string, ArchetypeId>> = new Map();
}