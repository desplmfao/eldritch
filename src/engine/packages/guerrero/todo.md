implement a global class pool so we dont have to allocate shit over and over and just have pointers public as fuck in the apis

this is different from the rfc because its not specific to ecs, it would be like a weakmap of every single allocatable class so we can reuse them if they aren't already being used

releasing them wouldn't actually delete them, it would just move them to a buffer where we can use them, and if there is nothing in the buffer for it, we fallback to making a new class