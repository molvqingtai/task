import Timer, { TimerAdapter } from '@resreq/timer'
import EventHub from '@resreq/event-hub'

export type { TimerAdapter }

export interface TaskOptions {
  interval?: number
  includeAsyncTime?: boolean
  adapter?: TimerAdapter
}

export type TaskCallback = () => any | Promise<any>

export type CallbackStatus = 'default' | 'loading' | 'success' | 'error'

export type TaskInfo = {
  status: CallbackStatus
  data: any
  error: Error | null
  timer: Timer
  id: number | string | symbol
  index: number
  active: boolean
}

export type TaskStatus = 'running' | 'paused' | 'stopped'

export type TaskEvent = 'start' | 'pause' | 'stop' | 'tick' | 'error' | 'clear'

export interface TaskListener {
  start: (time: number) => void
  pause: (time: number) => void
  stop: (time: number) => void
  error: (error: Error) => void
  tick: (data: any) => void
  clear: (time: number) => void
}

export default class Task {
  public status: TaskStatus
  private readonly interval: number
  private readonly includeAsyncTime: boolean
  private readonly adapter: TimerAdapter
  private readonly eventHub: EventHub
  public readonly tasks: Map<number | string | symbol, TaskInfo> = new Map()
  private pausedTimer?: Timer
  constructor(options?: TaskOptions) {
    this.status = 'stopped'
    this.interval = options?.interval ?? 0
    this.includeAsyncTime = options?.includeAsyncTime ?? false
    this.adapter = options?.adapter ?? {
      setTimer: globalThis.setTimeout.bind(globalThis),
      cancelTimer: globalThis.clearTimeout.bind(globalThis)
    }
    this.eventHub = new EventHub()
  }

  on<T extends keyof TaskListener>(event: T, listener: TaskListener[T]) {
    this.eventHub.on(event, listener)
  }

  push(taskId: number | string | symbol, callback: TaskCallback) {
    const lastTask = [...this.tasks.values()].at(-1)
    const timer = new Timer(callback, {
      limit: 1,
      interval: lastTask?.timer?.status === 'stopped' ? 0 : this.interval,
      includeAsyncTime: this.includeAsyncTime,
      adapter: this.adapter
    })

    timer.on('start', () => {
      this.tasks.get(taskId)!.status = 'loading'
    })

    timer.on('tick', (data) => {
      this.tasks.get(taskId)!.data = data
      this.tasks.get(taskId)!.active = false
      this.eventHub.emit('tick', data)
    })

    timer.on('end', () => {
      this.tasks.get(taskId)!.status = 'success'
    })

    timer.on('error', (error) => {
      this.tasks.get(taskId)!.error = error
      this.eventHub.emit('error', error)
      this.tasks.get(taskId)!.active = false
      this.tasks.get(taskId)!.status = 'error'
    })

    this.tasks.set(taskId, {
      timer,
      status: 'default',
      data: null,
      error: null,
      id: taskId,
      index: this.tasks.size,
      active: true
    })

    if (this.status === 'running') {
      if (this.tasks.size === 1 || lastTask?.timer?.status === 'stopped') {
        timer.start()
      } else {
        lastTask?.timer?.on('end', () => {
          timer.start()
        })
      }
    } else {
      lastTask?.timer?.on('end', () => {
        timer.start()
      })
    }
  }
  query<T = any>(taskId: number | string | symbol) {
    const task = this.tasks.get(taskId)
    if (task) {
      return {
        status: task.status,
        data: task.data as T | null,
        error: task.error,
        index: task.index,
        id: task.id
      }
    } else {
      throw new Error(`Task ${taskId.toString()} not found`)
    }
  }
  start() {
    if (this.status === 'stopped' || this.status === 'paused') {
      this.status = 'running'
      const pausedTask = [...this.tasks.values()].find((task) => task.active)
      pausedTask?.timer.start()
      this.eventHub.emit('start', Date.now())
    }
  }
  stop() {
    if (this.status === 'running' || this.status === 'paused') {
      this.status = 'stopped'
      this.tasks.forEach((task) => {
        task.timer.stop()
      })
      this.eventHub.emit('stop', Date.now())
    }
  }
  pause() {
    if (this.status === 'running') {
      this.status = 'paused'
      const runningTask = [...this.tasks.values()].find((task) => !task.active)
      runningTask?.timer.pause()
      this.eventHub.emit('pause', Date.now())
    }
  }
  clear() {
    this.stop()
    this.tasks.clear()
    this.eventHub.emit('clear', Date.now())
  }
}
