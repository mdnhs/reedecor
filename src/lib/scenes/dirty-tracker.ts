export class DirtyTracker {
  private changes = 0;
  private cleanAt = 0;

  get revision(): number {
    return this.changes;
  }

  get dirty(): boolean {
    return this.changes !== this.cleanAt;
  }

  touch(): void {
    this.changes += 1;
  }

  clear(revision: number = this.changes): void {
    this.cleanAt = Math.min(revision, this.changes);
  }
}
