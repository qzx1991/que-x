export class IdGenerator {
  private id = 0;
  private id_can_used: number[] = [];

  getId(): number {
    if (this.id_can_used.length > 0) return this.id_can_used.pop()!;
    return ++this.id!;
  }
  // 释放ID
  releaseId(id: number) {
    if (this.id_can_used.length === id - 1) {
      id = 0;
      this.id_can_used = [];
    } else {
      this.id_can_used.push(id);
    }
  }
  clear() {
    this.id_can_used = [];
    this.id = 0;
  }
}
