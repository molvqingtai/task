import { test, describe, expect, beforeEach, vi } from 'vitest'
import Task from '../src'
import { sleep } from './utils'

describe('Test task', () => {
  describe('Test methods', () => {
    let task: Task
    beforeEach(() => {
      task = new Task()
    })

    test('Status should work properly', async () => {
      task.start()
      expect(task.status).toBe('running')
      task.pause()
      expect(task.status).toBe('paused')
      task.start()
      expect(task.status).toBe('running')
      task.pause()
      expect(task.status).toBe('paused')
      task.stop()
      expect(task.status).toBe('stopped')
    })

    describe('Test event', () => {
      test('should emit start event', async () => {
        const callback = vi.fn()
        task.on('start', callback)
        task.start()
        task.stop()
        expect(callback).toHaveBeenCalled()
      })
      test('should emit pause event', async () => {
        const callback = vi.fn()
        task.on('pause', callback)
        task.start()
        task.pause()
        task.stop()
        expect(callback).toHaveBeenCalled()
      })
      test('should emit stop event', async () => {
        const callback = vi.fn()
        task.on('stop', callback)
        task.start()
        task.stop()
        expect(callback).toHaveBeenCalled()
      })
      test('should emit tick event', async () => {
        const callback = vi.fn()
        task.on('tick', callback)
        task.push('1', () => 'foobar')
        task.start()
        await sleep(100)
        task.stop()
        expect(callback).toHaveBeenCalled()
      })
      test('should emit error event', async () => {
        const callback = vi.fn()
        task.on('error', callback)
        task.push('1', () => {
          throw new Error('foobar')
        })
        task.start()
        await sleep(100)
        expect(callback).toHaveBeenCalled()
      })
      test('should emit clear event', async () => {
        const callback = vi.fn()
        task.on('clear', callback)
        task.push('1', () => 'foobar')
        task.clear()
        expect(callback).toHaveBeenCalled()
      })
    })
  })

  describe('Test sync task', () => {
    test('should call callback 1 time after start', async () => {
      const callback = vi.fn()
      const task = new Task()
      task.start()
      task.push('1', callback)
      await sleep(100)
      task.stop()
      expect(callback).toHaveBeenCalledTimes(1)
    })
    test('should call callback 3 times', async () => {
      const task = new Task()
      const callback = vi.fn()
      task.push('1', callback)
      task.push('2', callback)
      task.push('3', callback)
      task.start()
      await sleep(300)
      task.stop()
      expect(callback).toHaveBeenCalledTimes(3)
    })
    test('should call callback 2 times and stop', async () => {
      const task = new Task({
        interval: 100
      })
      const callback = vi.fn()
      task.push('1', callback)
      task.push('2', callback)
      task.push('3', callback)
      task.start()
      await sleep(150)
      task.stop()
      expect(callback).toHaveBeenCalledTimes(2)
    })

    test('should call callback 2 times and pause', async () => {
      const task = new Task({
        interval: 100
      })
      const callback = vi.fn()
      task.push('1', callback)
      task.push('2', callback)
      task.push('3', callback)
      task.start()
      await sleep(150)
      task.pause()
      expect(callback).toHaveBeenCalledTimes(2)
    })

    test('should call callback times and restart', async () => {
      const task = new Task({
        interval: 100
      })
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const callback3 = vi.fn()
      task.start()
      task.push('1', callback1)
      await sleep(150)
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(0)
      expect(callback3).toHaveBeenCalledTimes(0)

      task.pause()
      task.push('2', callback2)
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(0)
      expect(callback3).toHaveBeenCalledTimes(0)
      task.start()
      await sleep(250)
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
      expect(callback3).toHaveBeenCalledTimes(0)
      task.push('3', callback3)
      await sleep(50)
      expect(callback2).toHaveBeenCalledTimes(1)
      expect(callback3).toHaveBeenCalledTimes(1)
      expect(callback3).toHaveBeenCalledTimes(1)
      task.stop()
    })
  })
  describe('Test async task', () => {
    test('should call callback 1 time after start', async () => {
      const callback = vi.fn()
      const task = new Task()
      const promise = async () => {
        Promise.resolve(callback())
      }
      task.push('1', promise)
      task.start()
      await sleep(100)
      task.stop()
      expect(callback).toHaveBeenCalledTimes(1)
    })
  })
})
