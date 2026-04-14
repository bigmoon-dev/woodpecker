import { HookBus } from './hook-bus';
import { HookDefinition } from './plugin.interface';

describe('HookBus', () => {
  let bus: HookBus;

  beforeEach(() => {
    bus = new HookBus();
  });

  describe('register()', () => {
    it('adds hooks to the hooks map', async () => {
      const handler = jest.fn();
      bus.register([{ event: 'test', handler, priority: 1 }]);
      await bus.emit('test');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('sorts hooks by priority ascending', async () => {
      const order: number[] = [];
      const h1: HookDefinition = {
        event: 'evt',
        handler: () => {
          order.push(1);
        },
        priority: 10,
      };
      const h2: HookDefinition = {
        event: 'evt',
        handler: () => {
          order.push(2);
        },
        priority: 1,
      };
      const h3: HookDefinition = {
        event: 'evt',
        handler: () => {
          order.push(3);
        },
        priority: 5,
      };
      bus.register([h1, h2, h3]);
      await bus.emit('evt');
      expect(order).toEqual([2, 3, 1]);
    });

    it('registers hooks for multiple events independently', async () => {
      const handlerA = jest.fn();
      const handlerB = jest.fn();
      bus.register([{ event: 'a', handler: handlerA, priority: 1 }]);
      bus.register([{ event: 'b', handler: handlerB, priority: 1 }]);
      await bus.emit('a');
      expect(handlerA).toHaveBeenCalledTimes(1);
      expect(handlerB).not.toHaveBeenCalled();
    });
  });

  describe('emit()', () => {
    it('calls all handlers with provided arguments', async () => {
      const handler = jest.fn();
      bus.register([{ event: 'data', handler, priority: 1 }]);
      await bus.emit('data', 'arg1', 'arg2');
      expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('continues executing remaining handlers when one throws', async () => {
      const handler1 = jest.fn().mockRejectedValue(new Error('fail'));
      const handler2 = jest.fn();
      bus.register([
        { event: 'evt', handler: handler1, priority: 1 },
        { event: 'evt', handler: handler2, priority: 2 },
      ]);
      await bus.emit('evt');
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('does nothing when emitting an unregistered event', async () => {
      await expect(bus.emit('unknown')).resolves.toBeUndefined();
    });

    it('awaits async handlers', async () => {
      let resolved = false;
      const asyncHandler = jest.fn().mockImplementation(async () => {
        await Promise.resolve();
        resolved = true;
      });
      bus.register([{ event: 'async', handler: asyncHandler, priority: 1 }]);
      await bus.emit('async');
      expect(resolved).toBe(true);
    });
  });

  describe('unregisterByEvent()', () => {
    it('removes all hooks for the given event', async () => {
      const handler = jest.fn();
      bus.register([{ event: 'remove-me', handler, priority: 1 }]);
      bus.unregisterByEvent('remove-me');
      await bus.emit('remove-me');
      expect(handler).not.toHaveBeenCalled();
    });

    it('does not affect other events', async () => {
      const handlerA = jest.fn();
      const handlerB = jest.fn();
      bus.register([{ event: 'a', handler: handlerA, priority: 1 }]);
      bus.register([{ event: 'b', handler: handlerB, priority: 1 }]);
      bus.unregisterByEvent('a');
      await bus.emit('b');
      expect(handlerB).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleInit()', () => {
    it('resets the hooks map', async () => {
      const handler = jest.fn();
      bus.register([{ event: 'evt', handler, priority: 1 }]);
      bus.onModuleInit();
      await bus.emit('evt');
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
