/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/engine/packages/ecs/ecs-storage-backend-archetype/tests/archetype.test.ts
 */

import { describe, it, expect, beforeEach } from 'bun:test';

import { default_logger } from '@eldritch-engine/logger/logger';

import {
   Archetype,
   ResourceArchetypeMap,
   type ArchetypeId
} from '@self/ecs/resources/archetype';

import {
   archetype_calculate_id,
   archetype_find_or_create,
   archetype_remove_entity_from,
   archetype_add_entity_to,
   archetype_move_entity_to,
   archetype_find_matching,
   archetype_get_target_after_change,
   archetype_cleanup
} from '@self/operations/archetype';

import { Component } from '@eldritch-engine/ecs-core/types/component';
import type { EntityId } from '@eldritch-engine/ecs-core/types/entity';

class ComponentA extends Component {
   value = 'A';
}

class ComponentB extends Component {
   count = 0;
}

class ComponentC extends Component {
   active = true;
}

class ComponentX extends Component {
   x_val = 100;
}

class ComponentY extends Component {
   y_val = 200;
}

describe('archetype system operations', () => {
   let r_archetypes: ResourceArchetypeMap;

   beforeEach(() => {
      default_logger.options.log_level = 5;
      r_archetypes = new ResourceArchetypeMap();

      archetype_find_or_create(r_archetypes, new Set<string>());
   });

   describe('archetype_calculate_id', () => {
      it('should return |empty| for an empty set of component names', () => {
         expect(archetype_calculate_id(new Set<string>())).toBe('|empty|');
      });

      it('should return the component name for a single component', () => {
         expect(archetype_calculate_id(new Set([ComponentA.name]))).toBe(ComponentA.name);
      });

      it('should sort component names alphabetically and join with |', () => {
         const names1 = new Set([ComponentB.name, ComponentA.name, ComponentC.name]);
         const names2 = new Set([ComponentA.name, ComponentC.name, ComponentB.name]);
         const expected_id = `${ComponentA.name}|${ComponentB.name}|${ComponentC.name}`;

         expect(archetype_calculate_id(names1)).toBe(expected_id);
         expect(archetype_calculate_id(names2)).toBe(expected_id);
      });
   });

   describe('archetype_find_or_create', () => {
      it('should create a new archetype if one does not exist', () => {
         const names = new Set([ComponentA.name, ComponentB.name]);
         const archetype_id = archetype_calculate_id(names);

         expect(r_archetypes.archetypes_by_id.has(archetype_id)).toBe(false);

         const archetype = archetype_find_or_create(r_archetypes, names);

         expect(archetype).toBeInstanceOf(Archetype);
         expect(archetype.id).toBe(archetype_id);
         expect(archetype.component_names).toEqual(names);
         expect(r_archetypes.archetypes_by_id.get(archetype_id)).toBe(archetype);
         expect(r_archetypes.add_transitions.has(archetype_id)).toBe(true);
         expect(r_archetypes.remove_transitions.has(archetype_id)).toBe(true);
         expect(r_archetypes.archetypes_by_component_name.get(ComponentA.name)?.has(archetype_id)).toBe(true);
         expect(r_archetypes.archetypes_by_component_name.get(ComponentB.name)?.has(archetype_id)).toBe(true);
      });

      it('should return an existing archetype if one matches', () => {
         const names = new Set([ComponentA.name]);
         const archetype1 = archetype_find_or_create(r_archetypes, names);
         const archetype2 = archetype_find_or_create(r_archetypes, new Set([ComponentA.name]));

         expect(archetype2).toBe(archetype1);
         expect(r_archetypes.archetypes_by_id.size).toBe(2);
      });

      it('should correctly update graph transitions when creating archetypes sequentially (implicitly testing archetype_update_graph)', () => {
         const arch_empty = r_archetypes.archetypes_by_id.get('|empty|')!;
         const arch_a = archetype_find_or_create(r_archetypes, new Set([ComponentA.name]));
         const arch_ab = archetype_find_or_create(r_archetypes, new Set([ComponentA.name, ComponentB.name]));

         expect(r_archetypes.add_transitions.get(arch_empty.id)?.get(ComponentA.name)).toBe(arch_a.id);
         expect(r_archetypes.remove_transitions.get(arch_a.id)?.get(ComponentA.name)).toBe(arch_empty.id);

         expect(r_archetypes.add_transitions.get(arch_a.id)?.get(ComponentB.name)).toBe(arch_ab.id);
         expect(r_archetypes.remove_transitions.get(arch_ab.id)?.get(ComponentB.name)).toBe(arch_a.id);

         const arch_b = archetype_find_or_create(r_archetypes, new Set([ComponentB.name]));
         expect(r_archetypes.remove_transitions.get(arch_ab.id)?.get(ComponentA.name)).toBe(arch_b.id);
         expect(r_archetypes.add_transitions.get(arch_b.id)?.get(ComponentA.name)).toBe(arch_ab.id);
      });
   });

   describe('archetype entity addition and removal (archetype_add_entity_to, archetype_remove_entity_from)', () => {
      let archetype_ab: Archetype;

      const entity1_id = 1;
      const entity2_id = 2;

      let components_e1: Map<string, Component>;
      let components_e2: Map<string, Component>;

      beforeEach(() => {
         archetype_ab = archetype_find_or_create(
            r_archetypes,
            new Set([ComponentA.name, ComponentB.name])
         );

         components_e1 = new Map<string, Component>([
            [ComponentA.name, new ComponentA()],
            [ComponentB.name, new ComponentB()],
         ]);

         components_e2 = new Map<string, Component>([
            [ComponentA.name, new ComponentA()],
            [ComponentB.name, new ComponentB()],
         ]);
      });

      it('should add an entity to an archetype', () => {
         archetype_add_entity_to(r_archetypes, entity1_id, archetype_ab.id, components_e1);

         expect(archetype_ab.entities).toContain(entity1_id);
         expect(archetype_ab.entity_to_index.get(entity1_id)).toBe(0);
         expect(archetype_ab.component_arrays.get(ComponentA.name)?.[0]).toBe(components_e1.get(ComponentA.name)!);
         expect(archetype_ab.component_arrays.get(ComponentB.name)?.[0]).toBe(components_e1.get(ComponentB.name)!);
         expect(r_archetypes.entity_to_archetype_id.get(entity1_id)).toBe(archetype_ab.id);
      });

      it('should remove an entity from an archetype (not the last one) using swap-and-pop', () => {
         archetype_add_entity_to(r_archetypes, entity1_id, archetype_ab.id, components_e1);
         archetype_add_entity_to(r_archetypes, entity2_id, archetype_ab.id, components_e2);

         const removed_comps = archetype_remove_entity_from(r_archetypes, entity1_id);
         expect(removed_comps).toBeDefined();
         expect(removed_comps?.get(ComponentA.name)).toBe(components_e1.get(ComponentA.name)!);

         expect(archetype_ab.entities.length).toBe(1);
         expect(archetype_ab.entities[0]).toBe(entity2_id);
         expect(archetype_ab.entity_to_index.get(entity2_id)).toBe(0);
         expect(archetype_ab.component_arrays.get(ComponentA.name)?.[0]).toBe(components_e2.get(ComponentA.name)!);
         expect(r_archetypes.entity_to_archetype_id.has(entity1_id)).toBe(false);
      });

      it('should remove the last entity from an archetype and trigger cleanup if not |empty|', () => {
         archetype_add_entity_to(r_archetypes, entity1_id, archetype_ab.id, components_e1);
         const archetype_id_ab = archetype_ab.id;

         archetype_remove_entity_from(r_archetypes, entity1_id);

         expect(archetype_ab.entities.length).toBe(0);
         expect(r_archetypes.archetypes_by_id.has(archetype_id_ab)).toBe(false);
      });

      it('should not cleanup the |empty| archetype', () => {
         const empty_archetype_id = '|empty|';
         const empty_archetype = r_archetypes.archetypes_by_id.get(empty_archetype_id)!;

         r_archetypes.entity_to_archetype_id.set(entity1_id, empty_archetype_id);
         empty_archetype.entities.push(entity1_id);
         empty_archetype.entity_to_index.set(entity1_id, 0);

         archetype_remove_entity_from(r_archetypes, entity1_id);
         expect(r_archetypes.archetypes_by_id.has(empty_archetype_id)).toBe(true);
         expect(empty_archetype.entities.length).toBe(0);
      });

      it('should throw if adding entity with missing components for the archetype', () => {
         const incomplete_components = new Map([[ComponentA.name, new ComponentA()]]);

         expect(() => archetype_add_entity_to(r_archetypes, entity1_id, archetype_ab.id, incomplete_components))
            .toThrow(new RegExp(`missing component ${ComponentB.name} in provided Map for entity ${entity1_id} being added to archetype ${archetype_ab.id}`));
      });

      it('should return undefined if removing an entity not in any archetype', () => {
         const non_existent_entity_id = 999;

         expect(archetype_remove_entity_from(r_archetypes, non_existent_entity_id)).toBeUndefined();
      });
   });

   describe('archetype_move_entity_to', () => {
      const entity_id = 1;

      let arch_a: Archetype;
      let arch_ab: Archetype;
      let arch_b: Archetype;

      let comp_a_inst: ComponentA;
      let comp_b_inst: ComponentB;

      beforeEach(() => {
         comp_a_inst = new ComponentA();
         comp_b_inst = new ComponentB();

         arch_a = archetype_find_or_create(r_archetypes, new Set([ComponentA.name]));
         arch_ab = archetype_find_or_create(r_archetypes, new Set([ComponentA.name, ComponentB.name]));
         arch_b = archetype_find_or_create(r_archetypes, new Set([ComponentB.name]));

         archetype_add_entity_to(r_archetypes, entity_id, arch_a.id, new Map([[ComponentA.name, comp_a_inst]]));
      });

      it('should move entity by adding a component (A -> AB)', () => {
         const final_components_for_ab = new Map<string, Component>([
            [ComponentA.name, comp_a_inst],
            [ComponentB.name, comp_b_inst]
         ]);

         const moved = archetype_move_entity_to(r_archetypes, entity_id, arch_ab.id, final_components_for_ab);

         expect(moved).toBe(true);
         expect(arch_a.entities).not.toContain(entity_id);
         expect(arch_ab.entities).toContain(entity_id);
         expect(r_archetypes.entity_to_archetype_id.get(entity_id)).toBe(arch_ab.id);
         expect(arch_ab.component_arrays.get(ComponentA.name)?.includes(comp_a_inst)).toBe(true);
         expect(arch_ab.component_arrays.get(ComponentB.name)?.includes(comp_b_inst)).toBe(true);
      });

      it('should move entity by removing a component (from AB -> B)', () => {
         let final_components_for_ab = new Map<string, Component>([
            [ComponentA.name, comp_a_inst],
            [ComponentB.name, comp_b_inst]
         ]);

         archetype_move_entity_to(r_archetypes, entity_id, arch_ab.id, final_components_for_ab);

         const final_components_for_b = new Map([[ComponentB.name, comp_b_inst]]);
         const moved = archetype_move_entity_to(r_archetypes, entity_id, arch_b.id, final_components_for_b);

         expect(moved).toBe(true);
         expect(arch_ab.entities).not.toContain(entity_id);
         expect(arch_b.entities).toContain(entity_id);
         expect(r_archetypes.entity_to_archetype_id.get(entity_id)).toBe(arch_b.id);
         expect(arch_b.component_arrays.get(ComponentA.name)).toBeUndefined();
         expect(arch_b.component_arrays.get(ComponentB.name)?.includes(comp_b_inst)).toBe(true);
      });

      it('should return false if new archetype is same as old', () => {
         const final_components = new Map([[ComponentA.name, comp_a_inst]]);

         const moved = archetype_move_entity_to(r_archetypes, entity_id, arch_a.id, final_components);
         expect(moved).toBe(false);
      });
   });

   describe('archetype_find_matching', () => {
      let arch_a_id: ArchetypeId;
      let arch_ab_id: ArchetypeId;
      let arch_bc_id: ArchetypeId;
      let arch_abc_id: ArchetypeId;

      beforeEach(() => {
         arch_a_id = archetype_find_or_create(r_archetypes, new Set([ComponentA.name])).id;
         arch_ab_id = archetype_find_or_create(r_archetypes, new Set([ComponentA.name, ComponentB.name])).id;
         arch_bc_id = archetype_find_or_create(r_archetypes, new Set([ComponentB.name, ComponentC.name])).id;
         arch_abc_id = archetype_find_or_create(r_archetypes, new Set([ComponentA.name, ComponentB.name, ComponentC.name])).id;
      });

      it('should find archetypes matching a single component', () => {
         const matches_a = archetype_find_matching(r_archetypes, [ComponentA.name]);
         expect(matches_a).toEqual(new Set([arch_a_id, arch_ab_id, arch_abc_id]));

         const matches_c = archetype_find_matching(r_archetypes, [ComponentC.name]);
         expect(matches_c).toEqual(new Set([arch_bc_id, arch_abc_id]));
      });

      it('should find archetypes matching multiple components (intersection)', () => {
         const matches_ab = archetype_find_matching(r_archetypes, [ComponentA.name, ComponentB.name]);
         expect(matches_ab).toEqual(new Set([arch_ab_id, arch_abc_id]));
      });

      it('should return empty set if a required component is not in any archetype', () => {
         const matches_d = archetype_find_matching(r_archetypes, ['ComponentD']);
         expect(matches_d.size).toBe(0);

         const matches_ad = archetype_find_matching(r_archetypes, [ComponentA.name, 'ComponentD']);
         expect(matches_ad.size).toBe(0);
      });

      it('should return empty set if an empty component list is provided', () => {
         const matches_empty = archetype_find_matching(r_archetypes, []);
         expect(matches_empty.size).toBe(0);
      });
   });

   describe('archetype_get_target_after_change', () => {
      const entity_id = 1;

      let arch_empty: Archetype;
      let arch_a: Archetype;
      let arch_ab: Archetype;
      let arch_abc: Archetype;

      beforeEach(() => {
         arch_empty = r_archetypes.archetypes_by_id.get('|empty|')!;

         arch_a = archetype_find_or_create(r_archetypes, new Set([ComponentA.name]));
         arch_ab = archetype_find_or_create(r_archetypes, new Set([ComponentA.name, ComponentB.name]));
         arch_abc = archetype_find_or_create(r_archetypes, new Set([ComponentA.name, ComponentB.name, ComponentC.name]));

         archetype_add_entity_to(r_archetypes, entity_id, arch_a.id, new Map([[ComponentA.name, new ComponentA()]]));
      });

      it('should find target by adding a single component (graph hit)', () => {
         const target = archetype_get_target_after_change(r_archetypes, entity_id, [ComponentB.name]);

         expect(target.id).toBe(arch_ab.id);
      });

      it('should find target by removing a single component (graph hit)', () => {
         const final_components_for_ab = new Map<string, Component>([
            [ComponentA.name, new ComponentA()],
            [ComponentB.name, new ComponentB()]
         ])

         archetype_move_entity_to(r_archetypes, entity_id, arch_ab.id, final_components_for_ab);

         const target = archetype_get_target_after_change(r_archetypes, entity_id, undefined, [ComponentB.name]);

         expect(target.id).toBe(arch_a.id);
      });

      it('should calculate target for multiple additions (graph miss if direct transition not present)', () => {
         const target = archetype_get_target_after_change(r_archetypes, entity_id, [ComponentB.name, ComponentC.name]);

         expect(target.id).toBe(arch_abc.id);
      });

      it('should calculate target when adding to an entity in the empty archetype', () => {
         const entity_in_empty = 2;

         archetype_add_entity_to(r_archetypes, entity_in_empty, arch_empty.id, new Map());

         const target = archetype_get_target_after_change(r_archetypes, entity_in_empty, [ComponentC.name]);
         const expected_arch_c_id = archetype_calculate_id(new Set([ComponentC.name]));

         expect(target.id).toBe(expected_arch_c_id);
      });

      it('should calculate target when removing the last component(s) to become empty', () => {
         const target = archetype_get_target_after_change(r_archetypes, entity_id, undefined, [ComponentA.name]);

         expect(target.id).toBe(arch_empty.id);
      });

      it('should return current archetype if no changes (no added/removed arrays)', () => {
         const target = archetype_get_target_after_change(r_archetypes, entity_id);

         expect(target.id).toBe(arch_a.id);
      });

      it('should return current archetype if empty added/removed arrays provided', () => {
         const target = archetype_get_target_after_change(r_archetypes, entity_id, [], []);

         expect(target.id).toBe(arch_a.id);
      });
   });

   describe('archetype_cleanup', () => {
      it('should not cleanup |empty| archetype or non-empty archetypes', () => {
         const arch_empty_id = '|empty|';
         const arch_empty = r_archetypes.archetypes_by_id.get(arch_empty_id)!;
         const arch_a = archetype_find_or_create(r_archetypes, new Set([ComponentA.name]));

         archetype_add_entity_to(r_archetypes, 1, arch_a.id, new Map([[ComponentA.name, new ComponentA()]]));

         archetype_cleanup(r_archetypes, arch_empty);
         expect(r_archetypes.archetypes_by_id.has(arch_empty_id)).toBe(true);

         archetype_cleanup(r_archetypes, arch_a);
         expect(r_archetypes.archetypes_by_id.has(arch_a.id)).toBe(true);
      });

      it('should remove an empty archetype and update related structures (transitions, by_component_name)', () => {
         const arch_b = archetype_find_or_create(r_archetypes, new Set([ComponentB.name]));
         const arch_ab = archetype_find_or_create(r_archetypes, new Set([ComponentA.name, ComponentB.name]));
         const arch_b_id = arch_b.id;

         expect(r_archetypes.remove_transitions.get(arch_ab.id)?.get(ComponentA.name)).toBe(arch_b_id);
         expect(r_archetypes.archetypes_by_component_name.get(ComponentB.name)?.has(arch_b_id)).toBe(true);

         archetype_cleanup(r_archetypes, arch_b);

         expect(r_archetypes.archetypes_by_id.has(arch_b_id)).toBe(false);
         expect(r_archetypes.archetypes_by_component_name.get(ComponentB.name)?.has(arch_b_id)).toBe(false);
         expect(r_archetypes.remove_transitions.get(arch_ab.id)?.has(ComponentA.name)).toBe(false);
         expect(r_archetypes.add_transitions.has(arch_b_id)).toBe(false);
         expect(r_archetypes.remove_transitions.has(arch_b_id)).toBe(false);
      });
   });
});

describe('archetype system operations - advanced transitions and graph management', () => {
   let r_archetypes: ResourceArchetypeMap;

   const entity1 = 1;
   const entity2 = 2;

   beforeEach(() => {
      default_logger.options.log_level = 5;
      r_archetypes = new ResourceArchetypeMap();

      archetype_find_or_create(r_archetypes, new Set<string>());
   });


   it('rapid fire component changes on a single entity (add, add, remove, add, remove)', () => {
      archetype_add_entity_to(r_archetypes, entity1, '|empty|', new Map());

      let current_archetype_id = r_archetypes.entity_to_archetype_id.get(entity1)!;
      let current_components = new Map<string, Component>();

      // +a
      let target_arch = archetype_get_target_after_change(r_archetypes, entity1, [ComponentA.name]);
      current_components.set(ComponentA.name, new ComponentA());
      archetype_move_entity_to(r_archetypes, entity1, target_arch.id, new Map(current_components));
      current_archetype_id = r_archetypes.entity_to_archetype_id.get(entity1)!;
      expect(current_archetype_id).toBe(archetype_calculate_id(new Set([ComponentA.name])));

      // +b (now a, b)
      target_arch = archetype_get_target_after_change(r_archetypes, entity1, [ComponentB.name]);
      current_components.set(ComponentB.name, new ComponentB());
      archetype_move_entity_to(r_archetypes, entity1, target_arch.id, new Map(current_components));
      current_archetype_id = r_archetypes.entity_to_archetype_id.get(entity1)!;
      expect(current_archetype_id).toBe(archetype_calculate_id(new Set([ComponentA.name, ComponentB.name])));

      // -a (now b)
      target_arch = archetype_get_target_after_change(r_archetypes, entity1, undefined, [ComponentA.name]);
      current_components.delete(ComponentA.name);
      archetype_move_entity_to(r_archetypes, entity1, target_arch.id, new Map(current_components));
      current_archetype_id = r_archetypes.entity_to_archetype_id.get(entity1)!;
      expect(current_archetype_id).toBe(archetype_calculate_id(new Set([ComponentB.name])));

      // +c (now b, c)
      target_arch = archetype_get_target_after_change(r_archetypes, entity1, [ComponentC.name]);
      current_components.set(ComponentC.name, new ComponentC());
      archetype_move_entity_to(r_archetypes, entity1, target_arch.id, new Map(current_components));
      current_archetype_id = r_archetypes.entity_to_archetype_id.get(entity1)!;
      expect(current_archetype_id).toBe(archetype_calculate_id(new Set([ComponentB.name, ComponentC.name])));

      // -b (now c)
      target_arch = archetype_get_target_after_change(r_archetypes, entity1, undefined, [ComponentB.name]);
      current_components.delete(ComponentB.name);
      archetype_move_entity_to(r_archetypes, entity1, target_arch.id, new Map(current_components));
      current_archetype_id = r_archetypes.entity_to_archetype_id.get(entity1)!;
      expect(current_archetype_id).toBe(archetype_calculate_id(new Set([ComponentC.name])));

      const final_archetype = r_archetypes.archetypes_by_id.get(current_archetype_id)!;
      expect(final_archetype.component_names).toEqual(new Set([ComponentC.name]));
      expect(final_archetype.entities).toContain(entity1);
      expect(final_archetype.component_arrays.get(ComponentC.name)?.[0]).toBeInstanceOf(ComponentC);
   });

   it('complex path through multiple archetypes (empty -> A -> AB -> ABC -> AC -> C -> empty)', () => {
      archetype_add_entity_to(r_archetypes, entity1, '|empty|', new Map());

      let current_components = new Map<string, Component>();

      const comp_a = new ComponentA();
      const comp_b = new ComponentB();
      const comp_c = new ComponentC();

      // -> a
      let target_arch = archetype_get_target_after_change(r_archetypes, entity1, [ComponentA.name]);
      current_components.set(ComponentA.name, comp_a);
      archetype_move_entity_to(r_archetypes, entity1, target_arch.id, new Map(current_components));
      expect(r_archetypes.entity_to_archetype_id.get(entity1)).toBe(archetype_calculate_id(new Set([ComponentA.name])));

      // -> ab
      target_arch = archetype_get_target_after_change(r_archetypes, entity1, [ComponentB.name]);
      current_components.set(ComponentB.name, comp_b);
      archetype_move_entity_to(r_archetypes, entity1, target_arch.id, new Map(current_components));
      expect(r_archetypes.entity_to_archetype_id.get(entity1)).toBe(archetype_calculate_id(new Set([ComponentA.name, ComponentB.name])));

      // -> abc
      target_arch = archetype_get_target_after_change(r_archetypes, entity1, [ComponentC.name]);
      current_components.set(ComponentC.name, comp_c);
      archetype_move_entity_to(r_archetypes, entity1, target_arch.id, new Map(current_components));
      expect(r_archetypes.entity_to_archetype_id.get(entity1)).toBe(archetype_calculate_id(new Set([ComponentA.name, ComponentB.name, ComponentC.name])));

      // -> ac (remove b)
      target_arch = archetype_get_target_after_change(r_archetypes, entity1, undefined, [ComponentB.name]);
      current_components.delete(ComponentB.name);
      archetype_move_entity_to(r_archetypes, entity1, target_arch.id, new Map(current_components));
      expect(r_archetypes.entity_to_archetype_id.get(entity1)).toBe(archetype_calculate_id(new Set([ComponentA.name, ComponentC.name])));

      // -> c (remove a)
      target_arch = archetype_get_target_after_change(r_archetypes, entity1, undefined, [ComponentA.name]);
      current_components.delete(ComponentA.name);
      archetype_move_entity_to(r_archetypes, entity1, target_arch.id, new Map(current_components));
      expect(r_archetypes.entity_to_archetype_id.get(entity1)).toBe(archetype_calculate_id(new Set([ComponentC.name])));

      // -> empty (remove c)
      target_arch = archetype_get_target_after_change(r_archetypes, entity1, undefined, [ComponentC.name]);
      current_components.delete(ComponentC.name);
      archetype_move_entity_to(r_archetypes, entity1, target_arch.id, new Map(current_components));
      expect(r_archetypes.entity_to_archetype_id.get(entity1)).toBe('|empty|');

      const final_archetype = r_archetypes.archetypes_by_id.get('|empty|')!;
      expect(final_archetype.entities).toContain(entity1);
   });

   it('transition graph correctness - creating archetypes out of typical order', () => {
      // order: empty, a, c, ac, b, ab, bc, abc
      const arch_a = archetype_find_or_create(r_archetypes, new Set([ComponentA.name]));
      const arch_c = archetype_find_or_create(r_archetypes, new Set([ComponentC.name]));
      const arch_ac = archetype_find_or_create(r_archetypes, new Set([ComponentA.name, ComponentC.name]));

      // check a <-> ac transitions
      expect(r_archetypes.add_transitions.get(arch_a.id)?.get(ComponentC.name)).toBe(arch_ac.id);
      expect(r_archetypes.remove_transitions.get(arch_ac.id)?.get(ComponentC.name)).toBe(arch_a.id);
      // check c <-> ac transitions
      expect(r_archetypes.add_transitions.get(arch_c.id)?.get(ComponentA.name)).toBe(arch_ac.id);
      expect(r_archetypes.remove_transitions.get(arch_ac.id)?.get(ComponentA.name)).toBe(arch_c.id);

      const arch_b = archetype_find_or_create(r_archetypes, new Set([ComponentB.name]));
      const arch_ab = archetype_find_or_create(r_archetypes, new Set([ComponentA.name, ComponentB.name]));
      const arch_bc = archetype_find_or_create(r_archetypes, new Set([ComponentB.name, ComponentC.name]));
      const arch_abc = archetype_find_or_create(r_archetypes, new Set([ComponentA.name, ComponentB.name, ComponentC.name]));

      // check ab <-> abc
      expect(r_archetypes.add_transitions.get(arch_ab.id)?.get(ComponentC.name)).toBe(arch_abc.id);
      expect(r_archetypes.remove_transitions.get(arch_abc.id)?.get(ComponentC.name)).toBe(arch_ab.id);
      // check ac <-> abc
      expect(r_archetypes.add_transitions.get(arch_ac.id)?.get(ComponentB.name)).toBe(arch_abc.id);
      expect(r_archetypes.remove_transitions.get(arch_abc.id)?.get(ComponentB.name)).toBe(arch_ac.id);
      // check bc <-> abc
      expect(r_archetypes.add_transitions.get(arch_bc.id)?.get(ComponentA.name)).toBe(arch_abc.id);
      expect(r_archetypes.remove_transitions.get(arch_abc.id)?.get(ComponentA.name)).toBe(arch_bc.id);
   });

   it('cleanup of multiple empty archetypes and graph integrity', () => {
      const arch_a = archetype_find_or_create(r_archetypes, new Set([ComponentA.name]));
      const arch_b = archetype_find_or_create(r_archetypes, new Set([ComponentB.name]));
      const arch_c = archetype_find_or_create(r_archetypes, new Set([ComponentC.name]));
      const arch_d = archetype_find_or_create(r_archetypes, new Set(['ComponentD']));
      const arch_ab = archetype_find_or_create(r_archetypes, new Set([ComponentA.name, ComponentB.name]));

      archetype_add_entity_to(r_archetypes, entity1, arch_a.id, new Map([[ComponentA.name, new ComponentA()]]));
      archetype_add_entity_to(r_archetypes, entity2, arch_b.id, new Map([[ComponentB.name, new ComponentB()]]));

      const entity_for_ab = 3;

      archetype_add_entity_to(r_archetypes, entity_for_ab, arch_ab.id, new Map<string, Component>([
         [ComponentA.name, new ComponentA()],
         [ComponentB.name, new ComponentB()]
      ]));

      expect(r_archetypes.remove_transitions.get(arch_ab.id)?.get(ComponentB.name)).toBe(arch_a.id);
      expect(r_archetypes.remove_transitions.get(arch_ab.id)?.get(ComponentA.name)).toBe(arch_b.id);

      archetype_remove_entity_from(r_archetypes, entity1); // arch_a becomes empty
      archetype_remove_entity_from(r_archetypes, entity2); // arch_b becomes empty

      expect(r_archetypes.archetypes_by_id.has(arch_a.id)).toBe(false);
      expect(r_archetypes.archetypes_by_id.has(arch_b.id)).toBe(false);
      expect(r_archetypes.remove_transitions.get(arch_ab.id)?.has(ComponentB.name)).toBe(false); // was to arch_a
      expect(r_archetypes.remove_transitions.get(arch_ab.id)?.has(ComponentA.name)).toBe(false); // was to arch_b
      expect(r_archetypes.archetypes_by_component_name.get(ComponentA.name)?.has(arch_a.id)).toBe(false);
      expect(r_archetypes.archetypes_by_component_name.get(ComponentB.name)?.has(arch_b.id)).toBe(false);
      expect(r_archetypes.add_transitions.has(arch_a.id)).toBe(false);
      expect(r_archetypes.remove_transitions.has(arch_a.id)).toBe(false);
      expect(r_archetypes.add_transitions.has(arch_b.id)).toBe(false);
      expect(r_archetypes.remove_transitions.has(arch_b.id)).toBe(false);

      archetype_cleanup(r_archetypes, arch_c);
      archetype_cleanup(r_archetypes, arch_d);
      expect(r_archetypes.archetypes_by_id.has(arch_c.id)).toBe(false);
      expect(r_archetypes.archetypes_by_id.has(arch_d.id)).toBe(false);
      expect(r_archetypes.archetypes_by_id.has(arch_ab.id)).toBe(true);
   });

   it('entity moving to an archetype that then becomes empty and is cleaned up, then entity moves again', async () => {
      const arch_a = archetype_find_or_create(r_archetypes, new Set([ComponentA.name]));
      const arch_b = archetype_find_or_create(r_archetypes, new Set([ComponentB.name]));
      const comp_a_inst = new ComponentA();
      const comp_b_inst = new ComponentB();

      archetype_add_entity_to(r_archetypes, entity1, arch_a.id, new Map([[ComponentA.name, comp_a_inst]]));
      expect(r_archetypes.entity_to_archetype_id.get(entity1)).toBe(arch_a.id);

      archetype_move_entity_to(r_archetypes, entity1, arch_b.id, new Map([[ComponentB.name, comp_b_inst]]));
      expect(r_archetypes.archetypes_by_id.has(arch_a.id)).toBe(false); // arch_a should be gone
      expect(r_archetypes.entity_to_archetype_id.get(entity1)).toBe(arch_b.id);

      const final_components_for_a = new Map([[ComponentA.name, comp_a_inst]]);
      const target_arch_a_new = archetype_get_target_after_change(r_archetypes, entity1, [ComponentA.name], [ComponentB.name]);
      archetype_move_entity_to(r_archetypes, entity1, target_arch_a_new.id, final_components_for_a);

      expect(r_archetypes.entity_to_archetype_id.get(entity1)).toBe(target_arch_a_new.id);
      expect(target_arch_a_new.component_names).toEqual(new Set([ComponentA.name]));
      expect(r_archetypes.archetypes_by_id.has(arch_b.id)).toBe(false); // arch_b should now be gone
      expect(r_archetypes.archetypes_by_id.has(target_arch_a_new.id)).toBe(true);
   });

   it('adding and removing a component in the same \'conceptual tick\' (testing target archetype calculation)', () => {
      archetype_add_entity_to(r_archetypes, entity1, '|empty|', new Map());

      const initial_components = new Map<string, Component>();
      const target_arch = archetype_get_target_after_change(r_archetypes, entity1, [ComponentA.name], [ComponentA.name]);
      expect(target_arch.id).toBe('|empty|');
      archetype_move_entity_to(r_archetypes, entity1, target_arch.id, new Map(initial_components));
      expect(r_archetypes.entity_to_archetype_id.get(entity1)).toBe('|empty|');

      const arch_a = archetype_find_or_create(r_archetypes, new Set([ComponentA.name]));
      const comp_a = new ComponentA();
      initial_components.set(ComponentA.name, comp_a);
      archetype_move_entity_to(r_archetypes, entity1, arch_a.id, new Map(initial_components));

      const target_arch_b = archetype_get_target_after_change(r_archetypes, entity1, [ComponentB.name], [ComponentA.name]);
      const expected_arch_b_id = archetype_calculate_id(new Set([ComponentB.name]));
      expect(target_arch_b.id).toBe(expected_arch_b_id);

      initial_components.delete(ComponentA.name);
      initial_components.set(ComponentB.name, new ComponentB());
      archetype_move_entity_to(r_archetypes, entity1, target_arch_b.id, new Map(initial_components));
      expect(r_archetypes.entity_to_archetype_id.get(entity1)).toBe(expected_arch_b_id);
   });
});

describe('archetype system operations - more advanced transitions and graph management', () => {
   let r_archetypes: ResourceArchetypeMap;

   const entity1 = 1;
   const entity2 = 2;
   const entity3 = 3;

   beforeEach(() => {
      default_logger.options.log_level = 5;
      r_archetypes = new ResourceArchetypeMap();

      archetype_find_or_create(r_archetypes, new Set<string>());
   });

   it('archetype_get_target_after_change for a new entity (not yet in entity_to_archetype_id)', () => {
      const new_entity_id = 99;
      const components_to_add = [ComponentA.name, ComponentB.name];
      const target_arch = archetype_get_target_after_change(r_archetypes, new_entity_id, components_to_add);

      const expected_id = archetype_calculate_id(new Set(components_to_add));
      expect(target_arch.id).toBe(expected_id);
      expect(r_archetypes.archetypes_by_id.has(expected_id)).toBe(true);
   });

   it('graph state after multiple entities move through the same sequence (A -> AB, then A becomes empty)', () => {
      const arch_a_id_initial = archetype_calculate_id(new Set([ComponentA.name]));
      const arch_ab_id = archetype_calculate_id(new Set([ComponentA.name, ComponentB.name]));

      // entity 1: empty -> a -> ab
      let e1_comps = new Map<string, Component>();
      let target_arch = archetype_get_target_after_change(r_archetypes, entity1, [ComponentA.name]);
      e1_comps.set(ComponentA.name, new ComponentA());
      archetype_move_entity_to(r_archetypes, entity1, target_arch.id, new Map(e1_comps));

      target_arch = archetype_get_target_after_change(r_archetypes, entity1, [ComponentB.name]);
      e1_comps.set(ComponentB.name, new ComponentB());
      archetype_move_entity_to(r_archetypes, entity1, target_arch.id, new Map(e1_comps));
      expect(r_archetypes.entity_to_archetype_id.get(entity1)).toBe(arch_ab_id);

      // entity 2: empty -> a -> ab
      let e2_comps = new Map<string, Component>();
      target_arch = archetype_get_target_after_change(r_archetypes, entity2, [ComponentA.name]);
      e2_comps.set(ComponentA.name, new ComponentA());
      archetype_move_entity_to(r_archetypes, entity2, target_arch.id, new Map(e2_comps)); // e2 now in a

      expect(r_archetypes.archetypes_by_id.get(arch_a_id_initial)?.entities.includes(entity2)).toBe(true);

      target_arch = archetype_get_target_after_change(r_archetypes, entity2, [ComponentB.name]);
      e2_comps.set(ComponentB.name, new ComponentB());
      archetype_move_entity_to(r_archetypes, entity2, target_arch.id, new Map(e2_comps)); // e2 now in ab
      expect(r_archetypes.entity_to_archetype_id.get(entity2)).toBe(arch_ab_id);
      expect(r_archetypes.archetypes_by_id.has(arch_a_id_initial)).toBe(false);
      const arch_ab = r_archetypes.archetypes_by_id.get(arch_ab_id)!;
      expect(r_archetypes.remove_transitions.get(arch_ab.id)?.has(ComponentB.name)).toBe(false);
   });

   it('graph integrity with non-linear archetype creation and deletion (A,B,C -> AB,BC -> E1 in AB -> AB empty & cleaned)', () => {
      const arch_a = archetype_find_or_create(r_archetypes, new Set([ComponentA.name]));
      const arch_b = archetype_find_or_create(r_archetypes, new Set([ComponentB.name]));
      const arch_c = archetype_find_or_create(r_archetypes, new Set([ComponentC.name]));

      const arch_ab = archetype_find_or_create(r_archetypes, new Set([ComponentA.name, ComponentB.name]));
      const arch_bc = archetype_find_or_create(r_archetypes, new Set([ComponentB.name, ComponentC.name]));

      // pre-check transitions
      expect(r_archetypes.add_transitions.get(arch_a.id)?.get(ComponentB.name)).toBe(arch_ab.id);
      expect(r_archetypes.add_transitions.get(arch_b.id)?.get(ComponentA.name)).toBe(arch_ab.id);
      expect(r_archetypes.add_transitions.get(arch_b.id)?.get(ComponentC.name)).toBe(arch_bc.id);
      expect(r_archetypes.add_transitions.get(arch_c.id)?.get(ComponentB.name)).toBe(arch_bc.id);

      // move e1 into ab
      const e1_comps_ab = new Map<string, Component>([[ComponentA.name, new ComponentA()], [ComponentB.name, new ComponentB()]]);
      archetype_add_entity_to(r_archetypes, entity1, arch_ab.id, e1_comps_ab);

      // move e1 out of ab, making ab empty
      const e1_comps_a = new Map<string, Component>([[ComponentA.name, new ComponentA()]]);
      archetype_move_entity_to(r_archetypes, entity1, arch_a.id, e1_comps_a);

      // arch_ab should be cleaned up
      expect(r_archetypes.archetypes_by_id.has(arch_ab.id)).toBe(false);

      // transitions from a to ab and b to ab should be removed
      expect(r_archetypes.add_transitions.get(arch_a.id)?.has(ComponentB.name)).toBe(false);
      expect(r_archetypes.add_transitions.get(arch_b.id)?.has(ComponentA.name)).toBe(false);

      // transitions involving bc should remain
      expect(r_archetypes.add_transitions.get(arch_b.id)?.get(ComponentC.name)).toBe(arch_bc.id);
      expect(r_archetypes.add_transitions.get(arch_c.id)?.get(ComponentB.name)).toBe(arch_bc.id);
   });

   it('archetype_remove_entity_from an entity not in its supposed archetype (inconsistent state test)', () => {
      const arch_a = archetype_find_or_create(r_archetypes, new Set([ComponentA.name]));
      const arch_b = archetype_find_or_create(r_archetypes, new Set([ComponentB.name]));

      archetype_add_entity_to(r_archetypes, entity1, arch_a.id, new Map([[ComponentA.name, new ComponentA()]]));
      expect(r_archetypes.entity_to_archetype_id.get(entity1)).toBe(arch_a.id);

      r_archetypes.entity_to_archetype_id.set(entity1, arch_b.id);

      expect(() => archetype_remove_entity_from(r_archetypes, entity1))
         .toThrow(new RegExp(`entity ${entity1} in archetype ${arch_b.id} but missing from entity_to_index map`));

      r_archetypes.entity_to_archetype_id.set(entity1, arch_a.id);
      archetype_remove_entity_from(r_archetypes, entity1);
   });

   it('archetype_add_entity_to with pre-existing entity in that archetype (should warn and re-add)', () => {
      const arch_a = archetype_find_or_create(r_archetypes, new Set([ComponentA.name]));
      const comp_a_inst1 = new ComponentA();
      comp_a_inst1.value = 'InitialA';

      const comp_a_inst2 = new ComponentA();
      comp_a_inst2.value = 'OverwriteA';

      archetype_add_entity_to(r_archetypes, entity1, arch_a.id, new Map([[ComponentA.name, comp_a_inst1]]));
      expect(arch_a.entities).toContain(entity1);
      expect((arch_a.component_arrays.get(ComponentA.name)?.[0] as ComponentA).value).toBe('InitialA');

      archetype_add_entity_to(r_archetypes, entity1, arch_a.id, new Map([[ComponentA.name, comp_a_inst2]]));
      expect(arch_a.entities.length).toBe(1);
      expect(arch_a.entities).toContain(entity1);
      expect(arch_a.entity_to_index.get(entity1)).toBe(0);
      expect((arch_a.component_arrays.get(ComponentA.name)?.[0] as ComponentA).value).toBe('OverwriteA');
   });

   it('interaction with archetypes_by_component_name during cleanup', () => {
      const arch_ax = archetype_find_or_create(r_archetypes, new Set([ComponentA.name, ComponentX.name]));
      const arch_ay = archetype_find_or_create(r_archetypes, new Set([ComponentA.name, ComponentY.name]));
      const arch_a = archetype_find_or_create(r_archetypes, new Set([ComponentA.name]));

      const arch_ax_id = arch_ax.id;
      const arch_ay_id = arch_ay.id;
      const arch_a_id = arch_a.id;

      archetype_add_entity_to(r_archetypes, entity1, arch_ax_id, new Map<string, Component>([
         [ComponentA.name, new ComponentA()],
         [ComponentX.name, new ComponentX()]
      ]));

      archetype_add_entity_to(r_archetypes, entity2, arch_ay_id, new Map<string, Component>([
         [ComponentA.name, new ComponentA()],
         [ComponentY.name, new ComponentY()]
      ]));

      archetype_add_entity_to(r_archetypes, entity3, arch_a_id, new Map([[ComponentA.name, new ComponentA()]]));

      expect(r_archetypes.archetypes_by_component_name.get(ComponentA.name)).toEqual(new Set([arch_ax_id, arch_ay_id, arch_a_id]));
      expect(r_archetypes.archetypes_by_component_name.get(ComponentX.name)).toEqual(new Set([arch_ax_id]));
      expect(r_archetypes.archetypes_by_component_name.get(ComponentY.name)).toEqual(new Set([arch_ay_id]));

      archetype_remove_entity_from(r_archetypes, entity1);

      expect(r_archetypes.archetypes_by_id.has(arch_ax_id)).toBe(false);
      expect(r_archetypes.archetypes_by_component_name.get(ComponentA.name)).toEqual(new Set([arch_ay_id, arch_a_id]));
      expect(r_archetypes.archetypes_by_component_name.get(ComponentX.name)?.size ?? 0).toBe(0);
      expect(r_archetypes.archetypes_by_component_name.get(ComponentY.name)).toEqual(new Set([arch_ay_id]));
   });

   it('very large number of component types defining an archetype (string length and set ops)', () => {
      const many_comp_names: string[] = [];

      for (let i = 0; i < 2_000; i++) {
         many_comp_names.push(`StressComp${i}`);
      }

      const many_comp_set = new Set(many_comp_names);
      const many_comp_arch_id = archetype_calculate_id(many_comp_set);

      const arch = archetype_find_or_create(r_archetypes, many_comp_set);
      expect(arch.id).toBe(many_comp_arch_id);
      expect(arch.component_names.size).toBe(2_000);

      const dummy_components = new Map<string, Component>();

      for (const name of many_comp_names) {
         dummy_components.set(name, {} as Component)
      }

      archetype_add_entity_to(r_archetypes, entity1, arch.id, dummy_components);
      expect(arch.entities).toContain(entity1);

      archetype_remove_entity_from(r_archetypes, entity1);
      expect(r_archetypes.archetypes_by_id.has(arch.id)).toBe(false);
   });

   it('should correctly link transitions when a middle archetype is created last', () => {
      const arch_a = archetype_find_or_create(r_archetypes, new Set([ComponentA.name]));
      const arch_abc = archetype_find_or_create(r_archetypes, new Set([ComponentA.name, ComponentB.name, ComponentC.name]));
      const arch_ab = archetype_find_or_create(r_archetypes, new Set([ComponentA.name, ComponentB.name]));

      // a + b = ab
      expect(r_archetypes.add_transitions.get(arch_a.id)?.get(ComponentB.name)).toBe(arch_ab.id);
      // ab - b = a
      expect(r_archetypes.remove_transitions.get(arch_ab.id)?.get(ComponentB.name)).toBe(arch_a.id);

      // ab + c = abc
      expect(r_archetypes.add_transitions.get(arch_ab.id)?.get(ComponentC.name)).toBe(arch_abc.id);
      // abc - c = ab
      expect(r_archetypes.remove_transitions.get(arch_abc.id)?.get(ComponentC.name)).toBe(arch_ab.id);
   });
});