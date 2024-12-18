import Timer, { TimerAdapter } from '@resreq/timer'
import EventHub from '@resreq/event-hub'

export type { TimerAdapter }

export interface TaskOptions {
  interval?: number
  includeAsyncTime?: boolean
  adapter?: TimerAdapter
}

export type TaskRun = () => any | Promise<any>

export type TaskRunnerStatus = 'default' | 'loading' | 'success' | 'error'

export type TaskId = number | string | symbol

export type TaskRunner = {
  status: TaskRunnerStatus
  data: any
  error: Error | null
  id: TaskId
  index: number
  active: boolean
}

export type TaskStatus = 'running' | 'paused' | 'stopped'

export type TaskEvent = 'start' | 'pause' | 'stop' | 'tick' | 'error' | 'clear' | 'push' | 'change'

export type TaskRunnerEvent = 'run:start' | 'run:pause' | 'run:stop' | 'run:success' | 'run:error'

export interface TaskListener {
  start: (time: number) => void
  pause: (time: number) => void
  stop: (time: number) => void
  error: (error: Error) => void
  tick: (data: any) => void
  clear: (time: number) => void
  push: (id: TaskId) => void
  change: (list: TaskRunner[]) => void
  'run:start': (id: TaskId) => void
  'run:pause': (id: TaskId) => void
  'run:stop': (id: TaskId) => void
  'run:success': (id: TaskId, data: any) => void
  'run:error': (id: TaskId, error: Error) => void
}

export default class Task {
  public status: TaskStatus
  private readonly interval: number
  private readonly includeAsyncTime: boolean
  private readonly adapter: TimerAdapter
  private readonly eventHub: EventHub
  public readonly list: Map<TaskId, TaskRunner & { timer: Timer }> = new Map()
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

  off<T extends keyof TaskListener>(event?: T | T[], listener?: TaskListener[T]) {
    this.eventHub.off(event, listener)
  }

  push(taskId: TaskId, run: TaskRun) {
    if (this.list.has(taskId)) {
      throw new Error(`Task "${taskId.toString()}" already exists`)
    }

    const lastTask = [...this.list.values()].at(-1)
    const timer = new Timer(run, {
      limit: 1,
      interval:
        this.list.size === 0 || lastTask?.status === 'success' || lastTask?.status === 'error' ? 0 : this.interval,
      includeAsyncTime: this.includeAsyncTime,
      adapter: this.adapter
    })

    timer.on('start', () => {
      this.list.get(taskId)!.status = 'loading'
      this.list.get(taskId)!.active = true
      this.eventHub.emit('run:start', taskId)
      this.eventHub.emit('change', this.query())
    })

    timer.on('pause', () => {
      this.list.get(taskId)!.status = 'default'
      this.list.get(taskId)!.active = true
      this.eventHub.emit('run:pause', taskId)
      this.eventHub.emit('change', this.query())
    })

    timer.on('tick', (data: any) => {
      this.list.get(taskId)!.data = data
      this.list.get(taskId)!.status = 'success'
      this.list.get(taskId)!.active = false
      this.eventHub.emit('run:success', taskId, data)
      this.eventHub.emit('tick', data)
      this.eventHub.emit('change', this.query())
    })

    timer.on('error', (error: Error) => {
      this.list.get(taskId)!.error = error
      this.list.get(taskId)!.active = false
      this.list.get(taskId)!.status = 'error'
      this.eventHub.emit('run:error', taskId, error)
      this.eventHub.emit('error', error)
      this.eventHub.emit('change', this.query())
    })

    this.list.set(taskId, {
      timer,
      status: 'default',
      data: null,
      error: null,
      id: taskId,
      index: this.list.size,
      active: true
    })

    if (this.status === 'running') {
      if (this.list.size === 1 || !lastTask?.active) {
        timer.start()
      } else {
        lastTask?.timer?.on('end', () => timer.start())
      }
    } else {
      lastTask?.timer?.on('end', () => timer.start())
    }
    this.eventHub.emit('push', taskId)
    this.eventHub.emit('change', this.query())
  }

  query(): TaskRunner[]
  query(taskId: TaskId): TaskRunner | null
  query(taskId?: TaskId): TaskRunner[] | TaskRunner | null {
    if (taskId !== undefined) {
      const task = this.list.get(taskId)
      return task
        ? {
            status: task.status,
            data: task.data,
            error: task.error,
            index: task.index,
            id: task.id,
            active: task.active
          }
        : null
    } else {
      return [...this.list.values()].map((task) => ({
        status: task.status,
        data: task.data,
        error: task.error,
        index: task.index,
        id: task.id,
        active: task.active
      }))
    }
  }
  start() {
    if (this.status === 'stopped' || this.status === 'paused') {
      this.status = 'running'
      const pausedTask = [...this.list.values()].find((task) => task.active)
      pausedTask?.timer.start()
      this.eventHub.emit('start', Date.now())
      this.eventHub.emit('change', this.query())
    }
  }
  stop() {
    if (this.status === 'running' || this.status === 'paused') {
      this.status = 'stopped'
      this.list.forEach((task) => task.timer.stop())
      this.eventHub.emit('stop', Date.now())
      this.eventHub.emit('change', this.query())
    }
  }
  pause() {
    if (this.status === 'running') {
      this.status = 'paused'
      const runningTask = [...this.list.values()].find((task) => task.active)
      runningTask?.timer.pause()
      this.eventHub.emit('pause', Date.now())
      this.eventHub.emit('change', this.query())
    }
  }
  clear() {
    if (this.list.size) {
      this.stop()
      this.list.clear()
      this.eventHub.emit('clear', Date.now())
      this.eventHub.emit('change', this.query())
    }
  }
}
