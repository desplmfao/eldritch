/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/types/markers.ts
 */

import type { Component } from '@self/types/component';
import type { ResourceConstructor } from '@self/types/resource';
import type { EntityId } from '@self/types/entity';

/**
 * a marker type used in system method parameters to request a mutable reference to a specific resource
 *
 * @template R - the resource class constructor
 *
 * @example
 * ```ts
 * // to get a mutable reference:
 * update(config: Res<GameConfig>) {
 *    config.difficulty = 10;
 * }
 *
 * // to get a readonly reference:
 * update(config: Res<Readonly<GameConfig>>) {
 *    console.log(config.difficulty);
 * }
 * ```
 */
export type Res<R extends (
   InstanceType<ResourceConstructor>
)> =
   R
   & { __tddi: true };

//
//


/**
 * a filter for a `Query` that specifies components an entity **must have**
 *
 * @template T - a tuple of component types
 *
 * @example
 * ```ts
 * // query for entities that have Position AND a Player tag
 * update(query: Query<[Position], [With<Player>]>) {
 *   // ...
 * }
 * ```
 */
export type With<T extends (
   Readonly<Component[]> |
   Readonly<Component>
)> =
   T
   & { __tddi: true };

/**
 * a filter for a `Query` that specifies components an entity **must NOT have**
 *
 * @template T - a tuple of component types
 *
 * @example
 * ```ts
 * // query for entities that have Position but NOT a Dead tag
 * update(query: Query<[Position], [Without<Dead>]>) {
 *   // ...
 * }
 * ```
 * 
 * @example
 * ```ts
 * // query for entities that have Position that are NOT `Dead` and also NOT `Player`
 * update(query: Query<[Position], [Without<[Dead, Player]>]>) {
 *   // ...
 * }
 * ```
 */
export type Without<T extends (
   Readonly<Component[]> |
   Readonly<Component>
)> =
   T
   & { __tddi: true };

/** @internal */
export type QueryFilter =
   (
      With<
         Readonly<Component[]> |
         Readonly<Component>
      > |
      Without<
         Readonly<Component[]> |
         Readonly<Component>
      >
   )
   & { __tddi: true };

/**
 * a marker type for system parameters that injects an async iterator over entities matching a set of criteria
 * 
 * this is the primary way systems access and mutate component data
 *
 * @template ComponentsTuple - a tuple specifying the component types to access for each entity. by default, components are mutable. wrap a component type with `Readonly<T>` for immutable access
 * @template FilterTuple - an optional tuple of `With<...>` or `Without<...>` filters to further refine the query
 *
 * @example
 * ```ts
 * // query for entities with a mutable Position and a read-only Velocity, that also have a Player tag and do not have a Dead tag
 * update(
 *    query: Query<[Position, Readonly<Velocity>], [With<Player>, Without<Dead>]>
 * ) {
 *    for await (const [entity_id, [pos, vel]] of query) {
 *       // pos is mutable, vel is readonly
 *       pos.x += vel.x;
 *    }
 * }
 * ```
 */
export type Query<
   Components extends (
      Component |
      Readonly<Component> |
      readonly (
         Component |
         Readonly<Component>
      )[]
   ),
   Filters extends (
      Readonly<QueryFilter[]>
   ) = readonly QueryFilter[]
> =
   (
      [
         entity_id: EntityId,
         components: Components extends readonly any[]
         ? { -readonly [K in keyof Components]: Components[K] }
         : [Components]
      ][]
   )
   & { __tddi: true };

/**
 * a marker type for injecting system-local state
 *
 * the state is initialized to an empty object `{}` when the system is created
 * and persists across all updates for that specific system instance
 *
 * @template T - the type of the local state object
 *
 * @example
 * ```ts
 * interface MySystemState { click_count: number; }
 *
 * class MySystem extends System {
 *    update(local: Local<MySystemState>) {
 *       local.click_count++;
 *    }
 * }
 * ```
 */
export type Local<T extends (
   object
)> =
   T
   & { __tddi: true };