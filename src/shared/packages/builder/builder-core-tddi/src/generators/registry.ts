/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/builder/builder-core-tddi/src/generators/registry.ts
 */

import type { IInjectionGenerator } from '@eldritch-engine/type-utils/tddi/generator';

import { ResourceGenerator } from '@self/generators/builtins/resource';
import { LocalGenerator } from '@self/generators/builtins/local';
import { QueryGenerator } from '@self/generators/builtins/query';

// TODO: add query first implementation
export class InjectionGeneratorRegistry {
   #generators: Map<string, IInjectionGenerator> = new Map();

   constructor(
      custom_generators?: IInjectionGenerator[]
   ) {
      this.register(new ResourceGenerator());
      this.register(new LocalGenerator());
      this.register(new QueryGenerator());

      for (const generator of custom_generators ?? []) {
         this.register(generator);
      }
   }

   register(generator: IInjectionGenerator): void {
      this.#generators.set(generator.marker_name, generator);
   }

   get(marker_name: string): IInjectionGenerator | undefined {
      return this.#generators.get(marker_name);
   }
}