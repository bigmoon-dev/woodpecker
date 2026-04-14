import { Injectable, OnModuleInit } from '@nestjs/common';
import { HookDefinition } from './plugin.interface';

@Injectable()
export class HookBus implements OnModuleInit {
  private hooks: Map<string, HookDefinition[]> = new Map();

  onModuleInit() {
    this.hooks = new Map();
  }

  register(definitions: HookDefinition[]): void {
    for (const def of definitions) {
      const existing = this.hooks.get(def.event) || [];
      existing.push(def);
      existing.sort((a, b) => a.priority - b.priority);
      this.hooks.set(def.event, existing);
    }
  }

  async emit(event: string, ...args: unknown[]): Promise<void> {
    const handlers = this.hooks.get(event) || [];
    for (const h of handlers) {
      try {
        await h.handler(...args);
      } catch (err) {
        console.error(`[HookBus] Error in hook for ${event}:`, err);
      }
    }
  }

  unregisterByEvent(event: string): void {
    this.hooks.delete(event);
  }
}
