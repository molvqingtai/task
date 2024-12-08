import { test, describe, expect, beforeEach, vi, afterEach } from 'vitest'
import Task from '../src'
import { sleep } from './utils'

describe('Test task', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })
  describe('Test methods', () => {
    test('Status should work properly', async () => {
      const task = new Task()
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
  })

  describe('Test event', () => {
    test('should emit start event', async () => {
      const callback = vi.fn()
      const task = new Task()
      task.on('start', callback)
      task.start()
      task.stop()
      expect(callback).toHaveBeenCalled()
    })
    test('should emit pause event', async () => {
      const callback = vi.fn()
      const task = new Task()
      task.on('pause', callback)
      task.start()
      task.pause()
      task.stop()
      expect(callback).toHaveBeenCalled()
    })
    test('should emit stop event', async () => {
      const callback = vi.fn()
      const task = new Task()
      task.on('stop', callback)
      task.start()
      task.stop()
      expect(callback).toHaveBeenCalled()
    })
    test('should emit tick event', async () => {
      const callback = vi.fn()
      const task = new Task()
      task.on('tick', callback)
      task.push('1', () => 'foobar')
      task.start()
      await vi.advanceTimersByTimeAsync(100)
      task.stop()
      expect(callback).toHaveBeenCalled()
    })
    test('should emit error event', async () => {
      const callback = vi.fn()
      const task = new Task()
      task.on('error', callback)
      task.push('1', () => {
        throw new Error('foobar')
      })
      task.start()
      await vi.advanceTimersByTimeAsync(100)
      expect(callback).toHaveBeenCalled()
    })
    test('should emit clear event', async () => {
      const callback = vi.fn()
      const task = new Task()
      task.on('clear', callback)
      task.push('1', () => 'foobar')
      task.clear()
      expect(callback).toHaveBeenCalled()
    })
  })

  describe('Test sync task', () => {
    test('should call callback 1 time after start', async () => {
      const callback = vi.fn()
      const task = new Task()
      task.start()
      task.push('1', callback)
      await vi.advanceTimersByTimeAsync(100)
      task.stop()
      expect(callback).toHaveBeenCalledTimes(1)
    })
    test('should call callback 3 times', async () => {
      const task = new Task({
        interval: 1000
      })
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const callback3 = vi.fn()
      task.push('1', callback1)
      task.push('2', callback2)
      task.push('3', callback3)
      task.start()
      await vi.advanceTimersByTimeAsync(500) // 500
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(0)
      expect(callback3).toHaveBeenCalledTimes(0)
      await vi.advanceTimersByTimeAsync(1000) // 2000
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
      expect(callback3).toHaveBeenCalledTimes(0)
      await vi.advanceTimersByTimeAsync(1000) // 3000
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
      expect(callback3).toHaveBeenCalledTimes(1)
      task.stop()
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
      expect(callback3).toHaveBeenCalledTimes(1)
    })
    test('should call callback 3 times and stop', async () => {
      const task = new Task({
        interval: 1000
      })
      const callback = vi.fn()
      task.push('1', callback) // 0
      task.push('2', callback) // 100
      task.push('3', callback) // 200
      task.push('4', callback) // 300
      task.start()
      await vi.advanceTimersByTimeAsync(2500)
      task.stop()
      expect(callback).toHaveBeenCalledTimes(3)
    })

    test('should call callback 2 times and pause', async () => {
      const task = new Task({
        interval: 1000
      })
      const callback = vi.fn()
      task.push('1', callback) // 0
      task.push('2', callback) // 100
      task.push('3', callback) // 200
      task.push('4', callback) // 300
      task.start()
      await vi.advanceTimersByTimeAsync(2500)
      task.pause()
      expect(callback).toHaveBeenCalledTimes(3)
    })

    test('should call callback times and restart', async () => {
      const task = new Task({
        interval: 1000
      })
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const callback3 = vi.fn()
      const callback4 = vi.fn()
      task.start()
      task.push('1', callback1)
      task.push('2', callback2)
      task.push('3', callback3)
      task.push('4', callback4)
      await vi.advanceTimersByTimeAsync(500) // 500
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(0)
      expect(callback3).toHaveBeenCalledTimes(0)
      expect(callback4).toHaveBeenCalledTimes(0)
      task.pause()
      await vi.advanceTimersByTimeAsync(5000) // 5500
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(0)
      expect(callback3).toHaveBeenCalledTimes(0)
      expect(callback4).toHaveBeenCalledTimes(0)
      task.start()
      await vi.advanceTimersByTimeAsync(500) // 6000
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(0)
      expect(callback3).toHaveBeenCalledTimes(0)
      expect(callback4).toHaveBeenCalledTimes(0)
      await vi.advanceTimersByTimeAsync(500) // 6500
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
      expect(callback3).toHaveBeenCalledTimes(0)
      expect(callback4).toHaveBeenCalledTimes(0)
      task.pause()
      await vi.advanceTimersByTimeAsync(1000) // 7500
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
      expect(callback3).toHaveBeenCalledTimes(0)
      expect(callback4).toHaveBeenCalledTimes(0)
      task.start()
      await vi.advanceTimersByTimeAsync(2000) // 9500
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
      expect(callback3).toHaveBeenCalledTimes(1)
      expect(callback4).toHaveBeenCalledTimes(1)

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
      await vi.advanceTimersByTimeAsync(100)
      task.stop()
      expect(callback).toHaveBeenCalledTimes(1)
    })
    test('should call async callback 1 times and stop', async () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const callback3 = vi.fn()
      const promise1 = async () => {
        await sleep(500)
        callback1()
      }
      const promise2 = async () => {
        await sleep(500)
        callback2()
      }
      const promise3 = async () => {
        await sleep(500)
        callback3()
      }
      const task = new Task({
        interval: 500
      })
      task.push('1', promise1)
      task.push('2', promise2)
      task.push('3', promise3)
      task.start()
      await vi.advanceTimersByTimeAsync(700)
      task.stop()
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(0)
      expect(callback3).toHaveBeenCalledTimes(0)
    })
    test('should call async callback 2 times and pause', async () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const callback3 = vi.fn()
      const promise1 = async () => {
        await sleep(500)
        callback1()
      }
      const promise2 = async () => {
        await sleep(500)
        callback2()
      }
      const promise3 = async () => {
        await sleep(500)
        callback3()
      }
      const task = new Task({
        interval: 500,
        includeAsyncTime: true
      })

      task.push('1', promise1)
      task.push('2', promise2)
      task.push('3', promise3)
      task.start()
      await vi.advanceTimersByTimeAsync(700)
      task.pause()
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(0)
      expect(callback3).toHaveBeenCalledTimes(0)
    })

    test('should call async callback 2 times and restart', async () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const callback3 = vi.fn()
      const promise1 = async () => {
        await sleep(1000)
        callback1()
      }
      const promise2 = async () => {
        await sleep(1000)
        callback2()
      }
      const promise3 = async () => {
        await sleep(1000)
        callback3()
      }
      const task = new Task({
        interval: 1000,
        includeAsyncTime: true
      })

      task.push('1', promise1)
      task.push('2', promise2)
      task.push('3', promise3)
      task.start()
      await vi.advanceTimersByTimeAsync(1500)
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(0)
      expect(callback3).toHaveBeenCalledTimes(0)
      task.pause()
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(0)
      expect(callback3).toHaveBeenCalledTimes(0)
      task.start()
      await vi.advanceTimersByTimeAsync(2000)
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
      expect(callback3).toHaveBeenCalledTimes(0)
      task.pause()
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
      expect(callback3).toHaveBeenCalledTimes(0)
      task.start()
      await vi.advanceTimersByTimeAsync(2000)
      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
      expect(callback3).toHaveBeenCalledTimes(1)
    })

    test('should return callback status', async () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const promise1 = async () => {
        await sleep(1000)
        callback1()
      }
      const promise2 = async () => {
        await sleep(1000)
        callback2()
      }
      const promise3 = async () => {
        await sleep(1000)
        throw new Error()
      }
      const task = new Task({
        interval: 1000,
        includeAsyncTime: true
      })

      task.push('1', promise1)
      task.push('2', promise2)
      task.push('3', promise3)

      expect(task.status).toBe('stopped')
      expect(task.query('1').status).toBe('default')
      expect(task.query('2').status).toBe('default')
      expect(task.query('3').status).toBe('default')
      task.start()
      expect(task.status).toBe('running')
      await vi.advanceTimersByTimeAsync(1500)
      expect(task.query('1').status).toBe('success')
      expect(task.query('2').status).toBe('loading')
      expect(task.query('3').status).toBe('default')
      task.pause()
      expect(task.status).toBe('paused')
      task.start()
      expect(task.status).toBe('running')
      expect(task.query('1').status).toBe('success')
      expect(task.query('2').status).toBe('loading')
      expect(task.query('3').status).toBe('default')
      await vi.advanceTimersByTimeAsync(2000)
      expect(task.query('1').status).toBe('success')
      expect(task.query('2').status).toBe('success')
      expect(task.query('3').status).toBe('loading')
      await vi.advanceTimersByTimeAsync(2000)
      task.stop()
      expect(task.status).toBe('stopped')
      expect(task.query('1').status).toBe('success')
      expect(task.query('2').status).toBe('success')
      expect(task.query('3').status).toBe('error')
    })
  })
})
