/*!
 * Copyright (c) 2025-present, eldritch engine contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * you can find this file at: https://github.com/desplmfao/eldritch/blob/main/src/shared/packages/reflect/tests/reflect.test.ts
 */

import { describe, it, expect } from 'bun:test';

import {
   define_metadata,
   delete_metadata,
   get_metadata,
   get_metadata_keys,
   get_own_metadata,
   get_own_metadata_keys,
   has_metadata,
   has_own_metadata,
   append_metadata,
   get_all_own_metadata,
   get_all_metadata,
   define_injection_metadata,
   get_injection_metadata,
   list_injection_targets,
} from '@self/index';

describe('@eldritch-engine/reflect', () => {

   describe('define_metadata', () => {
      it('should not throw when defining metadata on an object', () => {
         const obj = {};
         expect(() => define_metadata('key', 'value', obj)).not.toThrow();
      });

      it('should throw a TypeError for a non-object target', () => {
         // @ts-expect-error
         expect(() => define_metadata('key', 'value', 123)).toThrow(TypeError);
         // @ts-expect-error
         expect(() => define_metadata('key', 'value', null)).toThrow(TypeError);
         // @ts-expect-error
         expect(() => define_metadata('key', 'value', undefined)).toThrow(TypeError);
      });
   });

   describe('has_own_metadata', () => {
      it('should return true if metadata is defined on the object', () => {
         const obj = {};
         define_metadata('key', 'value', obj);
         expect(has_own_metadata('key', obj)).toBe(true);
      });

      it('should return false if metadata is not defined on the object', () => {
         const obj = {};
         expect(has_own_metadata('key', obj)).toBe(false);
      });

      it('should return false if metadata is defined on the prototype', () => {
         class Parent { }
         class Child extends Parent { }
         define_metadata('key', 'value', Parent.prototype);
         expect(has_own_metadata('key', Child.prototype)).toBe(false);
      });
   });

   describe('has_metadata', () => {
      it('should return true if metadata is defined on the object', () => {
         const obj = {};
         define_metadata('key', 'value', obj);
         expect(has_metadata('key', obj)).toBe(true);
      });

      it('should return true if metadata is defined on the prototype', () => {
         class Parent { }
         class Child extends Parent { }
         define_metadata('key', 'value', Parent.prototype);
         expect(has_metadata('key', Child.prototype)).toBe(true);
      });

      it('should return false if metadata is not defined anywhere on the prototype chain', () => {
         class Parent { }
         class Child extends Parent { }
         expect(has_metadata('key', Child.prototype)).toBe(false);
      });
   });

   describe('get_own_metadata', () => {
      it('should return the metadata value if it is defined on the object', () => {
         const obj = {};
         define_metadata('key', 'value', obj);
         expect(get_own_metadata('key', obj)).toBe('value');
      });

      it('should return undefined if metadata is not defined on the object', () => {
         const obj = {};
         expect(get_own_metadata('key', obj)).toBeUndefined();
      });

      it('should return undefined if metadata is defined on the prototype', () => {
         class Parent { }
         class Child extends Parent { }
         define_metadata('key', 'value', Parent.prototype);
         expect(get_own_metadata('key', Child.prototype)).toBeUndefined();
      });
   });

   describe('get_metadata', () => {
      it('should return the metadata value if it is defined on the object', () => {
         const obj = {};
         define_metadata('key', 'value', obj);
         expect(get_metadata('key', obj)).toBe('value');
      });

      it('should return the metadata value from the prototype if not on the object', () => {
         class Parent { }
         class Child extends Parent { }
         define_metadata('key', 'value', Parent.prototype);
         expect(get_metadata('key', Child.prototype)).toBe('value');
      });

      it('should return the closest metadata value in the prototype chain', () => {
         class Grandparent { }
         class Parent extends Grandparent { }
         class Child extends Parent { }
         define_metadata('key', 'grandparent', Grandparent.prototype);
         define_metadata('key', 'parent', Parent.prototype);
         expect(get_metadata('key', Child.prototype)).toBe('parent');
      });
   });

   describe('get_own_metadata_keys', () => {
      it('should return an array of own metadata keys', () => {
         const obj = {};
         const key1 = Symbol('key1');
         define_metadata('keyA', 'valueA', obj);
         define_metadata(key1, 'valueB', obj);
         const keys = get_own_metadata_keys(obj);
         expect(keys).toEqual(expect.arrayContaining(['keyA', key1]));
         expect(keys.length).toBe(2);
      });

      it('should not return keys from the prototype', () => {
         class Parent { }
         class Child extends Parent { }
         define_metadata('parentKey', 'value', Parent.prototype);
         define_metadata('childKey', 'value', Child.prototype);
         const keys = get_own_metadata_keys(Child.prototype);
         expect(keys).toEqual(['childKey']);
      });
   });

   describe('get_metadata_keys', () => {
      it('should return an array of unique metadata keys from the entire prototype chain', () => {
         class Parent { }
         class Child extends Parent { }
         define_metadata('keyA', 'value', Parent.prototype);
         define_metadata('keyB', 'value', Parent.prototype);
         define_metadata('keyA', 'override', Child.prototype);
         define_metadata('keyC', 'value', Child.prototype);
         const keys = get_metadata_keys(Child.prototype);
         expect(keys).toEqual(expect.arrayContaining(['keyA', 'keyB', 'keyC']));
         expect(keys.length).toBe(3);
      });
   });

   describe('delete_metadata', () => {
      it('should delete metadata from an object', () => {
         const obj = {};
         define_metadata('key', 'value', obj);
         expect(has_own_metadata('key', obj)).toBe(true);
         const result = delete_metadata('key', obj);
         expect(result).toBe(true);
         expect(has_own_metadata('key', obj)).toBe(false);
      });

      it('should return false if metadata key does not exist', () => {
         const obj = {};
         const result = delete_metadata('key', obj);
         expect(result).toBe(false);
      });

      it('should not delete metadata from the prototype', () => {
         class Parent { }
         class Child extends Parent { }
         define_metadata('key', 'value', Parent.prototype);
         delete_metadata('key', Child.prototype);
         expect(has_metadata('key', Child.prototype)).toBe(true);
      });
   });

   describe('property key usage', () => {
      it('should handle metadata on properties correctly', () => {
         class MyClass {
            my_method() { }
         }
         const target = MyClass.prototype;
         const property_key = 'my_method';
         define_metadata('role', 'method', target, property_key);
         expect(has_metadata('role', target, property_key)).toBe(true);
         expect(get_metadata('role', target, property_key)).toBe('method');
         expect(has_metadata('role', target)).toBe(false);
      });

      it('should differentiate between class and property metadata', () => {
         class MyClass {
            my_prop: string = '';
         }
         define_metadata('class_meta', 'is_class', MyClass);
         define_metadata('prop_meta', 'is_prop', MyClass.prototype, 'my_prop');
         expect(get_metadata('class_meta', MyClass)).toBe('is_class');
         expect(get_metadata('prop_meta', MyClass.prototype, 'my_prop')).toBe('is_prop');
         expect(get_metadata('class_meta', MyClass.prototype, 'my_prop')).toBeUndefined();
         expect(get_metadata('prop_meta', MyClass)).toBeUndefined();
      });
   });

   describe('append_metadata', () => {
      it('should create an array with the value if none exists', () => {
         const obj = {};
         append_metadata('key', 'value1', obj);
         expect(get_own_metadata('key', obj)).toEqual(['value1']);
      });

      it('should add to an existing array', () => {
         const obj = {};
         define_metadata('key', ['value1'], obj);
         append_metadata('key', 'value2', obj);
         expect(get_own_metadata('key', obj)).toEqual(['value1', 'value2']);
      });

      it('should convert a non-array value to an array and append', () => {
         const obj = {};
         define_metadata('key', 'value1', obj);
         append_metadata('key', 'value2', obj);
         expect(get_own_metadata('key', obj)).toEqual(['value1', 'value2']);
      });
   });

   describe('get_all_own_metadata', () => {
      it('should return a map of all own metadata key-value pairs', () => {
         const obj = {};
         define_metadata('keyA', 'valueA', obj);
         define_metadata('keyB', 123, obj);
         const all_meta = get_all_own_metadata(obj);
         expect(all_meta).toBeInstanceOf(Map);
         expect(all_meta.size).toBe(2);
         expect(all_meta.get('keyA')).toBe('valueA');
         expect(all_meta.get('keyB')).toBe(123);
      });

      it('should not include metadata from the prototype', () => {
         class Parent { }
         class Child extends Parent { }
         define_metadata('parentKey', 'parentValue', Parent.prototype);
         define_metadata('childKey', 'childValue', Child.prototype);
         const all_meta = get_all_own_metadata(Child.prototype);
         expect(all_meta.size).toBe(1);
         expect(all_meta.get('childKey')).toBe('childValue');
         expect(all_meta.has('parentKey')).toBe(false);
      });
   });

   describe('get_all_metadata', () => {
      it('should return a map of all metadata from the object and its prototype chain', () => {
         class Parent { }
         class Child extends Parent { }
         define_metadata('parentKey', 'parentValue', Parent.prototype);
         define_metadata('childKey', 'childValue', Child.prototype);
         const all_meta = get_all_metadata(Child.prototype);
         expect(all_meta.size).toBe(2);
         expect(all_meta.get('parentKey')).toBe('parentValue');
         expect(all_meta.get('childKey')).toBe('childValue');
      });

      it('should correctly override prototype metadata with own metadata', () => {
         class Parent { }
         class Child extends Parent { }
         define_metadata('key', 'parent', Parent.prototype);
         define_metadata('key', 'child', Child.prototype);
         const all_meta = get_all_metadata(Child.prototype);
         expect(all_meta.size).toBe(1);
         expect(all_meta.get('key')).toBe('child');
      });
   });

   describe('injection helpers', () => {
      class ParentSystem {
         method_a(p0: any, p1: any) { }
         method_b(p0: any) { }
      }

      class ChildSystem extends ParentSystem {
         // @ts-expect-error
         method_b(p0: any, p1: any) { }
         method_c(p0: any) { }
      }

      const parent_proto = ParentSystem.prototype;
      const child_proto = ChildSystem.prototype;

      const meta_p_a_0 = { type: 'parent_a_0' };
      const meta_p_a_1 = { type: 'parent_a_1' };
      const meta_p_b_0 = { type: 'parent_b_0' };

      const meta_c_b_0 = { type: 'child_b_0_override' };
      const meta_c_b_1 = { type: 'child_b_1' };
      const meta_c_c_0 = { type: 'child_c_0' };

      define_injection_metadata(parent_proto, 'method_a', 0, meta_p_a_0);
      define_injection_metadata(parent_proto, 'method_a', 1, meta_p_a_1);
      define_injection_metadata(parent_proto, 'method_b', 0, meta_p_b_0);

      define_injection_metadata(child_proto, 'method_b', 0, meta_c_b_0);
      define_injection_metadata(child_proto, 'method_b', 1, meta_c_b_1);
      define_injection_metadata(child_proto, 'method_c', 0, meta_c_c_0);

      describe('list_injection_targets', () => {
         it('should list only own injection targets', () => {
            const targets = list_injection_targets(parent_proto);
            expect(targets).toEqual(expect.arrayContaining(['method_a', 'method_b']));
            expect(targets.length).toBe(2);
         });

         it('should list own and inherited injection targets without duplicates', () => {
            const targets = list_injection_targets(child_proto);
            expect(targets).toEqual(expect.arrayContaining(['method_a', 'method_b', 'method_c']));
            expect(targets.length).toBe(3);
         });
      });

      describe('get_injection_metadata', () => {
         it('should get inherited metadata', () => {
            const meta = get_injection_metadata(child_proto, 'method_a');
            expect(meta).toBeInstanceOf(Map);
            expect(meta.size).toBe(2);
            expect(meta.get(0)).toBe(meta_p_a_0);
            expect(meta.get(1)).toBe(meta_p_a_1);
         });

         it('should merge and override metadata', () => {
            const meta = get_injection_metadata(child_proto, 'method_b');
            expect(meta.size).toBe(2);
            expect(meta.get(0)).toBe(meta_c_b_0); // overridden
            expect(meta.get(1)).toBe(meta_c_b_1); // new on child
         });

         it('should get metadata defined only on the child', () => {
            const meta = get_injection_metadata(child_proto, 'method_c');
            expect(meta.size).toBe(1);
            expect(meta.get(0)).toBe(meta_c_c_0);
         });

         it('should return an empty map for non-existent targets', () => {
            const meta = get_injection_metadata(child_proto, 'non_existent_method');
            expect(meta).toBeInstanceOf(Map);
            expect(meta.size).toBe(0);
         });
      });
   });
});