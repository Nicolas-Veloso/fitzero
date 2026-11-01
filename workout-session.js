export const SESSION_STATES = Object.freeze({
  IDLE: 'IDLE',
  PREPARING: 'PREPARING',
  WORK: 'WORK',
  REST: 'REST',
  FINISHED: 'FINISHED'
});

export const PREPARING_SECONDS = 3;
export const REST_SECONDS = 45;

export function parseExercisePrescription(exercise) {
  const description = String(exercise?.series_recomendadas || '').toLowerCase();
  const setsMatch = description.match(/(\d+)\s*séries?/i);
  const sets = setsMatch ? Math.max(1, Number(setsMatch[1])) : 3;
  const timeRange = description.match(/(\d+)\s*(?:a|até|-)\s*(\d+)\s*segundos?/i);
  const singleTime = description.match(/(\d+)\s*segundos?/i);

  if (timeRange || singleTime) {
    return {
      sets,
      kind: 'time',
      seconds: Number(timeRange ? timeRange[2] : singleTime[1])
    };
  }

  const repRange = description.match(/(\d+)\s*(?:a|até|-)\s*(\d+)\s*repetições?/i);
  const singleRep = description.match(/(\d+)\s*repetições?/i);
  const minimum = Number(repRange ? repRange[1] : singleRep ? singleRep[1] : 8);
  const maximum = Number(repRange ? repRange[2] : singleRep ? singleRep[1] : 12);

  return { sets, kind: 'reps', minimum, maximum };
}

export class WorkoutSession {
  constructor() {
    this.reset();
  }

  reset() {
    this.exercises = [];
    this.exerciseIndex = 0;
    this.setNumber = 1;
    this.repetitions = 0;
    this.completedExercises = [];
    this.currentState = SESSION_STATES.IDLE;
    this.paused = false;
    this.remainingMs = null;
    this.deadline = null;
    this.exerciseComplete = false;
    this.endedEarly = false;
  }

  start(exercises, now = Date.now()) {
    if (!Array.isArray(exercises) || exercises.length === 0) return false;
    this.reset();
    this.exercises = [...exercises];
    this._transition(SESSION_STATES.PREPARING, now, PREPARING_SECONDS);
    return true;
  }

  addRepetition() {
    const prescription = this._prescription();
    if (
      this.currentState !== SESSION_STATES.WORK ||
      this.paused ||
      prescription.kind !== 'reps' ||
      this.repetitions >= prescription.maximum
    ) {
      return false;
    }
    this.repetitions += 1;
    return true;
  }

  removeRepetition() {
    const prescription = this._prescription();
    if (this.currentState !== SESSION_STATES.WORK || this.paused || prescription.kind !== 'reps') {
      return false;
    }
    this.repetitions = Math.max(0, this.repetitions - 1);
    return true;
  }

  completeSet(now = Date.now()) {
    const prescription = this._prescription();
    if (
      this.currentState !== SESSION_STATES.WORK ||
      this.paused ||
      prescription.kind !== 'reps' ||
      this.repetitions < prescription.minimum
    ) {
      return false;
    }

    if (this.setNumber >= prescription.sets) {
      this.completedExercises.push(this._currentExercise().nome_popular);
      this.exerciseComplete = true;
      if (this.exerciseIndex === this.exercises.length - 1) {
        this._finish();
        return true;
      }
    } else {
      this.setNumber += 1;
    }

    this.repetitions = 0;
    this._transition(SESSION_STATES.REST, now, REST_SECONDS);
    return true;
  }

  pause(now = Date.now()) {
    if (this.currentState === SESSION_STATES.IDLE || this.currentState === SESSION_STATES.FINISHED || this.paused) {
      return false;
    }
    this.paused = true;
    this.remainingMs = this.deadline === null ? null : Math.max(0, this.deadline - now);
    this.deadline = null;
    return true;
  }

  resume(now = Date.now()) {
    if (!this.paused) return false;
    this.paused = false;
    if (this.remainingMs !== null) {
      this.deadline = now + this.remainingMs;
    }
    this.remainingMs = null;
    return true;
  }

  skipExercise(now = Date.now()) {
    if (this.currentState === SESSION_STATES.IDLE || this.currentState === SESSION_STATES.FINISHED) {
      return false;
    }
    if (this.exerciseIndex >= this.exercises.length - 1) {
      this._finish();
      return true;
    }
    this.exerciseIndex += 1;
    this.setNumber = 1;
    this.repetitions = 0;
    this.exerciseComplete = false;
    this.paused = false;
    this.remainingMs = null;
    this._transition(SESSION_STATES.PREPARING, now, PREPARING_SECONDS);
    return true;
  }

  end() {
    if (this.currentState === SESSION_STATES.IDLE || this.currentState === SESSION_STATES.FINISHED) {
      return false;
    }
    this.endedEarly = true;
    this._finish();
    return true;
  }

  tick(now = Date.now()) {
    let transitions = 0;
    while (
      !this.paused &&
      this.deadline !== null &&
      this.deadline <= now &&
      transitions < 20
    ) {
      const transitionAt = this.deadline;
      transitions += 1;

      if (this.currentState === SESSION_STATES.PREPARING) {
        const prescription = this._prescription();
        this._transition(
          SESSION_STATES.WORK,
          transitionAt,
          prescription.kind === 'time' ? prescription.seconds : null
        );
      } else if (this.currentState === SESSION_STATES.WORK) {
        this._completeTimedSet(transitionAt);
      } else if (this.currentState === SESSION_STATES.REST) {
        if (this.exerciseComplete) {
          this.exerciseIndex += 1;
          this.setNumber = 1;
          this.repetitions = 0;
          this.exerciseComplete = false;
          this._transition(SESSION_STATES.PREPARING, transitionAt, PREPARING_SECONDS);
        } else {
          const prescription = this._prescription();
          this._transition(
            SESSION_STATES.WORK,
            transitionAt,
            prescription.kind === 'time' ? prescription.seconds : null
          );
        }
      }
    }
    return this.getSnapshot(now);
  }

  getSnapshot(now = Date.now()) {
    const exercise = this._currentExercise();
    const prescription = exercise ? this._prescription() : null;
    let remainingMs = null;
    if (this.paused) {
      remainingMs = this.remainingMs;
    } else if (this.deadline !== null) {
      remainingMs = Math.max(0, this.deadline - now);
    }

    return {
      state: this.currentState,
      paused: this.paused,
      exercise,
      exerciseIndex: this.exerciseIndex,
      exerciseCount: this.exercises.length,
      setNumber: this.setNumber,
      totalSets: prescription ? prescription.sets : 0,
      repetitions: this.repetitions,
      prescription,
      remainingSeconds: remainingMs === null ? null : Math.ceil(remainingMs / 1000),
      completedExercises: [...this.completedExercises],
      endedEarly: this.endedEarly
    };
  }

  _completeTimedSet(now) {
    if (this.setNumber >= this._prescription().sets) {
      this.completedExercises.push(this._currentExercise().nome_popular);
      this.exerciseComplete = true;
      if (this.exerciseIndex === this.exercises.length - 1) {
        this._finish();
        return;
      }
    } else {
      this.setNumber += 1;
    }
    this._transition(SESSION_STATES.REST, now, REST_SECONDS);
  }

  _transition(nextState, now, durationSeconds = null) {
    this.currentState = nextState;
    this.paused = false;
    this.remainingMs = null;
    this.deadline = durationSeconds === null ? null : now + durationSeconds * 1000;
  }

  _finish() {
    this.currentState = SESSION_STATES.FINISHED;
    this.paused = false;
    this.remainingMs = null;
    this.deadline = null;
  }

  _currentExercise() {
    return this.exercises[this.exerciseIndex] || null;
  }

  _prescription() {
    const exercise = this._currentExercise();
    return exercise ? parseExercisePrescription(exercise) : { sets: 0, kind: 'reps', minimum: 0, maximum: 0 };
  }
}