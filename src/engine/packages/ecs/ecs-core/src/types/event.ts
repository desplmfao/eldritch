/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/types/event.ts
 */

import type { MaybePromise, ObjK } from '@eldritch-engine/type-utils';

import type { Component } from '@self/types/component';
import type { EntityId } from '@self/types/entity';
import type { System } from '@self/types/system';
import type { Plugin } from '@self/types/plugin';
import type { Schedule } from '@self/types/schedule';

/** */
export type Event = keyof EventArgs;

/** */
export type EventArgs = {
   /** notified when a new entity is successfully created */
   entity_created: [entity_id: EntityId];
   /** notified when an entity is successfully deleted including recursive deletion of children */
   entity_deleted: [entity_id: EntityId];

   /** notified when an entity's parent changes, either by adding/removing ComponentChildOf or by changing its target_entity_id */
   entity_parent_set: [child_id: EntityId, new_parent_id?: EntityId, old_parent_id?: EntityId];
   /** notified when an entity (child_id) becomes a child of another entity (parent_id), specifically when it's added to the parent's ComponentChildren */
   entity_child_added: [parent_id: EntityId, child_id: EntityId];
   /** notified when an entity (child_id) ceases to be a child of another entity (parent_id), specifically when it's removed from the parent's ComponentChildren */
   entity_child_removed: [parent_id: EntityId, child_id: EntityId];

   /** notified when a component is added to an entity */
   component_added: [entity_id: EntityId, component: Component, context?: { overwritten_component?: Component }];
   /** notified when a component is removed to an entity */
   component_removed: [entity_id: EntityId, component: Component, context?: { is_overwrite: boolean }];

   /** */
   system_initialized: [system: System];
   /** */
   system_created: [system: System];
   /** */
   system_cleaned: [system: System];
   /** */
   system_started: [system: System];
   /** */
   system_stopped: [system: System];

   /** */
   plugin_added: [plugin: Plugin];
   /** */
   plugin_cleanup: [plugin: Plugin];

   /** notified just before the systems for a specific schedule are executed in world.update */
   schedule_started: [schedule: Schedule];
   /** notified just after all systems for a specific schedule have executed in world.update */
   schedule_ended: [schedule: Schedule];
};

export type EventHandler<EA extends Record<ObjK, unknown[]>, E extends keyof EA> = (
   ...args: EA[E]
) => MaybePromise<unknown>;
