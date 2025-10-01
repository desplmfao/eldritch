/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-core/src/types/component.ts
 */

import type { t } from '@eldritch-engine/type-utils/guerrero/markers';

export type ComponentConstructorParameters<C> =
   (C extends new (
      ...args: infer P
   ) => unknown
      ? P
      : never);

/** an object containing initial values for a component's properties */
export type ComponentInitializer<C extends ComponentConstructor> = t<Partial<InstanceType<C>>, 'dependencies'>;

/** constructor type for component classes */
export type ComponentConstructor<C extends Component = Component> =
   (new (...args: any[]) => C)
   & {
      /** optional default values for the component */
      default?: ComponentInitializer<ComponentConstructor>;
   };

/** a tuple representing a component to be added, containing its constructor and an initializer object */
export type ComponentDefinition = [ComponentConstructor, ComponentInitializer<ComponentConstructor>];

/** defines dependencies for components or systems */
export interface ComponentDependencies {
   /** */
   systems?: string[];
   /** */
   components?: string[];
}

/** base class for all components */
export abstract class Component {
   /** optional dependencies required by this component */
   readonly dependencies?: ComponentDependencies = {};
}