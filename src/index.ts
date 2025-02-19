import Timer, { TimerAdapter } from '@resreq/timer'
import EventHub from '@resreq/event-hub'

export type { TimerAdapter }

export interface TaskOptions {
  interval?: number
  includeAsyncTime?: boolean
  adapter?: TimerAdapter
}

export type TaskRunnerRun = () => any | Promise<any>

export type TaskRunnerStatus = 'pending' | 'running' | 'fulfilled' | 'rejected'

export type TaskRunnerId = number | string | symbol

export type TaskRunner = {
  status: TaskRunnerStatus
  data: any
  error: Error | null
  id: TaskRunnerId
  index: number
  run: TaskRunnerRun
}

export type TaskStatus = 'running' | 'paused' | 'stopped'

export type TaskEvent = 'start' | 'pause' | 'stop' | 'clear' | 'push' | 'change'

export type TaskRunnerEvent = 'runner:start' | 'runner:success' | 'runner:error' | 'runner:end'

export interface TaskListener {
  start: (time: number) => void
  pause: (time: number) => void
  stop: (time: number) => void
  clear: (runners: TaskRunner[]) => void
  push: (runner: TaskRunner) => void
  change: (runners: TaskRunner[]) => void
  'runner:start': (runner: TaskRunner) => void
  'runner:success': (runner: TaskRunner) => void
  'runner:error': (runner: TaskRunner) => void
  'runner:end': (runner: TaskRunner) => void
}

export default class Task {
  private readonly interval: number
  private readonly includeAsyncTime: boolean
  private readonly adapter: TimerAdapter
  private readonly eventHub: EventHub
  private timer: Timer | null = null
  public readonly list: Map<TaskRunnerId, TaskRunner> = new Map()
  public status: TaskStatus
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
  query(): TaskRunner[]
  query(TaskRunnerId: TaskRunnerId): TaskRunner | null
  query(TaskRunnerId?: TaskRunnerId): TaskRunner[] | TaskRunner | null {
    if (TaskRunnerId !== undefined) {
      return this.list.get(TaskRunnerId) || null
    } else {
      return [...this.list.values()].map((task) => task)
    }
  }
  push(TaskRunnerId: TaskRunnerId, run: TaskRunnerRun) {
    if (this.list.has(TaskRunnerId)) {
      throw new Error(`Task "${TaskRunnerId.toString()}" already exists`)
    }
    this.list.set(TaskRunnerId, {
      status: 'pending',
      data: null,
      error: null,
      id: TaskRunnerId,
      index: this.list.size,
      run
    })
    this.eventHub.emit('push', this.list.get(TaskRunnerId))
    this.status === 'running' && this.timer?.start()
    this.eventHub.emit('change', this.list)
  }

  start() {
    if (this.status === 'running') return
    if (!this.timer) {
      this.timer = new Timer(
        async () => {
          const runner = [...this.list.values()].find(({ status }) => status === 'pending')
          if (!runner) return
          try {
            this.list.get(runner!.id)!.status = 'running'
            this.eventHub.emit('runner:start', runner!.id, runner.data)
            this.eventHub.emit('change', this.list)
            await runner.run()
            this.list.get(runner!.id)!.status = 'fulfilled'
            this.list.get(runner!.id)!.data = runner.data
            this.eventHub.emit('runner:success', runner!.id, runner.data)
            this.eventHub.emit('change', this.list)
          } catch (error) {
            this.list.get(runner.id)!.status = 'rejected'
            this.list.get(runner.id)!.error = error as Error
            this.eventHub.emit('runner:error', runner)
            this.eventHub.emit('change', this.list)
          } finally {
            this.eventHub.emit('runner:end', runner)
          }
        },
        {
          adapter: this.adapter,
          interval: this.interval,
          includeAsyncTime: this.includeAsyncTime,
          immediate: true
        }
      )
    }
    this.list.size && this.timer.start()
    this.status = 'running'
    this.eventHub.emit('start', Date.now())
    this.eventHub.emit('change', this.query())
  }
  pause() {
    if (this.status === 'paused') return
    this.timer?.pause()
    this.status = 'paused'
    this.eventHub.emit('pause', Date.now())
    this.eventHub.emit('change', this.query())
  }
  stop() {
    if (this.status === 'stopped') return
    this.timer?.stop()
    this.status = 'stopped'
    this.eventHub.emit('stop', Date.now())
    this.eventHub.emit('change', this.query())
  }
  clear() {
    if (!this.list.size) return
    this.stop()
    this.list.clear()
    this.eventHub.emit('clear', [])
    this.eventHub.emit('change', this.query())
  }
}
